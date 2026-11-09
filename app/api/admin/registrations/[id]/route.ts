// app/api/admin/registrations/[id]/route.ts
// Committee actions on one registration.
// - payment_status: 'paid' settles the fee and any linked donation in full; 'pending' clears
//   payment on both.
// - core_committee_manually_verified: true issues the registration code (used after a bank
//   transfer is reconciled); false only clears the flag and keeps any code already issued.
// Both fields are optional, and at least one must be sent.

import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import {
  applyRegistrationPayment,
  markRegistrationUnpaid,
  setCommitteeVerified,
} from '@/lib/events/mark-paid';

type PatchBody = {
  payment_status?: unknown;
  core_committee_manually_verified?: unknown;
};

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  const registrationId = String(id || '').trim();
  if (!registrationId) return NextResponse.json({ error: 'Registration id is required' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const hasStatus = body.payment_status !== undefined;
  const hasVerified = body.core_committee_manually_verified !== undefined;
  if (!hasStatus && !hasVerified) {
    return NextResponse.json(
      { error: 'Send payment_status or core_committee_manually_verified' },
      { status: 400 }
    );
  }

  const response: Record<string, unknown> = { ok: true };

  if (hasStatus) {
    const status = String(body.payment_status || '');
    if (status !== 'paid' && status !== 'pending') {
      return NextResponse.json({ error: 'payment_status must be paid or pending' }, { status: 400 });
    }
    const result =
      status === 'paid'
        ? await applyRegistrationPayment({ registrationId, settleFull: true })
        : await markRegistrationUnpaid(registrationId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    response.payment_status = result.payment_status;
    response.amount_paid_paise = result.amount_paid_paise;
    if ('amount_due_paise' in result) response.amount_due_paise = result.amount_due_paise;
    if ('registration_code' in result) response.registration_code = result.registration_code;
  }

  if (hasVerified) {
    if (typeof body.core_committee_manually_verified !== 'boolean') {
      return NextResponse.json(
        { error: 'core_committee_manually_verified must be true or false' },
        { status: 400 }
      );
    }
    const result = await setCommitteeVerified(registrationId, body.core_committee_manually_verified);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    response.core_committee_manually_verified = result.core_committee_manually_verified;
    response.registration_code = result.registration_code;
  }

  return NextResponse.json(response);
}