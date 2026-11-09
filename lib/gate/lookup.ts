// lib/gate/lookup.ts
// Gate lookup and admission for one registration. Admission is split: the alumnus and any number
// of guests can enter in separate steps. Nobody is admitted unless the registration is confirmed,
// meaning the committee verified it or it is fully settled (fee and donation).
// Every figure comes from the database row.

import { amountDuePaise, OPEN_PAYMENT_STATUSES } from '@/lib/events/balance';
import {
  issueMissingPaidCodes,
  missingColumn,
  normalizeRegistrationCode,
  type RegistrationCodeAdmin,
} from '@/lib/events/registration-code';
import { venuePassSummary } from '@/lib/events/venue-pass';
import { clampGuestCount, clampGuestsEating } from '@/lib/registration/registration';
import { createAdminClient } from '@/lib/supabase-admin';

const SELECT = [
  'id',
  'registration_code',
  'attending',
  'lunch',
  'food_preference',
  'number_of_guests',
  'guests_eating',
  'guests_checked_in',
  'payment_status',
  'total_cost_paise',
  'amount_paid_paise',
  'core_committee_manually_verified',
  'checked_in_at',
  'donation:donations!event_registrations_donation_id_fkey(amount_paise,payment_status)',
  'event_catalog(title)',
  'alumni_accounts(full_name)',
].join(',');

type DonationEmbed = { amount_paise: number; payment_status: string };

type GateRow = {
  id: string;
  registration_code: string | null;
  attending: boolean;
  lunch: boolean;
  food_preference: string | null;
  number_of_guests: number | null;
  guests_eating: number | null;
  guests_checked_in: number | null;
  payment_status: string;
  total_cost_paise: number;
  amount_paid_paise: number;
  core_committee_manually_verified: boolean | null;
  checked_in_at: string | null;
  donation: DonationEmbed | DonationEmbed[] | null;
  event_catalog: { title: string } | { title: string }[] | null;
  alumni_accounts: { full_name: string } | { full_name: string }[] | null;
};

export type GateRegistration = {
  id: string;
  registration_code: string;
  full_name: string;
  event_title: string;
  attending: boolean;
  payment_status: string;
  committee_confirmed: boolean;
  /** True when the committee verified it or it is fully settled. Only confirmed registrations admit. */
  confirmed: boolean;
  amount_paid_paise: number;
  total_due_paise: number;
  guest_count: number;
  guests_eating: number;
  guests_checked_in: number;
  guests_remaining: number;
  alumnus_checked_in: boolean;
  alumnus_checked_in_at: string | null;
  can_admit_alumnus: boolean;
  can_admit_guests: boolean;
  people: number;
  meals: string;
  /** Kept for callers that predate partial check-in. Same as confirmed. */
  paid: boolean;
  checked_in_at: string | null;
};

export type GateLookupResult =
  | { ok: true; registration: GateRegistration }
  | { ok: false; status: number; error: string };

