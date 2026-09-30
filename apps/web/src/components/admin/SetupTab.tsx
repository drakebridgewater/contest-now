import {
  phaseStatus,
  type Award,
  type Category,
  type ContestConfig,
  type Criterion,
  type EventSettings,
  type Faq,
  FAQS_MAX,
} from '@contest/shared';
import { ChevronDown, ChevronUp, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useNow } from '../../lib/useNow.ts';
import { opensAtText, toLocalInput, untilText } from '../../lib/time.ts';
import { Button } from '../ui/Button.tsx';
import { Card, CardHeader } from '../ui/Card.tsx';
import { TextAreaField, TextField, Toggle } from '../ui/Field.tsx';

export interface SetupActions {
  saveSettings: (input: Partial<EventSettings>) => void;
  createCategory: (name: string, emoji: string) => void;
  updateCategory: (category: Category, patch: Partial<Category>) => void;
  deleteCategory: (category: Category) => void;
  createCriterion: (categoryId: string, name: string, helpText: string) => void;
  updateCriterion: (criterion: Criterion, patch: Partial<Criterion>) => void;
  deleteCriterion: (criterion: Criterion) => void;
  createAward: (name: string, emoji: string, description: string, categoryIds: string[]) => void;
  updateAward: (award: Award, patch: Partial<Award>) => void;
  deleteAward: (award: Award) => void;
}

export function SetupTab({
  config,
  hasRatings,
  actions,
}: {
  config: ContestConfig;
  hasRatings: boolean;
  actions: SetupActions;
}) {
  return (
    <div className="space-y-6">
      <ScheduleSection settings={config.settings} onSave={actions.saveSettings} />
      <SettingsSection settings={config.settings} onSave={actions.saveSettings} />
      <FaqSection faqs={config.settings.faqs} onSave={(faqs) => actions.saveSettings({ faqs })} />
      <CategoriesSection config={config} hasRatings={hasRatings} actions={actions} />
      <AwardsSection config={config} actions={actions} />
    </div>
  );
}

function ScheduleSection({
  settings,
  onSave,
}: {
  settings: EventSettings;
  onSave: (input: Partial<EventSettings>) => void;
}) {
  const now = useNow(true, 30_000);
  return (
    <Card>
      <CardHeader
        title="Schedule"
        subtitle="Guests see a countdown until each opens. The switch closes it by hand at any time."
      />
      <div className="space-y-5 p-4">
        <PhaseSchedule
          title="Entries"
          switchLabel="Accepting entries"
          switchHelp="Turn off to stop new dishes being submitted."
          open={settings.submissionsOpen}
          opensAt={settings.submissionsOpenAt}
          now={now}
          onOpenChange={(submissionsOpen) => onSave({ submissionsOpen })}
          onOpensAtChange={(submissionsOpenAt) => onSave({ submissionsOpenAt })}
        />
        <PhaseSchedule
          title="Voting"
          switchLabel="Voting is open"
          switchHelp="Turn off after the awards to freeze ratings and nominations."
          open={settings.votingOpen}
          opensAt={settings.votingOpensAt}
          now={now}
          onOpenChange={(votingOpen) => onSave({ votingOpen })}
          onOpensAtChange={(votingOpensAt) => onSave({ votingOpensAt })}
        />
      </div>
    </Card>
  );
}

