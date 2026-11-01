import { NextResponse } from 'next/server';
import { requireGateOrAdmin } from '@/lib/gate/access';
import { lookupByCode } from '@/lib/gate/lookup';

export async function GET(request: Request) {
  const access = await requireGateOrAdmin();
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const code = new URL(request.url).searchParams.get('code') || '';
  const result = await lookupByCode(code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.registration);
}
