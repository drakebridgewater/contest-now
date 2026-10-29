import type { AwardResults } from '@contest/shared';
import { Check, Trophy, TriangleAlert } from 'lucide-react';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';
import { otherWins, type Prize } from './prizes.ts';

/**
 * Every prize with the host's pick, in announcing order. Read off at the
 * ceremony, and where a guest picked for two prizes stands out.
 */
function PrizeList({ prizes }: { prizes: Prize[] }) {
  if (prizes.length === 0) return null;
  const picked = prizes.filter((prize) => prize.winner !== null).length;
  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Trophy className="size-5 text-amber-600" aria-hidden="true" />
        Winners
      </h2>
      <p className="text-sm text-ink-muted">
        {picked} of {prizes.length} picked. Mark a winner under Results for a category, or below for
        an award.
      </p>
      <ul className="mt-3 divide-y divide-black/5">
        {prizes.map((prize) => {
          const repeats = prize.winner
            ? otherWins(prizes, prize.winner.contestantName, prize.key)
            : [];
          return (
            <li key={prize.key} className="flex items-start gap-3 py-2">
              <span className="text-xl" aria-hidden="true">
                {prize.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{prize.name}</p>
                {prize.winner ? (
                  <p className="truncate text-sm">
                    {prize.winner.entryName}{' '}
                    <span className="text-ink-muted">by {prize.winner.contestantName}</span>
                  </p>
                ) : (
                  <p className="text-sm text-ink-muted">Not picked yet</p>
                )}
                {repeats.length > 0 ? (
                  <p className="flex items-center gap-1 text-xs font-semibold text-amber-700">
                    <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                    Also won {repeats.map((r) => r.name).join(', ')}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function AwardsTab({
  awards,
  prizes,
  onSetWinner,
}: {
  awards: AwardResults[];
  prizes: Prize[];
  onSetWinner: (awardId: string, entryId: number | null) => void;
}) {
  if (awards.length === 0) {
    return (
      <div className="space-y-4">
        <PrizeList prizes={prizes} />
        <p className="text-ink-muted">No awards yet. Add one under Setup.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PrizeList prizes={prizes} />
      {awards.map(({ award, tally, totalBallots, winnerEntryIds, chosenWinnerEntryId }) => {
        const leaders = tally.filter((row) => winnerEntryIds.includes(row.entry.id));
        const prizeKey = `award:${award.id}`;
        const chosen = prizes.find((prize) => prize.key === prizeKey)?.winner ?? null;
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

            {chosen ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                <img
                  src={chosen.photoUrl}
                  alt=""
                  loading="lazy"
                  className="size-12 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-amber-900">
                    <Trophy className="size-4" aria-hidden="true" />
                    Winner
                  </p>
                  <p className="truncate font-semibold">{chosen.entryName}</p>
                  <p className="truncate text-sm text-ink-muted">{chosen.contestantName}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => onSetWinner(award.id, null)}>
                  Clear
                </Button>
              </div>
            ) : leaders.length > 0 ? (
              <p className="mt-3 text-sm text-ink-muted">
                {leaders.length > 1
                  ? `Tied for most nominations: ${leaders.map((l) => l.entry.entryName).join(', ')}.`
                  : `Most nominations: ${leaders[0]!.entry.entryName}.`}{' '}
                Pick the winner below.
              </p>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">Nobody has nominated an entry yet.</p>
            )}

            {tally.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {tally.map(({ entry, count }) => {
                  const percent = totalBallots > 0 ? (count / totalBallots) * 100 : 0;
                  const isWinner = entry.id === chosenWinnerEntryId;
                  const alsoWon = otherWins(prizes, entry.contestantName, prizeKey);
                  return (
                    <li key={entry.id} className="flex items-center gap-2 text-sm">
                      <span className="w-32 min-w-0 sm:w-48">
                        <span className="block truncate">{entry.entryName}</span>
                        <span className="block truncate text-xs text-ink-muted">
                          {entry.contestantName}
                        </span>
                        {alsoWon.length > 0 ? (
                          <span className="block truncate text-xs font-semibold text-amber-700">
                            Won {alsoWon.map((p) => p.name).join(', ')}
                          </span>
                        ) : null}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/10">
                        <span
                          className="block h-full rounded-full bg-accent-500"
                          style={{ width: `${percent}%` }}
                        />
                      </span>
                      <span className="w-6 text-right font-semibold">{count}</span>
                      <Button
                        size="sm"
                        variant={isWinner ? 'primary' : 'secondary'}
                        aria-pressed={isWinner}
                        aria-label={`${entry.entryName} wins ${award.name}`}
                        onClick={() => onSetWinner(award.id, isWinner ? null : entry.id)}
                        className="w-24 shrink-0"
                      >
                        {isWinner ? (
                          <>
                            <Check className="size-4" aria-hidden="true" />
                            Winner
                          </>
                        ) : (
                          'Pick'
                        )}
                      </Button>
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
