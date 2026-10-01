export const EVENT_SECTIONS = [
  { id: 'details', label: 'Details' },
  { id: 'rsvp', label: 'RSVP' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'faq', label: 'FAQ' },
] as const;

export type EventSectionId = (typeof EVENT_SECTIONS)[number]['id'];

/** Clears the sticky app header plus the section chips when jumping to a section. */
export const SECTION_SCROLL_MARGIN = 'calc(var(--header-h, 4rem) + 4rem)';

/** Scrolls to a section and puts its hash in the URL, so a refresh lands there too. */
export function jumpTo(id: EventSectionId) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.history.replaceState(window.history.state, '', `#${id}`);
}
