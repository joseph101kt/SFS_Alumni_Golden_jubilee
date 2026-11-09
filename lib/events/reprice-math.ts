// lib/events/reprice-math.ts
// Pure recalculation of one registration's fee total and fee status. No database access.
// The donation is not part of this calculation: it is tracked on its own donation row.

import { amountDuePaise, statusFromAmounts } from '@/lib/events/balance';
import { clampGuestCount, clampGuestsEating, getEventCostBreakdown } from '@/lib/registration/registration';

export type RepriceRow = {
  attending: boolean;
  lunch: boolean;
  number_of_guests: number | null;
  guests_eating: number | null;
  batch?: number | null;
  amount_paid_paise?: number | null;
};

export type RepriceResult = {
  total_cost_paise: number;
  amount_paid_paise: number;
  amount_due_paise: number;
  payment_status: 'pending' | 'partial' | 'paid';
};

export function repriceRegistration(row: RepriceRow): RepriceResult {
  const guestCount = clampGuestCount(Number(row.number_of_guests) || 0);
  const guestsEating = clampGuestsEating(row.guests_eating, guestCount);
  const { totalCost } = getEventCostBreakdown({
    attending: row.attending,
    alumnusEats: row.lunch,
    batch: row.batch ?? null,
    guestCount,
    guestsEating,
  });
  const total_cost_paise = totalCost;
  const amount_paid_paise = Math.max(0, Math.floor(Number(row.amount_paid_paise) || 0));
  return {
    total_cost_paise,
    amount_paid_paise,
    amount_due_paise: amountDuePaise(total_cost_paise, amount_paid_paise),
    payment_status: statusFromAmounts(total_cost_paise, amount_paid_paise),
  };
}