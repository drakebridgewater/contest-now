import type {
  Award,
  Category,
  Criterion,
  EntryResult,
  EventSettings,
  VoterInfo,
} from '@contest/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, LockOpen } from 'lucide-react';
import { useState } from 'react';
import { AwardsTab } from '../components/admin/AwardsTab.tsx';
import { ResultsTab } from '../components/admin/ResultsTab.tsx';
import { SetupTab, type SetupActions } from '../components/admin/SetupTab.tsx';
import { VotersTab } from '../components/admin/VotersTab.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { TextField } from '../components/ui/Field.tsx';
import { HelpPanel } from '../components/ui/HelpPanel.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { api, getAdminPassword, setAdminPassword } from '../lib/api.ts';
import { errorMessage } from '../lib/errorMessage.ts';
import { queryKeys } from '../lib/queries.ts';

type Tab = 'results' | 'awards' | 'voters' | 'setup';

const TABS: { id: Tab; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'awards', label: 'Awards' },
  { id: 'voters', label: 'Voters' },
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
  const voters = useQuery({
    queryKey: queryKeys.adminVoters,
    queryFn: api.adminVoters,
    enabled: unlocked,
  });

  function refreshAll() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminResults });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminConfig });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminVoters });
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

  return (
    <div className="space-y-4">
      <HelpPanel id="admin" title="What you can do here">
        <ul>
          <li>
            <strong>Results</strong> ranks each category from the star ratings. Only fully rated
            entries count.
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

      {tab === 'voters' ? (
        <VotersTab
          voters={voters.data ?? []}
          onRename={(voterName, newName) =>
            act(() => api.renameVoter(voterName, newName), `Renamed to ${newName}`)
          }
          onDelete={(voter: VoterInfo) => {
            if (!confirm(`Delete ${voter.voterName} and all of their ratings and nominations?`))
              return;
            act(() => api.deleteVoter(voter.voterName), `Deleted ${voter.voterName}`);
          }}
        />
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
