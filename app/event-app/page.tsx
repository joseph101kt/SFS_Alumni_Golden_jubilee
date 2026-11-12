'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EventAppPage() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => {
        if (active) setSignedIn(r.ok);
      })
      .catch(() => {
        if (active) setSignedIn(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setSignedIn(false);
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <main className="flex-1 px-4 py-10 max-w-xl mx-auto w-full flex flex-col min-h-[100dvh]">
      <p className="text-label-sm uppercase tracking-[0.16em] text-jubilee-gold-deep font-bold">
        Event app
      </p>
      <h1 className="text-display-sm text-primary mt-2">SFS 50 year Aniversary Meet</h1>

      <nav className="mt-8 grid gap-3">
        <Link
          href="/event-app/pass"
          className="rounded-2xl bg-primary text-on-primary px-5 py-4 text-label-md text-center"
        >
          Open venue pass
        </Link>
        <Link
          href="/event-app/day"
          className="rounded-2xl border border-primary/20 bg-white px-5 py-4 text-label-md text-center text-primary"
        >
          Day-of details
        </Link>
        <Link
          href="/gate"
          className="rounded-2xl border border-primary/20 bg-white px-5 py-4 text-label-md text-center text-primary"
        >
          Volunteer gate scanner
        </Link>
      </nav>

      <div className="mt-auto pt-10 pb-4">
        {signedIn ? (
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void logout()}
            className="w-full rounded-2xl border border-outline-variant px-5 py-4 text-label-md text-on-surface-variant disabled:opacity-50 cursor-pointer"
          >
            {loggingOut ? 'Signing out…' : 'Log out'}
          </button>
        ) : (
          <Link
            href="/login?next=%2Fevent-app"
            className="block w-full rounded-2xl border border-outline-variant px-5 py-4 text-label-md text-center text-on-surface-variant"
          >
            Sign in
          </Link>
        )}
      </div>
    </main>
  );
}
