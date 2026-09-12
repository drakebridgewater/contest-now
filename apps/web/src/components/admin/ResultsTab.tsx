import {
  hasLowVotes,
  RATING_VALUES,
  type CategoryResults,
  type EntryResult,
} from '@contest/shared';
import { ChevronDown, Medal, Trash2, TriangleAlert, Utensils } from 'lucide-react';
import { useState } from 'react';
import { AllergenBadges } from '../AllergenBadges.tsx';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';

/**
 * `compact` drops the "(tie)" wording for the collapsed header, where the entry's
 * name needs every pixel; the expanded body says it in full instead.
 */
function RankBadge({
  rank,
  tied,
  rated,
  compact = false,
}: {
  rank: number;
  tied: boolean;
  rated: boolean;
  compact?: boolean;
}) {
  // Nothing has been rated yet, so there is no standing to report. Without this every
  // entry in a fresh contest reads "#1 (tie)": rankEntries ties on overall AND
  // voteCount, and with no votes those are 0 and 0 for all of them.
  if (!rated) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border border-black/10 bg-surface-muted px-2 py-1 text-sm font-bold text-ink-muted">
        —
      </span>
    );
  }
  const medal =
    rank === 1
      ? 'bg-amber-100 text-amber-900 border-amber-300'
      : 'bg-surface-muted text-ink-muted border-black/10';
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-sm font-bold ${medal}`}
    >
      {rank === 1 ? <Medal className="size-4" aria-hidden="true" /> : null}#{rank}
      {tied && !compact ? <span className="font-normal">(tie)</span> : null}
    </span>
  );
}

function CriterionBar({
  name,
  average,
  distribution,
  votes,
}: {
  name: string;
  average: number;
  distribution: Record<number, number>;
  votes: number;
}) {
  return (
    <div className="rounded-lg bg-surface-muted p-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-semibold">{name}</p>
        {/* With no counted votes the average is 0 by construction, which would read as
            a score of zero rather than as the absence of one. */}
        <p className="text-sm font-bold text-brand-700">{votes > 0 ? average.toFixed(1) : '—'}</p>
      </div>
      <div className="mt-1 space-y-0.5">
        {[...RATING_VALUES].reverse().map((star) => {
          const count = distribution[star] ?? 0;
          const percent = votes > 0 ? (count / votes) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-1.5 text-xs">
              <span className="w-6 text-ink-muted">{star}★</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
                <span
                  className="block h-full rounded-full bg-brand-500"
                  style={{ width: `${percent}%` }}
                />
              </span>
              <span className="w-4 text-right text-ink-muted">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultCard({
  entry,
  criteriaNames,
  tied,
  expanded,
  onExpandedChange,
  onDelete,
}: {
  entry: EntryResult;
  criteriaNames: Map<number, string>;
  tied: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onDelete: (entry: EntryResult) => void;
}) {
  const rated = entry.voteCount > 0;
  const lowVotes = hasLowVotes(entry.voteCount);

  /*
   * Spelled out rather than left to the accessible-name algorithm: the header's
   * children are inline spans, so the computed name would run them together as
   * "#1Bourbon Pecan Pie4.326 votes".
   */
  const label = `${entry.entryName}, ${
    rated
      ? `rank ${entry.rank}${tied ? ' (tie)' : ''}, score ${entry.overall.toFixed(2)}, ${entry.voteCount} ${entry.voteCount === 1 ? 'vote' : 'votes'}`
      : 'no votes yet'
  }`;

  return (
    <Card>
      <h3>
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={label}
          onClick={() => onExpandedChange(!expanded)}
          className="flex w-full items-center gap-2 rounded-card p-2 text-left hover:bg-black/[0.02]"
        >
          {/* Decorative: the entry name sits right beside it. */}
          <img
            src={entry.photoUrl}
            alt=""
            loading="lazy"
            className="size-10 shrink-0 rounded-lg object-cover"
          />
          <RankBadge rank={entry.rank} tied={tied} rated={rated} compact />
          <span className="min-w-0 flex-1 truncate font-bold">{entry.entryName}</span>
          <span className="shrink-0 text-right">
            <span
              className={`block text-lg leading-tight font-bold ${rated ? 'text-brand-700' : 'text-ink-muted'}`}
            >
              {rated ? entry.overall.toFixed(2) : '—'}
            </span>
            {rated ? (
              <span
                className={`flex items-center justify-end gap-0.5 text-xs ${
                  lowVotes ? 'font-semibold text-amber-700' : 'text-ink-muted'
                }`}
              >
                {lowVotes ? <TriangleAlert className="size-3.5" aria-hidden="true" /> : null}
                {entry.voteCount} {entry.voteCount === 1 ? 'vote' : 'votes'}
              </span>
            ) : (
              <span className="block text-xs text-ink-muted">No votes</span>
            )}
          </span>
          <ChevronDown
            className={`size-5 shrink-0 text-ink-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </h3>

      {expanded ? (
        <div className="space-y-3 p-4 pt-1">
          <p className="text-sm text-ink-muted">
            by {entry.contestantName}
            {/* The compact header badge drops this, so it is said here instead. */}
            {rated && tied ? ` · tied at #${entry.rank}` : ''}
          </p>

          {lowVotes ? (
            <p className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">
              Only {entry.voteCount} {entry.voteCount === 1 ? 'vote' : 'votes'} counted so far, so
              this score can still move a lot.
            </p>
          ) : null}

          <details className="rounded-lg border border-black/10 p-2">
            <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold">
              <Utensils className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
              Tasted by {entry.tastedCount}
              {entry.tastedCount === 1 ? ' guest' : ' guests'}
            </summary>
            {entry.tasters.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">Nobody has marked this tasted yet.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {entry.tasters.map((taster) => (
                  <li
                    key={taster}
                    className="rounded-full bg-surface-muted px-2 py-0.5 text-sm capitalize"
                  >
                    {taster}
                  </li>
                ))}
              </ul>
            )}
          </details>

          {entry.partialVoteCount > 0 ? (
            <p className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">
              {entry.partialVoteCount} part-finished{' '}
              {entry.partialVoteCount === 1 ? 'rating is' : 'ratings are'} not counted yet.
            </p>
          ) : null}

          <AllergenBadges ids={entry.allergens} />

          <div className="grid gap-2 sm:grid-cols-3">
            {entry.criteria.map((stat) => (
              <CriterionBar
                key={stat.criterionId}
                name={criteriaNames.get(stat.criterionId) ?? 'Criterion'}
                average={stat.average}
                distribution={stat.distribution}
                votes={entry.voteCount}
              />
            ))}
          </div>

          {entry.comments.length > 0 ? (
            <details className="rounded-lg border border-black/10 p-2">
              <summary className="cursor-pointer text-sm font-semibold">
                {entry.comments.length} {entry.comments.length === 1 ? 'comment' : 'comments'}
              </summary>
              <ul className="mt-2 space-y-2">
                {entry.comments.map((comment, index) => (
                  <li key={index} className="rounded-lg bg-surface-muted p-2 text-sm">
                    <p className="font-semibold text-brand-700">{comment.voterName}</p>
                    <p>{comment.comment}</p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <Button
            size="sm"
            variant="ghost"
            className="text-red-700"
            onClick={() => onDelete(entry)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete entry
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

export function ResultsTab({
  results,
  onDeleteEntry,
}: {
  results: CategoryResults[];
  onDeleteEntry: (entry: EntryResult) => void;
}) {
  // Empty means every card is shut, which is the default we want: a host opening
  // Results on a phone wants the standings, not fifteen histograms.
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  if (results.length === 0) {
    return <p className="text-ink-muted">No categories yet. Add one under Setup.</p>;
  }

  const allEntries = results.flatMap((category) => category.entries);
  const allExpanded = allEntries.length > 0 && allEntries.every((entry) => expanded[entry.id]);

  return (
    <div className="space-y-8">
      {allEntries.length > 0 ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setExpanded(Object.fromEntries(allEntries.map((entry) => [entry.id, !allExpanded])))
            }
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </Button>
        </div>
      ) : null}

      {results.map((category) => {
        const names = new Map(category.criteria.map((c) => [c.id, c.name] as const));
        const rankCounts = new Map<number, number>();
        for (const entry of category.entries) {
          rankCounts.set(entry.rank, (rankCounts.get(entry.rank) ?? 0) + 1);
        }
        return (
          <section key={category.category.id} className="space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <span aria-hidden="true">{category.category.emoji}</span>
              {category.category.name}
              {!category.category.isActive ? (
                <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-semibold text-ink-muted">
                  Hidden
                </span>
              ) : null}
            </h2>
            {category.entries.length === 0 ? (
              <p className="text-ink-muted">No entries in this category.</p>
            ) : (
              <div className="space-y-3">
                {category.entries.map((entry) => (
                  <ResultCard
                    key={entry.id}
                    entry={entry}
                    criteriaNames={names}
                    tied={(rankCounts.get(entry.rank) ?? 0) > 1}
                    expanded={expanded[entry.id] ?? false}
                    onExpandedChange={(value) =>
                      setExpanded((previous) => ({ ...previous, [entry.id]: value }))
                    }
                    onDelete={onDeleteEntry}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
