import {
  buildRefundEmailBody,
  buildRefundMailto,
  normalizeRefundEmail,
  refundAmountPaise,
} from '../lib/events/refund-mailto.ts';

if (normalizeRefundEmail('  A@B.COM ') !== 'a@b.com') throw new Error('normalize');
if (normalizeRefundEmail('not-an-email') !== null) throw new Error('reject bad');
if (refundAmountPaise(10000, 70000) !== 60000) throw new Error('refund calc');
if (refundAmountPaise(70000, 70000) !== 0) throw new Error('no refund');

const draft = buildRefundEmailBody({
  eventTitle: 'Golden Jubilee',
  fullName: 'Ada Lovelace',
  registrationCode: 'SFS-1',
  totalPaise: 0,
  paidPaise: 70000,
});
if (draft.refundPaise !== 70000) throw new Error('draft refund');
if (!draft.subject.includes('₹700.00')) throw new Error(`subject: ${draft.subject}`);
if (!draft.body.includes('Refund amount: ₹700.00')) throw new Error(`body: ${draft.body}`);
if (!draft.body.includes('Please process a refund of ₹700.00')) throw new Error('ask line');

const href = buildRefundMailto({
  email: 'committee@sfs.example',
  eventTitle: 'Golden Jubilee',
  fullName: 'Ada Lovelace',
  registrationCode: 'SFS-1',
  totalPaise: 0,
  paidPaise: 70000,
});
const decoded = decodeURIComponent(href);
if (!decoded.includes('Refund amount: ₹700.00')) throw new Error(`mailto body: ${decoded}`);
console.log('ok: refund mailto');
