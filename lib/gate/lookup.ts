import { amountDuePaise } from '@/lib/events/balance';
import {
  formatGuestMealCounts,
  guestMealCounts,
  guestsFromLegacy,
  normalizeGuests,
} from '@/lib/registration';
import {
  issueMissingPaidCodes,
  missingColumn,
  normalizeRegistrationCode,
  type RegistrationCodeAdmin,
} from '@/lib/events/registration-code';
import { createAdminClient } from '@/lib/supabase-admin';
import { venuePassSummary } from '@/lib/events/venue-pass';

export type GateLookupResult =
  | { ok: true; registration: GateRegistration }
  | { ok: false; status: number; error: string };

export type GateRegistration = {
  id: string;
  registration_code: string;
  full_name: string;
  number_of_guests: number;
  meals: string;
  parking: string;
  event_title: string;
  payment_status: string;
  amount_paid_paise: number;
  amount_due_paise: number;
  paid: boolean;
  checked_in_at: string | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] || null : v;
}

export async function lookupByCode(rawCode: string): Promise<GateLookupResult> {
  const code = normalizeRegistrationCode(rawCode);
  if (!code) return { ok: false, status: 400, error: 'Enter a registration ID' };

  const admin = createAdminClient();
  await issueMissingPaidCodes(admin as unknown as RegistrationCodeAdmin);

  const selectWithCheckIn =
    'id,registration_code,number_of_guests,food_preference,lunch,dinner,guests,parking_needed,payment_status,total_cost_paise,amount_paid_paise,checked_in_at,event_catalog(title),alumni_accounts(full_name)';
  const selectBase =
    'id,registration_code,number_of_guests,food_preference,lunch,dinner,guests,parking_needed,payment_status,total_cost_paise,amount_paid_paise,event_catalog(title),alumni_accounts(full_name)';

  let data: Record<string, unknown> | null = null;
  let error: { message?: string; code?: string } | null = null;

  for (const select of [selectWithCheckIn, selectBase]) {
    const res = await admin
      .from('event_registrations')
      .select(select)
      .eq('registration_code', code)
      .maybeSingle();
    if (!res.error) {
      data = res.data as unknown as Record<string, unknown> | null;
      error = null;
      break;
    }
    error = res.error;
    if (missingColumn(res.error)) continue;
    break;
  }

  if (error && missingColumn(error)) {
    return {
      ok: false,
      status: 503,
      error: 'Registration IDs are not stored yet. Run the registration code migration in Supabase.',
    };
  }
  if (error) {
    console.error('gate lookup', error);
    return { ok: false, status: 500, error: 'Could not look up that ID' };
  }
  if (!data) return { ok: false, status: 404, error: 'No registration for that ID' };

  const amount_paid_paise = Math.max(0, Number(data.amount_paid_paise) || 0);
  const total_cost_paise = Math.max(0, Number(data.total_cost_paise) || 0);
  const guests =
    Array.isArray(data.guests) && data.guests.length > 0
      ? normalizeGuests(data.guests, Number(data.number_of_guests) || 1)
      : guestsFromLegacy(
          Number(data.number_of_guests) || 1,
          (data.food_preference as string | null) || null,
          Boolean(data.lunch),
          Boolean(data.dinner)
        );
  const account = one(data.alumni_accounts as { full_name: string } | { full_name: string }[] | null);
  const event = one(data.event_catalog as { title: string } | { title: string }[] | null);
  const due = amountDuePaise(total_cost_paise, amount_paid_paise);
  const payment_status = String(data.payment_status || '');
  const summary = venuePassSummary({
    number_of_guests: Number(data.number_of_guests) || 1,
    lunch: Boolean(data.lunch),
    dinner: Boolean(data.dinner),
    parking_needed: String(data.parking_needed || 'none'),
    food_preference: (data.food_preference as string | null) || null,
    payment_status,
    amount_due_paise: due,
    registration_code: String(data.registration_code || code),
    guests,
  });

  return {
    ok: true,
    registration: {
      id: String(data.id),
      registration_code: String(data.registration_code || code),
      full_name: account?.full_name || '—',
      number_of_guests: Number(data.number_of_guests) || 1,
      meals: formatGuestMealCounts(guestMealCounts(guests)),
      parking: summary.parking,
      event_title: event?.title || 'Event',
      payment_status,
      amount_paid_paise,
      amount_due_paise: due,
      paid: payment_status === 'paid' && due === 0,
      checked_in_at: data.checked_in_at ? String(data.checked_in_at) : null,
    },
  };
}
