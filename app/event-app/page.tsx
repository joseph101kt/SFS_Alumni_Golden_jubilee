'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import PwaInstall from '@/components/pwa-install';

type DayOf = {
  headline: string;
  when: string;
  venue: string;
  mapUrl: string;
  parkingNote: string;
  helpText: string;
  helpPhone: string;
};

export default function EventAppPage() {
  const [day, setDay] = useState<DayOf | null>(null);
  const [pushState, setPushState] = useState<'idle' | 'on' | 'denied' | 'unsupported'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/event-app/day-of', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setDay(d as DayOf))
      .catch(() => {});
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPushState('unsupported');
    } else if (Notification.permission === 'granted') {
      setPushState('on');
    } else if (Notification.permission === 'denied') {
      setPushState('denied');
    }
  }, []);

  async function enablePush() {
    setMsg('');
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        setPushState('unsupported');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setPushState('denied');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch('/api/push/vapid-public');
      const keyPayload = await keyRes.json().catch(() => ({}));
      if (!keyRes.ok || !keyPayload.publicKey) {
        setMsg(keyPayload.error || 'Push is not configured on the server yet.');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyPayload.publicKey),
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setMsg(payload.error || 'Could not save subscription (sign in as a member first).');
        return;
      }
      setPushState('on');
      setMsg('Alerts enabled for this device.');
    } catch {
      setMsg('Could not enable alerts on this device.');
    }
  }

  return (
    <main className="flex-1 px-4 py-8 max-w-xl mx-auto w-full">
      <p className="text-label-sm uppercase tracking-[0.16em] text-jubilee-gold-deep font-bold">
        Event app
      </p>
      <h1 className="text-display-sm text-primary mt-2">SFS Golden Jubilee</h1>
      <p className="text-body-sm text-on-surface-variant mt-2">
        Put this on your home screen for your venue pass, day-of info, and alerts.
      </p>

      <PwaInstall />

      <nav className="mt-6 grid gap-3">
        <Link
          href="/member#venue-pass"
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

      <section className="mt-6 rounded-2xl border border-outline-variant bg-white p-5">
        <h2 className="text-headline-sm text-primary">Event alerts</h2>
        <p className="mt-2 text-body-sm text-on-surface-variant">
          Schedule changes, gate notes, and weekend updates. Sign in as a member first.
        </p>
        {pushState !== 'on' && pushState !== 'unsupported' && (
          <button
            type="button"
            onClick={() => void enablePush()}
            className="mt-4 rounded-lg bg-secondary-container text-on-secondary-fixed px-4 py-3 text-label-sm cursor-pointer"
          >
            Enable notifications
          </button>
        )}
        {pushState === 'on' && (
          <p className="mt-3 text-body-sm text-primary font-medium">Notifications are on for this device.</p>
        )}
        {pushState === 'denied' && (
          <p className="mt-3 text-body-sm text-error">Notifications blocked in browser settings.</p>
        )}
        {pushState === 'unsupported' && (
          <p className="mt-3 text-body-sm text-on-surface-variant">
            This browser does not support web push.
          </p>
        )}
        {msg && <p className="mt-3 text-body-sm text-navy-subtle">{msg}</p>}
      </section>

      {day && (
        <p className="mt-8 text-body-sm text-on-surface-variant">
          {day.headline} · {day.venue}
        </p>
      )}
    </main>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}
