import {
  activeCriteriaFor,
  activeSorted,
  allergenConflicts,
  categoryTerms,
  isVoteComplete,
  votingStatus,
  type Entry,
  type Rating,
} from '@contest/shared';
import { LayoutGrid, ListChecks, LogOut, Rows3, TriangleAlert, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PhaseNotice } from '../components/PhaseNotice.tsx';
import { AwardPicker } from '../components/vote/AwardPicker.tsx';
import { VoteCard, type CardLayout } from '../components/vote/VoteCard.tsx';
import { VoterNameForm } from '../components/vote/VoterNameForm.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { HelpPanel } from '../components/ui/HelpPanel.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { errorMessage } from '../lib/errorMessage.ts';
import { useContest, useEntries } from '../lib/queries.ts';
import { useAutoLogout } from '../lib/useAutoLogout.ts';
import { useDebouncedCallback } from '../lib/useDebouncedCallback.ts';
import { useLocalStorage } from '../lib/useLocalStorage.ts';
import { useNow } from '../lib/useNow.ts';
import { useVoterSession } from '../lib/useVoterSession.ts';
import { needsAttention, NOTHING_HERE, NOTHING_REMAINING } from '../lib/entryFilter.ts';
import { pageTerms, withArticle } from '../lib/terms.ts';

const AUTO_LOGOUT_SECONDS = 60;

/** Cards the voter has opened, plus the voter they belong to. */
interface ExpandedState {
  voter: string;
  ids: ReadonlySet<number>;
}

