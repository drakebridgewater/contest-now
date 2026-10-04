import {
  activeCriteriaFor,
  impliesTasted,
  isEntryInAwardScope,
  isVoteComplete,
  scoreKey,
  type Rating,
  type Scores,
  type UpsertBallot,
  type UpsertVote,
  type VoterInfo,
  type VoterState,
  type VoterVote,
  votingStatus,
} from '@contest/shared';
import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import {
  awardBallots,
  awardCategories,
  awards,
  criteria,
  entries,
  voteScores,
  votes,
} from '../db/schema.ts';
import { badRequest, conflict, notFound } from '../http/errors.ts';
import { getSettings, toCriterion } from './contest.ts';

// ---- reads --------------------------------------------------------------------

export async function getVoterState(db: Db, guestId: string): Promise<VoterState> {
  const [voteRows, ballotRows] = await Promise.all([
    db.select().from(votes).where(eq(votes.guestId, guestId)),
    db.select().from(awardBallots).where(eq(awardBallots.guestId, guestId)),
  ]);
  const scoreRows =
    voteRows.length === 0
      ? []
      : await db
          .select()
          .from(voteScores)
          .where(
            inArray(
              voteScores.voteId,
              voteRows.map((v) => v.id),
            ),
          );

  const state: VoterState = { votes: {}, ballots: {} };
  for (const vote of voteRows) {
    state.votes[String(vote.entryId)] = {
      scores: scoresFor(vote.id, scoreRows),
      comment: vote.comment,
      tasted: vote.tasted,
    };
  }
  for (const ballot of ballotRows) {
    state.ballots[ballot.awardId] = ballot.entryId;
  }
  return state;
}

function scoresFor(voteId: number, rows: (typeof voteScores.$inferSelect)[]): Scores {
  const scores: Scores = {};
  for (const row of rows) {
    if (row.voteId === voteId) scores[scoreKey(row.criterionId)] = row.rating as Rating;
  }
  return scores;
}

// ---- writes -------------------------------------------------------------------

async function assertVotingOpen(db: Db): Promise<void> {
  const settings = await getSettings(db);
  const status = votingStatus(settings);
  if (status === 'closed') throw conflict('Voting is closed');
  if (status === 'scheduled') {
    throw conflict('Voting has not opened yet', { opensAt: settings.votingOpensAt });
  }
}

/**
 * Merges the given scores/comment/tasted into the voter's vote for the entry.
 * Only keys present in `scores` change; null deletes that criterion's rating.
 * Rating anything implies the voter tried it, so a rating also marks it tasted;
 * an explicit `tasted` in the input still wins, which is how it gets cleared.
 */
export async function upsertVote(
  db: Db,
  entryId: number,
  guestId: string,
  input: UpsertVote,
): Promise<VoterVote> {
  await assertVotingOpen(db);
  const entry = await db
    .select()
    .from(entries)
    .where(eq(entries.id, entryId))
    .then((r) => r[0]);
  if (!entry) throw notFound(`Entry ${entryId} not found`);

  const categoryCriteria =
    entry.categoryId === null
      ? []
      : await db
          .select()
          .from(criteria)
          .where(eq(criteria.categoryId, entry.categoryId))
          .then((rows) => rows.map(toCriterion));
  const active = activeCriteriaFor(categoryCriteria, entry.categoryId);
  const activeIds = new Set(active.map((c) => scoreKey(c.id)));

  const scoreUpdates = Object.entries(input.scores ?? {});
  for (const [key] of scoreUpdates) {
    if (!activeIds.has(key)) {
      throw badRequest(`Criterion ${key} is not rateable for this entry`, { criterionId: key });
    }
  }

  const tasted = input.tasted ?? (impliesTasted(input.scores) || undefined);

  return db.transaction(async (tx) => {
    const now = new Date();
    const inserted = await tx
      .insert(votes)
      .values({
        guestId,
        entryId,
        comment: input.comment ?? '',
        tasted: tasted ?? false,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [votes.guestId, votes.entryId],
        set: {
          updatedAt: now,
          ...(input.comment !== undefined ? { comment: input.comment } : {}),
          ...(tasted !== undefined ? { tasted } : {}),
        },
      })
      .returning()
      .then((r) => r[0]!);

    for (const [key, rating] of scoreUpdates) {
      const criterionId = Number(key);
      if (rating === null) {
        await tx
          .delete(voteScores)
          .where(and(eq(voteScores.voteId, inserted.id), eq(voteScores.criterionId, criterionId)));
      } else {
        await tx
          .insert(voteScores)
          .values({ voteId: inserted.id, criterionId, rating })
          .onConflictDoUpdate({
            target: [voteScores.voteId, voteScores.criterionId],
            set: { rating },
          });
      }
    }

    const scoreRows = await tx.select().from(voteScores).where(eq(voteScores.voteId, inserted.id));
    const scores = scoresFor(inserted.id, scoreRows);
    // Clearing the last star does not un-taste; only an explicit `tasted: false` does.
    return { scores, comment: inserted.comment, tasted: inserted.tasted };
  });
}

