'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function GateLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pinConfigured, setPinConfigured] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/gate/me', { cache: 'no-store' });
      const payload = await res.json().catch(() => ({}));
      // Only a gate PIN session skips this screen — not alumni/admin login.
      if (payload.gate) {
        router.replace('/gate/scan');
        return;
      }
      setPinConfigured(payload.pinConfigured !== false);
    })().catch(() => {});
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/gate/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Could not unlock gate');
        return;
      }
      router.push('/gate/scan');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 px-4 py-10 max-w-lg mx-auto w-full">
      <p className="text-label-sm uppercase tracking-[0.16em] text-jubilee-gold-deep font-bold">Event gate</p>
      <h1 className="text-headline-md text-primary mt-2">Volunteer unlock</h1>
      <p className="text-body-sm text-on-surface-variant mt-2">
        Enter the shared gate PIN. This only opens check-in — not full admin tools.
      </p>

      {!pinConfigured && (
        <p className="mt-4 rounded-xl border border-error/30 bg-error-container p-4 text-body-sm text-error">
          Gate PIN is not configured on the server yet (`GATE_PIN`).
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-label-sm uppercase tracking-wider text-primary">Gate PIN</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
            className="mt-2 w-full px-3 py-3 rounded-lg border border-primary/15 text-body-md bg-surface-ivory tracking-[0.2em]"
          />
        </label>
        {error && (
          <p role="alert" className="text-body-sm text-error">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !pinConfigured}
          className="w-full rounded-lg bg-primary text-on-primary px-5 py-3 text-label-md uppercase tracking-wider disabled:opacity-50 cursor-pointer"
        >
          {busy ? 'Unlocking…' : 'Unlock scanner'}
        </button>
      </form>

      <p className="mt-8 text-body-sm text-on-surface-variant">
        Alumni: open your{' '}
        <Link href="/event-app" className="text-primary underline-offset-2 hover:underline">
          event app / pass
        </Link>
        .
      </p>
    </main>
  );
}
