// app/member/page.tsx
// Member home. The next-step button is decided from the server's amounts: a registration needs
// action only when money is still due and the committee has not confirmed it. A confirmed
// registration never shows a pay or continue prompt.

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import HomeDestinationLanes from '@/components/home-destination-lanes';
import MemberGate from '@/components/member-gate';
import MemberVenuePass from '@/components/member-venue-pass';
import PortalShell from '@/components/portal-shell';
import { registrationPath } from '@/lib/events/choose-event';
import type { EventCatalog } from '@/lib/events/types';
import { primaryNextAction, type PrimaryNextAction } from '@/lib/portal/next-action';
import { firstNameFromFullName } from '@/lib/portal/welcome';

/** Shape of one saved registration as GET /api/registration/event returns it. */
interface SavedRegistrationSummary {
  total_due_paise?: number;
  committee_confirmed?: boolean;
  payment_status?: string;
}

/**
 * Whether a saved registration still needs the member to act. Confirmed registrations never do.
 * Otherwise action is needed only while the server reports money still due.
 */
function needsAction(reg: SavedRegistrationSummary): boolean {
  if (reg.committee_confirmed === true) return false;
  return Math.max(0, Number(reg.total_due_paise) || 0) > 0;
}

export default function MemberPage() {
  const [firstName, setFirstName] = useState('friend');
  const [batch, setBatch] = useState<number | null>(null);
  const [welcomeReady, setWelcomeReady] = useState(false);
  const [membershipPending, setMembershipPending] = useState(false);
  const [next, setNext] = useState<PrimaryNextAction | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const meRes = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!active || !meRes.ok) return;
        const me = await meRes.json();
        if (!active) return;
        setFirstName(firstNameFromFullName(String(me.full_name || '')));
        setBatch(typeof me.batch === 'number' ? me.batch : me.batch != null ? Number(me.batch) || null : null);
        const status = String(me.member_status || '');
        const blocked = status === 'rejected' || status === 'suspended';
        if (!blocked) setWelcomeReady(true);
        setMembershipPending(status === 'pending');

        if (me.role === 'admin') {
          setNext(primaryNextAction({ hasRegistration: false, anyUnpaid: false }));
          return;
        }

        const listRes = await fetch('/api/events', { cache: 'no-store' });
        if (!listRes.ok || !active) {
          setNext(primaryNextAction({ hasRegistration: false, anyUnpaid: false }));
          return;
        }
        const list = (await listRes.json()) as EventCatalog[];
        let hasRegistration = false;
        let anyUnpaid = false;
        let continueHref: string | undefined;

        for (const event of Array.isArray(list) ? list : []) {
          const regRes = await fetch(`/api/registration/event?eventId=${encodeURIComponent(event.id)}`, {
            cache: 'no-store',
          });
          if (!regRes.ok || !active) continue;
          const payload = (await regRes.json()) as { registration?: SavedRegistrationSummary | null };
          if (!payload.registration) continue;
          hasRegistration = true;
          if (needsAction(payload.registration)) {
            anyUnpaid = true;
            if (!continueHref) continueHref = registrationPath(event.id);
          }
        }
        if (active) {
          setNext(primaryNextAction({ hasRegistration, anyUnpaid, continueHref }));
        }
      } catch {
        if (active) setNext(primaryNextAction({ hasRegistration: false, anyUnpaid: false }));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <PortalShell title="My home" intro="Your venue pass and next step live here.">
      {welcomeReady && (
        <section className="mb-6 rounded-2xl border border-outline-variant border-l-[3px] border-l-jubilee-gold-deep bg-surface-paper px-5 py-6 sm:px-7 sm:py-7">
          <p className="text-label-sm uppercase tracking-[0.16em] text-jubilee-gold-deep font-bold">
            Welcome
          </p>
          <h2 className="text-headline-lg text-primary mt-2">Welcome, {firstName}</h2>
          {batch != null && (
            <p className="text-label-sm text-jubilee-gold-deep mt-3 tracking-wide">Class of {batch}</p>
          )}
        </section>
      )}

      <MemberGate mode="signed-in">
        {membershipPending ? (
          <p className="mb-5 rounded-xl border border-jubilee-gold-deep/30 bg-secondary-container/40 px-4 py-3 text-body-sm text-on-surface">
            Your membership is awaiting committee verification. Your venue pass still works here;
            directory and private alumni pages unlock after approval.
          </p>
        ) : null}

        <MemberVenuePass />

        {next && (
          <div className="mb-2">
            <Link
              href={next.href}
              className="inline-flex items-center rounded-full bg-primary text-on-primary px-6 py-3 text-label-md font-bold hover:bg-primary-container transition-colors cursor-pointer"
            >
              {next.label}
            </Link>
          </div>
        )}

        <Link
          href="/member/donate"
          className="donate-flash mt-6 mb-2 flex items-center gap-4 sm:gap-5 rounded-2xl border px-5 py-5 sm:px-7 sm:py-6 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-4xl shrink-0" aria-hidden>
            volunteer_activism
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-label-sm uppercase tracking-[0.16em] font-bold opacity-90">
              Support SFS
            </p>
            <h2 className="text-headline-sm mt-1">Donate to a cause</h2>
            <p className="text-body-sm mt-1 opacity-90 max-w-2xl">
              Jubilee, students, or the association — pick a cause and give in a few taps.
            </p>
          </div>
          <span className="text-label-md font-bold shrink-0 hidden sm:inline">Give now →</span>
        </Link>

        <HomeDestinationLanes />

        <p className="mt-6 text-body-sm text-on-surface-variant">
          <Link
            href="/account/password"
            className="text-primary font-bold underline underline-offset-2"
          >
            Change password
          </Link>
          {' · '}
          <Link
            href="/account/recovery"
            className="text-primary font-bold underline underline-offset-2"
          >
            Recovery questions
          </Link>
          {' — '}
          set two answers so you can reset without email. Forgot password uses those plus your phone.
        </p>

        <div className="mt-8 rounded-2xl bg-primary text-white p-8">
          <div className="text-label-sm uppercase tracking-widest text-secondary-fixed">
            1976–2026 · 50 year Aniversary Alumni Meet
          </div>
          <h2 className="text-headline-md mt-2">Once SFS, always SFS.</h2>
          <p className="text-body-sm text-white/80 mt-2 max-w-2xl">
            Reconnect with your batch, contribute a memory, or help a younger generation find their way.
          </p>
          <div className="mt-4">
            <Link
              href="/about-association"
              className="inline-flex items-center text-label-sm text-secondary-fixed underline underline-offset-4"
            >
              About the association
            </Link>
          </div>
        </div>
      </MemberGate>
    </PortalShell>
  );
}