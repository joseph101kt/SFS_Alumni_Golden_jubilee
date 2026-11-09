// app/api/registrations/route.ts
// Admin list of event registrations. Every figure comes from the database row, using the same
// rules as the gate and check-in: fee and donation due, committee verification, and guests
// admitted. Reprices and issues missing codes first.

import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { amountDuePaise } from '@/lib/events/balance';
import { issueMissingPaidCodes, type RegistrationCodeAdmin } from '@/lib/events/registration-code';
import { repriceEventRegistrations } from '@/lib/events/reprice';
import { venuePassSummary } from '@/lib/events/venue-pass';
import { clampGuestCount, clampGuestsEating } from '@/lib/registration/registration';
import { createAdminClient } from '@/lib/supabase-admin';

const SELECT = [
  'id',
  'event_id',
  'account_id',
  'phone_number',
  'number_of_guests',
  'guests_eating',
  'guests_checked_in',
  'attending',
  'lunch',
  'food_preference',
  'total_cost_paise',
  'amount_paid_paise',
  'payment_status',
  'registration_code',
  'core_committee_manually_verified',
  'checked_in_at',
  'bank_reference',
  'created_at',
  'donation:donations!event_registrations_donation_id_fkey(amount_paise,payment_status)',
  'event_catalog(title)',
  'alumni_accounts(full_name,email,batch)',
].join(',');

type DonationEmbed = { amount_paise: number; payment_status: string };

type ListRow = {
  id: string;
  event_id: string;
  account_id: string;
  phone_number: string | null;
  number_of_guests: number | null;
  guests_eating: number | null;
  guests_checked_in: number | null;
  attending: boolean;
  lunch: boolean;
  food_preference: string | null;
  total_cost_paise: number;
  amount_paid_paise: number;
  payment_status: string;
  registration_code: string | null;
  core_committee_manually_verified: boolean | null;
  checked_in_at: string | null;
  bank_reference: string | null;
  created_at: string;
  donation: DonationEmbed | DonationEmbed[] | null;
  event_catalog: { title: string } | { title: string }[] | null;
  alumni_accounts:
    | { full_name: string; email: string; batch?: number | null }
    | { full_name: string; email: string; batch?: number | null }[]
    | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export async function GET(request: Request) {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('event_id') || '';
  const paymentStatus = searchParams.get('payment_status') || '';
  const q = (searchParams.get('q') || '').trim().toLowerCase();

  const admin = createAdminClient();
  if (eventId) {
    await repriceEventRegistrations(eventId);
  } else {
    const { data: catalog } = await admin.from('event_catalog').select('id');
    for (const row of catalog || []) {
      await repriceEventRegistrations(String((row as { id: string }).id));
    }
  }
  await issueMissingPaidCodes(admin as unknown as RegistrationCodeAdmin);

  let query = admin
    .from('event_registrations')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(200);
  if (eventId) query = query.eq('event_id', eventId);
  if (paymentStatus) query = query.eq('payment_status', paymentStatus);

  const { data, error } = await query;
  if (error) {
    console.error('admin registrations', error);
    return NextResponse.json(
      { error: 'Could not load registrations. Check the registration migrations in Supabase.' },
      { status: 500 }
    );
  }

  const rows = ((data || []) as unknown as ListRow[])
    .map((r) => {
      const account = one(r.alumni_accounts);
      const event = one(r.event_catalog);
      const donation = one(r.donation);

      const guestCount = clampGuestCount(Number(r.number_of_guests) || 0);
      const guestsEating = clampGuestsEating(r.guests_eating, guestCount);
      const guestsCheckedIn = Math.min(guestCount, Math.max(0, Number(r.guests_checked_in) || 0));

      const feeTotal = Math.max(0, Number(r.total_cost_paise) || 0);
      const feePaid = Math.max(0, Number(r.amount_paid_paise) || 0);
      const feeDue = amountDuePaise(feeTotal, feePaid);
      const donationDue =
        donation && donation.payment_status !== 'paid' && donation.payment_status !== 'failed'
          ? Math.max(0, Number(donation.amount_paise) || 0)
          : 0;

      const committeeConfirmed = r.core_committee_manually_verified === true;
      const confirmed =
        committeeConfirmed || (r.payment_status === 'paid' && feeDue === 0 && donationDue === 0);
      const totalDue = confirmed ? 0 : feeDue + donationDue;

      const summary = venuePassSummary({
        attending: r.attending !== false,
        lunch: r.lunch !== false,
        food_preference: r.food_preference,
        number_of_guests: guestCount,
        guests_eating: guestsEating,
        payment_status: confirmed ? 'paid' : r.payment_status,
        total_due_paise: totalDue,
        registration_code: r.registration_code,
      });

      const batchRaw = account?.batch;
      const batch =
        typeof batchRaw === 'number'
          ? batchRaw
          : batchRaw != null && String(batchRaw).trim() !== ''
            ? Number(batchRaw) || null
            : null;

      return {
        id: r.id,
        event_id: r.event_id,
        event_title: event?.title || 'Event',
        account_id: r.account_id,
        full_name: account?.full_name || '—',
        email: account?.email || '—',
        batch,
        phone_number: r.phone_number,
        attending: r.attending !== false,
        lunch: r.lunch !== false,
        food_preference: r.food_preference,
        number_of_guests: guestCount,
        guests_eating: guestsEating,
        guests_checked_in: guestsCheckedIn,
        guests_remaining: guestCount - guestsCheckedIn,
        meals: summary.meals,
        people: summary.people,
        fee_total_paise: feeTotal,
        fee_paid_paise: feePaid,
        fee_due_paise: feeDue,
        donation_intended_paise: donation?.amount_paise ?? 0,
        donation_payment_status: donation?.payment_status ?? null,
        donation_due_paise: donationDue,
        total_due_paise: totalDue,
        payment_status: r.payment_status,
        committee_confirmed: committeeConfirmed,
        confirmed,
        bank_reference: r.bank_reference,
        registration_code: r.registration_code || null,
        alumnus_checked_in: r.checked_in_at != null,
        checked_in_at: r.checked_in_at,
        created_at: r.created_at,
      };
    })
    .filter((r) => {
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.phone_number || '').toLowerCase().includes(q) ||
        (r.registration_code || '').toLowerCase().includes(q) ||
        (r.bank_reference || '').toLowerCase().includes(q)
      );
    });

  return NextResponse.json(rows);
}