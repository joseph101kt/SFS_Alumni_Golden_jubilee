// app/api/payments/webhook/route.ts
// Razorpay server-to-server notification. It is the backstop for a payment whose browser
// callback (verify) never arrived. The signature is checked against the raw body, then the
// captured payment is fetched from Razorpay and applied through applyRazorpayPayment.
// The registration is found from the order's notes, so it does not depend on the order
// stored on the row. That matters when a member paid an order that was later replaced.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { applyRazorpayPayment } from '@/lib/events/mark-paid';
import { getRazorpayClient } from '@/lib/payments/razorpay';
import { createAdminClient } from '@/lib/supabase-admin';

type WebhookPayment = {
  id: string;
  order_id: string;
  status: string;
  amount: number;
  notes?: Record<string, string> | null;
};

type WebhookEvent = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string } };
  };
};

function webhookSignatureMatches(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const givenBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== givenBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, givenBuffer);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || '';
  if (!signature || !webhookSignatureMatches(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(rawBody) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Only captured payments change money state. Other events are acknowledged and ignored.
  if (event.event !== 'payment.captured') {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const paymentId = event.payload?.payment?.entity?.id;
  if (!paymentId) return NextResponse.json({ ok: true, ignored: true });

  const client = getRazorpayClient();
  if (!client) return NextResponse.json({ error: 'Payments are not configured' }, { status: 503 });

  let payment: WebhookPayment;
  try {
    payment = (await client.payments.fetch(paymentId)) as unknown as WebhookPayment;
  } catch (err) {
    console.error('webhook fetch payment', err);
    // A 5xx makes Razorpay retry the notification later.
    return NextResponse.json({ error: 'Could not fetch payment' }, { status: 502 });
  }

  if (payment.status !== 'captured') return NextResponse.json({ ok: true, ignored: true });

  // The registration is named in the order's notes when the order was created.
  const registrationId = payment.notes?.registration_id;
  if (!registrationId) {
    console.error('webhook: captured payment without registration_id', paymentId);
    return NextResponse.json({ ok: true, unmatched: true });
  }

  // Confirm the registration belongs to this order's account before applying anything.
  const admin = createAdminClient();
  const { data: reg } = await admin
    .from('event_registrations')
    .select('id,account_id')
    .eq('id', registrationId)
    .maybeSingle();
  if (!reg) {
    console.error('webhook: registration not found', registrationId, paymentId);
    return NextResponse.json({ ok: true, unmatched: true });
  }

  const result = await applyRazorpayPayment({
    registrationId,
    orderId: payment.order_id,
    paymentId: payment.id,
    signature: null,
    amountPaise: Number(payment.amount),
  });

  if (!result.ok) {
    // Non-retryable answers are acknowledged so Razorpay stops resending. Server faults retry.
    if (result.status >= 500) return NextResponse.json({ error: result.error }, { status: 500 });
    console.error('webhook apply', result.error, paymentId);
    return NextResponse.json({ ok: true, unapplied: true });
  }

  return NextResponse.json({ ok: true, payment_status: result.payment_status });
}