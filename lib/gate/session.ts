import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { timingSafeEqual } from 'crypto';

export const GATE_COOKIE = 'sfs_gate';
const MAX_AGE_SEC = 60 * 60 * 16; // event day

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.GATE_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET is missing or too short');
  }
  return new TextEncoder().encode(`gate:${secret}`);
}

export function gatePinConfigured(): boolean {
  return Boolean(process.env.GATE_PIN && process.env.GATE_PIN.length >= 4);
}

export function verifyGatePin(input: string): boolean {
  const expected = process.env.GATE_PIN || '';
  if (!expected || expected.length < 4) return false;
  const a = Buffer.from(String(input || ''));
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // still compare to avoid leaking length via timing on equal-length only
    timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function createGateToken(): Promise<string> {
  return new SignJWT({ role: 'gate' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('gate')
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(getSecretKey());
}

export async function verifyGateToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const role = (payload as { role?: string }).role;
    return payload.sub === 'gate' && role === 'gate';
  } catch {
    return false;
  }
}

export const gateCookieOptions = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: MAX_AGE_SEC,
};

export async function hasGateSession(): Promise<boolean> {
  const token = cookies().get(GATE_COOKIE)?.value;
  if (!token) return false;
  return verifyGateToken(token);
}
