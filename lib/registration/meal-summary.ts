// lib/registration/meal-summary.ts
// Counts who is having lunch and their food choice, for check-in and the admin list.
// The alumnus eats only when attending and having lunch. Guests always eat.

import {
  normalizeFoodPreference,
  type FoodPreference,
  type GuestChoice,
} from '@/lib/registration/registration';

export type MealCounts = {
  lunchVeg: number;
  lunchNonVeg: number;
};

export type MealCountInput = {
  attending: boolean;
  selfLunch: boolean;
  selfPreference: unknown;
  guests: GuestChoice[];
};

export function mealCounts(input: MealCountInput): MealCounts {
  const counts: MealCounts = { lunchVeg: 0, lunchNonVeg: 0 };

  function add(preference: FoodPreference) {
    if (preference === 'non-veg') counts.lunchNonVeg += 1;
    else counts.lunchVeg += 1;
  }

  if (input.attending && input.selfLunch) {
    add(normalizeFoodPreference(input.selfPreference));
  }
  for (const guest of input.guests) {
    add(guest.preference);
  }
  return counts;
}

export function formatMealCounts(counts: MealCounts): string {
  const bits: string[] = [];
  if (counts.lunchVeg) bits.push(`Lunch veg×${counts.lunchVeg}`);
  if (counts.lunchNonVeg) bits.push(`Lunch non-veg×${counts.lunchNonVeg}`);
  return bits.join(' · ') || 'No lunch';
}