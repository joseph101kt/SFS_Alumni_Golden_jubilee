// app/api/registrations/[id]/route.ts
// Admin toggles a registration between paid (settles in full) and pending (clears payment).

import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { applyRegistrationPayment, markRegistrationUnpaid } from '@/lib/events/mark-paid';

type PatchBody = {
  payment_status?: unknown;
};

export async function PATCH(request: Request, ctx: { params: { id: string } }) {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const status = String(body.payment_status || '');
  if (status !== 'paid' && status !== 'pending') {
    return NextResponse.json({ error: 'payment_status must be paid or pending' }, { status: 400 });
  }

  if (status === 'paid') {
    const result = await applyRegistrationPayment({
      registrationId: ctx.params.id,
      settleFull: true,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Could not update' },
        { status: result.status || 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      payment_status: result.payment_status,
      amount_paid_paise: result.amount_paid_paise,
      amount_due_paise: result.amount_due_paise,
    });
  }

  const result = await markRegistrationUnpaid(ctx.params.id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || 'Could not update' },
      { status: result.status || 500 }
    );
  }
  return NextResponse.json({ ok: true, payment_status: 'pending', amount_paid_paise: 0 });
}