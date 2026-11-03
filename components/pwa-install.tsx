'use client';

import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isIos() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isAndroid() {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|MicroMessenger|Twitter/i.test(navigator.userAgent);
}

/** Chrome/Firefox/Edge on iOS — Share sheet has no Add to Home Screen. */
function isIosNonSafari() {
  if (typeof navigator === 'undefined' || !isIos()) return false;
  return /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export default function PwaInstall({
  shareMode = false,
  startPath = '/event-app',
  appLabel = 'SFS Jubilee',
}: {
  shareMode?: boolean;
  startPath?: string;
  /** Shown above the QR so alumni vs ops codes are not confused. */
  appLabel?: string;
}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [iosNonSafari, setIosNonSafari] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [qrSrc, setQrSrc] = useState('');

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());
    setAndroid(isAndroid());
    setInApp(isInAppBrowser());
    setIosNonSafari(isIosNonSafari());
    const path = startPath.startsWith('/') ? startPath : `/${startPath}`;
    const url = `${window.location.origin}${path}`;
    setPageUrl(url);
    setQrSrc(''); // avoid showing a previous app's QR while regenerating

    let cancel = false;
    import('qrcode')
      .then((mod) => mod.default.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: 'M' }))
      .then((dataUrl) => {
        if (!cancel) setQrSrc(dataUrl);
      })
      .catch(() => {});

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
      cancel = true;
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [startPath]);

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
        setHint('Install was dismissed. Use the browser menu → Install app.');
      }
    } catch {
      setHint('Could not open the install prompt. Use the browser menu → Install app.');
    } finally {
      setBusy(false);
    }
  }

  async function checkReady() {
    setHint('');
    if (!('serviceWorker' in navigator)) {
      setHint('This browser cannot install web apps. Open Chrome (Android) or Safari (iPhone).');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await reg.update().catch(() => {});
      await navigator.serviceWorker.ready;
      const manifestLink = document.querySelector('link[rel="manifest"]');
      if (!manifestLink) {
        setHint('Manifest missing. Refresh the page, then try again.');
        return;
      }
      setHint(
        deferred
          ? 'Ready — tap Install app above.'
          : android
            ? 'Service worker ready. Open Chrome ⋮ → Install app / Add to Home screen.'
            : ios
              ? 'Ready. Share is in Safari’s toolbar (bottom or top) — not on this page. Tap Share → Add to Home Screen.'
              : 'Ready. Use the QR on a phone, then follow iPhone or Android steps below.'
      );
    } catch {
      setHint('Could not register the service worker. Hard-refresh and try again.');
    }
  }

  async function copyLink() {
    if (!pageUrl) return;
    try {
      await navigator.clipboard.writeText(pageUrl);
      setHint('Link copied. Open it on your phone in Safari or Chrome.');
    } catch {
      setHint(pageUrl);
    }
  }

  if (installed && !shareMode) {
    return (
      <section className="mt-6 rounded-2xl border border-primary/10 bg-secondary-container/40 p-5">
        <h2 className="text-headline-sm text-primary">Installed</h2>
        <p className="mt-2 text-body-sm text-on-surface">
          You’re in the home-screen app. Use the links below for your pass and day-of info.
        </p>
      </section>
    );
  }

  const onPhone = ios || android;
  const showQr = shareMode || !onPhone;

  return (
    <section
      className={
        shareMode
          ? 'space-y-1'
          : 'mt-6 rounded-2xl border border-jubilee-gold-light bg-surface-paper p-5 shadow-sm'
      }
    >
      {!shareMode ? (
        <>
          <h2 className="text-headline-sm text-primary">Add to your phone</h2>
          <p className="mt-2 text-body-sm text-on-surface-variant">
            There is no Share / Install button on this webpage. Those controls live in your{' '}
            <strong>phone browser</strong> (Safari or Chrome).
          </p>
        </>
      ) : (
        <p className="text-body-sm text-on-surface-variant">
          This QR installs <strong>{appLabel}</strong> only ({startPath.startsWith('/') ? startPath : `/${startPath}`}
          ). Scan on a phone, then use <strong>Safari</strong> or <strong>Chrome</strong> install controls — not
          this website.
        </p>
      )}

      {inApp && (
        <p className="mt-3 rounded-xl border border-error/30 bg-error/5 p-3 text-body-sm text-error">
          You’re in an in-app browser (WhatsApp / Instagram / etc.). Tap ··· →{' '}
          <strong>Open in {ios ? 'Safari' : 'Chrome'}</strong>, then come back to this page.
        </p>
      )}

      {iosNonSafari && !inApp && (
        <p className="mt-3 rounded-xl border border-error/30 bg-error/5 p-3 text-body-sm text-error">
          This is not Safari. On iPhone, <strong>Add to Home Screen</strong> only appears in the{' '}
          <strong>Safari</strong> app (blue compass). Copy the link, open Safari, paste it in the
          address bar, then use Share.
        </p>
      )}

      {deferred && !shareMode ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void installChrome()}
          className="mt-4 w-full min-h-12 rounded-xl bg-primary text-on-primary px-5 py-3 text-label-md uppercase tracking-wider disabled:opacity-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {busy ? 'Opening…' : 'Install app'}
        </button>
      ) : null}

      {showQr ? (
        <div className="mt-4 rounded-xl border border-primary/15 bg-white p-4 text-body-sm text-on-surface space-y-3">
          <p className="font-medium text-primary text-center text-headline-sm">{appLabel}</p>
          <p className="text-center text-label-sm uppercase tracking-[0.14em] text-jubilee-gold-deep font-bold">
            {startPath.startsWith('/') ? startPath : `/${startPath}`}
          </p>
          <p className="text-on-surface-variant text-center">
            Scan this QR, or copy the link and open it in Safari (iPhone) or Chrome (Android).
          </p>
          {qrSrc ? (
            <img
              src={qrSrc}
              alt={`QR code for ${appLabel} (${startPath})`}
              width={220}
              height={220}
              className="mx-auto rounded-lg bg-white p-2"
            />
          ) : (
            <p className="text-center text-body-sm text-on-surface-variant">Generating QR…</p>
          )}
          <p className="break-all text-center text-body-sm font-medium text-primary">{pageUrl}</p>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="w-full rounded-lg border border-primary/20 px-4 py-2.5 text-label-sm text-primary cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            Copy {appLabel} link
          </button>
        </div>
      ) : null}

      <div
        className={`mt-4 rounded-xl border p-4 text-body-sm text-on-surface space-y-2 ${
          ios ? 'border-jubilee-gold-deep bg-secondary-container/40' : 'border-primary/15 bg-white'
        }`}
      >
        <p className="font-medium text-primary">iPhone / iPad</p>
        <p className="text-on-surface-variant">
          Share is <strong>not on this page</strong> — it’s the Safari button at the bottom of the screen
          (square with an arrow ↑). Must be <strong>Safari</strong>, not Chrome.
        </p>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>
            Open this link in the <strong>Safari</strong> app (blue compass icon).
          </li>
          <li>
            Tap <strong>Share</strong> in Safari’s toolbar (bottom center on most iPhones; top on some
            older models).
          </li>
          <li>
            In the bottom row of icons, <strong>swipe sideways</strong> until you see{' '}
            <strong>Add to Home Screen</strong>, then tap it → <strong>Add</strong>.
          </li>
        </ol>
        <p className="text-on-surface-variant border-t border-primary/10 pt-2 mt-2">
          <strong>Not showing on older iPhones?</strong> In the Share sheet, scroll down and tap{' '}
          <strong>Edit Actions</strong> (or <strong>Edit Favorites</strong>) → enable{' '}
          <strong>Add to Home Screen</strong> → Done → open Share again. Do not use Bookmark — that only
          saves inside Safari, not on the Home Screen.
        </p>
      </div>

      <div
        className={`mt-4 rounded-xl border p-4 text-body-sm text-on-surface space-y-2 ${
          android ? 'border-jubilee-gold-deep bg-secondary-container/40' : 'border-primary/15 bg-white'
        }`}
      >
        <p className="font-medium text-primary">Android</p>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>
            Open this page in <strong>Chrome</strong>.
          </li>
          <li>
            Tap <strong>⋮</strong> at the top right of Chrome (browser menu, not this page).
          </li>
          <li>
            Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
          </li>
        </ol>
        <p className="text-on-surface-variant">
          If Install is missing, stay on this page ~5 seconds, then open the menu again.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void checkReady()}
        className="mt-4 rounded-lg border border-primary/20 px-4 py-2.5 text-label-sm text-primary cursor-pointer"
      >
        Check install readiness
      </button>

      {hint ? <p className="mt-3 text-body-sm text-navy-subtle">{hint}</p> : null}
    </section>
  );
}
