// lib/registration.ts

export type ParkingNeeded = '2-wheeler' | '4-wheeler' | 'none';
export type FoodPreference = 'veg' | 'non-veg' | 'none';

export type GuestChoice = {
  preference: FoodPreference;
  lunch: boolean;
  dinner: boolean;
};

export type GuestMealCounts = {
  lunchVeg: number;
  lunchNonVeg: number;
  dinnerVeg: number;
  dinnerNonVeg: number;
  noFood: number;
  people: number;
};

export function normalizeFoodPreference(value: unknown): FoodPreference {
  if (value === 'non-veg') return 'non-veg';
  if (value === 'none') return 'none';
  return 'veg';
}

export function normalizeGuest(raw: unknown): GuestChoice {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const preference = normalizeFoodPreference(row.preference ?? row.food_preference);
  if (preference === 'none') return { preference: 'none', lunch: false, dinner: false };
  return {
    preference,
    lunch: Boolean(row.lunch),
    dinner: Boolean(row.dinner),
  };
}

export function guestsFromLegacy(
  people: number,
  preference: unknown,
  lunch: boolean,
  dinner: boolean
): GuestChoice[] {
  const n = partySize(people);
  const one = normalizeGuest({ preference, lunch, dinner });
  return Array.from({ length: n }, () => ({ ...one }));
}

export function normalizeGuests(raw: unknown, fallbackPeople = 1): GuestChoice[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((g) => normalizeGuest(g));
  }
  return guestsFromLegacy(fallbackPeople, 'veg', false, false);
}

export function legacySummaryFromGuests(guests: GuestChoice[]): {
  food_preference: string;
  lunch: boolean;
  dinner: boolean;
} {
  const list = guests.length ? guests.map(normalizeGuest) : [normalizeGuest({})];
  const prefs = new Set(list.map((g) => g.preference));
  let food_preference: string;
  if (prefs.size === 1) food_preference = [...prefs][0];
  else if ([...prefs].every((p) => p === 'none')) food_preference = 'none';
  else food_preference = 'mixed';
  return {
    food_preference,
    lunch: list.some((g) => g.lunch),
    dinner: list.some((g) => g.dinner),
  };
}

export function guestMealCounts(guests: GuestChoice[]): GuestMealCounts {
  const list = guests.map(normalizeGuest);
  const counts: GuestMealCounts = {
    lunchVeg: 0,
    lunchNonVeg: 0,
    dinnerVeg: 0,
    dinnerNonVeg: 0,
    noFood: 0,
    people: list.length || 1,
  };
  for (const g of list) {
    if (g.preference === 'none') {
      counts.noFood += 1;
      continue;
    }
    if (g.lunch) {
      if (g.preference === 'non-veg') counts.lunchNonVeg += 1;
      else counts.lunchVeg += 1;
    }
    if (g.dinner) {
      if (g.preference === 'non-veg') counts.dinnerNonVeg += 1;
      else counts.dinnerVeg += 1;
    }
  }
  return counts;
}

export function formatGuestMealCounts(counts: GuestMealCounts): string {
  const bits: string[] = [];
  if (counts.lunchVeg) bits.push(`Lunch veg×${counts.lunchVeg}`);
  if (counts.lunchNonVeg) bits.push(`Lunch non-veg×${counts.lunchNonVeg}`);
  if (counts.dinnerVeg) bits.push(`Dinner veg×${counts.dinnerVeg}`);
  if (counts.dinnerNonVeg) bits.push(`Dinner non-veg×${counts.dinnerNonVeg}`);
  if (counts.noFood) bits.push(`No food×${counts.noFood}`);
  return bits.join(' · ') || 'No meals';
}

export type CostCalculationInput = {
  numberOfGuests?: number;
  lunch?: boolean;
  dinner?: boolean;
  parkingNeeded: ParkingNeeded;
  foodPreference?: FoodPreference;
  guests?: GuestChoice[];
  /** Alumnus batch year — used for registration-fee range exceptions. */
  batch?: number | null;
};

