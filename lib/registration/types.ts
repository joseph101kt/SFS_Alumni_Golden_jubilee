// lib/registration/types.ts
// Shared types, option lists, and pure helpers for the registration flow.
// Framework-free so both the route and the UI components can import it.

import { COUNTRIES } from '@/lib/countries';
import {
    clampGuestCount,
    normalizeFoodPreference,
    type FoodPreference,
    type GuestChoice,
} from '@/lib/registration/registration';
import { batchYears } from '@/lib/registration/registration-fields';

export { isSeniorSponsoredBatch } from '@/lib/registration/registration';

export type RegistrationStep = 'phone' | 'confirm_prefill' | 'details' | 'review' | 'success';

export interface PreRegistrationData {
    id: string;
    phone_number: string;
    email: string;
    full_name: string;
    last_name?: string;
    batch?: number;
    section?: string;
    current_location?: string;
    food_preference?: FoodPreference;
    match_type: 'exact' | 'phone_only';
}

/** Validates an untyped RPC row. Returns null when required fields are missing. */
export function parsePreRegistrationRow(value: unknown): PreRegistrationData | null {
    if (typeof value !== 'object' || value === null) return null;
    const row = value as Record<string, unknown>;
    if (
        typeof row.id !== 'string' ||
        typeof row.phone_number !== 'string' ||
        typeof row.email !== 'string' ||
        typeof row.full_name !== 'string'
    ) {
        return null;
    }
    if (row.match_type !== 'exact' && row.match_type !== 'phone_only') return null;
    return {
        id: row.id,
        phone_number: row.phone_number,
        email: row.email,
        full_name: row.full_name,
        last_name: typeof row.last_name === 'string' ? row.last_name : undefined,
        batch: typeof row.batch === 'number' ? row.batch : undefined,
        section: typeof row.section === 'string' ? row.section : undefined,
        current_location: typeof row.current_location === 'string' ? row.current_location : undefined,
        food_preference:
            row.food_preference === undefined ? undefined : normalizeFoodPreference(row.food_preference),
        match_type: row.match_type,
    };
}

/** First element of an unknown RPC result, or undefined when the value is not an array. */
export function firstRowOf(value: unknown): unknown {
    return Array.isArray(value) ? (value as unknown[])[0] : undefined;
}

export interface RegistrationUser {
    id: string;
    email: string;
    role: string;
    jubilee_reg_status: string;
}

/** Shape of GET /api/auth/me. Only the fields this flow reads are listed. */
export interface AuthProfile {
    id: string;
    email: string;
    role: string;
    jubilee_reg_status?: string;
    phone_number?: string;
    current_location?: string;
    full_name?: string;
    last_name?: string;
    batch?: number | null;
    section?: string | null;
}

export type DonationOption = 'zero' | '5000' | '10000' | '25000' | 'custom';

export interface FormData {
    phone_number: string;
    full_name: string;
    last_name: string;
    batch?: number;
    section: string;
    city: string;
    country: string;
    email: string;
    /** Whether the alumnus is attending. When false, their fee and food questions are skipped. */
    attending: boolean;
    /** Whether the alumnus eats lunch. Only the alumnus has this choice; guests always eat. */
    self_lunch: boolean;
    /** The alumnus's food preference. Only asked when they are eating lunch. */
    self_preference: FoodPreference;
    /** Guests only, excluding the alumnus. The length is the guest count, 0 to 9. */
    guests: GuestChoice[];
    donation_option: DonationOption;
    /** Raw digits typed into the custom donation input. Empty means no donation. */
    donation_custom: string;
}

export const DEFAULT_GUEST: GuestChoice = { preference: 'veg' };

const BATCH_YEARS = batchYears();

export const BATCH_OPTIONS = BATCH_YEARS.map((year) => ({
    value: String(year),
    label: String(year),
}));

export const COUNTRY_OPTIONS = COUNTRIES.map((country) => ({ value: country, label: country }));

/** Grows or shrinks the guest list to match the requested count, clamped to 0–9. */
export function resizeGuests(guests: GuestChoice[], requestedCount: number): GuestChoice[] {
    const size = clampGuestCount(requestedCount);
    if (guests.length === size) return guests;
    if (guests.length > size) return guests.slice(0, size);
    return [
        ...guests,
        ...Array.from({ length: size - guests.length }, () => ({ ...DEFAULT_GUEST })),
    ];
}

/**
 * Compact signature of the choices that affect price. Used to detect unsaved edits
 * (dirty form) by comparing the current form against the last saved state.
 */
export function choicesFingerprint(data: FormData): string {
    return [
        data.attending,
        data.self_lunch,
        data.self_preference,
        JSON.stringify(data.guests),
        data.donation_option,
        data.donation_custom,
    ].join('|');
}

// ---- Donation -------------------------------------------------------------

export const DONATION_MIN_RUPEES = 100;
export const DONATION_MAX_RUPEES = 200000;

export const DONATION_OPTIONS: ReadonlyArray<{ value: DonationOption; label: string; rupees: number }> = [
    { value: 'zero', label: 'Zero', rupees: 0 },
    { value: '5000', label: 'Rs. 5,000', rupees: 5000 },
    { value: '10000', label: 'Rs. 10,000', rupees: 10000 },
    { value: '25000', label: 'Rs. 25,000', rupees: 25000 },
    { value: 'custom', label: 'Custom', rupees: 0 },
];

/** Custom amount in whole rupees, or null when the user has not typed anything. */
export function customDonationRupees(raw: string): number | null {
    const digits = raw.replace(/\D/g, '');
    if (digits === '') return null;
    return Number(digits);
}

/** Donation in whole rupees. A custom amount counts only when the user entered one. */
export function donationRupeesFor(data: FormData): number {
    if (data.donation_option === 'custom') {
        const custom = customDonationRupees(data.donation_custom);
        if (custom === null) return 0;
        return custom >= DONATION_MIN_RUPEES && custom <= DONATION_MAX_RUPEES ? custom : 0;
    }
    return DONATION_OPTIONS.find((option) => option.value === data.donation_option)?.rupees ?? 0;
}

/** Message for an entered custom amount outside the allowed range; null when valid or empty. */
export function donationValidationError(data: FormData): string | null {
    if (data.donation_option !== 'custom') return null;
    const custom = customDonationRupees(data.donation_custom);
    if (custom === null) return null;
    if (custom < DONATION_MIN_RUPEES) return `Minimum donation is Rs. ${DONATION_MIN_RUPEES}.`;
    if (custom > DONATION_MAX_RUPEES) return `Maximum donation is Rs. ${DONATION_MAX_RUPEES.toLocaleString('en-IN')}.`;
    return null;
}