/** Browser-side web push subscribe → POST /api/push/subscribe */

export type PushSubscribeStatus =
  | 'on'
  | 'denied'
  | 'unsupported'
  | 'need-permission'
  | 'error';

export type PushSubscribeResult = {
  status: PushSubscribeStatus;
  message?: string;
};

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Ensure this device is subscribed for event alerts.
 * @param requestIfNeeded — when permission is still "default", call requestPermission (needs a user gesture on some browsers).
 */
export async function ensurePushSubscription(
  requestIfNeeded = false
): Promise<PushSubscribeResult> {
  if (!pushSupported()) return { status: 'unsupported' };

  if (Notification.permission === 'denied') return { status: 'denied' };

  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch {
    return { status: 'error', message: 'Could not register the service worker.' };
  }

  if (Notification.permission === 'default') {
    if (!requestIfNeeded) return { status: 'need-permission' };
    const perm = await Notification.requestPermission();
    if (perm === 'denied') return { status: 'denied' };
    if (perm !== 'granted') return { status: 'need-permission' };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const keyRes = await fetch('/api/push/vapid-public');
    const keyPayload = await keyRes.json().catch(() => ({}));
    if (!keyRes.ok || !keyPayload.publicKey) {
      return {
        status: 'error',
        message: keyPayload.error || 'Push is not configured on the server yet.',
      };
    }

    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(String(keyPayload.publicKey)) as BufferSource,
      }));

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });
    if (res.status === 401) {
      return { status: 'error', message: 'Sign in to enable alerts on this device.' };
    }
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      return {
        status: 'error',
        message: payload.error || 'Could not save this device for alerts.',
      };
    }
    return { status: 'on' };
  } catch {
    return { status: 'error', message: 'Could not enable alerts on this device.' };
  }
}
