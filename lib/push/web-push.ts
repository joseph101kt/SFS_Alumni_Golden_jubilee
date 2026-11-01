import webpush from 'web-push';

export function vapidConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:alumni@sfsshanthinagar.edu';
  if (!publicKey || !privateKey) {
    throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set');
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return webpush;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  deep_link?: string;
};

export async function sendPushToSubscription(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload
) {
  const wp = configureWebPush();
  await wp.sendNotification(subscription, JSON.stringify(payload));
}
