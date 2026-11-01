import {
  normalizeGuest,
  type EventPricing,
  type GuestChoice,
} from '@/lib/registration';
import type { EventCatalog } from '@/lib/events/types';

export function eventToPricing(event: Pick<
  EventCatalog,
  'lunch_paise' | 'dinner_paise' | 'parking_2w_paise' | 'parking_4w_paise' | 'base_ticket_paise'
> & Partial<
  Pick<
    EventCatalog,
    'lunch_nonveg_paise' | 'dinner_nonveg_paise' | 'fee_batch_from' | 'fee_batch_to' | 'fee_batch_paise'
  >
>): EventPricing {
  return {
    lunch_paise: event.lunch_paise,
    dinner_paise: event.dinner_paise,
    lunch_nonveg_paise: event.lunch_nonveg_paise,
    dinner_nonveg_paise: event.dinner_nonveg_paise,
    parking_2w_paise: event.parking_2w_paise,
    parking_4w_paise: event.parking_4w_paise,
    base_ticket_paise: event.base_ticket_paise,
    fee_batch_from: event.fee_batch_from ?? null,
    fee_batch_to: event.fee_batch_to ?? null,
    fee_batch_paise: event.fee_batch_paise ?? 0,
  };
}

export { effectiveBaseTicketPaise } from '@/lib/registration';

export function parseOptionalBatchYear(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1900) return null;
  return n;
}

function rupees(paise: number | null | undefined) {
  return ((paise || 0) / 100).toFixed(0);
}

/** True when this meal has a positive veg or non-veg rate (zero = not offered). */
export function mealIsOffered(
  vegPaise: number,
  nonvegPaise?: number | null
): boolean {
  const veg = Math.max(0, Number(vegPaise) || 0);
  const non =
    nonvegPaise == null || !Number.isFinite(Number(nonvegPaise))
      ? veg
      : Math.max(0, Number(nonvegPaise));
  return veg > 0 || non > 0;
}

/** Drop lunch/dinner choices when that meal’s event price is zero. */
export function clampGuestMealsToPricing(
  pricing: EventPricing,
  guests: GuestChoice[]
): GuestChoice[] {
  const lunchOn = mealIsOffered(pricing.lunch_paise, pricing.lunch_nonveg_paise);
  const dinnerOn = mealIsOffered(pricing.dinner_paise, pricing.dinner_nonveg_paise);
  return guests.map((g) => {
    const guest = normalizeGuest(g);
    if (!lunchOn && !dinnerOn) {
      return { preference: 'none' as const, lunch: false, dinner: false };
    }
    return {
      ...guest,
      lunch: lunchOn && guest.lunch,
      dinner: dinnerOn && guest.dinner,
    };
  });
}

/** One line of meal rates. Omits lunch/dinner when priced at zero. */
export function mealPriceSummary(event: EventPricing): string {
  const bits: string[] = [];
  if (mealIsOffered(event.lunch_paise, event.lunch_nonveg_paise)) {
    const lunchNon = event.lunch_nonveg_paise == null ? event.lunch_paise : event.lunch_nonveg_paise;
    bits.push(
      lunchNon === event.lunch_paise
        ? `Lunch ₹${rupees(event.lunch_paise)} / person`
        : `Lunch veg ₹${rupees(event.lunch_paise)} · non-veg ₹${rupees(lunchNon)} / person`
    );
  }
  if (mealIsOffered(event.dinner_paise, event.dinner_nonveg_paise)) {
    const dinnerNon = event.dinner_nonveg_paise == null ? event.dinner_paise : event.dinner_nonveg_paise;
    bits.push(
      dinnerNon === event.dinner_paise
        ? `Dinner ₹${rupees(event.dinner_paise)} / person`
        : `Dinner veg ₹${rupees(event.dinner_paise)} · non-veg ₹${rupees(dinnerNon)} / person`
    );
  }
  return bits.join(' · ') || 'No meals on this event';
}

export function mealChoiceLabel(
  name: string,
  vegPaise: number,
  nonvegPaise: number | null | undefined,
  preference: 'veg' | 'non-veg' | 'none'
): string {
  const rate = preference === 'non-veg' && nonvegPaise != null ? nonvegPaise : vegPaise;
  return `${name} · ₹${rupees(rate)} / person`;
}

export function parseNonNegInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

/** Convert rupees (form input) to paise. */
export function rupeesToPaise(rupees: unknown): number {
  const n = Number(rupees);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}
