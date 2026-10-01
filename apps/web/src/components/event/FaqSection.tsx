import { labelFor } from '@contest/shared';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { useContest, useRsvpSummary } from '../../lib/queries.ts';
import { Card } from '../ui/Card.tsx';

export function FaqSection() {
  const contest = useContest();
  const settings = contest.data?.settings;
  const faqs = settings?.faqs ?? [];
  const guestAllergies = useRsvpSummary().data?.allergies ?? [];
  // The host's list first, in their order, then anything only guests reported.
  const allergies = [...new Set([...(settings?.knownAllergies ?? []), ...guestAllergies])];

  return (
    <>
      <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
        Frequently asked questions
      </h2>
      {contest.isSuccess && faqs.length === 0 && allergies.length === 0 ? (
        <p className="text-ink-muted">No questions yet. Check back closer to the party.</p>
      ) : null}
      <Card className="divide-y divide-black/5">
        {allergies.length > 0 ? (
          <FaqItem question="Are there any allergies to know about?">
            <p className="whitespace-pre-line text-ink-muted">
              Yes. You can still use these ingredients, but please mention them when you arrive so
              we can put up the right signage.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {allergies.map((id) => {
                const { label, emoji } = labelFor(id);
                return (
                  <li
                    key={id}
                    className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-950"
                  >
                    <span aria-hidden="true">{emoji}</span> <span>{label}</span>
                  </li>
                );
              })}
            </ul>
          </FaqItem>
        ) : null}
        {faqs.map(({ question, answer }) => (
          <FaqItem key={question} question={question}>
            <p className="whitespace-pre-line text-ink-muted">{answer}</p>
          </FaqItem>
        ))}
      </Card>
    </>
  );
}

function FaqItem({ question, children }: { question: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="tap-target flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
        {question}
        <ChevronDown
          className="size-5 shrink-0 text-ink-muted transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}
