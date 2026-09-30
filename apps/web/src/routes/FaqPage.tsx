import { ChevronDown } from 'lucide-react';
import { InfoTabs } from '../components/InfoTabs.tsx';
import { Card } from '../components/ui/Card.tsx';

// Static copy: edit here for next year's party.
const FAQS: { question: string; answer: string }[] = [
  {
    question: 'Is the event free?',
    answer:
      'Yes, since most partygoers take part in the challenges. If you’re not entering a friendly competition, we encourage you to donate to the pizza fund.',
  },
  {
    question: 'Can I bring my kids?',
    answer:
      'No, this is a 21-and-up party. All the other events around the holidays will include our children.',
  },
  {
    question: 'When should I show up?',
    answer:
      'If you’re entering a challenge, please try to arrive within the first hour of the event.',
  },
  {
    question: 'When are the winners announced?',
    answer: 'Around 8–9 pm.',
  },
  {
    question: 'Can I bring something to share but not enter it in the competitions?',
    answer: 'Of course! We’d love anything you’d like to share with the PDXmas family.',
  },
];

export function FaqPage() {
  return (
    <div className="space-y-4">
      <InfoTabs />
      <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
        Frequently asked questions
      </h2>
      <Card className="divide-y divide-black/5">
        {FAQS.map(({ question, answer }) => (
          <details key={question} className="group">
            <summary className="tap-target flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
              {question}
              <ChevronDown
                className="size-5 shrink-0 text-ink-muted transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="px-4 pb-4 text-ink-muted">{answer}</p>
          </details>
        ))}
      </Card>
    </div>
  );
}
