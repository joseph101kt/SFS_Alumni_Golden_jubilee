// lib/registration/registration.ts
// Event fee rules and attendance. Each person is either eating or not, and everyone eating
// shares one food choice (veg or non-veg). The alumnus pays only when attending, eating lunch,
// and outside the senior-sponsored batches (2021–2026). Guests pay only when eating.
// The server applies this rule when saving and settling payments. The client only displays it.

export type FoodPreference = 'veg' | 'non-veg';

export const MIN_GUESTS = 0;
export const MAX_GUESTS = 9;

/** Flat fee per paying person, in paise (₹1,000). */
export const EVENT_FEE_PER_PERSON_PAISE = 100_000;

const SENIOR_SPONSORED_FROM_BATCH = 2021;
const SENIOR_SPONSORED_TO_BATCH = 2026;

/** Batches 2021–2026: the alumnus's own fee is borne by Alumni Seniors. Guests still pay when eating. */
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

export type CostInput = {
  attending: boolean;
  alumnusEats: boolean;
  batch: number | null | undefined;
  guestCount: number;
  guestsEating: number;
};

export type CostBreakdown = {
  alumnusPays: boolean;
  payingPeople: number;
  totalCost: number;
  details: string;
};

/** The alumnus pays the event fee only when attending, eating lunch, and outside the senior batches. */
export function alumnusPaysEventFee(input: Pick<CostInput, 'attending' | 'alumnusEats' | 'batch'>): boolean {
  return input.attending && input.alumnusEats && !isSeniorSponsoredBatch(input.batch);
}

export function getEventCostBreakdown(input: CostInput): CostBreakdown {
  const guestCount = clampGuestCount(input.guestCount);
  const guestsEating = clampGuestsEating(input.guestsEating, guestCount);
  const alumnusPays = alumnusPaysEventFee(input);
  const payingPeople = (alumnusPays ? 1 : 0) + guestsEating;
  const totalCost = payingPeople * EVENT_FEE_PER_PERSON_PAISE;

  const feeLabel = formatCostForDisplay(EVENT_FEE_PER_PERSON_PAISE);
  const parts: string[] = [];
  if (alumnusPays) parts.push(`You · ${feeLabel}`);
  if (guestsEating > 0) {
    parts.push(`${guestsEating} guest${guestsEating === 1 ? '' : 's'} × ${feeLabel}`);
  }

  return {
    alumnusPays,
    payingPeople,
    totalCost,
    details: parts.length > 0 ? `Event fee: ${parts.join(' + ')}` : 'No event fee',
  };
}

export function formatCostForDisplay(costInPaise: number): string {
  return `₹${(costInPaise / 100).toFixed(2)}`;
}