import {
  activeSorted,
  RSVP_STATUSES,
  VOTER_NAME_MIN,
  type GuestProfile,
  type NotInvitedDetails,
  type RsvpStatus,
  type UpdateProfile,
} from '@contest/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Hourglass, LogOut, MailCheck, Send, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, ApiRequestError } from '../../lib/api.ts';
import { errorMessage } from '../../lib/errorMessage.ts';
import { queryKeys, useContest, useMe, useRsvpSummary } from '../../lib/queries.ts';
import { AllergenPicker } from '../submit/AllergenPicker.tsx';
import { Button } from '../ui/Button.tsx';
import { Card, CardHeader } from '../ui/Card.tsx';
import { TextField } from '../ui/Field.tsx';
import { useToast } from '../ui/Toast.tsx';

const RSVP_CHOICES: Record<Exclude<RsvpStatus, 'pending'>, { label: string; emoji: string }> = {
  yes: { label: 'Coming', emoji: '🎉' },
  maybe: { label: 'Maybe', emoji: '🤔' },
  no: { label: 'Can’t make it', emoji: '😢' },
};

/**
 * The RSVP. Signing in here is by email only: a one-time link, or the personal
 * invite link the host sent. No passwords, so nothing to forget or reset.
 */
export function RsvpSection({
  inviteSettled,
  inviteError,
}: {
  inviteSettled: boolean;
  inviteError: string | null;
}) {
  const [params, setParams] = useSearchParams();
  // Held in state so the banner survives dropping ?error= from the address bar;
  // otherwise a refresh, or a tab restored later, shows the stale error forever.
  const [linkError] = useState(() => params.get('error'));
  useEffect(() => {
    if (!params.has('error')) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('error');
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [params, setParams]);
  const me = useMe(inviteSettled);

  if (!inviteSettled || me.isLoading) {
    return <p className="text-ink-muted">Opening your RSVP…</p>;
  }

  const guest = me.data ?? null;
  return (
    <div className="space-y-4">
      {/* A used link no longer matters once this device is signed in, e.g. from another tab. */}
      {inviteError || (linkError && guest?.scope !== 'full') ? (
        <p className="rounded-card border border-amber-300 bg-amber-50 px-4 py-3 font-medium text-amber-900">
          {inviteError ??
            'That sign-in link has expired or was already used. Ask for a fresh one below.'}
        </p>
      ) : null}
      {guest?.scope === 'full' ? (
        <ProfileForm />
      ) : (
        <RequestLinkForm defaultName={guest?.name ?? ''} votingAs={guest?.name ?? null} />
      )}
    </div>
  );
}

function RequestLinkForm({
  defaultName,
  votingAs,
}: {
  defaultName: string;
  votingAs: string | null;
}) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; form?: string }>({});
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [notInvited, setNotInvited] = useState<NotInvitedDetails | null>(null);
  const [requested, setRequested] = useState(false);

  const request = useMutation({
    mutationFn: (requestAccess: boolean) =>
      api.requestLink(email.trim(), name.trim(), requestAccess),
    onSuccess: (result) => {
      setNotInvited(null);
      if ('requested' in result) setRequested(true);
      else setSentTo(email.trim());
    },
    onError: (error) => {
      if (isNotInvited(error)) {
        setNotInvited(error.details);
      } else if (
        error instanceof ApiRequestError &&
        error.status === 400 &&
        /email/i.test(error.message)
      ) {
        setErrors({ email: error.message });
      } else {
        setErrors({ form: errorMessage(error, 'Could not send the link. Try again.') });
      }
    },
  });

  function submit() {
    const next: typeof errors = {};
    if (name.trim().length < VOTER_NAME_MIN) next.name = 'Tell us your name';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter your email';
    setErrors(next);
    if (Object.keys(next).length === 0) request.mutate(false);
  }

  function startOver() {
    setSentTo(null);
    setNotInvited(null);
    setRequested(false);
  }

  if (requested) {
    return (
      <Card className="space-y-4 p-6 text-center">
        <Hourglass className="mx-auto size-12 text-accent-600" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-bold">Request sent</h2>
          <p className="mt-1 text-ink-muted">
            We’ve asked the host to add you. Once they do, you’ll get an email at{' '}
            <strong>{email.trim()}</strong> with your RSVP link.
          </p>
        </div>
      </Card>
    );
  }

  if (notInvited) {
    return (
      <Card className="space-y-4 p-6 text-center">
        <UserX className="mx-auto size-12 text-ink-muted" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-bold">
            {notInvited.alreadyRequested
              ? 'You’ve already asked to join'
              : 'You’re not on the guest list yet'}
          </h2>
          <p className="mt-1 text-ink-muted">
            {notInvited.alreadyRequested ? (
              <>
                The host will email <strong>{email.trim()}</strong> once they’ve added you.
              </>
            ) : notInvited.canRequest ? (
              <>
                We don’t have <strong>{email.trim()}</strong> on the list. If you were invited with
                another email, use that one. Otherwise, ask the host to add you and you’ll get your
                RSVP link once they do.
              </>
            ) : (
              <>Check you used the email your invite came to, or get in touch with the host.</>
            )}
          </p>
        </div>
        {errors.form ? <p className="text-sm font-medium text-red-700">{errors.form}</p> : null}
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          {notInvited.canRequest ? (
            <Button loading={request.isPending} onClick={() => request.mutate(true)}>
              Ask the host to add me
            </Button>
          ) : null}
          <Button variant="ghost" onClick={startOver}>
            Use a different email
          </Button>
        </div>
      </Card>
    );
  }

  if (sentTo) {
    return (
      <Card className="space-y-4 p-6 text-center">
        <MailCheck className="mx-auto size-12 text-accent-600" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-bold">Check your inbox</h2>
          <p className="mt-1 text-ink-muted">
            We sent a sign-in link to <strong>{sentTo}</strong>. Open it on this phone to fill in
            your RSVP. It works once and expires in 15 minutes.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button
            variant="secondary"
            loading={request.isPending}
            onClick={() => request.mutate(false)}
          >
            Send it again
          </Button>
          <Button variant="ghost" onClick={startOver}>
            Use a different email
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-4 sm:p-6">
      <div>
        <h2 className="text-xl font-bold">RSVP</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Use the email your invite came to and we will email you a link to your RSVP. No password:
          the link is your key, and you can ask for a new one any time.
        </p>
        {votingAs ? (
          <p className="mt-2 text-sm text-ink-muted">
            You are signed in to vote as <strong>{votingAs}</strong>. Your RSVP needs the email link
            so nobody else can change it.
          </p>
        ) : null}
      </div>
      <TextField
        label="Your name"
        help="First and last, so we can tell you apart."
        value={name}
        autoComplete="name"
        error={errors.name}
        onChange={(event) => setName(event.target.value)}
      />
      <TextField
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        enterKeyHint="send"
        value={email}
        error={errors.email}
        onChange={(event) => setEmail(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit();
        }}
      />
      {errors.form ? <p className="text-sm font-medium text-red-700">{errors.form}</p> : null}
      <Button size="lg" className="w-full" loading={request.isPending} onClick={submit}>
        <Send className="size-5" aria-hidden="true" />
        Email me a link
      </Button>
    </Card>
  );
}

