import { RATING_VALUES, type CategoryResults, type EntryResult } from '@contest/shared';
import { Medal, Trash2 } from 'lucide-react';
import { AllergenBadges } from '../AllergenBadges.tsx';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';

function RankBadge({ rank, tied }: { rank: number; tied: boolean }) {
  const medal =
    rank === 1
      ? 'bg-amber-100 text-amber-900 border-amber-300'
      : 'bg-surface-muted text-ink-muted border-black/10';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm font-bold ${medal}`}
    >
      {rank === 1 ? <Medal className="size-4" aria-hidden="true" /> : null}#{rank}
      {tied ? <span className="font-normal">(tie)</span> : null}
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
        <p className="text-sm font-bold text-brand-700">{average.toFixed(1)}</p>
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
  onDelete,
}: {
  entry: EntryResult;
  criteriaNames: Map<number, string>;
  tied: boolean;
  onDelete: (entry: EntryResult) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="sm:flex">
        <img
          src={entry.photoUrl}
          alt={entry.entryName}
          loading="lazy"
          className="aspect-4/3 w-full object-cover sm:aspect-square sm:w-40"
        />
        <div className="min-w-0 flex-1 space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <RankBadge rank={entry.rank} tied={tied} />
                <h3 className="truncate text-lg font-bold">{entry.entryName}</h3>
              </div>
              <p className="text-sm text-ink-muted">by {entry.contestantName}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-bold text-brand-700">{entry.overall.toFixed(2)}</p>
              <p className="text-xs text-ink-muted">
                {entry.voteCount} {entry.voteCount === 1 ? 'vote' : 'votes'}
              </p>
            </div>
          </div>

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
      </div>
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
  if (results.length === 0) {
    return <p className="text-ink-muted">No categories yet. Add one under Setup.</p>;
  }

  return (
    <div className="space-y-8">
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
