import {
  COMMENT_MAX,
  isVoteComplete,
  ratedCriteriaCount,
  scoreKey,
  type Criterion,
  type Entry,
  type Rating,
  type VoterVote,
} from '@contest/shared';
import { Check, CircleDashed, Square, SquareCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { AllergenBadges } from '../AllergenBadges.tsx';
import { TextAreaField } from '../ui/Field.tsx';
import { StarRating } from './StarRating.tsx';

export function VoteCard({
  entry,
  criteria,
  vote,
  disabled = false,
  onScoreChange,
  onCommentChange,
  onCommentFlush,
  onTastedChange,
}: {
  entry: Entry;
  criteria: Criterion[];
  vote: VoterVote | undefined;
  disabled?: boolean;
  onScoreChange: (criterionId: number, rating: Rating | null) => void;
  onCommentChange: (comment: string) => void;
  onCommentFlush: () => void;
  onTastedChange: (tasted: boolean) => void;
}) {
  const [saved, setSaved] = useState(false);
  const scores = vote?.scores;
  const complete = isVoteComplete(scores, criteria);
  const rated = ratedCriteriaCount(scores, criteria);
  const tasted = vote?.tasted ?? false;
  const TastedIcon = tasted ? SquareCheck : Square;

  const status = complete
    ? {
        label: 'Rated',
        className: 'border-accent-500/40 bg-accent-100 text-accent-700',
        Icon: Check,
      }
    : rated > 0
      ? {
          label: `${rated} of ${criteria.length}`,
          className: 'border-amber-300 bg-amber-50 text-amber-900',
          Icon: TriangleAlert,
        }
      : {
          label: 'Not rated',
          className: 'border-black/10 bg-surface-muted text-ink-muted',
          Icon: CircleDashed,
        };

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <article
      className={`rounded-card border bg-surface shadow-sm ${complete ? 'border-accent-500/40' : 'border-black/5'}`}
    >
      <img
        src={entry.photoUrl}
        alt={entry.entryName}
        loading="lazy"
        className="aspect-4/3 w-full rounded-t-[calc(var(--radius-card)-1px)] object-cover"
      />

      <div className="space-y-4 p-4">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg leading-tight font-bold">{entry.entryName}</h3>
            <p className="text-sm text-ink-muted">by {entry.contestantName}</p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${status.className}`}
          >
            <status.Icon className="size-3.5" aria-hidden="true" />
            {status.label}
          </span>
        </header>

        <AllergenBadges ids={entry.allergens} />

        <button
          type="button"
          aria-pressed={tasted}
          disabled={disabled}
          onClick={() => {
            onTastedChange(!tasted);
            flash();
          }}
          className={`tap-target flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            tasted
              ? 'border-accent-500/40 bg-accent-100 text-accent-700'
              : 'border-black/15 bg-surface-muted text-ink-muted hover:bg-black/5'
          }`}
        >
          <TastedIcon className="size-5 shrink-0" aria-hidden="true" />
          {tasted ? 'Tasted' : 'Mark as tasted'}
        </button>

        <div className="space-y-4">
          {criteria.map((criterion) => (
            <StarRating
              key={criterion.id}
              label={criterion.name}
              help={criterion.helpText}
              value={scores?.[scoreKey(criterion.id)] as Rating | undefined}
              disabled={disabled}
              onChange={(rating) => {
                onScoreChange(criterion.id, rating);
                flash();
              }}
            />
          ))}
          {criteria.length === 0 ? (
            <p className="text-sm text-ink-muted">
              This category has no rating criteria yet, so there is nothing to score.
            </p>
          ) : null}
        </div>

        <TextAreaField
          label="Comment (optional)"
          help="Saved when you tap away. The host sees this with the results."
          rows={2}
          maxLength={COMMENT_MAX}
          disabled={disabled}
          value={vote?.comment ?? ''}
          onChange={(event) => onCommentChange(event.target.value)}
          onBlur={() => {
            onCommentFlush();
            flash();
          }}
        />

        <p
          className={`text-sm font-semibold text-accent-700 transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`}
          aria-live="polite"
        >
          {saved ? 'Saved ✓' : ' '}
        </p>
      </div>
    </article>
  );
}
