export type ExceptionKind =
  | 'balance_due'
  | 'status_mismatch'
  | 'paid_no_code'
  | 'cancelled_with_money'
  | 'overpay';

export type ExceptionInput = {
  id: string;
  payment_status: string;
  total_cost_paise: number;
  amount_paid_paise: number;
  registration_code?: string | null;
};

export type ExceptionHit = ExceptionInput & {
  kinds: ExceptionKind[];
  amount_due_paise: number;
};

export function amountDuePaise(total: number, paid: number): number {
  return Math.max(0, Math.max(0, total) - Math.max(0, paid));
}

/** Classify one registration into zero or more exception kinds. */
export function classifyRegistration(row: ExceptionInput): ExceptionHit | null {
  const total = Math.max(0, Number(row.total_cost_paise) || 0);
  const paid = Math.max(0, Number(row.amount_paid_paise) || 0);
  const due = amountDuePaise(total, paid);
  const status = String(row.payment_status || '').toLowerCase();
  const code = (row.registration_code || '').trim();
  const kinds: ExceptionKind[] = [];

  if ((status === 'pending' || status === 'partial') && due > 0) {
    kinds.push('balance_due');
  }
  if (status === 'paid' && due > 0) {
    kinds.push('status_mismatch');
  }
  if (status === 'paid' && !code) {
    kinds.push('paid_no_code');
  }
  if (status === 'cancelled' && paid > 0) {
    kinds.push('cancelled_with_money');
  }
  if (paid > total) {
    kinds.push('overpay');
  }

  if (kinds.length === 0) return null;
  return { ...row, total_cost_paise: total, amount_paid_paise: paid, amount_due_paise: due, kinds };
}

export type MoneyTotals = {
  registration_count: number;
  people: number;
  paid_count: number;
  partial_count: number;
  pending_count: number;
  cancelled_count: number;
  checked_in_count: number;
  total_cost_paise: number;
  amount_paid_paise: number;
  amount_due_paise: number;
};

export type AggregateRow = {
  payment_status: string;
  number_of_guests: number;
  total_cost_paise: number;
  amount_paid_paise: number;
  checked_in_at?: string | null;
};

export function aggregateRegistrations(rows: AggregateRow[]): MoneyTotals {
  const totals: MoneyTotals = {
    registration_count: rows.length,
    people: 0,
    paid_count: 0,
    partial_count: 0,
    pending_count: 0,
    cancelled_count: 0,
    checked_in_count: 0,
    total_cost_paise: 0,
    amount_paid_paise: 0,
    amount_due_paise: 0,
  };
  for (const r of rows) {
    const total = Math.max(0, Number(r.total_cost_paise) || 0);
    const paid = Math.max(0, Number(r.amount_paid_paise) || 0);
    const status = String(r.payment_status || '').toLowerCase();
    totals.people += Math.max(0, Number(r.number_of_guests) || 0);
    totals.total_cost_paise += total;
    totals.amount_paid_paise += paid;
    totals.amount_due_paise += amountDuePaise(total, paid);
    if (status === 'paid') totals.paid_count += 1;
    else if (status === 'partial') totals.partial_count += 1;
    else if (status === 'cancelled') totals.cancelled_count += 1;
    else totals.pending_count += 1;
    if (r.checked_in_at) totals.checked_in_count += 1;
  }
  return totals;
}

export const EXCEPTION_LABELS: Record<ExceptionKind, string> = {
  balance_due: 'Balance due',
  status_mismatch: 'Paid status but balance due',
  paid_no_code: 'Paid without registration ID',
  cancelled_with_money: 'Cancelled with money paid',
  overpay: 'Overpaid',
};
