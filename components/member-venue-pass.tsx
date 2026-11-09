// components/member-venue-pass.tsx
// Entry pass shown on the member home. Every figure comes from the server's saved registration:
// attendance, guest counts, the shared food choice, the total still due, and the registration code.
// A registration counts as confirmed when it is fully paid or the committee has verified it.
// A confirmed registration shows the QR and no payment prompt.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import RegistrationQr from '@/components/registration-qr';
import { formatCostForDisplay } from '@/lib/registration/registration';
import { registrationPath } from '@/lib/events/choose-event';
import { venuePassSummary } from '@/lib/events/venue-pass';
import type { EventCatalog } from '@/lib/events/types';

/** One saved registration as GET /api/registration/event returns it. */
type Registration = {
  attending: boolean;
  lunch: boolean;
  food_preference: string | null;
  number_of_guests: number | null;
  guests_eating: number | null;
  payment_status: string;
  total_due_paise?: number;
  committee_confirmed?: boolean;
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

type MeResponse = { role?: string };

type RegistrationEventResponse = {
  registration?: Registration | null;
  profile?: { full_name?: string | null } | null;
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

export default function MemberVenuePass({ mode = 'full' }: { mode?: 'full' | 'pass-only' }) {
  const passOnly = mode === 'pass-only';
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
        const me = (await meRes.json()) as MeResponse;
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
          const payload = (await regRes.json()) as RegistrationEventResponse;
          if (!payload.registration) continue;
          loaded.push({
            eventId: event.id,
            eventTitle: event.title,
            when: whenLabel(event.starts_at, event.ends_at),
            venue: event.venue || '',
            name: String(payload.profile?.full_name || ''),
            registration: payload.registration,
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

  if (phase === 'hidden') {
    if (!passOnly) return null;
    return (
      <section className="rounded-2xl border border-outline-variant bg-white p-6">
        <h2 className="text-headline-sm text-primary">Pass unavailable</h2>
        <p className="text-body-sm text-on-surface-variant mt-2">
          Sign in with the account that registered for the event to show your pass.
        </p>
      </section>
    );
  }
  if (phase === 'loading') {
    return <p className="mb-6 text-body-sm text-on-surface-variant">Loading your entry pass…</p>;
  }
  if (phase === 'empty') {
    return (
      <section id="venue-pass" className="mb-6 rounded-2xl border border-outline-variant bg-white p-6 shadow-sm">
        <h2 className="text-headline-sm text-primary">No registration yet</h2>
        <p className="text-body-sm text-on-surface-variant mt-2">
          Register for an event first. Your entry pass will show up here.
        </p>
        <Link href="/registration" className="inline-flex mt-5 px-5 py-3 rounded-lg bg-primary text-white text-label-md">
          Register for an event
        </Link>
      </section>
    );
  }

  return (
    <div id="venue-pass" className={`space-y-4 scroll-mt-28 ${passOnly ? '' : 'mb-6'}`}>
      {passes.map((pass) => {
        const reg = pass.registration;
        const duePaise = Math.max(0, Number(reg.total_due_paise) || 0);
        // Confirmed by the committee, or nothing left to pay. Both mean the pass is valid.
        const confirmed = reg.committee_confirmed === true || (reg.payment_status === 'paid' && duePaise === 0);

        const summary = venuePassSummary({
          attending: reg.attending !== false,
          lunch: reg.lunch !== false,
          food_preference: reg.food_preference,
          number_of_guests: reg.number_of_guests,
          guests_eating: reg.guests_eating,
          payment_status: confirmed ? 'paid' : reg.payment_status,
          total_due_paise: confirmed ? 0 : duePaise,
          registration_code: reg.registration_code,
        });

        const facts: Array<[string, string]> = [
          ['People', String(summary.people)],
          ['Lunch', summary.meals],
        ];

        return (
          <section
            key={pass.eventId}
            aria-label={`${pass.eventTitle} entry pass`}
            className="rounded-2xl border border-outline-variant bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-label-sm uppercase tracking-[0.16em] text-jubilee-gold-deep font-bold">
                {confirmed ? 'Entry pass' : 'Registration'}
              </p>
              <p
                className={`rounded-full px-3 py-1 text-label-sm font-bold ${
                  confirmed ? 'bg-secondary-container text-on-secondary-fixed' : 'bg-error-container text-error'
                }`}
              >
                {confirmed
                  ? reg.committee_confirmed
                    ? 'Confirmed'
                    : 'Paid'
                  : `Due ${formatCostForDisplay(duePaise)}`}
              </p>
            </div>
            <h2 className="text-headline-sm text-primary mt-3">{pass.eventTitle}</h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              {pass.when}
              {pass.venue ? ` · ${pass.venue}` : ''}
            </p>
            {pass.name ? <p className="text-body-md text-primary mt-3">{pass.name}</p> : null}

            {!passOnly && (
              <dl className="mt-5 grid grid-cols-2 gap-3">
                {facts.map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-surface-container px-4 py-3">
                    <dt className="text-label-sm uppercase tracking-wider text-on-surface-variant">{label}</dt>
                    <dd className="text-body-md text-primary mt-1">{value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {summary.code ? (
              <div className="mt-5 rounded-xl border border-outline-variant px-4 py-5 text-center">
                <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                  Show this at the venue
                </p>
                <p className="mt-2 text-headline-md text-primary tracking-[0.18em] font-bold">{summary.code}</p>
                <div className="mt-4 flex justify-center">
                  <RegistrationQr code={summary.code} />
                </div>
                {passOnly ? (
                  <p className="mt-4 text-body-sm text-on-surface-variant">Turn brightness up for scanning.</p>
                ) : (
                  <p className="mt-4 text-body-sm text-on-surface-variant">
                    Turn brightness up. Prefer the{' '}
                    <Link href="/event-app" className="text-primary underline-offset-2 hover:underline">
                      home-screen event app
                    </Link>{' '}
                    so the pass is one tap away.
                  </p>
                )}
              </div>
            ) : confirmed ? (
              <p className="mt-5 text-body-sm text-on-surface-variant">
                Your registration ID will appear here once it is issued.
              </p>
            ) : (
              <p className="mt-5 text-body-sm text-error">Complete payment to unlock your entry pass QR.</p>
            )}

            {!confirmed && (
              <Link
                href={registrationPath(pass.eventId)}
                className="inline-flex mt-5 min-h-11 items-center px-5 py-3 rounded-lg bg-primary text-white text-label-md"
              >
                Complete payment
              </Link>
            )}

            {confirmed && !passOnly && (
              <Link
                href={registrationPath(pass.eventId)}
                className="inline-flex mt-5 min-h-11 items-center px-5 py-3 rounded-lg border border-outline-variant text-primary text-label-md"
              >
                View registration
              </Link>
            )}
          </section>
        );
      })}
    </div>
  );
}