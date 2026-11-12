// lib/registration/types.ts
// Shared types and pure helpers for the registration flow. Framework-free so the route and the
// UI can both import it. Money is never computed here: the server returns every amount, and this
// file only stores and formats what it was given.

import { COUNTRIES } from '@/lib/countries';
import { normalizeFoodPreference, type FoodPreference } from '@/lib/registration/registration';
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

/**
 * What the form edits. Attendance and food are choices, not prices.
 * number_of_guests is how many guests are coming. guests_eating is how many of them eat.
 * food_preference is one shared choice for everyone eating.
 * Parking: has_parking is a yes/no. The vehicle counts are only meaningful when has_parking is true,
 * and are kept at 0 otherwise.
 */
export interface FormData {
    phone_number: string;
    full_name: string;
    last_name: string;
    batch?: number;
    section: string;
    city: string;
    country: string;
    email: string;
    attending: boolean;
    lunch: boolean;
    food_preference: FoodPreference;
    number_of_guests: number;
    guests_eating: number;
    has_parking: boolean;
    two_wheeler_count: number;
    four_wheeler_count: number;
    donation_option: DonationOption;
    /** Raw digits typed into the custom donation input. Empty means no donation. */
    donation_custom: string;
}

export const EMPTY_FORM: FormData = {
    phone_number: '',
    full_name: '',
    last_name: '',
    section: '',
    city: '',
    country: '',
    email: '',
    attending: true,
    lunch: true,
    food_preference: 'veg',
    number_of_guests: 0,
    guests_eating: 0,
    has_parking: false,
    two_wheeler_count: 0,
    four_wheeler_count: 0,
    donation_option: 'zero',
    donation_custom: '',
};

/** Every amount the screens show. Filled only from the server, never calculated in the browser. */
export interface RegistrationMoney {
    /** Event fee for the registration, from the server. */
    feeTotalPaise: number;
    feePaidPaise: number;
    feeDuePaise: number;
    /** Donation the registration intends to give, from the linked donation row. */
    donationIntendedPaise: number;
    donationDuePaise: number;
    donationPaymentStatus: string | null;
    /** Everything still owed: fee plus donation. This is what Pay charges. */
    totalDuePaise: number;
    /** Payment status of the fee only. */
    paymentStatus: string | null;
    registrationCode: string | null;
}

export const EMPTY_MONEY: RegistrationMoney = {
    feeTotalPaise: 0,
    feePaidPaise: 0,
    feeDuePaise: 0,
    donationIntendedPaise: 0,
    donationDuePaise: 0,
    donationPaymentStatus: null,
    totalDuePaise: 0,
    paymentStatus: null,
    registrationCode: null,
};

function nonNegativeInt(value: unknown): number {
    const whole = Math.floor(Number(value));
    return Number.isFinite(whole) && whole > 0 ? whole : 0;
}

/** Reads the amounts the server returned for a saved registration. Missing values become 0 or null. */
export function moneyFromRegistration(source: Record<string, unknown>): RegistrationMoney {
    return {
        feeTotalPaise: nonNegativeInt(source.total_cost_paise),
        feePaidPaise: nonNegativeInt(source.amount_paid_paise),
        feeDuePaise: nonNegativeInt(source.fee_due_paise),
        donationIntendedPaise: nonNegativeInt(source.intended_donation_paise),
        donationDuePaise: nonNegativeInt(source.donation_due_paise),
        donationPaymentStatus:
            typeof source.donation_payment_status === 'string' ? source.donation_payment_status : null,
        totalDuePaise: nonNegativeInt(source.total_due_paise),
        paymentStatus: typeof source.payment_status === 'string' ? source.payment_status : null,
        registrationCode: typeof source.registration_code === 'string' ? source.registration_code : null,
    };
}

export const DONATION_OPTIONS_RUPEES: Record<'zero' | '5000' | '10000' | '25000', number> = {
    zero: 0,
    '5000': 5000,
    '10000': 10000,
    '25000': 25000,
};

export const BATCH_OPTIONS = batchYears().map((year) => ({
    value: String(year),
    label: String(year),
}));

export const COUNTRY_OPTIONS = COUNTRIES.map((country) => ({ value: country, label: country }));

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

/** Donation in whole rupees the user intends to give. Invalid custom amounts count as zero. */
export function donationRupeesFor(data: FormData): number {
    if (data.donation_option === 'custom') {
        const custom = customDonationRupees(data.donation_custom);
        if (custom === null) return 0;
        return custom >= DONATION_MIN_RUPEES && custom <= DONATION_MAX_RUPEES ? custom : 0;
    }
    return DONATION_OPTIONS.find((option) => option.value === data.donation_option)?.rupees ?? 0;
}

/** The intended donation in paise, which is what the server receives. */
export function donationIntentPaise(data: FormData): number {
    return donationRupeesFor(data) * 100;
}

/** Form values for a saved donation amount, so a reload shows the same choice. */
export function donationFormFromPaise(paise: number): Pick<FormData, 'donation_option' | 'donation_custom'> {
    const rupees = Math.round(Math.max(0, paise) / 100);
    if (rupees === 0) return { donation_option: 'zero', donation_custom: '' };
    const preset = DONATION_OPTIONS.find((option) => option.value !== 'custom' && option.rupees === rupees);
    if (preset) return { donation_option: preset.value, donation_custom: '' };
    return { donation_option: 'custom', donation_custom: String(rupees) };
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

/**
 * Compact signature of everything the server prices or stores. Used to tell whether the form has
 * unsaved changes compared with the last saved state.
 */
export function choicesFingerprint(data: FormData): string {
    return [
        data.attending,
        data.lunch,
        data.food_preference,
        data.number_of_guests,
        data.guests_eating,
        data.has_parking,
        data.has_parking ? data.two_wheeler_count : 0,
        data.has_parking ? data.four_wheeler_count : 0,
        donationIntentPaise(data),
    ].join('|');
}