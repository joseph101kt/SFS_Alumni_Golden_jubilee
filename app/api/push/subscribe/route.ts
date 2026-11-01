import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/request';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const me = await getCurrentAccount();
  if (!me) return NextResponse.json({ error: 'Sign in to enable alerts' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const endpoint = String(body?.endpoint || '');
  const p256dh = String(body?.keys?.p256dh || '');
  const auth = String(body?.keys?.auth || '');
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('push_subscriptions').upsert(
    {
      account_id: me.id,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get('user-agent')?.slice(0, 280) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    console.error('push subscribe', error);
    return NextResponse.json(
      { error: 'Could not save subscription. Apply the push migration if needed.' },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
