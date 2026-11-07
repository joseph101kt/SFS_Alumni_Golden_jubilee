// lib/events/reprice-math.ts
// Pure recalculation of one registration's total and status. No database access.

import { amountDuePaise, statusFromAmounts } from './balance';
import { getEventCostBreakdown, guestsFromUnknown } from '../registration/registration';

export type RepriceRow = {
  attending: boolean;
  self_lunch: boolean;
  guests: unknown;
  batch?: number | null;
  amount_paid_paise?: number | null;
};

export function repriceRegistration(row: RepriceRow) {
  const guestCount = guestsFromUnknown(row.guests).length;
  const { totalCost } = getEventCostBreakdown({
    attending: row.attending,
    selfLunch: row.self_lunch,
    batch: row.batch ?? null,
    guestCount,
  });
  const total_cost_paise = totalCost;
  const amount_paid_paise = Math.max(0, Math.floor(Number(row.amount_paid_paise) || 0));
  const payment_status = statusFromAmounts(total_cost_paise, amount_paid_paise);
  return {
    total_cost_paise,
    amount_paid_paise,
    amount_due_paise: amountDuePaise(total_cost_paise, amount_paid_paise),
    payment_status,
  };
}