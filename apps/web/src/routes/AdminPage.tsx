import type {
  AdminGuest,
  Award,
  Category,
  Criterion,
  EntryResult,
  EventSettings,
} from '@contest/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, LockOpen } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { AwardsTab } from '../components/admin/AwardsTab.tsx';
import { GuestsTab, RsvpSummaryCard, type GuestActions } from '../components/admin/GuestsTab.tsx';
import { ResultsTab } from '../components/admin/ResultsTab.tsx';
import { SetupTab, type SetupActions } from '../components/admin/SetupTab.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { TextField } from '../components/ui/Field.tsx';
import { HelpPanel } from '../components/ui/HelpPanel.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { api, getAdminPassword, setAdminPassword } from '../lib/api.ts';
import { errorMessage } from '../lib/errorMessage.ts';
import { queryKeys } from '../lib/queries.ts';

// The rich-text editor is only for the host, so guests' phones never download it.
const EmailTab = lazy(() =>
  import('../components/admin/EmailTab.tsx').then((module) => ({ default: module.EmailTab })),
);

type Tab = 'results' | 'guests' | 'email' | 'awards' | 'setup';

const TABS: { id: Tab; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'guests', label: 'Guests' },
  { id: 'email', label: 'Email' },
  { id: 'awards', label: 'Awards' },
  { id: 'setup', label: 'Setup' },
];

