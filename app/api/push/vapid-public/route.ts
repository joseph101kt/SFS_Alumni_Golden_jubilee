import { NextResponse } from 'next/server';
import { getVapidPublicKey, vapidConfigured } from '@/lib/push/web-push';

export async function GET() {
  if (!vapidConfigured()) {
    return NextResponse.json(
      { error: 'Push is not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.' },
      { status: 503 }
    );
  }
  return NextResponse.json({ publicKey: getVapidPublicKey() });
}
