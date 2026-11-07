// app/api/check-in/route.ts
// Looks up a registration by its ID for venue check-in. Admin only.

import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { amountDuePaise } from '@/lib/events/balance';
import {
  issueMissingPaidCodes,
  missingColumn,
  normalizeRegistrationCode,
  type RegistrationCodeAdmin,
} from '@/lib/events/registration-code';
import { guestsFromUnknown } from '@/lib/registration/registration';
import { formatMealCounts, mealCounts } from '@/lib/registration/meal-summary';
import { createAdminClient } from '@/lib/supabase-admin';

type CheckInRow = {
  registration_code: string;
  number_of_guests: number;
  attending?: boolean;
  self_lunch?: boolean;
  self_preference?: string | null;
  guests?: unknown;
  payment_status: string;
  total_cost_paise: number;
  amount_paid_paise?: number;
  event_catalog: { title: string } | { title: string }[] | null;
  alumni_accounts: { full_name: string } | { full_name: string }[] | null;
};

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
    .select(
      'registration_code,number_of_guests,attending,self_lunch,self_preference,guests,payment_status,total_cost_paise,amount_paid_paise,event_catalog(title),alumni_accounts(full_name)'
    )
    .eq('registration_code', code)
    .maybeSingle();

  if (error && missingColumn(error)) {
    return NextResponse.json(
      { error: 'Registration IDs or the new registration fields are not stored yet. Run the registration migrations in Supabase.' },
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

  const row = data as CheckInRow;
  const account = Array.isArray(row.alumni_accounts) ? row.alumni_accounts[0] : row.alumni_accounts;
  const event = Array.isArray(row.event_catalog) ? row.event_catalog[0] : row.event_catalog;
  const amount_paid_paise = Math.max(0, Number(row.amount_paid_paise) || 0);
  const total_cost_paise = Math.max(0, Number(row.total_cost_paise) || 0);

  const attending = row.attending ?? true;
  const guests = guestsFromUnknown(row.guests);
  const meals = formatMealCounts(
    mealCounts({
      attending,
      selfLunch: row.self_lunch ?? true,
      selfPreference: row.self_preference,
      guests,
    })
  );

  return NextResponse.json({
    registration_code: row.registration_code,
    full_name: account?.full_name || '—',
    attending,
    number_of_guests: guests.length,
    meals,
    event_title: event?.title || 'Event',
    payment_status: row.payment_status,
    amount_paid_paise,
    amount_due_paise: amountDuePaise(total_cost_paise, amount_paid_paise),
  });
}