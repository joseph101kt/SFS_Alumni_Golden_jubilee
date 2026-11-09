// app/api/check-in/route.ts
// Looks up a registration by its ID for venue check-in. Admin only.
// Every figure comes from the database row. Confirmed means the committee verified it or it is
// fully settled, and only a confirmed registration is valid for entry.

import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
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
  'registration_code',
  'attending',
  'lunch',
  'food_preference',
  'number_of_guests',
  'guests_eating',
  'payment_status',
  'total_cost_paise',
  'amount_paid_paise',
  'core_committee_manually_verified',
  'donation:donations!event_registrations_donation_id_fkey(amount_paise,payment_status)',
  'event_catalog(title)',
  'alumni_accounts(full_name)',
].join(',');

type DonationEmbed = { amount_paise: number; payment_status: string };

type CheckInRow = {
  registration_code: string | null;
  attending: boolean;
  lunch: boolean;
  food_preference: string | null;
  number_of_guests: number | null;
  guests_eating: number | null;
  payment_status: string;
  total_cost_paise: number;
  amount_paid_paise: number;
  core_committee_manually_verified: boolean | null;
  donation: DonationEmbed | DonationEmbed[] | null;
  event_catalog: { title: string } | { title: string }[] | null;
  alumni_accounts: { full_name: string } | { full_name: string }[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export async function GET(request: Request) {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const code = normalizeRegistrationCode(new URL(request.url).searchParams.get('code') || '');
  if (!code) {
    return NextResponse.json({ error: 'Enter a registration ID' }, { status: 400 });
  }

  const admin = createAdminClient();
  await issueMissingPaidCodes(admin as unknown as RegistrationCodeAdmin);

  const { data, error } = await admin
    .from('event_registrations')
    .select(SELECT)
    .eq('registration_code', code)
    .in('payment_status', [...OPEN_PAYMENT_STATUSES])
    .maybeSingle();

  if (error && missingColumn(error)) {
    return NextResponse.json(
      { error: 'Registration fields are not stored yet. Run the registration migrations in Supabase.' },
      { status: 503 }
    );
  }
  if (error) {
    console.error('check-in', error);
    return NextResponse.json({ error: 'Could not look up that ID' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'No registration for that ID' }, { status: 404 });
  }

  const row = data as unknown as CheckInRow;
  const account = one(row.alumni_accounts);
  const event = one(row.event_catalog);
  const donation = one(row.donation);

  const guestCount = clampGuestCount(Number(row.number_of_guests) || 0);
  const guestsEating = clampGuestsEating(row.guests_eating, guestCount);

  const feeTotal = Math.max(0, Number(row.total_cost_paise) || 0);
  const feePaid = Math.max(0, Number(row.amount_paid_paise) || 0);
  const feeDue = amountDuePaise(feeTotal, feePaid);
  const donationDue =
    donation && donation.payment_status !== 'paid' && donation.payment_status !== 'failed'
      ? Math.max(0, Number(donation.amount_paise) || 0)
      : 0;

  const verified = row.core_committee_manually_verified === true;
  const confirmed = verified || (row.payment_status === 'paid' && feeDue === 0 && donationDue === 0);
  const totalDue = confirmed ? 0 : feeDue + donationDue;

  const summary = venuePassSummary({
    attending: row.attending !== false,
    lunch: row.lunch !== false,
    food_preference: row.food_preference,
    number_of_guests: guestCount,
    guests_eating: guestsEating,
    payment_status: confirmed ? 'paid' : row.payment_status,
    total_due_paise: totalDue,
    registration_code: row.registration_code,
  });

  return NextResponse.json({
    registration_code: row.registration_code || code,
    full_name: account?.full_name || '—',
    event_title: event?.title || 'Event',
    attending: row.attending !== false,
    number_of_guests: guestCount,
    guests_eating: guestsEating,
    people: summary.people,
    meals: summary.meals,
    payment_status: row.payment_status,
    committee_confirmed: verified,
    amount_paid_paise: feePaid,
    total_due_paise: totalDue,
    paid: summary.paid,
    admit: confirmed && row.attending !== false,
  });
}