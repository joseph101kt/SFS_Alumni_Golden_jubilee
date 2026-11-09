// app/api/payments/verify/route.ts
// Browser callback after Razorpay Checkout. Three checks happen before any money is recorded:
// 1. The signature matches the order and payment ids (HMAC with the key secret).
// 2. Razorpay confirms the payment is captured and belongs to this order.
// 3. The amount comes from Razorpay, never from the request body.
// The webhook is the backstop when this call never arrives. Both use applyRazorpayPayment.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/request';
import { applyRazorpayPayment } from '@/lib/events/mark-paid';
import { getRazorpayClient } from '@/lib/payments/razorpay';
import { createAdminClient } from '@/lib/supabase-admin';

type RazorpayPaymentLike = {
  id: string;
  order_id: string;
  status: string;
  amount: number;
};

function signatureMatches(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const givenBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== givenBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, givenBuffer);
}

export async function POST(request: Request) {
  const me = await getCurrentAccount();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const registrationId = String(body.registrationId || '').trim();
  const orderId = String(body.razorpay_order_id || '').trim();
  const paymentId = String(body.razorpay_payment_id || '').trim();
  const signature = String(body.razorpay_signature || '').trim();
  if (!registrationId || !orderId || !paymentId || !signature) {
    return NextResponse.json({ error: 'Payment details are incomplete' }, { status: 400 });
  }

  // The registration must belong to the signed-in account.
  const admin = createAdminClient();
  const { data: owned } = await admin
    .from('event_registrations')
    .select('id')
    .eq('id', registrationId)
    .eq('account_id', me.id)
    .maybeSingle();
  if (!owned) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });

  if (!signatureMatches(orderId, paymentId, signature)) {
    return NextResponse.json({ error: 'Payment signature is invalid' }, { status: 400 });
  }

  const client = getRazorpayClient();
  if (!client) {
    return NextResponse.json({ error: 'Payments are not configured' }, { status: 503 });
  }

  let payment: RazorpayPaymentLike;
  try {
    payment = (await client.payments.fetch(paymentId)) as unknown as RazorpayPaymentLike;
  } catch (err) {
    console.error('verify fetch payment', err);
    return NextResponse.json({ error: 'Could not confirm the payment with Razorpay' }, { status: 502 });
  }

  if (payment.order_id !== orderId) {
    return NextResponse.json({ error: 'Payment does not belong to this order' }, { status: 400 });
  }
  if (payment.status !== 'captured') {
    return NextResponse.json(
      { error: 'Payment is not captured yet. Please wait a moment and try again.' },
      { status: 409 }
    );
  }

  const result = await applyRazorpayPayment({
    registrationId,
    orderId,
    paymentId,
    signature,
    amountPaise: Number(payment.amount),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    payment_status: result.payment_status,
    amount_paid_paise: result.amount_paid_paise,
    amount_due_paise: result.amount_due_paise,
    donation_due_paise: result.donation_due_paise,
    registration_code: result.registration_code,
  });
}