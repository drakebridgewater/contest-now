import {
  activeCriteriaFor,
  isEntryInAwardScope,
  isVoteComplete,
  normalizeVoterName,
  scoreKey,
  type Rating,
  type Scores,
  type UpsertBallot,
  type UpsertVote,
  type VoterInfo,
  type VoterState,
  type VoterVote,
} from '@contest/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
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

export async function getVoterState(db: Db, rawVoterName: string): Promise<VoterState> {
  const voterName = normalizeVoterName(rawVoterName);
  const [voteRows, ballotRows] = await Promise.all([
    db.select().from(votes).where(eq(votes.voterName, voterName)),
    db.select().from(awardBallots).where(eq(awardBallots.voterName, voterName)),
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
  if (!settings.votingOpen) throw conflict('Voting is closed');
}

/**
 * Merges the given scores/comment into the voter's vote for the entry.
 * Only keys present in `scores` change; null deletes that criterion's rating.
 */
export async function upsertVote(db: Db, entryId: number, input: UpsertVote): Promise<VoterVote> {
  await assertVotingOpen(db);
  const voterName = normalizeVoterName(input.voterName);
  const entry = await db
    .select()
    .from(entries)
    .where(eq(entries.id, entryId))
    .then((r) => r[0]);
  if (!entry) throw notFound(`Entry ${entryId} not found`);

  const categoryCriteria = await db
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

  return db.transaction(async (tx) => {
    const now = new Date();
    const inserted = await tx
      .insert(votes)
      .values({ voterName, entryId, comment: input.comment ?? '', createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [votes.voterName, votes.entryId],
        set: {
          updatedAt: now,
          ...(input.comment !== undefined ? { comment: input.comment } : {}),
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
    return { scores: scoresFor(inserted.id, scoreRows), comment: inserted.comment };
  });
}

export async function upsertBallot(
  db: Db,
  awardId: string,
  input: UpsertBallot,
): Promise<{ awardId: string; entryId: number }> {
  await assertVotingOpen(db);
  const voterName = normalizeVoterName(input.voterName);
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
    .values({ voterName, awardId, entryId: input.entryId, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [awardBallots.voterName, awardBallots.awardId],
      set: { entryId: input.entryId, updatedAt: now },
    });
  return { awardId, entryId: input.entryId };
}

export async function deleteBallot(db: Db, awardId: string, rawVoterName: string): Promise<void> {
  await assertVotingOpen(db);
  const voterName = normalizeVoterName(rawVoterName);
  await db
    .delete(awardBallots)
    .where(and(eq(awardBallots.awardId, awardId), eq(awardBallots.voterName, voterName)));
}

// ---- admin: voters ------------------------------------------------------------

export async function listVoters(db: Db): Promise<VoterInfo[]> {
  const [voteRows, scoreRows, ballotRows, criterionRows, entryRows] = await Promise.all([
    db.select().from(votes).orderBy(asc(votes.voterName)),
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
  const touch = (name: string, at: Date) => {
    let info = byVoter.get(name);
    if (!info) {
      info = {
        voterName: name,
        voteCount: 0,
        completeVoteCount: 0,
        ballotCount: 0,
        firstActivity: at.toISOString(),
        lastActivity: at.toISOString(),
      };
      byVoter.set(name, info);
    }
    if (at.toISOString() < info.firstActivity) info.firstActivity = at.toISOString();
    if (at.toISOString() > info.lastActivity) info.lastActivity = at.toISOString();
    return info;
  };

  for (const vote of voteRows) {
    const info = touch(vote.voterName, vote.createdAt);
    touch(vote.voterName, vote.updatedAt);
    const scores = scoresFor(vote.id, scoreRows);
    if (Object.keys(scores).length === 0 && vote.comment === '') continue;
    info.voteCount += 1;
    const categoryId = categoryOfEntry.get(vote.entryId);
    if (categoryId && isVoteComplete(scores, activeFor(categoryId))) info.completeVoteCount += 1;
  }
  for (const ballot of ballotRows) {
    const info = touch(ballot.voterName, ballot.createdAt);
    touch(ballot.voterName, ballot.updatedAt);
    info.ballotCount += 1;
  }
  return [...byVoter.values()].sort((a, b) => a.voterName.localeCompare(b.voterName));
}

export async function renameVoter(
  db: Db,
  rawOld: string,
  rawNew: string,
): Promise<{ votes: number; ballots: number }> {
  const oldName = normalizeVoterName(rawOld);
  const newName = normalizeVoterName(rawNew);
  if (oldName === newName) throw badRequest('That is already the voter’s name');
  return db.transaction(async (tx) => {
    const [oldVotes, newVotes, oldBallots, newBallots] = await Promise.all([
      countWhere(tx, votes, eq(votes.voterName, oldName)),
      countWhere(tx, votes, eq(votes.voterName, newName)),
      countWhere(tx, awardBallots, eq(awardBallots.voterName, oldName)),
      countWhere(tx, awardBallots, eq(awardBallots.voterName, newName)),
    ]);
    if (oldVotes + oldBallots === 0) throw notFound(`Voter "${oldName}" not found`);
    if (newVotes + newBallots > 0) throw conflict(`A voter named "${newName}" already exists`);
    await tx.update(votes).set({ voterName: newName }).where(eq(votes.voterName, oldName));
    await tx
      .update(awardBallots)
      .set({ voterName: newName })
      .where(eq(awardBallots.voterName, oldName));
    return { votes: oldVotes, ballots: oldBallots };
  });
}

export async function deleteVoter(
  db: Db,
  rawName: string,
): Promise<{ votes: number; ballots: number }> {
  const voterName = normalizeVoterName(rawName);
  return db.transaction(async (tx) => {
    const deletedVotes = await tx
      .delete(votes)
      .where(eq(votes.voterName, voterName))
      .returning({ id: votes.id });
    const deletedBallots = await tx
      .delete(awardBallots)
      .where(eq(awardBallots.voterName, voterName))
      .returning({ id: awardBallots.id });
    if (deletedVotes.length + deletedBallots.length === 0)
      throw notFound(`Voter "${voterName}" not found`);
    return { votes: deletedVotes.length, ballots: deletedBallots.length };
  });
}

async function countWhere(
  db: Db,
  table: typeof votes | typeof awardBallots,
  where: ReturnType<typeof eq>,
): Promise<number> {
  const row = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(where)
    .then((r) => r[0]);
  return row?.count ?? 0;
}
