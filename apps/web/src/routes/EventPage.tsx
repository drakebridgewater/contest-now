import { useIsFetching } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router';
import { EventExtras, EventFacts } from '../components/event/EventDetails.tsx';
import { EventSectionNav } from '../components/event/EventSectionNav.tsx';
import { FaqSection } from '../components/event/FaqSection.tsx';
import { ScheduleSection } from '../components/event/ScheduleSection.tsx';
import { EVENT_SECTIONS, SECTION_SCROLL_MARGIN } from '../components/event/sections.ts';
import { useContest } from '../lib/queries.ts';
import { eventTimeline } from '../lib/timeline.ts';
import { useInviteSignIn } from '../lib/useInviteSignIn.ts';

const sectionStyle = { scrollMarginTop: SECTION_SCROLL_MARGIN };

/**
 * Everything a guest needs on one page, in the order they need it: the key
 * facts, then the fine print, the timeline and the FAQ.
 */
export function EventPage() {
  useInviteSignIn();
  const settings = useContest().data?.settings;
  const hasSchedule = settings ? eventTimeline(settings).length > 0 : false;
  useScrollToHash();

  return (
    <div className="space-y-4">
      <EventSectionNav hidden={hasSchedule ? [] : ['schedule']} />

      <section id="details" data-section="details" className="space-y-4" style={sectionStyle}>
        <EventFacts />
      </section>

      {/* Still the details, just the parts nobody needs before answering. */}
      <section
        id="contest"
        data-section="details"
        aria-label="More details"
        className="space-y-4"
        style={sectionStyle}
      >
        <EventExtras />
      </section>

      {hasSchedule ? (
        <section id="schedule" data-section="schedule" className="space-y-4" style={sectionStyle}>
          <ScheduleSection />
        </section>
      ) : null}

      <section id="faq" data-section="faq" className="space-y-4" style={sectionStyle}>
        <FaqSection />
      </section>
    </div>
  );
}

/**
 * Opens at the section in the URL hash (like /event#faq). Waits until nothing
 * is loading, because content filling in above would push the target down.
 */
function useScrollToHash() {
  const { hash } = useLocation();
  const contestLoaded = useContest().isSuccess;
  const fetching = useIsFetching();
  const loaded = contestLoaded && fetching === 0;
  const done = useRef(false);

  useEffect(() => {
    const id = hash.slice(1);
    if (done.current || !loaded || !EVENT_SECTIONS.some((s) => s.id === id)) return;
    done.current = true;
    document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, [hash, loaded]);
}

/** Redirects to /event, keeping the query so invite and sign-in links still work. */
export function ToEvent({ hash = '' }: { hash?: string }) {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/event', search, hash }} replace />;
}
