// lib/events/existing-registration.ts
// Shapes for a saved event registration and the merge that prefills the form from it.
// The form reads the server's figures. It never recomputes the fee or the donation.

import { normalizeFoodPreference, type FoodPreference } from '../registration/registration';
import { parseLocation } from '../registration/registration-fields';

export type ExistingRegistrationRow = {
  attending: boolean;
  lunch: boolean;
  food_preference: string | null;
  number_of_guests: number | null;
  guests_eating: number | null;
  has_parking?: boolean | null;
  two_wheeler_count?: number | null;
  four_wheeler_count?: number | null;
  phone_number: string | null;
  payment_status: string;
  total_cost_paise?: number;
  amount_paid_paise?: number;
  fee_due_paise?: number;
  donation_due_paise?: number;
  total_due_paise?: number;
  intended_donation_paise?: number;
  donation_payment_status?: string | null;
};

export type RegistrationProfileSnapshot = {
  full_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  batch?: number | null;
  section?: string | null;
  current_location?: string | null;
};

export type RegistrationPrefill = {
  full_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  batch?: number;
  section: string;
  city: string;
  country: string;
  attending: boolean;
  lunch: boolean;
  /** Shared food choice for everyone eating. Defaults to veg when nobody is eating yet. */
  food_preference: FoodPreference;
  number_of_guests: number;
  guests_eating: number;
  has_parking: boolean;
  two_wheeler_count: number;
  four_wheeler_count: number;
  intended_donation_paise: number;
  payment_status?: string;
  donation_payment_status: string | null;
  total_cost_paise: number;
  amount_paid_paise: number;
  fee_due_paise: number;
  donation_due_paise: number;
  total_due_paise: number;
};

function nonNegativeInt(value: unknown): number {
  return Math.max(0, Math.floor(Number(value) || 0));
}

/** Merge account profile + saved event registration into registration-form fields. */
export function mergeRegistrationPrefill(
  profile: RegistrationProfileSnapshot | null | undefined,
  row: ExistingRegistrationRow | null | undefined
): RegistrationPrefill {
  const loc = parseLocation(profile?.current_location || '');
  // The database keeps vehicle counts at 0 when parking is off. Mirror that here so the form matches.
  const hasParking = row?.has_parking === true;
  return {
    full_name: String(profile?.full_name || '').trim(),
    last_name: String(profile?.last_name || '').trim(),
    email: String(profile?.email || '').trim(),
    phone_number: row?.phone_number || profile?.phone_number || '',
    batch: typeof profile?.batch === 'number' ? profile.batch : undefined,
    section: String(profile?.section || '').trim(),
    city: loc.city,
    country: loc.country,
    attending: row?.attending ?? true,
    lunch: row?.lunch ?? true,
    food_preference: normalizeFoodPreference(row?.food_preference),
    number_of_guests: nonNegativeInt(row?.number_of_guests),
    guests_eating: nonNegativeInt(row?.guests_eating),
    has_parking: hasParking,
    two_wheeler_count: hasParking ? nonNegativeInt(row?.two_wheeler_count) : 0,
    four_wheeler_count: hasParking ? nonNegativeInt(row?.four_wheeler_count) : 0,
    intended_donation_paise: nonNegativeInt(row?.intended_donation_paise),
    payment_status: row?.payment_status,
    donation_payment_status: row?.donation_payment_status ?? null,
    total_cost_paise: nonNegativeInt(row?.total_cost_paise),
    amount_paid_paise: nonNegativeInt(row?.amount_paid_paise),
    fee_due_paise: nonNegativeInt(row?.fee_due_paise),
    donation_due_paise: nonNegativeInt(row?.donation_due_paise),
    total_due_paise: nonNegativeInt(row?.total_due_paise),
  };
}