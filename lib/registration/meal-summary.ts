// lib/registration/meal-summary.ts
// Counts who is having lunch and the shared food choice, for check-in and the admin list.
// The alumnus eats only when attending and having lunch. Guests eat by count.
// Everyone eating has the same veg / non-veg choice.

import { normalizeFoodPreference } from '@/lib/registration/registration';

export type MealCounts = {
  lunchVeg: number;
  lunchNonVeg: number;
};

export type MealCountInput = {
  attending: boolean;
  alumnusEats: boolean;
  foodPreference: unknown;
  guestsEating: number;
};

export function mealCounts(input: MealCountInput): MealCounts {
  const alumnusCount = input.attending && input.alumnusEats ? 1 : 0;
  const guestCount = Math.max(0, Math.floor(Number(input.guestsEating) || 0));
  const eaters = alumnusCount + guestCount;

  if (eaters === 0) return { lunchVeg: 0, lunchNonVeg: 0 };

  return normalizeFoodPreference(input.foodPreference) === 'non-veg'
    ? { lunchVeg: 0, lunchNonVeg: eaters }
    : { lunchVeg: eaters, lunchNonVeg: 0 };
}

export function formatMealCounts(counts: MealCounts): string {
  const bits: string[] = [];
  if (counts.lunchVeg) bits.push(`Lunch veg×${counts.lunchVeg}`);
  if (counts.lunchNonVeg) bits.push(`Lunch non-veg×${counts.lunchNonVeg}`);
  return bits.join(' · ') || 'No lunch';
}