export type AdmitRequest = {
  /** Admit the alumnus. Ignored when already checked in. */
  alumnus: boolean;
  /** Number of guests to admit now. Must not exceed the guests still outside. */
  guests: number;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

async function loadRow(
  rawCode: string
): Promise<{ ok: true; row: GateRow } | { ok: false; status: number; error: string }> {
  const code = normalizeRegistrationCode(rawCode);
  if (!code) return { ok: false, status: 400, error: 'Enter a registration ID' };

  const admin = createAdminClient();
  await issueMissingPaidCodes(admin as unknown as RegistrationCodeAdmin);

  const { data, error } = await admin
    .from('event_registrations')
    .select(SELECT)
    .eq('registration_code', code)
    .in('payment_status', [...OPEN_PAYMENT_STATUSES])
    .maybeSingle();

  if (error && missingColumn(error)) {
    return {
      ok: false,
      status: 503,
      error: 'Registration fields are not stored yet. Run the registration migrations in Supabase.',
    };
  }
  if (error) {
    console.error('gate lookup', error);
    return { ok: false, status: 500, error: 'Could not look up that ID' };
  }
  if (!data) return { ok: false, status: 404, error: 'No registration for that ID' };

  return { ok: true, row: data as unknown as GateRow };
}

function summarize(row: GateRow): GateRegistration {
  const guestCount = clampGuestCount(Number(row.number_of_guests) || 0);
  const guestsEating = clampGuestsEating(row.guests_eating, guestCount);
  const guestsCheckedIn = Math.min(guestCount, Math.max(0, Math.floor(Number(row.guests_checked_in) || 0)));
  const guestsRemaining = guestCount - guestsCheckedIn;

  const feeTotal = Math.max(0, Number(row.total_cost_paise) || 0);
  const feePaid = Math.max(0, Number(row.amount_paid_paise) || 0);
  const feeDue = amountDuePaise(feeTotal, feePaid);

  const donation = one(row.donation);
  const donationDue =
    donation && donation.payment_status !== 'paid' && donation.payment_status !== 'failed'
      ? Math.max(0, Number(donation.amount_paise) || 0)
      : 0;

  const committeeConfirmed = row.core_committee_manually_verified === true;
  const confirmed =
    committeeConfirmed || (row.payment_status === 'paid' && feeDue === 0 && donationDue === 0);
  const totalDue = confirmed ? 0 : feeDue + donationDue;

  const attending = row.attending !== false;
  const alumnusCheckedIn = row.checked_in_at != null;

  const summary = venuePassSummary({
    attending,
    lunch: row.lunch !== false,
    food_preference: row.food_preference,
    number_of_guests: guestCount,
    guests_eating: guestsEating,
    payment_status: confirmed ? 'paid' : row.payment_status,
    total_due_paise: totalDue,
    registration_code: row.registration_code,
  });

  const account = one(row.alumni_accounts);
  const event = one(row.event_catalog);

  return {
    id: row.id,
    registration_code: row.registration_code || '',
    full_name: account?.full_name || '—',
    event_title: event?.title || 'Event',
    attending,
    payment_status: row.payment_status,
    committee_confirmed: committeeConfirmed,
    confirmed,
    amount_paid_paise: feePaid,
    total_due_paise: totalDue,
    guest_count: guestCount,
    guests_eating: guestsEating,
    guests_checked_in: guestsCheckedIn,
    guests_remaining: guestsRemaining,
    alumnus_checked_in: alumnusCheckedIn,
    alumnus_checked_in_at: row.checked_in_at,
    can_admit_alumnus: confirmed && attending && !alumnusCheckedIn,
    can_admit_guests: confirmed && guestsRemaining > 0,
    people: summary.people,
    meals: summary.meals,
    paid: confirmed,
    checked_in_at: row.checked_in_at,
  };
}

/** Read-only lookup for the gate screen. Changes nothing. */
export async function lookupByCode(rawCode: string): Promise<GateLookupResult> {
  const loaded = await loadRow(rawCode);
  if (!loaded.ok) return loaded;
  return { ok: true, registration: summarize(loaded.row) };
}

/**
 * Admits the alumnus and/or some guests. Each step is recorded separately, so a partial group can
 * enter now and the rest later. The guest update only succeeds if the count has not changed since
 * it was read, so two gate phones cannot both admit the same guest.
 */
export async function admitAtGate(
  rawCode: string,
  request: AdmitRequest
): Promise<GateLookupResult> {
  const loaded = await loadRow(rawCode);
  if (!loaded.ok) return loaded;
  const current = summarize(loaded.row);

  if (!current.confirmed) {
    return {
      ok: false,
      status: 403,
      error: 'Not confirmed. Payment or committee verification is needed before entry.',
    };
  }

  const admitAlumnus = request.alumnus === true && current.can_admit_alumnus;
  if (request.alumnus === true && !current.attending) {
    return { ok: false, status: 400, error: 'This registration is not attending' };
  }

  const guestsRequested = Math.floor(Number(request.guests) || 0);
  if (guestsRequested < 0) {
    return { ok: false, status: 400, error: 'Guest count cannot be negative' };
  }
  if (guestsRequested > current.guests_remaining) {
    return {
      ok: false,
      status: 400,
      error: `Only ${current.guests_remaining} guest${current.guests_remaining === 1 ? '' : 's'} left to admit`,
    };
  }

  if (!admitAlumnus && guestsRequested === 0) {
    return { ok: false, status: 400, error: 'Nothing to admit' };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  if (admitAlumnus) patch.checked_in_at = now;
  if (guestsRequested > 0) patch.guests_checked_in = current.guests_checked_in + guestsRequested;

  let update = admin.from('event_registrations').update(patch).eq('id', current.id);
  if (guestsRequested > 0) {
    update = update.eq('guests_checked_in', current.guests_checked_in);
  }
  if (admitAlumnus) {
    update = update.is('checked_in_at', null);
  }

  const { data: updated, error } = await update.select('id');
  if (error) {
    console.error('gate admit', error);
    return { ok: false, status: 500, error: 'Could not record entry' };
  }
  if (!updated || updated.length === 0) {
    return { ok: false, status: 409, error: 'Entry changed on another device. Look up the ID again.' };
  }

  // Return the fresh state so the gate screen shows what is left.
  const after = await loadRow(rawCode);
  if (!after.ok) return after;
  return { ok: true, registration: summarize(after.row) };
}