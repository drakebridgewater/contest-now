import {
  activeCriteriaFor,
  isEntryInAwardScope,
  isVoteComplete,
  rankEntries,
  summarizeEntry,
  tallyBallots,
  type AwardResults,
  type CategoryResults,
  type ContestResults,
  type Entry,
  type VoterVote,
} from '@contest/shared';
import { asc } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import {
  awardBallots,
  awardCategories,
  awards,
  categories,
  criteria,
  entries,
  voteScores,
  votes,
} from '../db/schema.ts';
import { toAward, toCategory, toCriterion } from './contest.ts';
import { toEntry, type PhotoStorage } from './entries.ts';

export async function computeResults(db: Db, storage: PhotoStorage): Promise<ContestResults> {
  const [
    categoryRows,
    criterionRows,
    awardRows,
    scopeRows,
    entryRows,
    voteRows,
    scoreRows,
    ballotRows,
  ] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id)),
    db.select().from(criteria),
    db.select().from(awards).orderBy(asc(awards.sortOrder), asc(awards.id)),
    db.select().from(awardCategories),
    db.select().from(entries),
    db.select().from(votes),
    db.select().from(voteScores),
    db.select().from(awardBallots),
  ]);

  const allCriteria = criterionRows.map(toCriterion);
  const allEntries = entryRows.map((row) => toEntry(row, storage));
  const entryById = new Map(allEntries.map((e) => [e.id, e] as const));

  // votes grouped by entry, with their scores
  const scoresByVote = new Map<number, Record<string, 1 | 2 | 3 | 4 | 5>>();
  for (const score of scoreRows) {
    let scores = scoresByVote.get(score.voteId);
    if (!scores) {
      scores = {};
      scoresByVote.set(score.voteId, scores);
    }
    scores[String(score.criterionId)] = score.rating as 1 | 2 | 3 | 4 | 5;
  }
  const votesByEntry = new Map<number, { voterName: string; vote: VoterVote }[]>();
  for (const row of voteRows) {
    const list = votesByEntry.get(row.entryId) ?? [];
    list.push({
      voterName: row.voterName,
      vote: { scores: scoresByVote.get(row.id) ?? {}, comment: row.comment },
    });
    votesByEntry.set(row.entryId, list);
  }

  let completeVoteCount = 0;
  const categoryResults: CategoryResults[] = categoryRows.map((categoryRow) => {
    const category = toCategory(categoryRow);
    const activeCriteria = activeCriteriaFor(allCriteria, category.id);
    const summarized = allEntries
      .filter((entry) => entry.categoryId === category.id)
      .map((entry) => {
        const entryVotes = votesByEntry.get(entry.id) ?? [];
        const summary = summarizeEntry(
          activeCriteria,
          entryVotes.map((v) => v.vote),
        );
        completeVoteCount += summary.voteCount;
        const comments = entryVotes
          .filter((v) => v.vote.comment.trim() !== '')
          .map((v) => ({ voterName: v.voterName, comment: v.vote.comment.trim() }));
        return { ...entry, ...summary, comments };
      });
    return { category, criteria: activeCriteria, entries: rankEntries(summarized) };
  });

  const awardResults: AwardResults[] = awardRows.map((awardRow) => {
    const award = toAward(
      awardRow,
      scopeRows.filter((s) => s.awardId === awardRow.id).map((s) => s.categoryId),
    );
    const eligible = ballotRows.filter((b) => {
      if (b.awardId !== award.id) return false;
      const entry = entryById.get(b.entryId);
      return entry !== undefined && isEntryInAwardScope(award, entry);
    });
    const tally = tallyBallots(eligible);
    const tallyRows = [...tally.counts.entries()]
      .map(([entryId, count]) => ({ entry: entryById.get(entryId) as Entry, count }))
      .filter((row) => row.entry !== undefined)
      .sort((a, b) => b.count - a.count || a.entry.entryName.localeCompare(b.entry.entryName));
    return {
      award,
      totalBallots: tally.totalBallots,
      tally: tallyRows,
      winnerEntryIds: tally.winnerEntryIds,
    };
  });

  const voterNames = new Set<string>();
  for (const row of voteRows) {
    const entry = entryById.get(row.entryId);
    const active = entry ? activeCriteriaFor(allCriteria, entry.categoryId) : [];
    if (isVoteComplete(scoresByVote.get(row.id), active) || row.comment !== '')
      voterNames.add(row.voterName);
    else if (scoresByVote.has(row.id)) voterNames.add(row.voterName);
  }
  for (const row of ballotRows) voterNames.add(row.voterName);

  return {
    categories: categoryResults,
    awards: awardResults,
    summary: {
      voterCount: voterNames.size,
      entryCount: allEntries.length,
      completeVoteCount,
      ballotCount: ballotRows.length,
    },
  };
}
