import crypto from 'crypto';
import Razorpay from 'razorpay';

/** Trim + strip wrapping quotes (common Vercel/env paste footgun). */
function envCred(name: string): string {
  let v = process.env[name]?.trim() || '';
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function keyId(): string {
  return envCred('RAZORPAY_KEY_ID');
}

function keySecret(): string {
  return envCred('RAZORPAY_KEY_SECRET');
}

function publicKeyId(): string {
  return envCred('NEXT_PUBLIC_RAZORPAY_KEY_ID') || keyId();
}

export function isRazorpayConfigured(): boolean {
  const id = keyId();
  const secret = keySecret();
  const pub = publicKeyId();
  console.log({
  id,
  secret: secret ? '[PRESENT]' : '[MISSING]',
  pub
});
  return Boolean(
    id &&
      secret &&
      pub &&
      !id.includes('...') &&
      !secret.includes('...') &&
      (id.startsWith('rzp_test_') || id.startsWith('rzp_live_'))
  );
}

export function razorpayKeyId(): string {
  return publicKeyId();
}

/** True when public checkout key and server key_id are the same mode+value. */
export function razorpayKeysAligned(): boolean {
  const id = keyId();
  const pub = publicKeyId();
  return Boolean(id && pub && id === pub);
}

export function getRazorpayClient(): Razorpay | null {
  if (!isRazorpayConfigured()) return null;
  return new Razorpay({
    key_id: keyId(),
    key_secret: keySecret(),
  });
}

export function verifyCheckoutSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = keySecret();
  if (!secret) return false;
  const body = `${params.orderId}|${params.paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(params.signature || '')));
  } catch {
    return false;
  }
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature || '')));
  } catch {
    return false;
  }
}
