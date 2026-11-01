import assert from 'node:assert/strict';

function amountDuePaise(total, paid) {
  return Math.max(0, Math.max(0, total) - Math.max(0, paid));
}

function classify(row) {
  const total = Math.max(0, Number(row.total_cost_paise) || 0);
  const paid = Math.max(0, Number(row.amount_paid_paise) || 0);
  amountDuePaise(total, paid);
  const due = amountDuePaise(total, paid);
  const status = String(row.payment_status || '').toLowerCase();
  const code = (row.registration_code || '').trim();
  const kinds = [];
  if ((status === 'pending' || status === 'partial') && due > 0) kinds.push('balance_due');
  if (status === 'paid' && due > 0) kinds.push('status_mismatch');
  if (status === 'paid' && !code) kinds.push('paid_no_code');
  if (status === 'cancelled' && paid > 0) kinds.push('cancelled_with_money');
  if (paid > total) kinds.push('overpay');
  return kinds;
}

assert.deepEqual(
  classify({ payment_status: 'pending', total_cost_paise: 1000, amount_paid_paise: 0 }),
  ['balance_due']
);
assert.deepEqual(
  classify({ payment_status: 'paid', total_cost_paise: 1000, amount_paid_paise: 500, registration_code: 'X' }),
  ['status_mismatch']
);
assert.deepEqual(
  classify({ payment_status: 'paid', total_cost_paise: 1000, amount_paid_paise: 1000, registration_code: null }),
  ['paid_no_code']
);
assert.deepEqual(
  classify({ payment_status: 'cancelled', total_cost_paise: 1000, amount_paid_paise: 1000 }),
  ['cancelled_with_money']
);
assert.deepEqual(
  classify({ payment_status: 'paid', total_cost_paise: 1000, amount_paid_paise: 1200, registration_code: 'A' }),
  ['overpay']
);
assert.deepEqual(
  classify({ payment_status: 'paid', total_cost_paise: 1000, amount_paid_paise: 1000, registration_code: 'A' }),
  []
);

console.log('check-event-exceptions: ok');
