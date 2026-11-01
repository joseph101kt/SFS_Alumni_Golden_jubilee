import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { sendPushToSubscription, vapidConfigured } from '@/lib/push/web-push';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET() {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('event_broadcasts')
    .select('id,title,body,deep_link,created_at,sent_count')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) {
    return NextResponse.json({ broadcasts: [], error: error.message, vapid: vapidConfigured() });
  }
  return NextResponse.json({ broadcasts: data || [], vapid: vapidConfigured() });
}

export async function POST(request: Request) {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!vapidConfigured()) {
    return NextResponse.json(
      { error: 'Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY before sending.' },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || '').trim().slice(0, 80);
  const text = String(body.body || '').trim().slice(0, 280);
  const deep_link = String(body.deep_link || '/event-app').trim().slice(0, 200) || '/event-app';
  if (!title || !text) {
    return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('id,endpoint,p256dh,auth');
  if (subErr) {
    console.error('broadcast subs', subErr);
    return NextResponse.json(
      { error: 'Could not load subscriptions. Apply the push migration if needed.' },
      { status: 500 }
    );
  }

  let sent = 0;
  const stale: string[] = [];
  for (const sub of subs || []) {
    try {
      await sendPushToSubscription(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        { title, body: text, url: deep_link, deep_link }
      );
      sent += 1;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) stale.push(sub.id);
    }
  }

  if (stale.length) {
    await admin.from('push_subscriptions').delete().in('id', stale);
  }

  const { data: row } = await admin
    .from('event_broadcasts')
    .insert({
      title,
      body: text,
      deep_link,
      created_by: me.id,
      sent_count: sent,
    })
    .select('id,title,body,deep_link,created_at,sent_count')
    .maybeSingle();

  return NextResponse.json({ ok: true, sent, broadcast: row });
}
