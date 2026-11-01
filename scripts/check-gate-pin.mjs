import assert from 'node:assert/strict';
import { timingSafeEqual } from 'node:crypto';

function verifyGatePin(input, expected) {
  if (!expected || expected.length < 4) return false;
  const a = Buffer.from(String(input || ''));
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
    return false;
  }
  return timingSafeEqual(a, b);
}

assert.equal(verifyGatePin('1234', '1234'), true);
assert.equal(verifyGatePin('1235', '1234'), false);
assert.equal(verifyGatePin('123', '1234'), false);
assert.equal(verifyGatePin('1234', '12'), false);
console.log('check-gate-pin: ok');
