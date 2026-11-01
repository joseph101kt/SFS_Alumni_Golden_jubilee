import { NextResponse } from 'next/server';
import {
  createGateToken,
  gateCookieOptions,
  gatePinConfigured,
  GATE_COOKIE,
  verifyGatePin,
} from '@/lib/gate/session';

export async function POST(request: Request) {
  if (!gatePinConfigured()) {
    return NextResponse.json(
      { error: 'Gate PIN is not configured. Set GATE_PIN in the server environment.' },
      { status: 503 }
    );
  }
  const body = await request.json().catch(() => ({}));
  const pin = String(body.pin || '');
  if (!verifyGatePin(pin)) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
  }
  const token = await createGateToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, token, gateCookieOptions);
  return res;
}
