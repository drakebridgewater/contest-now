import { EMAIL_MERGE_TAGS, type AdminGuest, type CustomEmail } from '@contest/shared';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import clsx from 'clsx';
import {
  Bold,
  Eye,
  Images,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Send,
  Ticket,
  User,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../../lib/api.ts';
import { errorMessage } from '../../lib/errorMessage.ts';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';
import { TextField } from '../ui/Field.tsx';
import { guestMatchesFilter, type GuestFilter } from './guestFilter.ts';
import { FilterChips } from './GuestsTab.tsx';

const DRAFT_KEY = 'contest.emailDraft';

interface Draft {
  subject: string;
  html: string;
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw) as Draft;
  } catch {
    // Private window or blocked storage: start blank.
  }
  return { subject: '', html: '' };
}

function saveDraft(draft: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Not worth bothering the host about.
  }
}

/** A merge tag as it is written in the email, e.g. `{{ rsvp_link }}`. */
const tag = (name: keyof typeof EMAIL_MERGE_TAGS) => `{{ ${name} }}`;
const MERGE_TAG_HREF = /^\{\{\s*\w+\s*\}\}$/;

function ToolButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'tap-target inline-flex size-9 items-center justify-center rounded-lg disabled:opacity-40',
        active ? 'bg-brand-600 text-white' : 'text-ink hover:bg-black/5',
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, hasPhotoAlbum }: { editor: Editor; hasPhotoAlbum: boolean }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      link: e.isActive('link'),
    }),
  });

  function insertLink(href: string, text: string) {
    // The trailing space is its own node so typing on afterwards is not part of the link.
    editor
      .chain()
      .focus()
      .insertContent([
        { type: 'text', text, marks: [{ type: 'link', attrs: { href } }] },
        { type: 'text', text: ' ' },
      ])
      .run();
  }

  function editLink() {
    if (state.link) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const href = prompt('Link address (https://…)');
    if (!href) return;
    if (editor.state.selection.empty) insertLink(href, href);
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }

  const insertClass =
    'tap-target inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-40';

  return (
    <div className="space-y-2 border-b border-black/10 p-2">
      <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Formatting">
        <ToolButton
          label="Bold"
          active={state.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label="Italic"
          active={state.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label="Bulleted list"
          active={state.bullet}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label="Numbered list"
          active={state.ordered}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label={state.link ? 'Remove link' : 'Add link'}
          active={state.link}
          onClick={editLink}
        >
          <LinkIcon className="size-4" aria-hidden="true" />
        </ToolButton>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Insert">
        <span className="text-xs font-semibold text-ink-muted uppercase">Insert</span>
        <button
          type="button"
          className={insertClass}
          onClick={() => editor.chain().focus().insertContent(tag('guest_name')).run()}
        >
          <User className="size-4" aria-hidden="true" />
          {EMAIL_MERGE_TAGS.guest_name}
        </button>
        <button
          type="button"
          className={insertClass}
          onClick={() => insertLink(tag('rsvp_link'), 'RSVP here')}
        >
          <Ticket className="size-4" aria-hidden="true" />
          {EMAIL_MERGE_TAGS.rsvp_link}
        </button>
        <button
          type="button"
          className={insertClass}
          disabled={!hasPhotoAlbum}
          title={hasPhotoAlbum ? undefined : 'Add a photo album link under Setup first'}
          onClick={() => insertLink(tag('photo_album_link'), 'Party photos')}
        >
          <Images className="size-4" aria-hidden="true" />
          {EMAIL_MERGE_TAGS.photo_album_link}
        </button>
      </div>
    </div>
  );
}

export function EmailTab({
  guests,
  mailConfigured,
  hasPhotoAlbum,
  sending,
  onSend,
}: {
  guests: readonly AdminGuest[];
  mailConfigured: boolean;
  hasPhotoAlbum: boolean;
  sending: boolean;
  onSend: (email: CustomEmail) => void;
}) {
  const [draft] = useState(loadDraft);
  const [subject, setSubject] = useState(draft.subject);
  const [html, setHtml] = useState(draft.html);
  const [isEmpty, setIsEmpty] = useState(true);
  const [filter, setFilter] = useState<GuestFilter>('all');
  /** Unticked by hand. Everyone the filter shows is ticked unless they are in here. */
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | undefined>();
  const [previewing, setPreviewing] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          isAllowedUri: (url, { defaultValidate }) =>
            MERGE_TAG_HREF.test(url) || defaultValidate(url),
        },
      }),
    ],
    content: draft.html,
    editorProps: {
      attributes: {
        'aria-label': 'Message',
        class: 'prose-email min-h-48 p-3 focus:outline-none',
      },
    },
    onCreate: ({ editor: e }) => setIsEmpty(e.isEmpty),
    onUpdate: ({ editor: e }) => {
      setHtml(e.getHTML());
      setIsEmpty(e.isEmpty);
    },
  });

  useEffect(() => saveDraft({ subject, html }), [subject, html]);

  // Not people waiting on (or turned away by) the host.
  const withEmail = useMemo(
    () => guests.filter((g) => g.email !== '' && g.access === 'invited'),
    [guests],
  );
  const shown = useMemo(
    () => withEmail.filter((guest) => guestMatchesFilter(guest, filter)),
    [withEmail, filter],
  );
  const recipients = shown.filter((guest) => !excluded.has(guest.id));

  function toggle(id: string) {
    setExcluded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function showPreview() {
    setPreviewing(true);
    setPreviewError(undefined);
    try {
      setPreview(await api.previewEmail({ subject, html }));
    } catch (error) {
      setPreview(null);
      setPreviewError(errorMessage(error));
    } finally {
      setPreviewing(false);
    }
  }

  const ready = subject.trim() !== '' && !isEmpty;
  const usesRsvpLink = html.includes('rsvp_link');

  return (
    <div className="space-y-4">
      {!mailConfigured ? (
        <p className="rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Email is not set up on the server, so messages cannot be sent. You can still write and
          preview one.
        </p>
      ) : null}

      <Card className="space-y-3 p-4">
        <h2 className="text-lg font-bold">Who gets it</h2>
        <FilterChips value={filter} onChange={setFilter} />
        {shown.length === 0 ? (
          <p className="text-sm text-ink-muted">No guests with an email address match.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 text-sm">
              <p className="font-semibold" aria-live="polite">
                {recipients.length} of {shown.length} selected
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setExcluded((previous) => {
                    const next = new Set(previous);
                    const allOn = recipients.length === shown.length;
                    for (const guest of shown) {
                      if (allOn) next.add(guest.id);
                      else next.delete(guest.id);
                    }
                    return next;
                  })
                }
              >
                {recipients.length === shown.length ? 'Select none' : 'Select all'}
              </Button>
            </div>
            <ul className="max-h-64 divide-y divide-black/5 overflow-y-auto rounded-lg border border-black/10">
              {shown.map((guest) => (
                <li key={guest.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-600"
                      checked={!excluded.has(guest.id)}
                      onChange={() => toggle(guest.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{guest.name}</span>
                      <span className="block truncate text-xs text-ink-muted">{guest.email}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-lg font-bold">Message</h2>
        <TextField
          label="Subject"
          value={subject}
          maxLength={200}
          onChange={(event) => setSubject(event.target.value)}
        />
        <div className="overflow-hidden rounded-lg border border-black/15 bg-white">
          {editor ? <Toolbar editor={editor} hasPhotoAlbum={hasPhotoAlbum} /> : null}
          <EditorContent editor={editor} />
        </div>
        <p className="text-xs text-ink-muted">
          Merge tags like <code>{tag('guest_name')}</code> are filled in for each guest.
          {usesRsvpLink
            ? ' Each guest gets a fresh personal RSVP link; any older one they had stops working.'
            : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!ready} loading={previewing} onClick={showPreview}>
            <Eye className="size-4" aria-hidden="true" />
            Preview
          </Button>
          <Button
            disabled={!ready || !mailConfigured || recipients.length === 0}
            loading={sending}
            onClick={() => {
              const count = recipients.length;
              if (!confirm(`Email ${count} ${count === 1 ? 'guest' : 'guests'}?`)) return;
              onSend({ subject, html, guestIds: recipients.map((guest) => guest.id) });
            }}
          >
            <Send className="size-4" aria-hidden="true" />
            Send to {recipients.length}
          </Button>
        </div>
        {previewError ? (
          <p role="alert" className="text-sm text-red-700">
            {previewError}
          </p>
        ) : null}
      </Card>

      {preview ? (
        <Card className="space-y-2 p-4">
          <h2 className="text-lg font-bold">Preview</h2>
          <p className="text-sm">
            <span className="text-ink-muted">Subject:</span> <strong>{preview.subject}</strong>
          </p>
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={preview.html}
            className="h-96 w-full rounded-lg border border-black/10 bg-white"
          />
          <p className="text-xs text-ink-muted">Shown for a sample guest with a sample link.</p>
        </Card>
      ) : null}
    </div>
  );
}
