import {
  COMMENT_MAX,
  labelFor,
  ratedCriteriaCount,
  scoreKey,
  splitLabels,
  voterScore,
  type Criterion,
  type Entry,
  type Rating,
  type VoterVote,
} from '@contest/shared';
import {
  ChevronDown,
  MessageSquarePlus,
  Square,
  SquareCheck,
  Star,
  TriangleAlert,
} from 'lucide-react';
import { useId, useState } from 'react';
import { AllergenBadges } from '../AllergenBadges.tsx';
import { TextAreaField } from '../ui/Field.tsx';
import { StarRating } from './StarRating.tsx';
import { StarSelect } from './StarSelect.tsx';

/** How an opened card is laid out. A closed card is always the one-line header. */
export type CardLayout = 'large' | 'medium';

export function VoteCard({
  entry,
  criteria,
  vote,
  disabled = false,
  expanded = true,
  onExpandedChange,
  layout = 'large',
  conflicts = [],
  onScoreChange,
  onCommentChange,
  onCommentFlush,
  onTastedChange,
}: {
  entry: Entry;
  criteria: Criterion[];
  vote: VoterVote | undefined;
  disabled?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  layout?: CardLayout;
  /** This entry's allergens that are on the voter's own allergy list. */
  conflicts?: string[];
  onScoreChange: (criterionId: number, rating: Rating | null) => void;
  onCommentChange: (comment: string) => void;
  onCommentFlush: () => void;
  onTastedChange: (tasted: boolean) => void;
}) {
  const bodyId = useId();
  const nameId = useId();
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
  const allergenIds = splitLabels(entry.allergens).allergens;

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  /**
   * Tasting and rating are independent — you can rate a dish and then clear the
   * mark — so the icon reports tasted and the words report rating progress.
   * Tapping it toggles tasted.
   */
  const StatusIcon = tasted ? SquareCheck : Square;
  const statusClass = complete
    ? 'border-accent-500/40 bg-accent-100 text-accent-700'
    : rated > 0
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : tasted
        ? 'border-accent-500/40 bg-accent-100 text-accent-700'
        : 'border-black/10 bg-surface-muted text-ink-muted';
  // The closed row is short on width at 375px, so its wording is shorter.
  const statusText = complete
    ? null
    : rated > 0
      ? expanded
        ? `Partially voted · ${rated}/${criteria.length}`
        : `Partial ${rated}/${criteria.length}`
      : tasted
        ? 'Tasted'
        : 'Not tasted';

  const statusPill = (
    <button
      type="button"
      aria-pressed={tasted}
      aria-label={`${complete ? `Scored ${score.toFixed(1)} stars` : statusText}. ${
        tasted ? 'Tap to unmark tasted' : 'Tap to mark tasted'
      }`}
      disabled={disabled}
      onClick={() => {
        onTastedChange(!tasted);
        flash();
      }}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${statusClass}`}
    >
      <StatusIcon className="size-4 shrink-0" aria-hidden="true" />
      {complete ? (
        <>
          Scored: {score.toFixed(1)}
          <Star className="size-3 fill-current" aria-hidden="true" />
        </>
      ) : (
        statusText
      )}
    </button>
  );

  const allergenMarks =
    allergenIds.length > 0 ? (
      <span className="flex shrink-0 gap-0.5 text-sm" aria-label="Allergens">
        {allergenIds.map((id) => {
          const item = labelFor(id);
          return (
            <span key={id} title={item.label} role="img" aria-label={item.label}>
              {item.emoji}
            </span>
          );
        })}
      </span>
    ) : null;

  // `min-w-0` is load-bearing: a grid item defaults to min-width:auto, so without
  // it this flex line refuses to shrink and the title cannot truncate.
  const header = (
    <div className="flex min-w-0 items-center gap-2 p-2">
      {/* The accordion pattern: a heading wrapping the toggle button. */}
      <h3 className="flex min-w-0 flex-1">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => onExpandedChange?.(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
        >
          {!expanded ? (
            <img
              src={entry.photoUrl}
              alt=""
              loading="lazy"
              className="size-14 shrink-0 rounded-lg object-cover"
            />
          ) : null}
          <span className="min-w-0 flex-1">
            <span id={nameId} className="block truncate leading-tight font-bold">
              {entry.entryName}
            </span>
            {expanded ? (
              <span className="block truncate text-sm text-ink-muted">
                by {entry.contestantName}
              </span>
            ) : null}
          </span>
          {allergenMarks}
          <ChevronDown
            className={`size-5 shrink-0 text-ink-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </h3>
      {statusPill}
    </div>
  );

  const conflictBanner =
    conflicts.length > 0 ? (
      <p
        role="note"
        className="mx-2 mb-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2 py-1.5 text-sm font-semibold text-red-800"
      >
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Contains {conflicts.map((id) => labelFor(id).label).join(', ')} — on your allergy list
      </p>
    ) : null;

  const noCriteria =
    criteria.length === 0 ? (
      <p className="text-sm text-ink-muted">
        This category has no rating criteria yet, so there is nothing to score.
      </p>
    ) : null;

  const changeScore = (criterionId: number, rating: Rating | null) => {
    onScoreChange(criterionId, rating);
    flash();
  };

  const commentAndSaved = (
    <>
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
    </>
  );

  return (
    <article
      aria-labelledby={nameId}
      className={`min-w-0 rounded-card border bg-surface shadow-sm ${complete ? 'border-accent-500/40' : conflicts.length > 0 ? 'border-red-300' : 'border-black/5'}`}
    >
      {header}
      {conflictBanner}
      {expanded ? (
        <div id={bodyId}>
          {layout === 'medium' ? (
            <div className="space-y-2 px-2 pb-2">
              {/* Photo and scores share one fixed height, so every medium card is
                  the same size and a long list of criteria scrolls in place. */}
              <div className="grid h-48 grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <img
                  src={entry.photoUrl}
                  alt={entry.entryName}
                  loading="lazy"
                  className="h-full w-full rounded-lg object-cover"
                />
                <div
                  className="-mr-1 space-y-2 overflow-y-auto overscroll-contain pr-1"
                  data-testid="criteria-scroll"
                >
                  {criteria.map((criterion) => (
                    <StarSelect
                      key={criterion.id}
                      label={criterion.name}
                      help={criterion.helpText}
                      value={scores?.[scoreKey(criterion.id)] as Rating | undefined}
                      disabled={disabled}
                      onChange={(rating) => changeScore(criterion.id, rating)}
                    />
                  ))}
                  {noCriteria}
                </div>
              </div>
              {commentAndSaved}
            </div>
          ) : (
            <>
              <img
                src={entry.photoUrl}
                alt={entry.entryName}
                loading="lazy"
                className="aspect-4/3 w-full object-cover"
              />
              <div className="space-y-3 p-4">
                <AllergenBadges ids={entry.allergens} />
                <div className="space-y-3">
                  {criteria.map((criterion) => (
                    <StarRating
                      key={criterion.id}
                      label={criterion.name}
                      help={criterion.helpText}
                      value={scores?.[scoreKey(criterion.id)] as Rating | undefined}
                      disabled={disabled}
                      onChange={(rating) => changeScore(criterion.id, rating)}
                    />
                  ))}
                  {noCriteria}
                </div>
                {commentAndSaved}
              </div>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}