/** The 403 for an email the host has not put on the guest list. */
function isNotInvited(error: unknown): error is ApiRequestError & { details: NotInvitedDetails } {
  return (
    error instanceof ApiRequestError &&
    error.status === 403 &&
    typeof error.details === 'object' &&
    error.details !== null &&
    'notInvited' in error.details
  );
}

function ProfileForm() {
  const profile = useQuery({ queryKey: queryKeys.profile, queryFn: api.getProfile });
  if (!profile.data) {
    return profile.isError ? (
      <p className="text-red-700">{errorMessage(profile.error, 'Could not load your RSVP.')}</p>
    ) : (
      <p className="text-ink-muted">Loading your RSVP…</p>
    );
  }
  // Keyed so a saved profile re-seeds the form rather than fighting its local state.
  return <ProfileEditor key={profile.dataUpdatedAt} profile={profile.data} />;
}

function ProfileEditor({ profile }: { profile: GuestProfile }) {
  const contest = useContest();
  const summary = useRsvpSummary();
  const queryClient = useQueryClient();
  const toast = useToast();
  const categories = activeSorted(contest.data?.categories ?? []);

  const [name, setName] = useState(profile.name);
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>(profile.rsvpStatus);
  const [hasPlusOne, setHasPlusOne] = useState(profile.plusOneFirstName !== '');
  const [plusOneFirstName, setPlusOneFirstName] = useState(profile.plusOneFirstName);
  const [plusOneLastName, setPlusOneLastName] = useState(profile.plusOneLastName);
  const [phone, setPhone] = useState(profile.phone);
  const [allergies, setAllergies] = useState(profile.allergies);
  const [preregistrations, setPreregistrations] = useState(profile.preregistrations);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (input: UpdateProfile) => api.updateProfile(input),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.profile, updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rsvpSummary });
      void queryClient.invalidateQueries({ queryKey: queryKeys.guestNames });
      toast.success(updated.rsvpStatus === 'no' ? 'Saved. We’ll miss you!' : 'RSVP saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not save your RSVP.')),
  });

  const signOut = useMutation({
    mutationFn: api.signOut,
    onSettled: () => {
      queryClient.setQueryData(queryKeys.me, null);
      queryClient.removeQueries({ queryKey: queryKeys.profile });
      queryClient.removeQueries({ queryKey: ['voter'] });
    },
  });

  function submit() {
    const next: Record<string, string> = {};
    if (name.trim().length < VOTER_NAME_MIN) next.name = 'Tell us your name';
    if (rsvpStatus === 'pending') next.rsvpStatus = 'Let us know if you can make it';
    if (hasPlusOne && (!plusOneFirstName.trim() || !plusOneLastName.trim())) {
      next.plusOne = 'Give your plus-one a first and last name';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    save.mutate({
      name: name.trim(),
      rsvpStatus,
      plusOneFirstName: hasPlusOne ? plusOneFirstName.trim() : '',
      plusOneLastName: hasPlusOne ? plusOneLastName.trim() : '',
      phone: phone.trim(),
      allergies,
      preregistrations,
    });
  }

  /** Others who might enter the category: the server's count, less this guest's own saved tick. */
  function othersIn(categoryId: string): number {
    const total = summary.data?.preregistered[categoryId] ?? 0;
    const mine = profile.rsvpStatus !== 'no' && profile.preregistrations.includes(categoryId);
    return Math.max(0, total - (mine ? 1 : 0));
  }

  const attending = rsvpStatus !== 'no';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={`Hi, ${profile.name.split(' ')[0]}!`}
          subtitle={`Signed in as ${profile.email}`}
          action={
            <Button
              size="sm"
              variant="ghost"
              className="whitespace-nowrap"
              loading={signOut.isPending}
              onClick={() => signOut.mutate()}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </Button>
          }
        />
        <div className="space-y-5 p-4">
          <fieldset>
            <legend className="text-sm font-semibold">Can you make it?</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {RSVP_STATUSES.filter((s) => s !== 'pending').map((status) => {
                const choice = RSVP_CHOICES[status as Exclude<RsvpStatus, 'pending'>];
                const selected = rsvpStatus === status;
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setRsvpStatus(status)}
                    className={clsx(
                      'rounded-xl border-2 p-3 text-center font-semibold transition-colors',
                      selected
                        ? 'border-brand-600 bg-brand-50'
                        : 'border-black/10 bg-white hover:border-brand-200',
                    )}
                  >
                    <span className="block text-2xl" aria-hidden="true">
                      {choice.emoji}
                    </span>
                    <span className="text-sm">{choice.label}</span>
                  </button>
                );
              })}
            </div>
            {errors.rsvpStatus ? (
              <p className="mt-1 text-xs font-medium text-red-700">{errors.rsvpStatus}</p>
            ) : null}
          </fieldset>

          <TextField
            label="Your name"
            help="Shown on your entries and used to vote on the party tablet."
            value={name}
            error={errors.name}
            autoComplete="name"
            onChange={(event) => setName(event.target.value)}
          />

          {attending ? (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  className="size-5 accent-brand-600"
                  checked={hasPlusOne}
                  onChange={(event) => setHasPlusOne(event.target.checked)}
                />
                I’m bringing a plus-one
              </label>
              {hasPlusOne ? (
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="First name"
                    value={plusOneFirstName}
                    autoComplete="off"
                    onChange={(event) => setPlusOneFirstName(event.target.value)}
                  />
                  <TextField
                    label="Last name"
                    value={plusOneLastName}
                    autoComplete="off"
                    onChange={(event) => setPlusOneLastName(event.target.value)}
                  />
                </div>
              ) : null}
              {errors.plusOne ? (
                <p className="text-xs font-medium text-red-700">{errors.plusOne}</p>
              ) : null}
            </div>
          ) : null}

          <TextField
            label="Phone (optional)"
            help="Only the host sees it, in case plans change on the day."
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
      </Card>

      {attending ? (
        <>
          <Card className="p-4">
            <AllergenPicker for="guest" selected={allergies} onChange={setAllergies} />
          </Card>

          {categories.length > 0 ? (
            <Card className="p-4">
              <fieldset>
                <legend className="text-sm font-semibold">Might you enter the contest?</legend>
                <p className="mt-0.5 text-sm text-ink-muted">
                  No commitment — it just helps the host plan. Tick any you might bring.
                </p>
                <div className="mt-3 space-y-2">
                  {categories.map((category) => {
                    const checked = preregistrations.includes(category.id);
                    const others = othersIn(category.id);
                    return (
                      <label
                        key={category.id}
                        className={clsx(
                          'flex items-center gap-3 rounded-xl border-2 p-3',
                          checked ? 'border-brand-600 bg-brand-50' : 'border-black/10 bg-white',
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-5 accent-brand-600"
                          checked={checked}
                          onChange={(event) =>
                            setPreregistrations(
                              event.target.checked
                                ? [...preregistrations, category.id]
                                : preregistrations.filter((id) => id !== category.id),
                            )
                          }
                        />
                        <span className="text-2xl" aria-hidden="true">
                          {category.emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{category.name}</span>
                          <span className="block text-xs text-ink-muted">
                            {others === 0
                              ? 'Nobody else yet — be the first!'
                              : `${others} ${others === 1 ? 'other guest is' : 'others are'} planning this`}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </Card>
          ) : null}
        </>
      ) : null}

      <Button size="lg" className="w-full" loading={save.isPending} onClick={submit}>
        Save my RSVP
      </Button>
    </div>
  );
}
