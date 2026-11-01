'use client';

import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export default function PwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function installChrome() {
    if (!deferred) return;
    setBusy(true);
    setHint('');
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        setDeferred(null);
      } else {
        setHint('Install was dismissed. You can also use the browser menu → Install app.');
      }
    } catch {
      setHint('Could not open the install prompt. Use the browser menu → Install app / Add to Home screen.');
    } finally {
      setBusy(false);
    }
  }

  if (installed) {
    return (
      <section className="mt-6 rounded-2xl border border-primary/10 bg-secondary-container/40 p-5">
        <h2 className="text-headline-sm text-primary">Installed</h2>
        <p className="mt-2 text-body-sm text-on-surface">
          You’re in the home-screen app. Use the links below for your pass and day-of info.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-jubilee-gold-light bg-surface-paper p-5 shadow-sm">
      <h2 className="text-headline-sm text-primary">Add to your phone</h2>
      <p className="mt-2 text-body-sm text-on-surface-variant">
        Browsers do not always show an install banner. Use the button or steps below.
      </p>

      {deferred ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void installChrome()}
          className="mt-4 w-full min-h-12 rounded-xl bg-primary text-on-primary px-5 py-3 text-label-md uppercase tracking-wider disabled:opacity-50 cursor-pointer"
        >
          {busy ? 'Opening…' : 'Install app'}
        </button>
      ) : ios ? (
        <div className="mt-4 rounded-xl border border-primary/15 bg-white p-4 text-body-sm text-on-surface space-y-2">
          <p className="font-medium text-primary">iPhone / iPad (Safari only)</p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>Tap the <strong>Share</strong> button (square with ↑) at the bottom of Safari.</li>
            <li>Scroll and tap <strong>Add to Home Screen</strong>.</li>
            <li>Tap <strong>Add</strong>.</li>
          </ol>
          <p className="text-on-surface-variant">
            If you opened this inside WhatsApp/Instagram, tap ··· → <strong>Open in Safari</strong> first.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-primary/15 bg-white p-4 text-body-sm text-on-surface space-y-2">
          <p className="font-medium text-primary">Android / Chrome</p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>Tap the <strong>⋮</strong> menu (top right).</li>
            <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
          </ol>
          <p className="text-on-surface-variant">
            Stay on this page a few seconds after it loads (Chrome needs the service worker ready).
            Then reopen the menu if Install is missing.
          </p>
          <button
            type="button"
            onClick={() => {
              void navigator.serviceWorker?.ready.then(() => {
                setHint(
                  'Service worker is ready. Open Chrome menu (⋮) → Install app / Add to Home screen.'
                );
              });
            }}
            className="mt-2 rounded-lg border border-primary/20 px-4 py-2.5 text-label-sm text-primary cursor-pointer"
          >
            Check install readiness
          </button>
        </div>
      )}

      {hint ? <p className="mt-3 text-body-sm text-navy-subtle">{hint}</p> : null}
    </section>
  );
}
