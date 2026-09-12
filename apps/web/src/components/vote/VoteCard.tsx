import {
  COMMENT_MAX,
  ratedCriteriaCount,
  scoreKey,
  voterScore,
  type Criterion,
  type Entry,
  type Rating,
  type VoterVote,
} from '@contest/shared';
import { ChevronUp, MessageSquarePlus, Pencil, Square, SquareCheck, Star } from 'lucide-react';
import { useState } from 'react';
import { AllergenBadges } from '../AllergenBadges.tsx';
import { Button } from '../ui/Button.tsx';
import { TextAreaField } from '../ui/Field.tsx';
import { StarRating } from './StarRating.tsx';

export function VoteCard({
  entry,
  criteria,
  vote,
  disabled = false,
  collapsed = false,
  onCollapsedChange,
  onScoreChange,
  onCommentChange,
  onCommentFlush,
  onTastedChange,
}: {
  entry: Entry;
  criteria: Criterion[];
  vote: VoterVote | undefined;
  disabled?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onScoreChange: (criterionId: number, rating: Rating | null) => void;
  onCommentChange: (comment: string) => void;
  onCommentFlush: () => void;
  onTastedChange: (tasted: boolean) => void;
}) {
  const [saved, setSaved] = useState(false);
  // One-way for the life of the card: deleting what you typed must not pull the
  // box out from under you, and reopening the card keeps it where you left it.
  const [commentOpen, setCommentOpen] = useState(false);
  const scores = vote?.scores;
  const score = voterScore(scores, criteria);
  const complete = score !== null;
  const rated = ratedCriteriaCount(scores, criteria);
  const tasted = vote?.tasted ?? false;
  const comment = vote?.comment ?? '';

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  /**
   * Tasting and rating are independent — you can rate a dish and then clear the
   * mark — so the icon reports tasted and the text reports rating progress.
   * Tapping anywhere on it toggles tasted, as the old full-width button did.
   */
  const StatusIcon = tasted ? SquareCheck : Square;
  const statusClass = complete
    ? 'border-accent-500/40 bg-accent-100 text-accent-700'
    : rated > 0
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : tasted
        ? 'border-accent-500/40 bg-accent-100 text-accent-700'
        : 'border-black/10 bg-surface-muted text-ink-muted';

  /**
   * `compact` drops the tasted wording, which the box itself already says, so the
   * collapsed row can spend that width on the entry's name instead. The expanded
   * card keeps the words: there it is the primary control, not a marker.
   */
  function statusPill(compact: boolean) {
    return (
      <button
        type="button"
        aria-pressed={tasted}
        aria-label={tasted ? 'Tasted' : 'Mark as tasted'}
        disabled={disabled}
        onClick={() => {
          onTastedChange(!tasted);
          flash();
        }}
        className={`inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${statusClass}`}
      >
        <StatusIcon className="size-4 shrink-0" aria-hidden="true" />
        {complete ? (
          <>
            {score.toFixed(1)}
            <Star className="size-3 fill-current" aria-hidden="true" />
          </>
        ) : rated > 0 ? (
          `${rated} of ${criteria.length}`
        ) : compact ? null : tasted ? (
          'Tasted'
        ) : (
          'Not tasted'
        )}
      </button>
    );
  }

  // `min-w-0` on the row is load-bearing: a grid item defaults to min-width:auto,
  // so without it this single flex line refuses to shrink below its own content and
  // blows the column out sideways instead of letting the title truncate.
  if (collapsed) {
    return (
      <article className="flex min-w-0 items-center gap-3 rounded-card border border-black/5 bg-surface p-2 shadow-sm">
        <img
          src={entry.photoUrl}
          alt={entry.entryName}
          loading="lazy"
          className="size-14 shrink-0 rounded-lg object-cover"
        />
        {/* The contestant name is dropped here on purpose: at 375px the row has no
            second line to give it, and the expanded card still carries it. */}
        <h3 className="min-w-0 flex-1 truncate leading-tight font-bold">{entry.entryName}</h3>
        {statusPill(true)}
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 px-2"
          aria-expanded={false}
          /* Named after the entry: a page of cards otherwise offers a dozen
             buttons all called "Edit". */
          aria-label={`Edit ${entry.entryName}`}
          onClick={() => onCollapsedChange?.(false)}
        >
          <Pencil className="size-4" aria-hidden="true" />
          {/* The word costs ~30px of title on a phone, which is the scarcest space
              on this row; the aria-label carries it regardless. */}
          <span className="hidden sm:inline">Edit</span>
        </Button>
      </article>
    );
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

      <div className="space-y-3 p-4">
        <header className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg leading-tight font-bold">{entry.entryName}</h3>
            <p className="text-sm text-ink-muted">by {entry.contestantName}</p>
          </div>
          {statusPill(false)}
          {onCollapsedChange ? (
            <button
              type="button"
              aria-expanded={true}
              aria-label={`Collapse ${entry.entryName}`}
              onClick={() => onCollapsedChange(true)}
              className="grid min-h-9 w-8 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-black/5"
            >
              <ChevronUp className="size-5" aria-hidden="true" />
            </button>
          ) : null}
        </header>

        <AllergenBadges ids={entry.allergens} />

        <div className="space-y-3">
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

        {/* Most people never comment, so the box stays out of the way until asked
            for. Anything already written is always shown. */}
        {commentOpen || comment !== '' ? (
          <TextAreaField
            label="Comment (optional)"
            help="Saved when you tap away. The host sees this with the results."
            rows={2}
            maxLength={COMMENT_MAX}
            disabled={disabled}
            autoFocus={commentOpen}
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            onBlur={() => {
              onCommentFlush();
              flash();
            }}
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            aria-label={`Add a comment for ${entry.entryName}`}
            onClick={() => setCommentOpen(true)}
            className="tap-target -my-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageSquarePlus className="size-4" aria-hidden="true" />
            Add a comment
          </button>
        )}

        <p
          className={`text-sm font-semibold text-accent-700 transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`}
          aria-live="polite"
        >
          {saved ? 'Saved ✓' : ' '}
        </p>
      </div>
    </article>
  );
}
