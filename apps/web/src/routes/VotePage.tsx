import {
  activeCriteriaFor,
  activeSorted,
  isVoteComplete,
  type Entry,
  type Rating,
} from '@contest/shared';
import { ListChecks, LogOut, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AwardPicker } from '../components/vote/AwardPicker.tsx';
import { VoteCard } from '../components/vote/VoteCard.tsx';
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
import { useVoterSession } from '../lib/useVoterSession.ts';
import { needsAttention, NOTHING_HERE, NOTHING_REMAINING } from '../lib/entryFilter.ts';

const AUTO_LOGOUT_SECONDS = 60;

/** Cards the voter has explicitly opened or shut, plus the voter they belong to. */
interface CollapseState {
  voter: string;
  map: Record<number, boolean>;
}

export function VotePage() {
  const contest = useContest();
  const entriesQuery = useEntries();
  const session = useVoterSession();
  const toast = useToast();

  const [sharedDevice, setSharedDevice] = useLocalStorage('contest.sharedDevice', false);
  const [onlyRemaining, setOnlyRemaining] = useLocalStorage('contest.vote.onlyRemaining', false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<CollapseState | null>(null);

  const { secondsRemaining } = useAutoLogout({
    enabled: sharedDevice && session.voterName !== null,
    seconds: AUTO_LOGOUT_SECONDS,
    onLogout: () => session.signOut(),
  });

  const saveComment = useDebouncedCallback((entryId: number, comment: string) => {
    session.setComment(entryId, comment).catch((error: unknown) => {
      toast.error(errorMessage(error, 'Could not save your comment.'));
    });
  }, 700);

  const categories = activeSorted(contest.data?.categories ?? []);
  const criteria = useMemo(() => contest.data?.criteria ?? [], [contest.data?.criteria]);
  const awards = activeSorted(contest.data?.awards ?? []);
  const votingOpen = contest.data?.settings.votingOpen ?? true;
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data]);
  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name] as const)),
    [categories],
  );

  const voterName = session.voterName;
  const voterState = session.state;
  const dataReady = contest.isSuccess && entriesQuery.isSuccess && session.isReady;

  /**
   * A card you have already finished starts shut, everything else starts open.
   *
   * This is a starting state, not a rule: it is seeded once per voter and then
   * only the voter changes it, so rating the last criterion never snaps the card
   * closed under your thumb. All three queries have to have landed first —
   * `criteria` comes from the contest query and an empty one makes every entry
   * look unrated, and `isReady` is what distinguishes "no votes" from "not loaded",
   * which matters because this runs on the signed-out screen too.
   *
   * Adjusted during render rather than in an effect: React re-runs the component
   * immediately without committing the discarded pass, so the first paint already
   * has the right shape and there is no cascading render to suppress.
   */
  if (dataReady && voterName !== null && collapsed?.voter !== voterName) {
    const map: Record<number, boolean> = {};
    for (const entry of entries) {
      const active = activeCriteriaFor(criteria, entry.categoryId);
      map[entry.id] = isVoteComplete(voterState.votes[String(entry.id)]?.scores, active);
    }
    setCollapsed({ voter: voterName, map });
  }

  function setCardCollapsed(entryId: number, value: boolean) {
    setCollapsed((previous) =>
      previous === null ? previous : { ...previous, map: { ...previous.map, [entryId]: value } },
    );
  }

  function setAllCollapsed(value: boolean) {
    setCollapsed((previous) =>
      previous === null
        ? previous
        : {
            ...previous,
            map: Object.fromEntries(entries.map((entry) => [entry.id, value])),
          },
    );
  }

  const progress = useMemo(() => {
    let rated = 0;
    let tasted = 0;
    for (const entry of entries) {
      const vote = session.state.votes[String(entry.id)];
      const active = activeCriteriaFor(criteria, entry.categoryId);
      if (isVoteComplete(vote?.scores, active)) rated += 1;
      if (vote?.tasted) tasted += 1;
    }
    return {
      rated,
      tasted,
      total: entries.length,
      ballots: Object.keys(session.state.ballots).length,
    };
  }, [entries, criteria, session.state]);

  if (!session.voterName) {
    return (
      <div className="space-y-4">
        <HelpPanel id="vote-intro" title="How voting works">
          <ol>
            <li>Enter your name so your ratings are saved to you.</li>
            <li>Mark each dish tasted as you try it, then rate it with stars.</li>
            <li>Nominate your favourites for the special awards at the bottom.</li>
          </ol>
          <p>You can change any rating until the host closes voting.</p>
        </HelpPanel>
        <VoterNameForm
          onSubmit={session.signIn}
          sharedDevice={sharedDevice}
          onSharedDeviceChange={setSharedDevice}
        />
      </div>
    );
  }

  const allCollapsed =
    entries.length > 0 && entries.every((entry) => collapsed?.map[entry.id] ?? false);

  const visibleCategories = categories.filter(
    (category) => categoryFilter === null || categoryFilter === category.id,
  );

  function visibleEntries(categoryId: string): Entry[] {
    const inCategory = entries.filter((entry) => entry.categoryId === categoryId);
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
          <li>Tap the tasted box on a card once you have tried it.</li>
          <li>Tap stars to rate. Rating a dish marks it tasted for you too.</li>
          <li>Rate every criterion on a card for it to count toward the ranking.</li>
          <li>Finished cards fold away — tap Edit to open one back up.</li>
          <li>Turn on “Only what’s left” to see just the dishes you still owe.</li>
        </ul>
      </HelpPanel>

      <Card className="flex flex-wrap items-center gap-3 p-3">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <UserRound className="size-4" aria-hidden="true" />
          {session.voterName}
        </span>
        <span className="text-sm text-ink-muted">
          {progress.tasted} of {progress.total} tasted · {progress.rated} rated
          {awards.length > 0 ? ` · ${progress.ballots} of ${awards.length} awards` : ''}
        </span>
        {secondsRemaining !== null && secondsRemaining <= 20 ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-900">
            Signing out in {secondsRemaining}s
          </span>
        ) : null}
        <div className="ml-auto flex gap-2">
          {entries.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => setAllCollapsed(!allCollapsed)}>
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => session.signOut()}>
            <LogOut className="size-4" aria-hidden="true" />
            Switch voter
          </Button>
        </div>
      </Card>

      {!votingOpen ? (
        <p className="rounded-card border border-amber-300 bg-amber-50 px-4 py-3 font-medium text-amber-900">
          Voting is closed. You can look, but ratings can no longer change.
        </p>
      ) : null}

      {/* One row. "Only what's left" leads so it stays on screen at any width;
          the categories are what scroll. */}
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1">
        <FilterChip active={onlyRemaining} onClick={() => setOnlyRemaining(!onlyRemaining)}>
          <ListChecks className="size-4" aria-hidden="true" />
          Only what’s left
        </FilterChip>
        {categories.length > 1 ? (
          <>
            <span className="w-px shrink-0 self-stretch bg-black/10" aria-hidden="true" />
            <div className="flex gap-2" role="group" aria-label="Category">
              <FilterChip active={categoryFilter === null} onClick={() => setCategoryFilter(null)}>
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

      {entries.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-lg font-semibold">No entries yet</p>
          <p className="mt-1 text-ink-muted">
            As soon as someone submits a dish it appears here. This page refreshes itself.
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
              <div className="grid gap-4 sm:grid-cols-2">
                {list.map((entry) => (
                  <VoteCard
                    key={entry.id}
                    entry={entry}
                    criteria={active}
                    vote={session.state.votes[String(entry.id)]}
                    disabled={!votingOpen}
                    collapsed={collapsed?.map[entry.id] ?? false}
                    onCollapsedChange={(value) => setCardCollapsed(entry.id, value)}
                    onScoreChange={(criterionId: number, rating: Rating | null) => {
                      session.setScore(entry.id, criterionId, rating).catch((error: unknown) => {
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
              Nominate one entry per award. This is separate from the star ratings.
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
                disabled={!votingOpen}
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
