import { ChevronDown } from 'lucide-react';
import { useContest } from '../../lib/queries.ts';
import { Card } from '../ui/Card.tsx';

export function FaqSection() {
  const contest = useContest();
  const faqs = contest.data?.settings.faqs ?? [];

  return (
    <>
      <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
        Frequently asked questions
      </h2>
      {contest.isSuccess && faqs.length === 0 ? (
        <p className="text-ink-muted">No questions yet. Check back closer to the party.</p>
      ) : null}
      <Card className="divide-y divide-black/5">
        {faqs.map(({ question, answer }) => (
          <details key={question} className="group">
            <summary className="tap-target flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
              {question}
              <ChevronDown
                className="size-5 shrink-0 text-ink-muted transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="px-4 pb-4 whitespace-pre-line text-ink-muted">{answer}</p>
          </details>
        ))}
      </Card>
    </>
  );
}