export type EventPricing = {
  lunch_paise: number;
  dinner_paise: number;
  /** Absent means non-veg lunch uses the veg lunch rate. */
  lunch_nonveg_paise?: number | null;
  /** Absent means non-veg dinner uses the veg dinner rate. */
  dinner_nonveg_paise?: number | null;
  parking_2w_paise: number;
  parking_4w_paise: number;
  base_ticket_paise: number;
  /** Inclusive batch bounds for fee; both null = fee applies to all. */
  fee_batch_from?: number | null;
  fee_batch_to?: number | null;
};

function mealRatePaise(pricing: EventPricing, meal: 'lunch' | 'dinner', foodPreference?: string): number {
  const veg = meal === 'lunch' ? pricing.lunch_paise || 0 : pricing.dinner_paise || 0;
  if (foodPreference !== 'non-veg') return veg;
  const nonveg = meal === 'lunch' ? pricing.lunch_nonveg_paise : pricing.dinner_nonveg_paise;
  if (nonveg == null || !Number.isFinite(Number(nonveg))) return veg;
  return Math.max(0, Number(nonveg));
}

/** Registration fee per person after batch-range rules. Both bounds null = all batches. */
export function effectiveBaseTicketPaise(
  pricing: Pick<EventPricing, 'base_ticket_paise' | 'fee_batch_from' | 'fee_batch_to'>,
  batch?: number | null
): number {
  const rate = Math.max(0, Number(pricing.base_ticket_paise) || 0);
  if (rate <= 0) return 0;
  const fromRaw = pricing.fee_batch_from;
  const toRaw = pricing.fee_batch_to;
  const fromSet = fromRaw != null && Number.isFinite(Number(fromRaw));
  const toSet = toRaw != null && Number.isFinite(Number(toRaw));
  if (!fromSet && !toSet) return rate;
  if (batch == null || !Number.isFinite(Number(batch))) return 0;
  const batchYear = Math.floor(Number(batch));
  if (fromSet && toSet) {
    const lo = Math.min(Number(fromRaw), Number(toRaw));
    const hi = Math.max(Number(fromRaw), Number(toRaw));
    return batchYear >= lo && batchYear <= hi ? rate : 0;
  }
  const only = fromSet ? Number(fromRaw) : Number(toRaw);
  return batchYear === only ? rate : 0;
}

/** @deprecated Prefer event catalog rates; kept for interim call sites. */
export const DEFAULT_JUBILEE_PRICING: EventPricing = {
  lunch_paise: 30000,
  dinner_paise: 50000,
  parking_2w_paise: 5000,
  parking_4w_paise: 20000,
  base_ticket_paise: 0,
};

export function calculateEventRegistrationCost(
  pricing: EventPricing,
  input: CostCalculationInput
): number {
  return getEventCostBreakdown(pricing, input).totalCost;
}

