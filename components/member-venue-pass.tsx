'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import RegistrationQr from '@/components/registration-qr';
import { formatCostForDisplay, type GuestChoice } from '@/lib/registration';
import { registrationPath } from '@/lib/events/choose-event';
import { venuePassSummary } from '@/lib/events/venue-pass';
import type { EventCatalog } from '@/lib/events/types';

type Registration = {
  number_of_guests: number;
  lunch: boolean;
  dinner: boolean;
  parking_needed: string;
  food_preference: string | null;
  guests?: GuestChoice[] | null;
  payment_status: string;
  amount_due_paise?: number;
  registration_code?: string | null;
};

type Loaded = {
  eventId: string;
  eventTitle: string;
  when: string;
  venue: string;
  name: string;
  registration: Registration;
};

function whenLabel(starts: string, ends?: string | null): string {
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  const start = day(starts);
  const end = ends ? day(ends) : '';
  return end && end !== start ? `${start} – ${end}` : start;
}

export default function MemberVenuePass() {
  const [passes, setPasses] = useState<Loaded[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'empty' | 'hidden'>('loading');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const meRes = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!active) return;
        if (!meRes.ok) {
          setPhase('hidden');
          return;
        }
        const me = await meRes.json();
        if (me.role === 'admin') {
          setPhase('hidden');
          return;
        }
        const listRes = await fetch('/api/events', { cache: 'no-store' });
        if (!listRes.ok || !active) {
          setPhase('hidden');
          return;
        }
        const list = (await listRes.json()) as EventCatalog[];
        if (!Array.isArray(list)) {
          setPhase('hidden');
          return;
        }
        const loaded: Loaded[] = [];
        for (const event of list) {
          const regRes = await fetch(`/api/registration/event?eventId=${encodeURIComponent(event.id)}`, {
            cache: 'no-store',
          });
          if (regRes.status === 401) {
            if (active) setPhase('hidden');
            return;
          }
          if (!regRes.ok || !active) continue;
          const payload = await regRes.json();
          if (!payload.registration) continue;
          loaded.push({
            eventId: event.id,
            eventTitle: event.title,
            when: whenLabel(event.starts_at, event.ends_at),
            venue: event.venue || '',
            name: String(payload.profile?.full_name || ''),
            registration: payload.registration as Registration,
          });
        }
        if (!active) return;
        setPasses(loaded);
        setPhase(loaded.length ? 'ready' : 'empty');
      } catch {
        if (active) setPhase('hidden');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (phase === 'hidden') return null;
  if (phase === 'loading') {
    return <p className="mb-6 text-body-sm text-on-surface-variant">Loading your registrations…</p>;
  }
  if (phase === 'empty') {
    return (
      <section id="venue-pass" className="mb-6 rounded-2xl border border-outline-variant bg-white p-6 shadow-sm">
        <h2 className="text-headline-sm text-primary">No registration yet</h2>
        <p className="text-body-sm text-on-surface-variant mt-2">
          Pick an open event and register. Your pass, payment, and venue code will show up here.
        </p>
        <Link href="/registration" className="inline-flex mt-5 px-5 py-3 rounded-lg bg-primary text-white text-label-md">
          Register for an event
        </Link>
      </section>
    );
  }

  return (
    <div id="venue-pass" className="space-y-4 mb-6 scroll-mt-28">
      {passes.map((pass) => {
        const summary = venuePassSummary({
          ...pass.registration,
          amount_due_paise: Math.max(0, Number(pass.registration.amount_due_paise) || 0),
        });
        const facts = [
          ['People', String(summary.people)],
          ['Food', summary.food],
          ['Meals', summary.meals],
          ['Parking', summary.parking],
        ];
        return (
          <section key={pass.eventId} aria-label={`${pass.eventTitle} registration`} className="rounded-2xl border border-outline-variant bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-label-sm uppercase tracking-[0.16em] text-jubilee-gold-deep font-bold">
                {summary.paid ? 'Venue pass' : 'Registration'}
              </p>
              <p
                className={`rounded-full px-3 py-1 text-label-sm font-bold ${
                  summary.paid ? 'bg-secondary-container text-on-secondary-fixed' : 'bg-error-container text-error'
                }`}
              >
                {summary.paid ? 'Paid' : `Due ${formatCostForDisplay(pass.registration.amount_due_paise || 0)}`}
              </p>
            </div>
            <h2 className="text-headline-sm text-primary mt-3">{pass.eventTitle}</h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              {pass.when}
              {pass.venue ? ` · ${pass.venue}` : ''}
            </p>
            {pass.name ? <p className="text-body-md text-primary mt-3">{pass.name}</p> : null}

            <dl className="mt-5 grid grid-cols-2 gap-3">
              {facts.map(([label, value]) => (
                <div key={label} className="rounded-xl bg-surface-container px-4 py-3">
                  <dt className="text-label-sm uppercase tracking-wider text-on-surface-variant">{label}</dt>
                  <dd className="text-body-md text-primary mt-1">{value}</dd>
                </div>
              ))}
            </dl>

            {summary.code ? (
              <div className="mt-5 rounded-xl border border-outline-variant px-4 py-5 text-center">
                <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                  Show this at the venue
                </p>
                <p className="mt-2 text-headline-md text-primary tracking-[0.18em] font-bold">{summary.code}</p>
                <div className="mt-4 flex justify-center">
                  <RegistrationQr code={summary.code} />
                </div>
                <p className="mt-4 text-body-sm text-on-surface-variant">
                  Turn brightness up. Prefer the{' '}
                  <Link href="/event-app" className="text-primary underline-offset-2 hover:underline">
                    home-screen event app
                  </Link>{' '}
                  so the pass is one tap away.
                </p>
              </div>
            ) : summary.paid ? (
              <p className="mt-5 text-body-sm text-on-surface-variant">
                Your registration ID will appear here once it is issued.
              </p>
            ) : null}

            <Link
              href={registrationPath(pass.eventId)}
              className="inline-flex mt-5 min-h-11 items-center px-5 py-3 rounded-lg bg-primary text-white text-label-md"
            >
              {summary.paid ? 'Update registration' : 'Complete payment'}
            </Link>
          </section>
        );
      })}
    </div>
  );
}
