// lib/events/existing-registration.ts
// Shapes for a saved event registration and the merge that prefills the form from it.

import {
  guestsFromUnknown,
  normalizeFoodPreference,
  type FoodPreference,
  type GuestChoice,
} from '../registration/registration';
import { parseLocation } from '../registration/registration-fields';

export type ExistingRegistrationRow = {
  attending: boolean;
  self_lunch: boolean;
  self_preference: string | null;
  guests?: unknown;
  number_of_guests?: number;
  phone_number: string | null;
  payment_status: string;
  amount_paid_paise?: number;
  amount_due_paise?: number;
  total_cost_paise?: number;
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
  self_lunch: boolean;
  self_preference: FoodPreference;
  guests: GuestChoice[];
  payment_status?: string;
  amount_paid_paise: number;
  amount_due_paise: number;
  total_cost_paise: number;
};

/** Merge account profile + saved event registration into registration-form fields. */
export function mergeRegistrationPrefill(
  profile: RegistrationProfileSnapshot | null | undefined,
  row: ExistingRegistrationRow | null | undefined
): RegistrationPrefill {
  const loc = parseLocation(profile?.current_location || '');
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
    self_lunch: row?.self_lunch ?? true,
    self_preference: normalizeFoodPreference(row?.self_preference),
    guests: guestsFromUnknown(row?.guests),
    payment_status: row?.payment_status,
    amount_paid_paise: Math.max(0, Number(row?.amount_paid_paise) || 0),
    amount_due_paise: Math.max(0, Number(row?.amount_due_paise) || 0),
    total_cost_paise: Math.max(0, Number(row?.total_cost_paise) || 0),
  };
}