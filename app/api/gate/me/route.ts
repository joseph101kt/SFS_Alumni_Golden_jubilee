import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { gatePinConfigured, hasGateSession } from '@/lib/gate/session';

export async function GET() {
  const gate = await hasGateSession();
  const admin = await requireVerifiedAdmin();
  return NextResponse.json({
    ok: gate || Boolean(admin),
    gate,
    admin: Boolean(admin),
    pinConfigured: gatePinConfigured(),
  });
}
