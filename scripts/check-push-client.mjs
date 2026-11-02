import { urlBase64ToUint8Array } from '../lib/push/client-subscribe.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sample = 'BNcRdteraUzK08Jy'; // short fake key fragment — length check only
const bytes = urlBase64ToUint8Array(sample);
assert(bytes instanceof Uint8Array, 'returns Uint8Array');
assert(bytes.length > 0, 'non-empty decode');
// padding path: length % 4 === 2
const b2 = urlBase64ToUint8Array('ab');
assert(b2.length >= 1, 'pads and decodes short input');

console.log('PASS push client');
