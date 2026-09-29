const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dayTimeFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** "in 42 min", "in 3 h 5 min", "in 2 days". Coarse on purpose: it is a party. */
export function untilText(target: Date, now: Date): string {
  const seconds = Math.max(0, Math.round((target.getTime() - now.getTime()) / 1000));
  if (seconds < 60) return `in ${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `in ${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
  return `in ${Math.round(hours / 24)} days`;
}

export function opensAtText(opensAt: Date, now: Date): string {
  const sameDay = opensAt.toDateString() === now.toDateString();
  return (sameDay ? timeFormat : dayTimeFormat).format(opensAt);
}

/** "2026-12-20T19:30" in the browser's own time zone, as a datetime-local input wants. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