export function VotePage() {
  const contest = useContest();
  const entriesQuery = useEntries();
  const session = useVoterSession();
  const toast = useToast();

  const [sharedDevice, setSharedDevice] = useLocalStorage('contest.sharedDevice', false);
  const [onlyRemaining, setOnlyRemaining] = useLocalStorage('contest.vote.onlyRemaining', false);
  const [layout, setLayout] = useLocalStorage<CardLayout>('contest.vote.layout', 'large');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showAllergens, setShowAllergens] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedState | null>(null);

  const { secondsRemaining } = useAutoLogout({
    enabled: sharedDevice && session.voterName !== null,
    seconds: AUTO_LOGOUT_SECONDS,
    onLogout: () => void session.signOut(),
  });

  const saveComment = useDebouncedCallback((entryId: number, comment: string) => {
    session.setComment(entryId, comment).catch((error: unknown) => {
      toast.error(errorMessage(error, 'Could not save your comment.'));
    });
  }, 700);

  const categories = activeSorted(contest.data?.categories ?? []);
  const criteria = useMemo(() => contest.data?.criteria ?? [], [contest.data?.criteria]);
  const awards = activeSorted(contest.data?.awards ?? []);
  const settings = contest.data?.settings;
  // Tick every second only while waiting for the opening time, to flip on the dot.
  const scheduled = settings ? votingStatus(settings) === 'scheduled' : false;
  const now = useNow(scheduled);
  // Null until the contest has loaded: assuming "open" would flash the cards
  // up before the countdown replaces them.
  const status = settings ? votingStatus(settings, now) : null;
  const votingOpen = status === 'open';
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data]);
  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name] as const)),
    [categories],
  );
  const termsByCategory = useMemo(
    () => new Map((contest.data?.categories ?? []).map((c) => [c.id, categoryTerms(c)] as const)),
    [contest.data?.categories],
  );
  const termsOf = useMemo(
    () => (entry: Entry) => termsByCategory.get(entry.categoryId) ?? categoryTerms(undefined),
    [termsByCategory],
  );
  const page = pageTerms(categories);

  const voterName = session.voterName;
  const allergies = useMemo(() => session.guest?.allergies ?? [], [session.guest]);
  // Every card starts closed, and only the voter opens or shuts one: nothing
  // snaps shut under a thumb when the last star goes in.
  const openIds: ReadonlySet<number> =
    expanded !== null && expanded.voter === voterName ? expanded.ids : new Set();

  function setCardExpanded(entryId: number, value: boolean) {
    const next = new Set(openIds);
    if (value) next.add(entryId);
    else next.delete(entryId);
    setExpanded({ voter: voterName ?? '', ids: next });
  }

  function setAllExpanded(value: boolean) {
    setExpanded({
      voter: voterName ?? '',
      ids: value ? new Set(entries.map((entry) => entry.id)) : new Set(),
    });
  }

  const conflictsById = useMemo(
    () =>
      new Map(
        entries.map((entry) => [
          entry.id,
          termsOf(entry).allergens ? allergenConflicts(allergies, entry.allergens) : [],
        ]),
      ),
    [entries, allergies, termsOf],
  );

  const progress = useMemo(() => {
    let rated = 0;
    // Tasted and seen are counted apart: "3 of 9 tasted" is wrong for costumes.
    const marks = { Tasted: { done: 0, total: 0 }, Seen: { done: 0, total: 0 } };
    for (const entry of entries) {
      const vote = session.state.votes[String(entry.id)];
      const active = activeCriteriaFor(criteria, entry.categoryId);
      if (isVoteComplete(vote?.scores, active)) rated += 1;
      const mark = marks[termsOf(entry).mark];
      mark.total += 1;
      if (vote?.tasted) mark.done += 1;
    }
    const markText = (['Tasted', 'Seen'] as const)
      .filter((m) => marks[m].total > 0)
      .map((m) => `${marks[m].done} of ${marks[m].total} ${m.toLowerCase()}`)
      .join(' · ');
    return {
      rated,
      markText,
      ballots: Object.keys(session.state.ballots).length,
    };
  }, [entries, criteria, session.state, termsOf]);
  const anyRateable = criteria.some((c) => c.isActive);
  const markHelp =
    page.anyTasting && page.anyShowcase ? 'tasted (or seen)' : page.anyShowcase ? 'seen' : 'tasted';

  if (!session.sessionKnown || status === null) {
    return <p className="text-ink-muted">Loading…</p>;
  }

  if (!session.voterName) {
    return (
      <div className="space-y-4">
        <HelpPanel id="vote-intro" title="How voting works">
          <ol>
            <li>Enter your name so your ratings are saved to you.</li>
            <li>
              Mark each {page.noun} {markHelp} as you go
              {anyRateable ? ', then rate it with stars' : ''}.
            </li>
            <li>Nominate your favourites for the special awards at the bottom.</li>
          </ol>
          <p>You can change any rating until the host closes voting.</p>
        </HelpPanel>
        <PhaseNotice
          status={status}
          opensAt={settings?.votingOpensAt ?? null}
          now={now}
          scheduledTitle="Voting opens"
          closedText="Voting is closed."
        />
        <VoterNameForm
          onSubmit={session.signIn}
          sharedDevice={sharedDevice}
          onSharedDeviceChange={setSharedDevice}
        />
      </div>
    );
  }

  const allExpanded = entries.length > 0 && entries.every((entry) => openIds.has(entry.id));

  const visibleCategories = categories.filter(
    (category) => categoryFilter === null || categoryFilter === category.id,
  );

  const conflictIds = new Set(
    [...conflictsById].filter(([, ids]) => ids.length > 0).map(([id]) => id),
  );
  const hasConflict = (entry: Entry) => (conflictsById.get(entry.id)?.length ?? 0) > 0;
  const hiddenForAllergies = entries.filter(
    (entry) =>
      hasConflict(entry) && visibleCategories.some((category) => category.id === entry.categoryId),
  ).length;

  function visibleEntries(categoryId: string): Entry[] {
    const inCategory = entries.filter(
      (entry) => entry.categoryId === categoryId && (showAllergens || !hasConflict(entry)),
    );
    if (!onlyRemaining) return inCategory;
    const active = activeCriteriaFor(criteria, categoryId);
    return inCategory.filter((entry) =>
      needsAttention(session.state.votes[String(entry.id)], active),
    );
  }

  const anyVisible = visibleCategories.some((category) => visibleEntries(category.id).length > 0);
  const anyInCategory = visibleCategories.some((category) =>
    entries.some((entry) => entry.categoryId === category.id),
  );
  // Nothing showing means either the toggle hid it all or the category is simply empty.
  const emptyMessage = onlyRemaining && anyInCategory ? NOTHING_REMAINING : NOTHING_HERE;

  return (
    <div className="space-y-4">
      <HelpPanel id="vote" title="How voting works">
        <ul>
          <li>Tap the {markHelp} box on a card once you have checked it out.</li>
          {anyRateable ? (
            <>
              <li>
                Tap stars to rate. Rating {withArticle(page.noun)} marks it {markHelp} too.
              </li>
              <li>Rate every criterion on a card for it to count toward the ranking.</li>
            </>
          ) : null}
          <li>Tap {withArticle(page.noun)}’s name to open or close its card.</li>
          {page.anyTasting ? (
            <li>Food with your allergens is hidden. Tap the warning chip to see it.</li>
          ) : null}
          <li>Turn on “Only what’s left” to see just the entries you still owe.</li>
        </ul>
      </HelpPanel>

      <Card className="flex flex-wrap items-center gap-3 p-3">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <UserRound className="size-4" aria-hidden="true" />
          {session.voterName}
        </span>
        {votingOpen ? (
          <span className="text-sm text-ink-muted">
            {progress.markText}
            {anyRateable ? ` · ${progress.rated} rated` : ''}
            {awards.length > 0 ? ` · ${progress.ballots} of ${awards.length} awards` : ''}
          </span>
        ) : null}
        {secondsRemaining !== null && secondsRemaining <= 20 ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-900">
            Signing out in {secondsRemaining}s
          </span>
        ) : null}
        <div className="ml-auto flex gap-2">
          {votingOpen ? (
            <div
              role="group"
              aria-label="Card size"
              className="flex rounded-lg border border-black/10"
            >
              <LayoutButton
                active={layout === 'large'}
                label="Large cards"
                onClick={() => setLayout('large')}
              >
                <LayoutGrid className="size-4" aria-hidden="true" />
              </LayoutButton>
              <LayoutButton
                active={layout === 'medium'}
                label="Medium cards"
                onClick={() => setLayout('medium')}
              >
                <Rows3 className="size-4" aria-hidden="true" />
              </LayoutButton>
            </div>
          ) : null}
          {votingOpen && entries.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              className="whitespace-nowrap"
              onClick={() => setAllExpanded(!allExpanded)}
            >
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="whitespace-nowrap"
            onClick={() => void session.signOut()}
          >
            <LogOut className="size-4" aria-hidden="true" />
            Switch voter
          </Button>
        </div>
      </Card>

      <PhaseNotice
        status={status}
        opensAt={settings?.votingOpensAt ?? null}
        now={now}
        scheduledTitle="Voting opens"
        closedText="Voting is closed. Thanks for voting!"
      />

      {/* Nothing to rate until voting opens, and nothing once it closes: the
          notice above is the whole page then. */}
      {votingOpen ? (
        <>
          {/* One row. "Only what's left" leads so it stays on screen at any width;
          the categories are what scroll. */}
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1">
            <FilterChip active={onlyRemaining} onClick={() => setOnlyRemaining(!onlyRemaining)}>
              <ListChecks className="size-4" aria-hidden="true" />
              Only what’s left
            </FilterChip>
            {hiddenForAllergies > 0 || showAllergens ? (
              <FilterChip active={showAllergens} onClick={() => setShowAllergens(!showAllergens)}>
                <TriangleAlert className="size-4" aria-hidden="true" />
                {showAllergens
                  ? 'Hide your allergens'
                  : `Show ${hiddenForAllergies} with your allergens`}
              </FilterChip>
            ) : null}
            {categories.length > 1 ? (
              <>
                <span className="w-px shrink-0 self-stretch bg-black/10" aria-hidden="true" />
                <div className="flex gap-2" role="group" aria-label="Category">
                  <FilterChip
                    active={categoryFilter === null}
                    onClick={() => setCategoryFilter(null)}
                  >
                    All
                  </FilterChip>
                  {categories.map((category) => (
                    <FilterChip
                      key={category.id}
                      active={categoryFilter === category.id}
                      onClick={() => setCategoryFilter(category.id)}
                    >
                      <span aria-hidden="true">{category.emoji}</span> {category.name}
                    </FilterChip>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {!session.isReady ? (
            <p className="text-ink-muted">Loading your votes…</p>
          ) : entries.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-lg font-semibold">No entries yet</p>
              <p className="mt-1 text-ink-muted">
                As soon as someone submits {withArticle(page.noun)} it appears here. This page
                refreshes itself.
              </p>
            </Card>
          ) : !anyVisible ? (
            <Card className="p-8 text-center">
              <p className="text-2xl" aria-hidden="true">
                🎉
              </p>
              <p className="mt-1 text-lg font-semibold">{emptyMessage.title}</p>
              <p className="mt-1 text-ink-muted">{emptyMessage.body}</p>
            </Card>
          ) : (
            visibleCategories.map((category) => {
              const list = visibleEntries(category.id);
              if (list.length === 0) return null;
              const active = activeCriteriaFor(criteria, category.id);
              return (
                <section key={category.id} className="space-y-3">
                  <h2 className="flex items-center gap-2 text-xl font-bold">
                    <span aria-hidden="true">{category.emoji}</span>
                    {category.name}
                    <span className="text-sm font-normal text-ink-muted">
                      {list.length} {list.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </h2>
                  {/* Medium cards put photo and scores side by side, so they need the full
                  width; two to a row would squeeze the criteria names to nothing. */}
                  <div
                    className={`grid gap-4 ${layout === 'medium' ? 'lg:grid-cols-2' : 'sm:grid-cols-2'}`}
                  >
                    {list.map((entry) => (
                      <VoteCard
                        key={entry.id}
                        entry={entry}
                        criteria={active}
                        terms={termsOf(entry)}
                        vote={session.state.votes[String(entry.id)]}
                        layout={layout}
                        conflicts={conflictsById.get(entry.id) ?? []}
                        expanded={openIds.has(entry.id)}
                        onExpandedChange={(value) => setCardExpanded(entry.id, value)}
                        onScoreChange={(criterionId: number, rating: Rating | null) => {
                          session
                            .setScore(entry.id, criterionId, rating)
                            .catch((error: unknown) => {
                              toast.error(errorMessage(error, 'Could not save that rating.'));
                            });
                        }}
                        onCommentChange={(comment) => saveComment.call(entry.id, comment)}
                        onCommentFlush={saveComment.flush}
                        onTastedChange={(tasted) => {
                          session.setTasted(entry.id, tasted).catch((error: unknown) => {
                            toast.error(errorMessage(error, 'Could not save that.'));
                          });
                        }}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}

          {awards.length > 0 ? (
            <section className="space-y-3 pt-2">
              <div>
                <h2 className="text-xl font-bold">Special awards</h2>
                <p className="text-sm text-ink-muted">
                  Nominate one entry per award.
                  {anyRateable ? ' This is separate from the star ratings.' : ''}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {awards.map((award) => (
                  <AwardPicker
                    key={award.id}
                    award={award}
                    entries={entries}
                    categoryNames={categoryNames}
                    pickedEntryId={session.state.ballots[award.id]}
                    conflictIds={conflictIds}
                    onPick={(entryId) => {
                      session.pickAward(award.id, entryId).catch((error: unknown) => {
                        toast.error(errorMessage(error, 'Could not save your nomination.'));
                      });
                    }}
                    onClear={() => {
                      session.clearAward(award.id).catch((error: unknown) => {
                        toast.error(errorMessage(error, 'Could not clear your nomination.'));
                      });
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`tap-target inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${
        active ? 'border-brand-600 bg-brand-600 text-white' : 'border-black/15 bg-white text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function LayoutButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid min-h-9 w-10 place-items-center first:rounded-l-lg last:rounded-r-lg ${
        active ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-black/5'
      }`}
    >
      {children}
    </button>
  );
}
