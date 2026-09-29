import type { PhaseStatus } from '@contest/shared';
import { Clock } from 'lucide-react';
import { opensAtText, untilText } from '../lib/time.ts';

/** Why a page is not accepting input yet (scheduled) or any more (closed). */
export function PhaseNotice({
  status,
  opensAt,
  now,
  scheduledTitle,
  closedText,
}: {
  status: PhaseStatus;
  opensAt: string | null;
  now: Date;
  scheduledTitle: string;
  closedText: string;
}) {
  if (status === 'open') return null;
  if (status === 'closed' || opensAt === null) {
    return (
      <p className="rounded-card border border-amber-300 bg-amber-50 px-4 py-3 font-medium text-amber-900">
        {closedText}
      </p>
    );
  }
  const at = new Date(opensAt);
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-card border border-accent-500/30 bg-accent-100 px-4 py-3 text-accent-700"
    >
      <Clock className="size-6 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">
          {scheduledTitle} at {opensAtText(at, now)}
        </p>
        <p className="text-sm">{untilText(at, now)} · this page opens by itself</p>
      </div>
    </div>
  );
}
