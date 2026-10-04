import type { EventSettings, ScheduleItem } from '@contest/shared';

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

/**
 * The evening as guests see it: the host's timeline items plus the start,
 * entry and voting times, in time order and grouped by day.
 */
export function eventTimeline(settings: EventSettings): { day: string; items: ScheduleItem[] }[] {
  const fixed: ScheduleItem[] = [
    { at: settings.startsAt, title: 'Party starts', details: '' },
    {
      at: settings.submissionsOpenAt,
      title: 'Entries open',
      details: 'Submit your entry.',
    },
    {
      at: settings.votingOpensAt,
      title: 'Voting opens',
      details: 'Check out the entries and vote.',
    },
  ].filter((item): item is ScheduleItem => item.at !== null);

  const items = [...fixed, ...settings.schedule].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
  const days: { day: string; items: ScheduleItem[] }[] = [];
  for (const item of items) {
    const day = dayFormat.format(new Date(item.at));
    const last = days.at(-1);
    if (last?.day === day) last.items.push(item);
    else days.push({ day, items: [item] });
  }
  return days;
}
