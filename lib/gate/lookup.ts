// lib/gate/lookup.ts
// Looks up a registration by its ID for gate check-in. Parking is no longer part of the event.

import { amountDuePaise } from '@/lib/events/balance';
import {
  issueMissingPaidCodes,
  missingColumn,
  normalizeRegistrationCode,
  type RegistrationCodeAdmin,
} from '@/lib/events/registration-code';
import { venuePassSummary } from '@/lib/events/venue-pass';
import { guestsFromUnknown } from '@/lib/registration/registration';
import { createAdminClient } from '@/lib/supabase-admin';

export type GateLookupResult =
  | { ok: true; registration: GateRegistration }
  | { ok: false; status: number; error: string };

export type GateRegistration = {
  id: string;
  registration_code: string;
  full_name: string;
  attending: boolean;
  guest_count: number;
  people: number;
  meals: string;
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
    'id,registration_code,attending,self_lunch,self_preference,guests,payment_status,total_cost_paise,amount_paid_paise,checked_in_at,event_catalog(title),alumni_accounts(full_name)';
  const selectBase =
    'id,registration_code,attending,self_lunch,self_preference,guests,payment_status,total_cost_paise,amount_paid_paise,event_catalog(title),alumni_accounts(full_name)';

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
  const due = amountDuePaise(total_cost_paise, amount_paid_paise);
  const payment_status = String(data.payment_status || '');
  const attending = data.attending !== false;
  const guests = guestsFromUnknown(data.guests);

  const account = one(data.alumni_accounts as { full_name: string } | { full_name: string }[] | null);
  const event = one(data.event_catalog as { title: string } | { title: string }[] | null);

  const summary = venuePassSummary({
    attending,
    self_lunch: data.self_lunch !== false,
    self_preference: data.self_preference,
    guests: data.guests,
    payment_status,
    amount_due_paise: due,
    registration_code: String(data.registration_code || code),
  });

  return {
    ok: true,
    registration: {
      id: String(data.id),
      registration_code: String(data.registration_code || code),
      full_name: account?.full_name || '—',
      attending,
      guest_count: guests.length,
      people: summary.people,
      meals: summary.meals,
      event_title: event?.title || 'Event',
      payment_status,
      amount_paid_paise,
      amount_due_paise: due,
      paid: summary.paid,
      checked_in_at: data.checked_in_at ? String(data.checked_in_at) : null,
    },
  };
}