'use client';

import Link from 'next/link';
import EventPushOptIn from '@/components/event-push-opt-in';
import MemberGate from '@/components/member-gate';
import MemberVenuePass from '@/components/member-venue-pass';

export default function EventAppPassPage() {
  return (
    <main className="flex-1 px-4 py-8 max-w-xl mx-auto w-full">
      <Link href="/event-app" className="text-label-sm text-primary underline-offset-2 hover:underline">
        ← Event app
      </Link>
      <h1 className="text-display-sm text-primary mt-4">Entry pass</h1>
      <p className="text-body-sm text-on-surface-variant mt-2">
        Sign in to show your venue QR at the gate.
      </p>
      <div className="mt-6">
        <MemberGate mode="signed-in" loginNext="/event-app/pass">
          <MemberVenuePass mode="pass-only" />
          <EventPushOptIn auto compact />
        </MemberGate>
      </div>
    </main>
  );
}
