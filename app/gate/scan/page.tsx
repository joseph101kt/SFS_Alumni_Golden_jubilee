'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GateQrScanner from '@/components/gate-qr-scanner';
import { formatCostForDisplay } from '@/lib/registration/registration';

type Hit = {
  id: string;
  registration_code: string;
  full_name: string;
  attending: boolean;
  guest_count: number;
  people: number;
  meals: string;
  event_title: string;
  payment_status: string;
  amount_due_paise: number;
  paid: boolean;
  checked_in_at: string | null;
  already_checked_in?: boolean;
};

type RecentCheckIn = {
  registration_code: string | null;
  full_name: string;
  checked_in_at: string;
  number_of_guests: number;
};

type Stats = {
  registration_count: number;
  people: number;
  checked_in_count: number;
  people_on_site: number;
  unpaid_count: number;
  recent: RecentCheckIn[];
};

type GateMeResponse = { gate?: boolean };

function beep(ok: boolean) {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = ok ? 880 : 220;
    g.gain.value = 0.05;
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.12 : 0.25));
  } catch {
    /* ignore */
  }
}

export default function GateScanPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState('');
  const [hit, setHit] = useState<Hit | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/gate/stats', { cache: 'no-store' });
    if (res.ok) setStats((await res.json()) as Stats);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/gate/me', { cache: 'no-store' });
      const payload = (await res.json().catch(() => ({}))) as GateMeResponse;
      if (!payload.gate) {
        router.replace('/gate');
        return;
      }
      setReady(true);
      await loadStats();
    })().catch(() => router.replace('/gate'));
  }, [router, loadStats]);

  const lookup = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setBusy(true);
    setMessage('');
    setPaused(true);
    try {
      const res = await fetch(`/api/gate/lookup?code=${encodeURIComponent(trimmed)}`);
      const payload = (await res.json().catch(() => ({}))) as Hit & { error?: string };
      if (!res.ok) {
        setHit(null);
        setMessage(payload.error || 'Lookup failed');
        beep(false);
        return;
      }
      setHit(payload);
      setCode(payload.registration_code || trimmed);
      beep(Boolean(payload.paid));
    } catch {
      setHit(null);
      setMessage('Could not reach the server. Check the connection and try again.');
      beep(false);
    } finally {
      setBusy(false);
    }
  }, []);

  async function mark(action: 'check_in' | 'undo') {
    if (!hit) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/gate/check-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: hit.registration_code, action }),
      });
      const payload = (await res.json().catch(() => ({}))) as Hit & { error?: string };
      if (!res.ok) {
        setMessage(payload.error || 'Could not update check-in');
        beep(false);
        return;
      }
      setHit(payload);
      if (payload.already_checked_in) {
        setMessage(
          `Already checked in${
            payload.checked_in_at ? ` at ${new Date(payload.checked_in_at).toLocaleTimeString('en-IN')}` : ''
          }.`
        );
      } else if (action === 'check_in') {
        setMessage('Checked in.');
        beep(true);
      } else {
        setMessage('Check-in cleared.');
      }
      await loadStats();
    } finally {
      setBusy(false);
    }
  }

  function nextGuest() {
    setHit(null);
    setCode('');
    setMessage('');
    setPaused(false);
  }

  async function logout() {
    await fetch('/api/gate/logout', { method: 'POST' });
    router.replace('/gate');
  }

  function onManual(e: FormEvent) {
    e.preventDefault();
    void lookup(code);
  }

  if (!ready) {
    return <main className="flex-1 p-6 text-body-sm text-on-surface-variant">Checking gate access…</main>;
  }

  return (
    <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full overscroll-contain">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-label-sm uppercase tracking-[0.16em] text-jubilee-gold-deep font-bold">Gate scanner</p>
          <h1 className="text-headline-sm text-primary mt-1">Check-in</h1>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="text-label-sm text-error border border-error/20 rounded-lg px-3 py-2 cursor-pointer"
        >
          Lock
        </button>
      </div>

      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-2 text-body-sm">
          <div className="rounded-xl bg-surface-paper border border-primary/10 p-3">
            <p className="text-on-surface-variant">Checked in</p>
            <p className="text-headline-sm text-primary tabular-nums">{stats.checked_in_count}</p>
          </div>
          <div className="rounded-xl bg-surface-paper border border-primary/10 p-3">
            <p className="text-on-surface-variant">People on site</p>
            <p className="text-headline-sm text-primary tabular-nums">{stats.people_on_site}</p>
          </div>
        </div>
      )}

      {!hit && (
        <>
          <GateQrScanner onCode={(c) => void lookup(c)} paused={paused || busy} />
          <form onSubmit={onManual} className="mt-4 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Registration ID"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 px-3 py-3 rounded-lg border border-primary/15 tracking-[0.12em] bg-surface-ivory"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary text-on-primary px-4 py-3 text-label-sm disabled:opacity-50 cursor-pointer"
            >
              Look up
            </button>
          </form>
        </>
      )}

      {message && (
        <p role="status" className="mt-4 rounded-xl border border-jubilee-gold-light bg-secondary-container/40 p-3 text-body-sm">
          {message}
        </p>
      )}

      {hit && (
        <div className="mt-4 rounded-2xl border border-primary/10 bg-surface-paper p-5 shadow-sm">
          <p
            className={`inline-flex px-2.5 py-1 rounded-md text-label-sm uppercase tracking-wider ${
              hit.paid ? 'bg-primary text-secondary-container' : 'bg-jubilee-gold-light text-on-secondary-fixed-variant'
            }`}
          >
            {hit.paid ? 'Paid' : `Due ${formatCostForDisplay(hit.amount_due_paise)}`}
          </p>
          {hit.checked_in_at && (
            <p className="mt-2 text-label-sm text-jubilee-gold-deep font-bold">
              Arrived {new Date(hit.checked_in_at).toLocaleString('en-IN')}
            </p>
          )}
          <h2 className="mt-3 text-headline-md text-primary">{hit.full_name}</h2>
          <p className="mt-1 tracking-[0.14em] text-navy-subtle">{hit.registration_code}</p>
          <dl className="mt-4 space-y-2 text-body-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">Event</dt>
              <dd className="text-primary text-right">{hit.event_title}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">Attending</dt>
              <dd>{hit.attending ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">Guests</dt>
              <dd className="tabular-nums">{hit.guest_count}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">People on site</dt>
              <dd className="tabular-nums">{hit.people}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">Lunch</dt>
              <dd className="text-right">{hit.meals}</dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-col gap-2">
            {!hit.checked_in_at ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void mark('check_in')}
                className="min-h-12 rounded-lg bg-primary text-on-primary px-4 py-3 text-label-md disabled:opacity-50 cursor-pointer"
              >
                Mark arrived
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void mark('undo')}
                className="min-h-14 rounded-lg border border-primary/20 px-4 py-3 text-label-md cursor-pointer"
              >
                Undo check-in
              </button>
            )}
            <button
              type="button"
              onClick={nextGuest}
              className="min-h-12 rounded-lg bg-secondary-container text-on-secondary-fixed px-4 py-3 text-label-md cursor-pointer"
            >
              Next guest
            </button>
          </div>
        </div>
      )}

      <p className="mt-6 text-body-sm text-on-surface-variant">
        <Link href="/event-app" className="text-primary underline-offset-2 hover:underline">
          Event app home
        </Link>
      </p>
    </main>
  );
}