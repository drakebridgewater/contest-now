import { activeSorted, CONTESTANT_NAME_MAX, ENTRY_NAME_MAX, type Entry } from '@contest/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, PartyPopper } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AllergenPicker } from '../components/submit/AllergenPicker.tsx';
import { PhotoPicker } from '../components/submit/PhotoPicker.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { TextField } from '../components/ui/Field.tsx';
import { HelpPanel } from '../components/ui/HelpPanel.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { api } from '../lib/api.ts';
import { errorMessage } from '../lib/errorMessage.ts';
import { queryKeys, useContest } from '../lib/queries.ts';

export function SubmitPage() {
  const contest = useContest();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const [entryName, setEntryName] = useState('');
  const [contestantName, setContestantName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Entry | null>(null);

  const categories = activeSorted(contest.data?.categories ?? []);
  const votingOpen = contest.data?.settings.votingOpen ?? true;

  const mutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.set('entryName', entryName.trim());
      form.set('contestantName', contestantName.trim());
      form.set('categoryId', categoryId!);
      for (const id of allergens) form.append('allergens', id);
      form.set('photo', photo!);
      return api.createEntry(form);
    },
    onSuccess: (entry) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.entries });
      setSubmitted(entry);
      setEntryName('');
      setAllergens([]);
      setPhoto(null);
      setErrors({});
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not submit your entry.')),
  });

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (entryName.trim().length === 0) next.entryName = 'Give your entry a name';
    if (contestantName.trim().length === 0) next.contestantName = 'Tell us who made it';
    if (!categoryId) next.categoryId = 'Pick a category';
    if (!photo) next.photo = 'A photo is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  if (submitted) {
    return (
      <div className="space-y-4">
        <Card className="p-6 text-center">
          <PartyPopper className="mx-auto size-12 text-accent-600" aria-hidden="true" />
          <h2 className="mt-3 text-2xl font-bold">“{submitted.entryName}” is in!</h2>
          <p className="mt-1 text-ink-muted">
            It is on the voting page now. Guests can rate it as soon as they find your dish.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={() => setSubmitted(null)} variant="secondary">
              Submit another entry
            </Button>
            <Button onClick={() => void navigate('/vote')}>Go vote</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HelpPanel id="submit" title="How submitting works">
        <ol>
          <li>Take a photo of your dish or drink and give it a name.</li>
          <li>Pick the category it is competing in.</li>
          <li>Tap every allergen it contains so guests can taste safely.</li>
        </ol>
        <p>You can submit as many entries as you like, in any category.</p>
      </HelpPanel>

      {!votingOpen ? (
        <p className="rounded-card border border-amber-300 bg-amber-50 px-4 py-3 font-medium text-amber-900">
          Submissions are closed for now. Ask the host to reopen them.
        </p>
      ) : null}

      <Card className="space-y-5 p-4 sm:p-6">
        <TextField
          label="Your name"
          help="So we know who to hand the trophy to."
          value={contestantName}
          onChange={(event) => setContestantName(event.target.value)}
          maxLength={CONTESTANT_NAME_MAX}
          counter={`${contestantName.length}/${CONTESTANT_NAME_MAX}`}
          error={errors.contestantName}
          autoComplete="name"
          enterKeyHint="next"
        />

        <TextField
          label="Entry name"
          help="Something memorable, like “Grandma's Bourbon Pecan Pie”."
          value={entryName}
          onChange={(event) => setEntryName(event.target.value)}
          maxLength={ENTRY_NAME_MAX}
          counter={`${entryName.length}/${ENTRY_NAME_MAX}`}
          error={errors.entryName}
        />

        <fieldset>
          <legend className="text-sm font-semibold">Category</legend>
          <p className="mt-0.5 text-sm text-ink-muted">
            Each category is judged on its own criteria.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categories.map((category) => {
              const selected = categoryId === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategoryId(category.id)}
                  className={`rounded-xl border-2 p-3 text-left transition-colors ${
                    selected
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-black/10 bg-white hover:border-brand-200'
                  }`}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {category.emoji}
                  </span>
                  <span className="mt-1 block font-semibold">{category.name}</span>
                  {category.description ? (
                    <span className="block text-xs text-ink-muted">{category.description}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {errors.categoryId ? (
            <p className="mt-1 text-xs font-medium text-red-700">{errors.categoryId}</p>
          ) : null}
          {categories.length === 0 && contest.isSuccess ? (
            <p className="mt-2 text-sm text-ink-muted">
              No categories yet. The host can add them under Results → Setup.
            </p>
          ) : null}
        </fieldset>

        <AllergenPicker selected={allergens} onChange={setAllergens} />

        <PhotoPicker onChange={setPhoto} error={errors.photo} />

        <Button
          size="lg"
          className="w-full"
          loading={mutation.isPending}
          disabled={!votingOpen}
          onClick={() => {
            if (validate()) mutation.mutate();
          }}
        >
          <CheckCircle2 className="size-5" aria-hidden="true" />
          Submit entry
        </Button>
      </Card>
    </div>
  );
}
