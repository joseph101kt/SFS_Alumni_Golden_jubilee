// app/api/registrations/route.ts
// Admin list of event registrations with filters. Reprices and issues missing codes first.

import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { issueMissingPaidCodes, missingColumn, type RegistrationCodeAdmin } from '@/lib/events/registration-code';
import { repriceEventRegistrations } from '@/lib/events/reprice';
import { guestsFromUnknown } from '@/lib/registration/registration';
import { formatMealCounts, mealCounts } from '@/lib/registration/meal-summary';
import { createAdminClient } from '@/lib/supabase-admin';

const COLUMNS =
  'id,event_id,account_id,phone_number,number_of_guests,attending,self_lunch,self_preference,guests,total_cost_paise,amount_paid_paise,payment_status,created_at,event_catalog(title),alumni_accounts(full_name,email,batch)';

type RegistrationListRow = {
  id: string;
  event_id: string;
  account_id: string;
  phone_number: string | null;
  number_of_guests: number;
  attending: boolean;
  self_lunch: boolean;
  self_preference: string | null;
  guests?: unknown;
  total_cost_paise: number;
  amount_paid_paise?: number;
  payment_status: string;
  registration_code?: string | null;
  created_at: string;
  event_catalog: { title: string } | { title: string }[] | null;
  alumni_accounts:
    | { full_name: string; email: string; batch?: number | null }
    | { full_name: string; email: string; batch?: number | null }[]
    | null;
};

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

  function list(select: string) {
    let query = admin
      .from('event_registrations')
      .select(select)
      .order('created_at', { ascending: false })
      .limit(200);
    if (eventId) query = query.eq('event_id', eventId);
    if (paymentStatus) query = query.eq('payment_status', paymentStatus);
    return query;
  }

  let { data, error } = await list(`${COLUMNS},registration_code`);
  if (error && missingColumn(error)) {
    ({ data, error } = await list(COLUMNS));
  }
  if (error) {
    console.error('admin registrations', error);
    return NextResponse.json(
      { error: 'Could not load registrations. Apply the event_registrations migration.' },
      { status: 500 }
    );
  }

  const rows = ((data || []) as unknown as RegistrationListRow[])
    .map((r) => {
      const account = Array.isArray(r.alumni_accounts) ? r.alumni_accounts[0] : r.alumni_accounts;
      const event = Array.isArray(r.event_catalog) ? r.event_catalog[0] : r.event_catalog;
      const amount_paid_paise = Math.max(0, Number(r.amount_paid_paise) || 0);
      const batchRaw = account?.batch;
      const batch =
        typeof batchRaw === 'number'
          ? batchRaw
          : batchRaw != null && String(batchRaw).trim() !== ''
            ? Number(batchRaw) || null
            : null;
      const guests = guestsFromUnknown(r.guests);
      const meals = formatMealCounts(
        mealCounts({
          attending: r.attending,
          selfLunch: r.self_lunch,
          selfPreference: r.self_preference,
          guests,
        })
      );
      return {
        id: r.id,
        event_id: r.event_id,
        event_title: event?.title || 'Event',
        account_id: r.account_id,
        full_name: account?.full_name || '—',
        email: account?.email || '—',
        batch,
        phone_number: r.phone_number,
        attending: r.attending,
        self_lunch: r.self_lunch,
        self_preference: r.self_preference,
        number_of_guests: guests.length,
        guests,
        meals,
        total_cost_paise: r.total_cost_paise,
        amount_paid_paise,
        amount_due_paise: Math.max(0, r.total_cost_paise - amount_paid_paise),
        payment_status: r.payment_status,
        registration_code: r.registration_code || null,
        created_at: r.created_at,
      };
    })
    .filter((r) => {
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.phone_number || '').toLowerCase().includes(q) ||
        (r.registration_code || '').toLowerCase().includes(q)
      );
    });

  return NextResponse.json(rows);
}