import type { AwardResults } from '@contest/shared';
import { Trophy } from 'lucide-react';
import { Card } from '../ui/Card.tsx';

export function AwardsTab({ awards }: { awards: AwardResults[] }) {
  if (awards.length === 0) {
    return <p className="text-ink-muted">No awards yet. Add one under Setup.</p>;
  }

  return (
    <div className="space-y-4">
      {awards.map(({ award, tally, totalBallots, winnerEntryIds }) => {
        const winners = tally.filter((row) => winnerEntryIds.includes(row.entry.id));
        return (
          <Card key={award.id} className="p-4">
            <header className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">
                {award.emoji || '🏆'}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold">
                  {award.name}
                  {!award.isActive ? (
                    <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-xs font-semibold text-ink-muted">
                      Hidden
                    </span>
                  ) : null}
                </h2>
                <p className="text-sm text-ink-muted">
                  {totalBallots} {totalBallots === 1 ? 'nomination' : 'nominations'}
                </p>
              </div>
            </header>

            {winners.length > 0 ? (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p className="flex items-center gap-1.5 text-sm font-bold text-amber-900">
                  <Trophy className="size-4" aria-hidden="true" />
                  {winners.length > 1 ? `Tied (${winners.length} entries)` : 'Winner'}
                </p>
                <ul className="mt-2 space-y-2">
                  {winners.map(({ entry, count }) => (
                    <li key={entry.id} className="flex items-center gap-3">
                      <img
                        src={entry.photoUrl}
                        alt=""
                        loading="lazy"
                        className="size-12 rounded-lg object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{entry.entryName}</p>
                        <p className="truncate text-sm text-ink-muted">
                          {entry.contestantName} · {count} {count === 1 ? 'vote' : 'votes'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">Nobody has nominated an entry yet.</p>
            )}

            {tally.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {tally.map(({ entry, count }) => {
                  const percent = totalBallots > 0 ? (count / totalBallots) * 100 : 0;
                  return (
                    <li key={entry.id} className="flex items-center gap-2 text-sm">
                      <span className="w-32 truncate sm:w-48">{entry.entryName}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/10">
                        <span
                          className="block h-full rounded-full bg-accent-500"
                          style={{ width: `${percent}%` }}
                        />
                      </span>
                      <span className="w-6 text-right font-semibold">{count}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
