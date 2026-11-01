import { buildRefundMailto, normalizeRefundEmail } from '../lib/events/refund-mailto.ts';

if (normalizeRefundEmail('  A@B.COM ') !== 'a@b.com') throw new Error('normalize');
if (normalizeRefundEmail('not-an-email') !== null) throw new Error('reject bad');

const href = buildRefundMailto({
  email: 'committee@sfs.example',
  eventTitle: 'Golden Jubilee',
  fullName: 'Ada Lovelace',
  registrationCode: 'SFS-1',
  totalPaise: 10000,
  paidPaise: 15000,
});
if (!href.startsWith('mailto:')) throw new Error('mailto');
if (!href.includes('Refund%20request') && !decodeURIComponent(href).includes('Refund request')) {
  throw new Error(`subject missing: ${href}`);
}
if (!decodeURIComponent(href).includes('Possible credit:')) throw new Error('credit line');
console.log('ok: refund mailto');
