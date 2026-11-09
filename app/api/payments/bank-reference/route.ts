// app/api/payments/bank-reference/route.ts
// Stores the bank reference that an alumnus enters after a foreign remittance. It only records
// the reference. It never marks anything paid: the committee reconciles the remittance and
// then sets core_committee_manually_verified, which issues the code through mark-paid.
// Saving the same reference again changes nothing.

import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/request';
import { OPEN_PAYMENT_STATUSES } from '@/lib/events/balance';
import { createAdminClient } from '@/lib/supabase-admin';

/** Bank references are short. This limit only stops pasted essays. */
const MAX_REFERENCE_LENGTH = 64;

export async function POST(request: Request) {
  const me = await getCurrentAccount();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (me.role === 'admin') {
    return NextResponse.json({ error: 'Committee accounts do not pay here' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const registrationId = String(body.registrationId || '').trim();
  const reference = String(body.bank_reference || '').trim();

  if (!registrationId) {
    return NextResponse.json({ error: 'registrationId is required' }, { status: 400 });
  }
  if (!reference) {
    return NextResponse.json({ error: 'Enter the bank reference' }, { status: 400 });
  }
  if (reference.length > MAX_REFERENCE_LENGTH) {
    return NextResponse.json(
      { error: `Bank reference must be ${MAX_REFERENCE_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: reg, error } = await admin
    .from('event_registrations')
    .select('id,bank_reference')
    .eq('id', registrationId)
    .eq('account_id', me.id)
    .in('payment_status', [...OPEN_PAYMENT_STATUSES])
    .maybeSingle();

  if (error || !reg) {
    return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
  }

  if (reg.bank_reference === reference) {
    return NextResponse.json({ ok: true, bank_reference: reference, unchanged: true });
  }

  const { error: updError } = await admin
    .from('event_registrations')
    .update({ bank_reference: reference, updated_at: new Date().toISOString() })
    .eq('id', reg.id);
  if (updError) {
    console.error('bank reference update', updError);
    return NextResponse.json({ error: 'Could not save the bank reference' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bank_reference: reference });
}