import { useContest } from '../../lib/queries.ts';
import { eventTimeline } from '../../lib/timeline.ts';
import { Card } from '../ui/Card.tsx';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** The evening's timeline. The Event page hides the section when it is empty. */
export function ScheduleSection() {
  const settings = useContest().data?.settings;
  if (!settings) return null;
  const days = eventTimeline(settings);

  return (
    <>
      <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
        Schedule
      </h2>
      {days.map(({ day, items }) => (
        <Card key={day}>
          {days.length > 1 ? (
            <h3 className="border-b border-black/5 px-4 py-3 font-bold">{day}</h3>
          ) : null}
          <ol className="divide-y divide-black/5">
            {items.map((item) => (
              <li key={`${item.at}-${item.title}`} className="flex gap-3 px-4 py-3">
                <time
                  dateTime={item.at}
                  className="w-20 shrink-0 font-semibold text-brand-700 tabular-nums"
                >
                  {timeFormat.format(new Date(item.at))}
                </time>
                <span className="min-w-0">
                  <span className="block font-semibold">{item.title}</span>
                  {item.details ? (
                    <span className="block text-sm text-ink-muted">{item.details}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      ))}
    </>
  );
}