export async function upsertBallot(
  db: Db,
  awardId: string,
  guestId: string,
  input: UpsertBallot,
): Promise<{ awardId: string; entryId: number }> {
  await assertVotingOpen(db);
  const award = await db
    .select()
    .from(awards)
    .where(eq(awards.id, awardId))
    .then((r) => r[0]);
  if (!award || !award.isActive) throw notFound(`Award "${awardId}" not found`);
  const entry = await db
    .select()
    .from(entries)
    .where(eq(entries.id, input.entryId))
    .then((r) => r[0]);
  if (!entry) throw notFound(`Entry ${input.entryId} not found`);
  const scope = await db
    .select({ categoryId: awardCategories.categoryId })
    .from(awardCategories)
    .where(eq(awardCategories.awardId, awardId));
  if (!isEntryInAwardScope({ categoryIds: scope.map((s) => s.categoryId) }, entry)) {
    throw badRequest(`"${entry.entryName}" is not eligible for ${award.name}`);
  }
  const now = new Date();
  await db
    .insert(awardBallots)
    .values({ guestId, awardId, entryId: input.entryId, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [awardBallots.guestId, awardBallots.awardId],
      set: { entryId: input.entryId, updatedAt: now },
    });
  return { awardId, entryId: input.entryId };
}

export async function deleteBallot(db: Db, awardId: string, guestId: string): Promise<void> {
  await assertVotingOpen(db);
  await db
    .delete(awardBallots)
    .where(and(eq(awardBallots.awardId, awardId), eq(awardBallots.guestId, guestId)));
}

// ---- admin: voters ------------------------------------------------------------

/** Voting activity per guest, for the admin Guests tab. */
export async function listVoters(db: Db): Promise<VoterInfo[]> {
  const [voteRows, scoreRows, ballotRows, criterionRows, entryRows] = await Promise.all([
    db.select().from(votes),
    db.select().from(voteScores),
    db.select().from(awardBallots),
    db
      .select()
      .from(criteria)
      .then((rows) => rows.map(toCriterion)),
    db.select({ id: entries.id, categoryId: entries.categoryId }).from(entries),
  ]);
  const categoryOfEntry = new Map(entryRows.map((e) => [e.id, e.categoryId] as const));
  const activeByCategory = new Map<string, ReturnType<typeof activeCriteriaFor>>();
  const activeFor = (categoryId: string) => {
    let list = activeByCategory.get(categoryId);
    if (!list) {
      list = activeCriteriaFor(criterionRows, categoryId);
      activeByCategory.set(categoryId, list);
    }
    return list;
  };

  const byVoter = new Map<string, VoterInfo>();
  const touch = (guestId: string, at: Date) => {
    let info = byVoter.get(guestId);
    if (!info) {
      info = {
        guestId,
        voteCount: 0,
        completeVoteCount: 0,
        tastedCount: 0,
        ballotCount: 0,
        firstActivity: at.toISOString(),
        lastActivity: at.toISOString(),
      };
      byVoter.set(guestId, info);
    }
    if (at.toISOString() < info.firstActivity) info.firstActivity = at.toISOString();
    if (at.toISOString() > info.lastActivity) info.lastActivity = at.toISOString();
    return info;
  };

  for (const vote of voteRows) {
    const info = touch(vote.guestId, vote.createdAt);
    touch(vote.guestId, vote.updatedAt);
    if (vote.tasted) info.tastedCount += 1;
    const scores = scoresFor(vote.id, scoreRows);
    if (Object.keys(scores).length === 0 && vote.comment === '') continue;
    info.voteCount += 1;
    const categoryId = categoryOfEntry.get(vote.entryId);
    if (categoryId && isVoteComplete(scores, activeFor(categoryId))) info.completeVoteCount += 1;
  }
  for (const ballot of ballotRows) {
    const info = touch(ballot.guestId, ballot.createdAt);
    touch(ballot.guestId, ballot.updatedAt);
    info.ballotCount += 1;
  }
  return [...byVoter.values()];
}