function PhaseSchedule({
  title,
  switchLabel,
  switchHelp,
  open,
  opensAt,
  now,
  onOpenChange,
  onOpensAtChange,
}: {
  title: string;
  switchLabel: string;
  switchHelp: string;
  open: boolean;
  opensAt: string | null;
  now: Date;
  onOpenChange: (open: boolean) => void;
  onOpensAtChange: (opensAt: string | null) => void;
}) {
  const [draft, setDraft] = useState(toLocalInput(opensAt));
  const status = phaseStatus(open, opensAt, now);
  const saved = toLocalInput(opensAt);
  const statusText =
    status === 'open'
      ? 'Open now'
      : status === 'closed'
        ? 'Closed'
        : `Opens ${opensAtText(new Date(opensAt!), now)} (${untilText(new Date(opensAt!), now)})`;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">{title}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            status === 'open'
              ? 'bg-accent-100 text-accent-700'
              : status === 'scheduled'
                ? 'bg-amber-50 text-amber-900'
                : 'bg-surface-muted text-ink-muted'
          }`}
        >
          {statusText}
        </span>
      </div>
      <Toggle label={switchLabel} help={switchHelp} checked={open} onChange={onOpenChange} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <TextField
            label={`${title} open at`}
            help="Leave empty to open as soon as the switch is on."
            type="datetime-local"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <Button
          size="sm"
          className="mb-6"
          disabled={draft === saved || draft === ''}
          onClick={() => onOpensAtChange(new Date(draft).toISOString())}
        >
          Save time
        </Button>
        {opensAt ? (
          <Button
            size="sm"
            variant="ghost"
            className="mb-6"
            onClick={() => {
              setDraft('');
              onOpensAtChange(null);
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function SettingsSection({
  settings,
  onSave,
}: {
  settings: EventSettings;
  onSave: (input: Partial<EventSettings>) => void;
}) {
  const [eventName, setEventName] = useState(settings.eventName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [photoShareUrl, setPhotoShareUrl] = useState(settings.photoShareUrl);
  const [location, setLocation] = useState(settings.location);
  const [startsAt, setStartsAt] = useState(toLocalInput(settings.startsAt));

  const dirty =
    eventName !== settings.eventName ||
    tagline !== settings.tagline ||
    photoShareUrl !== settings.photoShareUrl ||
    location !== settings.location ||
    startsAt !== toLocalInput(settings.startsAt);

  return (
    <Card>
      <CardHeader
        title="Event"
        subtitle="The name shows in the header on every page; the rest on the Info page."
      />
      <div className="space-y-4 p-4">
        <TextField
          label="Event name"
          value={eventName}
          onChange={(event) => setEventName(event.target.value)}
        />
        <TextField
          label="Tagline"
          help="One line under the name. Leave empty to hide it."
          value={tagline}
          onChange={(event) => setTagline(event.target.value)}
        />
        <TextField
          label="Photo album link"
          help="Optional. A link to your shared album; guests see a Photos button."
          placeholder="https://..."
          inputMode="url"
          value={photoShareUrl}
          onChange={(event) => setPhotoShareUrl(event.target.value)}
        />
        <TextAreaField
          label="Location"
          help="Anyone with the app link can see this. Leave empty to show TBA."
          rows={2}
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
        <TextField
          label="Party starts at"
          help="Leave empty to show TBA."
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
        />
        <Button
          disabled={!dirty}
          onClick={() =>
            onSave({
              eventName,
              tagline,
              photoShareUrl,
              location,
              startsAt: startsAt === '' ? null : new Date(startsAt).toISOString(),
            })
          }
        >
          Save event details
        </Button>
      </div>
    </Card>
  );
}

/** A FAQ being edited, with a stable key so reordering keeps focus and state. */
type FaqDraft = Faq & { key: number };

let nextFaqKey = 1;
const toDrafts = (faqs: Faq[]): FaqDraft[] => faqs.map((faq) => ({ ...faq, key: nextFaqKey++ }));

function FaqSection({ faqs, onSave }: { faqs: Faq[]; onSave: (faqs: Faq[]) => void }) {
  const [drafts, setDrafts] = useState(() => toDrafts(faqs));

  const cleaned = drafts.map(({ question, answer }) => ({
    question: question.trim(),
    answer: answer.trim(),
  }));
  const dirty = JSON.stringify(cleaned) !== JSON.stringify(faqs);
  const incomplete = cleaned.some((faq) => faq.question === '' || faq.answer === '');

  const update = (key: number, patch: Partial<Faq>) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const move = (index: number, direction: -1 | 1) =>
    setDrafts((list) => {
      const next = [...list];
      [next[index], next[index + direction]] = [next[index + direction]!, next[index]!];
      return next;
    });

  return (
    <Card>
      <CardHeader title="FAQ" subtitle="Shown on the Info page, in this order." />
      <div className="space-y-4 p-4">
        {drafts.map((draft, index) => (
          <div key={draft.key} className="space-y-2 rounded-xl border border-black/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold">Question {index + 1}</h3>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Move question ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Move question ${index + 1} down`}
                  disabled={index === drafts.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove question ${index + 1}`}
                  onClick={() => setDrafts((list) => list.filter((d) => d.key !== draft.key))}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
            <TextField
              label="Question"
              maxLength={200}
              value={draft.question}
              onChange={(event) => update(draft.key, { question: event.target.value })}
            />
            <TextAreaField
              label="Answer"
              maxLength={2000}
              rows={3}
              value={draft.answer}
              onChange={(event) => update(draft.key, { answer: event.target.value })}
            />
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={drafts.length >= FAQS_MAX}
            onClick={() =>
              setDrafts((list) => [...list, { question: '', answer: '', key: nextFaqKey++ }])
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            Add question
          </Button>
          <Button disabled={!dirty || incomplete} onClick={() => onSave(cleaned)}>
            Save FAQ
          </Button>
          {dirty ? (
            <Button variant="ghost" onClick={() => setDrafts(toDrafts(faqs))}>
              Discard changes
            </Button>
          ) : null}
        </div>
        {incomplete ? (
          <p className="text-sm text-ink-muted">Every question needs an answer before saving.</p>
        ) : null}
      </div>
    </Card>
  );
}

function CategoriesSection({
  config,
  hasRatings,
  actions,
}: {
  config: ContestConfig;
  hasRatings: boolean;
  actions: SetupActions;
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');

  const sorted = [...config.categories].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Card>
      <CardHeader
        title="Categories and criteria"
        subtitle="Each category is judged on its own criteria."
      />
      <div className="space-y-4 p-4">
        {sorted.map((category, index) => (
          <CategoryEditor
            key={category.id}
            category={category}
            criteria={config.criteria.filter((c) => c.categoryId === category.id)}
            hasRatings={hasRatings}
            canMoveUp={index > 0}
            canMoveDown={index < sorted.length - 1}
            onMove={(direction) => {
              const other = sorted[index + direction];
              if (!other) return;
              actions.updateCategory(category, { sortOrder: other.sortOrder });
              actions.updateCategory(other, { sortOrder: category.sortOrder });
            }}
            actions={actions}
          />
        ))}

        <div className="rounded-xl border border-dashed border-black/20 p-3">
          <p className="text-sm font-semibold">Add a category</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={emoji}
              onChange={(event) => setEmoji(event.target.value)}
              placeholder="🍖"
              aria-label="Category emoji"
              className="w-16 rounded-lg border border-black/15 px-2 py-2 text-center"
            />
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Main dishes"
              aria-label="Category name"
              className="min-w-0 flex-1 rounded-lg border border-black/15 px-3 py-2"
            />
            <Button
              disabled={name.trim().length === 0}
              onClick={() => {
                actions.createCategory(name.trim(), emoji.trim());
                setName('');
                setEmoji('');
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function CategoryEditor({
  category,
  criteria,
  hasRatings,
  canMoveUp,
  canMoveDown,
  onMove,
  actions,
}: {
  category: Category;
  criteria: Criterion[];
  hasRatings: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
  actions: SetupActions;
}) {
  const [criterionName, setCriterionName] = useState('');
  const [criterionHelp, setCriterionHelp] = useState('');
  const sorted = [...criteria].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section className="rounded-xl border border-black/10 p-3">
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-xl" aria-hidden="true">
          {category.emoji}
        </span>
        <h3 className="min-w-0 flex-1 truncate font-bold">{category.name}</h3>
        <Button
          size="sm"
          variant="ghost"
          disabled={!canMoveUp}
          onClick={() => onMove(-1)}
          aria-label={`Move ${category.name} up`}
        >
          <ChevronUp className="size-4" aria-hidden="true" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!canMoveDown}
          onClick={() => onMove(1)}
          aria-label={`Move ${category.name} down`}
        >
          <ChevronDown className="size-4" aria-hidden="true" />
        </Button>
        <Button
          size="sm"
          variant={category.isActive ? 'ghost' : 'secondary'}
          onClick={() => actions.updateCategory(category, { isActive: !category.isActive })}
        >
          {category.isActive ? 'Hide' : 'Show'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-700"
          onClick={() => actions.deleteCategory(category)}
          aria-label={`Delete ${category.name}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </header>

      <ul className="mt-3 space-y-2">
        {sorted.map((criterion, index) => (
          <li
            key={criterion.id}
            className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-muted px-2 py-1.5"
          >
            <div className="min-w-0 flex-1">
              <p
                className={`truncate font-medium ${criterion.isActive ? '' : 'text-ink-muted line-through'}`}
              >
                {criterion.name}
              </p>
              {criterion.helpText ? (
                <p className="truncate text-xs text-ink-muted">{criterion.helpText}</p>
              ) : null}
            </div>
            <Button
              size="sm"
              variant="ghost"
              disabled={index === 0}
              aria-label={`Move ${criterion.name} up`}
              onClick={() => {
                const other = sorted[index - 1];
                if (!other) return;
                actions.updateCriterion(criterion, { sortOrder: other.sortOrder });
                actions.updateCriterion(other, { sortOrder: criterion.sortOrder });
              }}
            >
              <ChevronUp className="size-4" aria-hidden="true" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => actions.updateCriterion(criterion, { isActive: !criterion.isActive })}
            >
              {criterion.isActive ? 'Hide' : 'Show'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-700"
              aria-label={`Delete ${criterion.name}`}
              onClick={() => actions.deleteCriterion(criterion)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </li>
        ))}
        {sorted.length === 0 ? (
          <li className="text-sm text-ink-muted">No criteria yet: entries here cannot be rated.</li>
        ) : null}
      </ul>

      {hasRatings ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          People have already rated entries. A new criterion makes their ratings part-finished until
          they come back. Hiding a criterion is always safe.
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={criterionName}
          onChange={(event) => setCriterionName(event.target.value)}
          placeholder="Criterion, e.g. Spice"
          aria-label={`New criterion name for ${category.name}`}
          className="min-w-0 flex-1 rounded-lg border border-black/15 px-3 py-2"
        />
        <input
          value={criterionHelp}
          onChange={(event) => setCriterionHelp(event.target.value)}
          placeholder="Help text guests see"
          aria-label={`New criterion help text for ${category.name}`}
          className="min-w-0 flex-1 rounded-lg border border-black/15 px-3 py-2"
        />
        <Button
          disabled={criterionName.trim().length === 0}
          onClick={() => {
            actions.createCriterion(category.id, criterionName.trim(), criterionHelp.trim());
            setCriterionName('');
            setCriterionHelp('');
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add criterion
        </Button>
      </div>
    </section>
  );
}

function AwardsSection({ config, actions }: { config: ContestConfig; actions: SetupActions }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<string[]>([]);

  const toggleScope = (id: string) =>
    setScope(scope.includes(id) ? scope.filter((s) => s !== id) : [...scope, id]);

  return (
    <Card>
      <CardHeader
        title="Special awards"
        subtitle="Each guest nominates one entry per award. Separate from the star ratings."
      />
      <div className="space-y-4 p-4">
        {[...config.awards]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((award) => (
            <div
              key={award.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-black/10 p-3"
            >
              <span className="text-xl" aria-hidden="true">
                {award.emoji || '🏆'}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`font-semibold ${award.isActive ? '' : 'text-ink-muted line-through'}`}
                >
                  {award.name}
                </p>
                <p className="text-xs text-ink-muted">
                  {award.categoryIds.length === 0
                    ? 'Any category'
                    : award.categoryIds
                        .map((id) => config.categories.find((c) => c.id === id)?.name ?? id)
                        .join(', ')}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => actions.updateAward(award, { isActive: !award.isActive })}
              >
                {award.isActive ? 'Hide' : 'Show'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-700"
                aria-label={`Delete ${award.name}`}
                onClick={() => actions.deleteAward(award)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}

        <div className="rounded-xl border border-dashed border-black/20 p-3">
          <p className="text-sm font-semibold">Add an award</p>
          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              <input
                value={emoji}
                onChange={(event) => setEmoji(event.target.value)}
                placeholder="🎄"
                aria-label="Award emoji"
                className="w-16 rounded-lg border border-black/15 px-2 py-2 text-center"
              />
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Most Festive"
                aria-label="Award name"
                className="min-w-0 flex-1 rounded-lg border border-black/15 px-3 py-2"
              />
            </div>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What guests should look for"
              aria-label="Award description"
              className="w-full rounded-lg border border-black/15 px-3 py-2"
            />
            <fieldset>
              <legend className="text-xs font-semibold text-ink-muted">
                Eligible categories (none selected = all)
              </legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {config.categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={scope.includes(category.id)}
                    onClick={() => toggleScope(category.id)}
                    className={`rounded-full border px-3 py-1 text-sm font-medium ${
                      scope.includes(category.id)
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-black/15 bg-white'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <Button
              disabled={name.trim().length === 0}
              onClick={() => {
                actions.createAward(name.trim(), emoji.trim(), description.trim(), scope);
                setName('');
                setEmoji('');
                setDescription('');
                setScope([]);
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add award
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
