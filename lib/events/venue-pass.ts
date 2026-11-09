// lib/events/venue-pass.ts
// Summary shown on a venue pass or at the gate.
// People counts everyone coming: the alumnus when attending, plus every guest.
// Meals count only those eating. A pass is paid only when nothing is due, fee or donation.

import { formatMealCounts, mealCounts } from '../registration/meal-summary';
import { clampGuestCount, clampGuestsEating } from '../registration/registration';

export type VenuePassInput = {
  attending: boolean;
  lunch: boolean;
  food_preference: unknown;
  number_of_guests: number | null;
  guests_eating: number | null;
  payment_status: string;
  total_due_paise: number;
  registration_code?: string | null;
};

export type VenuePassSummary = {
  people: number;
  meals: string;
  paid: boolean;
  code: string | null;
};

export function venuePassSummary(reg: VenuePassInput): VenuePassSummary {
  const guestCount = clampGuestCount(Number(reg.number_of_guests) || 0);
  const guestsEating = clampGuestsEating(reg.guests_eating, guestCount);
  const people = (reg.attending ? 1 : 0) + guestCount;
  const counts = mealCounts({
    attending: reg.attending,
    alumnusEats: reg.lunch,
    foodPreference: reg.food_preference,
    guestsEating,
  });
  return {
    people,
    meals: formatMealCounts(counts),
    paid: reg.payment_status === 'paid' && Math.max(0, Number(reg.total_due_paise) || 0) === 0,
    code: reg.registration_code || null,
  };
}