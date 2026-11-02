'use client';

import { useEffect, useState } from 'react';
import {
  ensurePushSubscription,
  pushSupported,
  type PushSubscribeStatus,
} from '@/lib/push/client-subscribe';

function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return iOS && !standalone;
}

export default function EventPushOptIn({
  auto = true,
  /** Also call requestPermission once (use on registration success). */
  autoRequest = false,
  compact = false,
}: {
  auto?: boolean;
  autoRequest?: boolean;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<PushSubscribeStatus>(() =>
    pushSupported()
      ? typeof Notification !== 'undefined' && Notification.permission === 'granted'
        ? 'on'
        : typeof Notification !== 'undefined' && Notification.permission === 'denied'
          ? 'denied'
          : 'need-permission'
      : 'unsupported'
  );
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    setIosHint(isIosSafari());
    if (!auto) return;
    let cancel = false;
    (async () => {
      const granted = Notification.permission === 'granted';
      const result = await ensurePushSubscription(autoRequest || granted);
      if (cancel) return;
      setStatus(result.status);
      if (result.message) setMessage(result.message);
    })();
    return () => {
      cancel = true;
    };
  }, [auto, autoRequest]);

  async function onEnable() {
    setBusy(true);
    setMessage('');
    const result = await ensurePushSubscription(true);
    setStatus(result.status);
    if (result.message) setMessage(result.message);
    setBusy(false);
  }

  if (status === 'unsupported') {
    if (compact) return null;
    return (
      <p className="text-body-sm text-on-surface-variant">
        This browser cannot receive event alerts. Use Chrome (Android) or the home-screen app on iPhone.
      </p>
    );
  }

  if (status === 'on') {
    return (
      <p className={`text-body-sm text-primary font-medium ${compact ? 'mt-4' : ''}`}>
        Event alerts are on for this device.
      </p>
    );
  }

  if (status === 'denied') {
    return (
      <p className={`text-body-sm text-error ${compact ? 'mt-4' : ''}`}>
        Notifications are blocked in browser settings. Allow them for this site to get event updates.
      </p>
    );
  }

  return (
    <section
      className={
        compact
          ? 'mt-4 rounded-xl border border-jubilee-gold-light bg-secondary-container/30 p-4 text-left'
          : 'rounded-2xl border border-outline-variant bg-white p-5 text-left'
      }
    >
      <h2 className={compact ? 'text-label-md text-primary font-bold' : 'text-headline-sm text-primary'}>
        Event alerts
      </h2>
      <p className="mt-2 text-body-sm text-on-surface-variant">
        One tap so schedule changes and gate notes reach this phone. No App Store install required.
      </p>
      {iosHint && (
        <p className="mt-2 text-body-sm text-on-surface-variant">
          On iPhone, add the event app to your Home Screen first, then turn on alerts.
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void onEnable()}
        className="mt-4 w-full min-h-11 rounded-lg bg-primary text-on-primary px-4 py-3 text-label-sm disabled:opacity-50 cursor-pointer"
      >
        {busy ? 'Enabling…' : 'Turn on event alerts'}
      </button>
      {message ? <p className="mt-3 text-body-sm text-navy-subtle">{message}</p> : null}
    </section>
  );
}
