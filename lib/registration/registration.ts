// lib/registration/registration.ts
// Event fee rules, attendance, and parking limits.
// Fee: ₹1000 for each person attending. The alumnus pays when attending, unless their batch is
// senior-sponsored (2021–2026). Every guest who is attending pays, whether or not they eat lunch.
// Lunch and the shared food choice do not change the fee; they only decide food counts and the food question.
// Parking: total vehicles (2-wheelers + 4-wheelers) may not exceed the number of people coming,
// which is the alumnus plus the guests.
// The server applies these rules when saving and settling payments. The client only displays them.

export type FoodPreference = 'veg' | 'non-veg';

export const MIN_GUESTS = 0;
export const MAX_GUESTS = 9;

/** Flat fee per paying person, in paise (₹1,000). */
export const EVENT_FEE_PER_PERSON_PAISE = 100_000;

const SENIOR_SPONSORED_FROM_BATCH = 2021;
const SENIOR_SPONSORED_TO_BATCH = 2026;

/** Batches 2021–2026: the alumnus's own fee is borne by Alumni Seniors. Their guests still pay. */
export function isSeniorSponsoredBatch(batch: number | null | undefined): boolean {
  return batch != null && batch >= SENIOR_SPONSORED_FROM_BATCH && batch <= SENIOR_SPONSORED_TO_BATCH;
}

/** Anything other than 'non-veg' is treated as veg. Used only when someone is eating. */
export function normalizeFoodPreference(value: unknown): FoodPreference {
  return value === 'non-veg' ? 'non-veg' : 'veg';
}

/** Keeps the guest count within 0–9. Non-finite input (e.g. an empty number field) becomes 0. */
export function clampGuestCount(requested: number): number {
  const whole = Math.floor(Number(requested));
  if (!Number.isFinite(whole) || whole < MIN_GUESTS) return MIN_GUESTS;
  return Math.min(whole, MAX_GUESTS);
}

/** Guests who are eating, kept between 0 and the guest count. */
export function clampGuestsEating(requested: unknown, guestCount: number): number {
  const whole = Math.floor(Number(requested));
  if (!Number.isFinite(whole) || whole < 0) return 0;
  return Math.min(whole, clampGuestCount(guestCount));
}

/** Someone is attending when the alumnus attends or at least one guest is coming. */
export function isEventAttending(alumnusAttending: boolean, guestCount: number): boolean {
  return alumnusAttending || clampGuestCount(guestCount) > 0;
}

/** Whether anyone in the registration is eating. The shared food choice only matters then. */
export function anyoneEating(alumnusEats: boolean, guestsEating: number): boolean {
  return alumnusEats || Math.floor(Number(guestsEating) || 0) > 0;
}

/**
 * Most vehicles (2-wheelers + 4-wheelers together) a registration can park.
 * One per person coming: the alumnus plus every guest.
 */
export function maxVehiclesFor(guestCount: number): number {
  return clampGuestCount(guestCount) + 1;
}

/** Keeps a vehicle count a whole number at or above zero. Non-finite input becomes 0. */
export function clampVehicleCount(requested: unknown): number {
  const whole = Math.floor(Number(requested));
  return Number.isFinite(whole) && whole > 0 ? whole : 0;
}

/**
 * Message when the vehicle counts break the rule, or null when they are valid.
 * Only checked when parking is needed; the caller sends zero counts otherwise.
 */
export function vehicleCountsProblem(
  twoWheelers: number,
  fourWheelers: number,
  guestCount: number
): string | null {
  const two = clampVehicleCount(twoWheelers);
  const four = clampVehicleCount(fourWheelers);
  const max = maxVehiclesFor(guestCount);
  if (two + four === 0) return 'Enter at least one 2-wheeler or 4-wheeler, or choose No for parking.';
  if (two + four > max) {
    return `Total vehicles cannot exceed ${max} (you and your ${clampGuestCount(guestCount)} guest${
      clampGuestCount(guestCount) === 1 ? '' : 's'
    }).`;
  }
  return null;
}

export type CostInput = {
  attending: boolean;
  /** Lunch choice. Used for the food question only; it does not change the fee. */
  alumnusEats: boolean;
  batch: number | null | undefined;
  guestCount: number;
  /** Guests eating lunch. Used for food counts only; it does not change the fee. */
  guestsEating: number;
};

export type CostBreakdown = {
  alumnusPays: boolean;
  payingPeople: number;
  totalCost: number;
  details: string;
};

/** The alumnus pays the event fee when attending, unless their batch is senior-sponsored. */
export function alumnusPaysEventFee(input: Pick<CostInput, 'attending' | 'batch'>): boolean {
  return input.attending && !isSeniorSponsoredBatch(input.batch);
}

/** Every attending guest pays the fee, whether or not they eat. */
export function getEventCostBreakdown(input: CostInput): CostBreakdown {
  const guestCount = clampGuestCount(input.guestCount);
  const alumnusPays = alumnusPaysEventFee(input);
  const payingPeople = (alumnusPays ? 1 : 0) + guestCount;
  const totalCost = payingPeople * EVENT_FEE_PER_PERSON_PAISE;

  const feeLabel = formatCostForDisplay(EVENT_FEE_PER_PERSON_PAISE);
  const parts: string[] = [];
  if (alumnusPays) parts.push(`You · ${feeLabel}`);
  if (guestCount > 0) {
    parts.push(`${guestCount} guest${guestCount === 1 ? '' : 's'} × ${feeLabel}`);
  }

  return {
    alumnusPays,
    payingPeople,
    totalCost,
    details: parts.length > 0 ? `Registration fee: ${parts.join(' + ')}` : 'No registration fee',
  };
}

export function formatCostForDisplay(costInPaise: number): string {
  return `₹${(costInPaise / 100).toFixed(2)}`;
}