export function AdminPage() {
  const [unlocked, setUnlocked] = useState(() => getAdminPassword() !== null);
  const [tab, setTab] = useState<Tab>('results');
  const toast = useToast();
  const queryClient = useQueryClient();

  const results = useQuery({
    queryKey: queryKeys.adminResults,
    queryFn: api.adminResults,
    enabled: unlocked,
    refetchInterval: 20_000,
  });
  const config = useQuery({
    queryKey: queryKeys.adminConfig,
    queryFn: api.adminConfig,
    enabled: unlocked,
  });
  const guests = useQuery({
    queryKey: queryKeys.adminGuests,
    queryFn: api.adminGuests,
    enabled: unlocked,
    refetchInterval: 30_000,
  });
  const mailStatus = useQuery({
    queryKey: queryKeys.adminMailStatus,
    queryFn: api.adminMailStatus,
    enabled: unlocked,
  });

  function refreshAll() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminResults });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminConfig });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminGuests });
    void queryClient.invalidateQueries({ queryKey: queryKeys.contest });
    void queryClient.invalidateQueries({ queryKey: queryKeys.entries });
  }

  /** Every admin write goes through here so errors surface the same way. */
  const run = useMutation({
    mutationFn: async ({ action }: { action: () => Promise<unknown>; success?: string }) =>
      action(),
    onSuccess: (_data, variables) => {
      refreshAll();
      if (variables.success) toast.success(variables.success);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const act = (action: () => Promise<unknown>, success?: string) => run.mutate({ action, success });

  if (!unlocked) {
    return (
      <PasswordGate
        onUnlocked={() => {
          setUnlocked(true);
          refreshAll();
        }}
      />
    );
  }

  const hasRatings = (results.data?.summary.completeVoteCount ?? 0) > 0;

  const actions: SetupActions = {
    saveSettings: (input: Partial<EventSettings>) =>
      act(() => api.updateSettings(input), 'Event details saved'),
    createCategory: (name, emoji) =>
      act(() => api.createCategory({ name, emoji }), `Added ${name}`),
    updateCategory: (category: Category, patch) =>
      act(() => api.updateCategory(category.id, { ...category, ...patch })),
    deleteCategory: (category: Category) =>
      act(() => api.deleteCategory(category.id), `Deleted ${category.name}`),
    createCriterion: (categoryId, name, helpText) =>
      act(() => api.createCriterion({ categoryId, name, helpText }), `Added ${name}`),
    updateCriterion: (criterion: Criterion, patch) =>
      act(() => api.updateCriterion(criterion.id, patch)),
    deleteCriterion: (criterion: Criterion) =>
      act(() => api.deleteCriterion(criterion.id), `Deleted ${criterion.name}`),
    createAward: (name, emoji, description, categoryIds) =>
      act(() => api.createAward({ name, emoji, description, categoryIds }), `Added ${name}`),
    updateAward: (award: Award, patch) =>
      act(() => api.updateAward(award.id, { ...award, ...patch })),
    deleteAward: (award: Award) => act(() => api.deleteAward(award.id), `Deleted ${award.name}`),
  };

  const categoryNames = new Map(
    (config.data?.categories ?? []).map((category) => [category.id, category.name] as const),
  );

  const guestActions: GuestActions = {
    add: (list) =>
      act(
        async () => {
          const result = await api.addGuests(list);
          if (result.skipped.length > 0) {
            toast.error(
              `Skipped ${result.skipped.length}: ${result.skipped.map((s) => s.name).join(', ')}`,
            );
          }
          return result;
        },
        `Added ${list.length === 1 ? list[0]!.name : `${list.length} guests`}`,
      ),
    inviteLink: async (guest: AdminGuest) => {
      try {
        const { url } = await api.inviteLink(guest.id);
        refreshAll();
        return url;
      } catch (error) {
        toast.error(errorMessage(error));
        throw error;
      }
    },
    sendInvites: (selector) =>
      act(async () => {
        const result = await api.sendInvites(selector);
        if (result.failed.length > 0) {
          toast.error(`Could not email ${result.failed.map((f) => f.name).join(', ')}`);
        }
        return result;
      }, 'Invites sent'),
    rename: (guest, newName) =>
      act(() => api.renameGuest(guest.id, newName), `Renamed to ${newName}`),
    setAccess: (guest, access) =>
      act(
        async () => {
          const result = await api.setGuestAccess(guest.id, access);
          if (result && result.failed.length > 0) {
            toast.error(`Could not email ${guest.name}: ${result.failed[0]!.error}`);
          }
          return result;
        },
        access === 'invited' ? `${guest.name} is on the list` : `Declined ${guest.name}`,
      ),
    remove: (guest) => {
      if (!confirm(`Delete ${guest.name} and all of their ratings and nominations?`)) return;
      act(() => api.deleteGuest(guest.id), `Deleted ${guest.name}`);
    },
  };

  return (
    <div className="space-y-4">
      <HelpPanel id="admin" title="What you can do here">
        <ul>
          <li>
            <strong>Results</strong> ranks each category from the star ratings. Only fully rated
            entries count.
          </li>
          <li>
            <strong>Guests</strong> is the RSVP list: who is coming, plus-ones, allergies, and
            invite links.
          </li>
          <li>
            <strong>Email</strong> sends your own message to the guests you pick, with their name
            and personal RSVP link filled in.
          </li>
          <li>
            <strong>Setup</strong> is where you add categories, criteria and awards. Guests see
            changes within a minute.
          </li>
          <li>
            Hiding something keeps its data. Deleting is blocked once people have voted on it.
          </li>
        </ul>
      </HelpPanel>

      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1" role="tablist">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`tap-target shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                tab === id ? 'bg-brand-600 text-white' : 'bg-white text-ink border border-black/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setAdminPassword(null);
            setUnlocked(false);
            queryClient.clear();
          }}
        >
          <Lock className="size-4" aria-hidden="true" />
          Lock
        </Button>
      </div>

      {results.isError ? (
        <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {errorMessage(results.error, 'Could not load results.')}
        </p>
      ) : null}

      {tab === 'results' && guests.data && guests.data.length > 0 ? (
        <RsvpSummaryCard guests={guests.data} categoryNames={categoryNames} />
      ) : null}

      {tab === 'results' ? (
        <ResultsTab
          results={results.data?.categories ?? []}
          onDeleteEntry={(entry: EntryResult) => {
            if (
              !confirm(`Delete “${entry.entryName}” and all of its ratings? This cannot be undone.`)
            )
              return;
            act(() => api.deleteEntry(entry.id), `Deleted ${entry.entryName}`);
          }}
        />
      ) : null}

      {tab === 'awards' ? <AwardsTab awards={results.data?.awards ?? []} /> : null}

      {tab === 'guests' ? (
        <GuestsTab
          guests={guests.data ?? []}
          categoryNames={categoryNames}
          mailConfigured={mailStatus.data?.configured ?? false}
          actions={guestActions}
        />
      ) : null}

      {tab === 'email' ? (
        <Suspense fallback={<p className="text-ink-muted">Loading editor…</p>}>
          <EmailTab
            guests={guests.data ?? []}
            mailConfigured={mailStatus.data?.configured ?? false}
            hasPhotoAlbum={(config.data?.settings.photoShareUrl ?? '') !== ''}
            sending={run.isPending}
            onSend={(email) =>
              act(
                async () => {
                  const result = await api.sendCustomEmail(email);
                  if (result.failed.length > 0) {
                    toast.error(`Could not email ${result.failed.map((f) => f.name).join(', ')}`);
                  }
                  return result;
                },
                `Email sent to ${email.guestIds.length === 1 ? '1 guest' : `${email.guestIds.length} guests`}`,
              )
            }
          />
        </Suspense>
      ) : null}

      {tab === 'setup' ? (
        config.data ? (
          <SetupTab config={config.data} hasRatings={hasRatings} actions={actions} />
        ) : (
          <p className="text-ink-muted">Loading setup…</p>
        )
      ) : null}
    </div>
  );
}

function PasswordGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();

  const login = useMutation({
    mutationFn: (value: string) => api.adminLogin(value),
    onSuccess: (_data, value) => {
      setAdminPassword(value);
      onUnlocked();
    },
    onError: (err) => setError(errorMessage(err, 'That password did not work.')),
  });

  return (
    <Card className="mx-auto max-w-md space-y-4 p-6">
      <div className="text-center">
        <LockOpen className="mx-auto size-10 text-brand-600" aria-hidden="true" />
        <h2 className="mt-2 text-xl font-bold">Host area</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Results and contest setup. Ask the host for the password.
        </p>
      </div>
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        error={error}
        onChange={(event) => {
          setPassword(event.target.value);
          setError(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && password) login.mutate(password);
        }}
      />
      <Button
        className="w-full"
        loading={login.isPending}
        disabled={password.length === 0}
        onClick={() => login.mutate(password)}
      >
        Unlock
      </Button>
    </Card>
  );
}
