import type { VoterInfo } from '@contest/shared';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';

export function VotersTab({
  voters,
  onRename,
  onDelete,
}: {
  voters: VoterInfo[];
  onRename: (voterName: string, newName: string) => void;
  onDelete: (voter: VoterInfo) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (voters.length === 0) {
    return <p className="text-ink-muted">Nobody has voted yet.</p>;
  }

  return (
    <Card className="divide-y divide-black/5">
      <p className="px-4 py-3 text-sm text-ink-muted">
        {voters.length} {voters.length === 1 ? 'voter' : 'voters'}. Renaming moves that
        person&apos;s ratings and nominations with them.
      </p>
      {voters.map((voter) => (
        <div key={voter.voterName} className="flex flex-wrap items-center gap-3 px-4 py-3">
          {editing === voter.voterName ? (
            <>
              <input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commit(voter.voterName);
                  if (event.key === 'Escape') setEditing(null);
                }}
                aria-label={`New name for ${voter.voterName}`}
                className="min-w-0 flex-1 rounded-lg border border-black/15 px-2 py-1.5"
              />
              <Button size="sm" onClick={() => commit(voter.voterName)}>
                <Check className="size-4" aria-hidden="true" />
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                <X className="size-4" aria-hidden="true" />
              </Button>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{voter.voterName}</p>
                <p className="text-sm text-ink-muted">
                  {voter.completeVoteCount} rated
                  {voter.voteCount > voter.completeVoteCount
                    ? ` · ${voter.voteCount - voter.completeVoteCount} part-finished`
                    : ''}
                  {voter.ballotCount > 0 ? ` · ${voter.ballotCount} nominations` : ''}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(voter.voterName);
                  setDraft(voter.voterName);
                }}
              >
                <Pencil className="size-4" aria-hidden="true" />
                Rename
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-700"
                onClick={() => onDelete(voter)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
      ))}
    </Card>
  );

  function commit(voterName: string) {
    const next = draft.trim();
    setEditing(null);
    if (next.length >= 2 && next !== voterName) onRename(voterName, next);
  }
}
