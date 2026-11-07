// lib/registration/registration.ts
// Event fee rules and guest choices. Every paying person pays a flat per-person fee.
// The alumnus pays only when attending, eating lunch, and outside the senior-sponsored
// batches (2021–2026). Guests always pay and always eat. The server must apply the same rule.

export type FoodPreference = 'veg' | 'non-veg';

export type GuestChoice = {
  preference: FoodPreference;
};

export const MIN_GUESTS = 0;
export const MAX_GUESTS = 9;

/** Flat fee per paying person, in paise (₹1,000). */
export const EVENT_FEE_PER_PERSON_PAISE = 100_000;

const SENIOR_SPONSORED_FROM_BATCH = 2021;
const SENIOR_SPONSORED_TO_BATCH = 2026;

/** Batches 2021–2026: the alumnus's own fee is borne by Alumni Seniors. Guests still pay. */
export function isSeniorSponsoredBatch(batch: number | null | undefined): boolean {
  return batch != null && batch >= SENIOR_SPONSORED_FROM_BATCH && batch <= SENIOR_SPONSORED_TO_BATCH;
}

export function normalizeFoodPreference(value: unknown): FoodPreference {
  return value === 'non-veg' ? 'non-veg' : 'veg';
}

export function normalizeGuest(raw: unknown): GuestChoice {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { preference: normalizeFoodPreference(row.preference) };
}

/** Parses an untyped guests list from the API. Anything that is not an array becomes an empty list. */
export function guestsFromUnknown(raw: unknown): GuestChoice[] {
  let value: unknown = raw;
  // Some rows were saved with the JSON encoded as a string; decode those too.
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.map((guest: unknown) => normalizeGuest(guest));
}

/** Keeps the guest count within 0–9. Non-finite input (e.g. an empty number field) becomes 0. */
export function clampGuestCount(requested: number): number {
  const whole = Math.floor(requested);
  if (!Number.isFinite(whole) || whole < MIN_GUESTS) return MIN_GUESTS;
  return Math.min(whole, MAX_GUESTS);
}

export type CostInput = {
  attending: boolean;
  selfLunch: boolean;
  batch: number | null | undefined;
  guestCount: number;
};

export type CostBreakdown = {
  selfPays: boolean;
  payingPeople: number;
  totalCost: number;
  details: string;
};

/** The alumnus pays the event fee only when attending, eating lunch, and outside the senior batches. */
export function selfPaysEventFee(input: Pick<CostInput, 'attending' | 'selfLunch' | 'batch'>): boolean {
  return input.attending && input.selfLunch && !isSeniorSponsoredBatch(input.batch);
}

export function getEventCostBreakdown(input: CostInput): CostBreakdown {
  const guestCount = clampGuestCount(input.guestCount);
  const selfPays = selfPaysEventFee(input);
  const payingPeople = (selfPays ? 1 : 0) + guestCount;
  const totalCost = payingPeople * EVENT_FEE_PER_PERSON_PAISE;

  const feeLabel = formatCostForDisplay(EVENT_FEE_PER_PERSON_PAISE);
  const parts: string[] = [];
  if (selfPays) parts.push(`You · ${feeLabel}`);
  if (guestCount > 0) {
    parts.push(`${guestCount} guest${guestCount === 1 ? '' : 's'} × ${feeLabel}`);
  }

  return {
    selfPays,
    payingPeople,
    totalCost,
    details: parts.length > 0 ? `Event fee: ${parts.join(' + ')}` : 'No event fee',
  };
}

export function formatCostForDisplay(costInPaise: number): string {
  return `₹${(costInPaise / 100).toFixed(2)}`;
}