/** People attending, including the alumnus. Blank or zero still counts as one person. */
export function partySize(numberOfGuests: number): number {
  const n = Math.floor(Number(numberOfGuests));
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

function resolveGuests(input: CostCalculationInput): GuestChoice[] {
  if (Array.isArray(input.guests) && input.guests.length > 0) {
    return input.guests.map(normalizeGuest);
  }
  return guestsFromLegacy(
    input.numberOfGuests ?? 1,
    input.foodPreference ?? 'veg',
    Boolean(input.lunch),
    Boolean(input.dinner)
  );
}

function guestsForPricing(pricing: EventPricing, input: CostCalculationInput): GuestChoice[] {
  // Inline clamp (avoid circular import with pricing.ts helpers used by the UI).
  const lunchOn =
    Math.max(0, pricing.lunch_paise || 0) > 0 ||
    (pricing.lunch_nonveg_paise != null && Number(pricing.lunch_nonveg_paise) > 0);
  const dinnerOn =
    Math.max(0, pricing.dinner_paise || 0) > 0 ||
    (pricing.dinner_nonveg_paise != null && Number(pricing.dinner_nonveg_paise) > 0);
  return resolveGuests(input).map((g) => {
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

export function getEventCostBreakdown(
  pricing: EventPricing,
  input: CostCalculationInput
): {
  mealCost: number;
  parkingCost: number;
  baseCost: number;
  totalCost: number;
  details: string;
} {
  const guests = guestsForPricing(pricing, input);
  const totalPeople = guests.length;
  let mealCost = 0;

  for (const g of guests) {
    if (g.preference === 'none') continue;
    if (g.lunch) mealCost += mealRatePaise(pricing, 'lunch', g.preference);
    if (g.dinner) mealCost += mealRatePaise(pricing, 'dinner', g.preference);
  }

  const parkingCost =
    input.parkingNeeded === '2-wheeler'
      ? pricing.parking_2w_paise || 0
      : input.parkingNeeded === '4-wheeler'
        ? pricing.parking_4w_paise || 0
        : 0;

  const baseRate = effectiveBaseTicketPaise(pricing, input.batch);
  const baseCost = totalPeople * baseRate;
  const counts = guestMealCounts(guests);

  const mealBits: string[] = [];
  if (counts.lunchVeg) {
    mealBits.push(`Lunch veg×${counts.lunchVeg} ₹${(mealRatePaise(pricing, 'lunch', 'veg') / 100).toFixed(0)}`);
  }
  if (counts.lunchNonVeg) {
    mealBits.push(
      `Lunch non-veg×${counts.lunchNonVeg} ₹${(mealRatePaise(pricing, 'lunch', 'non-veg') / 100).toFixed(0)}`
    );
  }
  if (counts.dinnerVeg) {
    mealBits.push(
      `Dinner veg×${counts.dinnerVeg} ₹${(mealRatePaise(pricing, 'dinner', 'veg') / 100).toFixed(0)}`
    );
  }
  if (counts.dinnerNonVeg) {
    mealBits.push(
      `Dinner non-veg×${counts.dinnerNonVeg} ₹${(mealRatePaise(pricing, 'dinner', 'non-veg') / 100).toFixed(0)}`
    );
  }

  let details =
    mealBits.length > 0
      ? `${totalPeople} people · ${mealBits.join(' · ')}`
      : `${totalPeople} people · No meals`;
  if (parkingCost > 0) {
    details += ` · parking ₹${(parkingCost / 100).toFixed(0)}`;
  }
  if (baseRate > 0) {
    details += ` · registration fee ₹${(baseRate / 100).toFixed(0)} / person`;
  }

  return {
    mealCost,
    parkingCost,
    baseCost,
    totalCost: mealCost + parkingCost + baseCost,
    details,
  };
}

/** Legacy wrapper using Jubilee defaults. */
export function calculateRegistrationCost(input: CostCalculationInput): number {
  return calculateEventRegistrationCost(DEFAULT_JUBILEE_PRICING, input);
}

export function getCostBreakdown(input: CostCalculationInput) {
  const b = getEventCostBreakdown(DEFAULT_JUBILEE_PRICING, input);
  return {
    mealCost: b.mealCost,
    parkingCost: b.parkingCost,
    totalCost: b.totalCost,
    details: b.details,
  };
}

export function formatCostForDisplay(costInPaise: number): string {
  const rupees = costInPaise / 100;
  return `₹${rupees.toFixed(2)}`;
}

export function validateRegistrationCost(
  pricingOrInput: EventPricing | CostCalculationInput,
  maybeInput?: CostCalculationInput
): boolean {
  const pricing = maybeInput ? (pricingOrInput as EventPricing) : DEFAULT_JUBILEE_PRICING;
  const input = maybeInput ?? (pricingOrInput as CostCalculationInput);
  const guests = guestsForPricing(pricing, input);
  const hasMeal = guests.some((g) => g.lunch || g.dinner);
  const hasParking = input.parkingNeeded !== 'none';
  const hasBase = effectiveBaseTicketPaise(pricing, input.batch) > 0;
  return hasMeal || hasParking || hasBase;
}
