// lib/events/venue-pass.ts
// Summary shown on a venue pass or at the gate. The alumnus counts only when attending.

import { guestsFromUnknown } from '../registration/registration';
import { formatMealCounts, mealCounts } from '../registration/meal-summary';

export type VenuePassInput = {
  attending: boolean;
  self_lunch: boolean;
  self_preference: unknown;
  guests: unknown;
  payment_status: string;
  amount_due_paise: number;
  registration_code?: string | null;
};

export type VenuePassSummary = {
  people: number;
  meals: string;
  paid: boolean;
  code: string | null;
};

export function venuePassSummary(reg: VenuePassInput): VenuePassSummary {
  const guests = guestsFromUnknown(reg.guests);
  const people = (reg.attending ? 1 : 0) + guests.length;
  const counts = mealCounts({
    attending: reg.attending,
    selfLunch: reg.self_lunch,
    selfPreference: reg.self_preference,
    guests,
  });
  return {
    people,
    meals: formatMealCounts(counts),
    paid: reg.payment_status === 'paid' && Math.max(0, Number(reg.amount_due_paise) || 0) === 0,
    code: reg.registration_code || null,
  };
}