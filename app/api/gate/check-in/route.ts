import { NextResponse } from 'next/server';
import { requireGateOrAdmin } from '@/lib/gate/access';
import { lookupByCode } from '@/lib/gate/lookup';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const access = await requireGateOrAdmin();
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const action = body.action === 'undo' ? 'undo' : 'check_in';
  const result = await lookupByCode(String(body.code || ''));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const admin = createAdminClient();
  if (action === 'undo') {
    const { error } = await admin
      .from('event_registrations')
      .update({ checked_in_at: null, checked_in_by: null })
      .eq('id', result.registration.id);
    if (error) {
      console.error('gate undo', error);
      return NextResponse.json(
        { error: 'Could not undo check-in. Apply the check-in migration if needed.' },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ...result.registration,
      checked_in_at: null,
    });
  }

  if (result.registration.checked_in_at) {
    return NextResponse.json({
      ...result.registration,
      already_checked_in: true,
    });
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from('event_registrations')
    .update({ checked_in_at: now, checked_in_by: access.actor })
    .eq('id', result.registration.id);
  if (error) {
    console.error('gate check-in', error);
    return NextResponse.json(
      { error: 'Could not mark check-in. Apply the check-in migration if needed.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ...result.registration,
    checked_in_at: now,
    already_checked_in: false,
  });
}
