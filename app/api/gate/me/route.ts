import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { gatePinConfigured, hasGateSession } from '@/lib/gate/session';

export async function GET() {
  const gate = await hasGateSession();
  const admin = await requireVerifiedAdmin();
  return NextResponse.json({
    // Volunteer scanner unlock = gate PIN cookie only (admin login does not skip PIN).
    ok: gate,
    gate,
    admin: Boolean(admin),
    pinConfigured: gatePinConfigured(),
  });
}
