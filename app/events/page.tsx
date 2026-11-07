// app/events/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import MemberGate from '@/components/member-gate';
import PortalShell from '@/components/portal-shell';
import { eventFeeSummary } from '@/lib/events/pricing';
import type { EventCatalog } from '@/lib/events/types';

export default function EventsPage() {
  const [events, setEvents] = useState<EventCatalog[]>([]);
  const [message, setMessage] = useState('Loading events…');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/events', { cache: 'no-store' });
        const payload = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setMessage(payload.error || 'Events are not connected yet.');
          setEvents([]);
          return;
        }
        const rows = payload as EventCatalog[];
        setEvents(rows);
        setMessage(rows.length ? '' : 'No upcoming events have been published yet.');
      } catch {
        if (active) setMessage('Events are not configured yet.');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <PortalShell title="Make the next memory" eyebrow="REUNIONS · MEETUPS · SCHOOL EVENTS">
      <MemberGate>
        {message && (
          <p className="rounded-xl bg-secondary-container/30 border border-jubilee-gold-light p-5 text-body-sm text-on-secondary-fixed-variant mb-4">
            {message}
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((e) => (
            <article
              key={e.id}
              className="rounded-2xl bg-surface-paper border border-primary/10 p-6 shadow-sm hover:border-jubilee-gold-light transition-colors"
            >
              <div className="text-label-sm uppercase tracking-widest text-jubilee-gold-deep font-bold">
                {new Date(e.starts_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
              <h2 className="text-headline-sm text-primary mt-3">{e.title}</h2>
              <p className="text-body-sm text-navy-subtle mt-2">{e.summary}</p>
              {e.venue && (
                <p className="text-label-sm text-on-surface-variant mt-3">Venue: {e.venue}</p>
              )}
              <p className="text-label-sm text-navy-subtle mt-3">{eventFeeSummary()}</p>
              <Link
                href={`/registration?event=${e.id}`}
                className="inline-flex mt-5 rounded-lg bg-secondary-container text-on-secondary-container hover:bg-secondary-fixed px-4 py-2.5 text-label-sm font-bold"
              >
                Register ↗
              </Link>
            </article>
          ))}
        </div>
      </MemberGate>
    </PortalShell>
  );
}