'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type DayOf = {
  headline: string;
  when: string;
  venue: string;
  mapUrl: string;
  parkingNote: string;
  helpText: string;
  helpPhone: string;
};

export default function EventDayPage() {
  const [day, setDay] = useState<DayOf | null>(null);

  useEffect(() => {
    fetch('/api/event-app/day-of', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setDay(d as DayOf))
      .catch(() => {});
  }, []);

  return (
    <main className="flex-1 px-4 py-8 max-w-xl mx-auto w-full">
      <Link href="/event-app" className="text-label-sm text-primary underline-offset-2 hover:underline">
        ← Event app
      </Link>
      <h1 className="text-headline-md text-primary mt-4">{day?.headline || 'Day-of details'}</h1>
      {!day ? (
        <p className="mt-4 text-body-sm text-on-surface-variant">Loading…</p>
      ) : (
        <dl className="mt-6 space-y-4">
          <div className="rounded-2xl border border-primary/10 bg-surface-paper p-4">
            <dt className="text-label-sm uppercase tracking-wider text-on-surface-variant">When</dt>
            <dd className="mt-1 text-body-md text-primary">{day.when}</dd>
          </div>
          <div className="rounded-2xl border border-primary/10 bg-surface-paper p-4">
            <dt className="text-label-sm uppercase tracking-wider text-on-surface-variant">Venue</dt>
            <dd className="mt-1 text-body-md text-primary">{day.venue}</dd>
            <a
              href={day.mapUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex mt-3 text-label-sm text-jubilee-gold-deep underline-offset-2 hover:underline"
            >
              Open map
            </a>
          </div>
          <div className="rounded-2xl border border-primary/10 bg-surface-paper p-4">
            <dt className="text-label-sm uppercase tracking-wider text-on-surface-variant">Parking</dt>
            <dd className="mt-1 text-body-md text-primary">{day.parkingNote}</dd>
          </div>
          <div className="rounded-2xl border border-primary/10 bg-surface-paper p-4">
            <dt className="text-label-sm uppercase tracking-wider text-on-surface-variant">Help</dt>
            <dd className="mt-1 text-body-md text-primary">{day.helpText}</dd>
            {day.helpPhone ? (
              <a href={`tel:${day.helpPhone}`} className="inline-flex mt-3 text-label-sm text-primary font-bold">
                Call {day.helpPhone}
              </a>
            ) : null}
          </div>
        </dl>
      )}
      <p className="mt-8 text-body-sm text-on-surface-variant">
        Tip: turn screen brightness up when showing your QR at the gate.
      </p>
      <Link
        href="/event-app/pass"
        className="inline-flex mt-4 rounded-lg bg-primary text-on-primary px-5 py-3 text-label-md"
      >
        Show venue pass
      </Link>
    </main>
  );
}
