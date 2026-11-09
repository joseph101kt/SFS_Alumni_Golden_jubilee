// app/api/payments/create-order/route.ts
// Creates one Razorpay order for everything still due on a registration: the event fee plus
// the linked donation. Both amounts are computed here from the database, never from the browser.
// The same order id is stored on the registration and on its donation, so verify and the
// webhook can find both.

import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/request';
import { amountDuePaise, OPEN_PAYMENT_STATUSES } from '@/lib/events/balance';
import { repriceEventRegistrations } from '@/lib/events/reprice';
import {
  applyRegistrationPayment,
  donationDuePaise,
  loadDonation,
} from '@/lib/events/mark-paid';
import {
  getRazorpayClient,
  isRazorpayConfigured,
  razorpayKeyId,
  razorpayKeysAligned,
} from '@/lib/payments/razorpay';
import { createAdminClient } from '@/lib/supabase-admin';

/** Razorpay refuses orders below ₹1. */
const MIN_ONLINE_PAISE = 100;

export async function POST(request: Request) {
  const me = await getCurrentAccount();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (me.role === 'admin') {
    return NextResponse.json({ error: 'Committee accounts do not pay here' }, { status: 400 });
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      {
        error: 'Payments are not configured yet. Ask the committee to mark your payment, or try again later.',
        configured: false,
      },
      { status: 503 }
    );
  }

  if (!razorpayKeysAligned()) {
    return NextResponse.json(
      {
        error:
          'Payment keys mismatch: NEXT_PUBLIC_RAZORPAY_KEY_ID must equal RAZORPAY_KEY_ID (same test or live key).',
        configured: false,
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const registrationId = String(body.registrationId || '').trim();
  if (!registrationId) {
    return NextResponse.json({ error: 'registrationId is required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const registrationSelect =
    'id,event_id,account_id,payment_status,total_cost_paise,amount_paid_paise,donation_id';

  const { data: reg, error } = await admin
    .from('event_registrations')
    .select(registrationSelect)
    .eq('id', registrationId)
    .eq('account_id', me.id)
    .in('payment_status', [...OPEN_PAYMENT_STATUSES])
    .maybeSingle();

  if (error || !reg) {
    return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
  }

  // Bring the fee up to date with the current rule before charging anything.
  await repriceEventRegistrations(String(reg.event_id || ''));

  const { data: priced } = await admin
    .from('event_registrations')
    .select(registrationSelect)
    .eq('id', reg.id)
    .maybeSingle();
  const current = priced || reg;

  const feeTotal = Math.max(0, Number(current.total_cost_paise) || 0);
  const feePaid = Math.max(0, Number(current.amount_paid_paise) || 0);
  const feeDue = amountDuePaise(feeTotal, feePaid);

  const donation = await loadDonation(admin, current.donation_id);
  const donationDue = donationDuePaise(donation);
  const totalDue = feeDue + donationDue;

  // Nothing owed (₹0 fee and no donation): settle now and issue the code if it is eligible.
  if (totalDue === 0) {
    const settled = await applyRegistrationPayment({ registrationId: reg.id, settleFull: true });
    if (!settled.ok) {
      return NextResponse.json({ error: settled.error }, { status: settled.status });
    }
    return NextResponse.json({
      ok: true,
      skipCheckout: true,
      amount_due_paise: 0,
      payment_status: settled.payment_status,
      registration_code: settled.registration_code,
    });
  }

  if (totalDue < MIN_ONLINE_PAISE) {
    return NextResponse.json(
      { error: 'Amount due must be at least ₹1 to pay online' },
      { status: 400 }
    );
  }

  const client = getRazorpayClient();
  if (!client) {
    return NextResponse.json({ error: 'Payments are not configured', configured: false }, { status: 503 });
  }

  let orderId: string;
  try {
    const order = await client.orders.create({
      amount: totalDue,
      currency: 'INR',
      receipt: `reg_${reg.id.slice(0, 8)}_${Date.now()}`.slice(0, 40),
      notes: {
        registration_id: reg.id,
        donation_id: donation?.id ?? '',
        account_id: me.id,
      },
    });
    orderId = order.id;
  } catch (err) {
    console.error('razorpay order', err);
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err
        ? Number((err as { statusCode?: unknown }).statusCode)
        : NaN;
    if (statusCode === 401) {
      return NextResponse.json(
        {
          error:
            'Payment gateway authentication failed. In Razorpay Dashboard (Test Mode) regenerate API keys, then set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and NEXT_PUBLIC_RAZORPAY_KEY_ID to the new pair in Vercel and redeploy.',
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: 'Could not create payment order' }, { status: 500 });
  }

  // Store the order on the registration, and on the donation when there is one still owed.
  const now = new Date().toISOString();
  const { error: regUpdError } = await admin
    .from('event_registrations')
    .update({ razorpay_order_id: orderId, updated_at: now })
    .eq('id', reg.id);
  if (regUpdError) {
    console.error('create-order persist registration', regUpdError);
    return NextResponse.json({ error: 'Could not save payment order' }, { status: 500 });
  }

  if (donation && donationDue > 0) {
    const { error: donUpdError } = await admin
      .from('donations')
      .update({ razorpay_order_id: orderId, updated_at: now })
      .eq('id', donation.id);
    if (donUpdError) {
      console.error('create-order persist donation', donUpdError);
      return NextResponse.json({ error: 'Could not save payment order' }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    orderId,
    amount: totalDue,
    fee_due_paise: feeDue,
    donation_due_paise: donationDue,
    currency: 'INR',
    keyId: razorpayKeyId(),
    name: me.full_name,
    email: me.email,
    contact: me.phone_number,
  });
}