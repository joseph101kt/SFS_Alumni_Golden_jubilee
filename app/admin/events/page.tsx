// app/admin/events/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminShell from '@/components/admin-shell';
import { eventFeeSummary } from '@/lib/events/pricing';
import type { EventCatalog } from '@/lib/events/types';

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventCatalog[]>([]);
  const [message, setMessage] = useState('Loading…');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/events', { cache: 'no-store' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload.error || 'Could not load events');
        setEvents([]);
        return;
      }
      setEvents(payload as EventCatalog[]);
      setMessage('');
    })();
  }, []);

  return (
    <AdminShell title="Events">
      <div className="flex justify-end mb-4">
        <Link
          href="/admin/events/new"
          className="inline-flex items-center gap-2 rounded-lg bg-secondary-container text-on-secondary-container hover:bg-secondary-fixed px-4 py-2.5 text-label-sm font-bold shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New event
        </Link>
      </div>
      {message && (
        <p className="rounded-xl border border-jubilee-gold-light bg-secondary-container/25 p-4 text-body-sm text-on-secondary-fixed-variant mb-4">
          {message}
        </p>
      )}
      <div className="space-y-3">
        {events.map((e) => (
          <article
            key={e.id}
            className="rounded-2xl border border-primary/10 bg-surface-paper p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-headline-sm text-primary">{e.title}</h3>
                {e.published ? (
                  <span className="text-label-sm px-2.5 py-1 rounded-md bg-primary text-secondary-container">
                    Published
                  </span>
                ) : (
                  <span className="text-label-sm px-2.5 py-1 rounded-md bg-surface-ivory text-navy-subtle border border-primary/10">
                    Draft
                  </span>
                )}
                {e.is_primary && (
                  <span className="text-label-sm px-2.5 py-1 rounded-md bg-secondary-container text-on-secondary-container">
                    Primary
                  </span>
                )}
              </div>
              <p className="text-body-sm text-on-surface-variant mt-1">
                {new Date(e.starts_at).toLocaleString('en-IN')}
                {e.venue ? ` · ${e.venue}` : ''}
              </p>
              <p className="text-label-sm text-navy-subtle mt-1">{eventFeeSummary()}</p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/admin/registrations?event=${e.id}`}
                className="rounded-lg border border-jubilee-gold-light bg-surface-ivory px-3 py-2 text-label-sm text-jubilee-gold-deep hover:bg-secondary-container/40"
              >
                Registrations
              </Link>
              <Link
                href={`/admin/events/${e.id}`}
                className="rounded-lg bg-primary text-on-primary px-3 py-2 text-label-sm"
              >
                Edit
              </Link>
            </div>
          </article>
        ))}
      </div>
    </AdminShell>
  );
}