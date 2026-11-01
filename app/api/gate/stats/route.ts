import { NextResponse } from 'next/server';
import { amountDuePaise } from '@/lib/events/balance';
import { requireGateOrAdmin } from '@/lib/gate/access';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(request: Request) {
  const access = await requireGateOrAdmin();
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const eventId = new URL(request.url).searchParams.get('event_id') || '';
  const admin = createAdminClient();

  let query = admin
    .from('event_registrations')
    .select('payment_status,number_of_guests,total_cost_paise,amount_paid_paise,checked_in_at,registration_code,alumni_accounts(full_name)')
    .order('checked_in_at', { ascending: false });
  if (eventId) query = query.eq('event_id', eventId);

  const { data, error } = await query;
  if (error) {
    // migration not applied
    const fallback = await admin
      .from('event_registrations')
      .select('payment_status,number_of_guests,total_cost_paise,amount_paid_paise');
    if (fallback.error) {
      return NextResponse.json({ error: 'Could not load stats' }, { status: 500 });
    }
    const rows = fallback.data || [];
    return NextResponse.json({
      registration_count: rows.length,
      people: rows.reduce((n, r) => n + (Number(r.number_of_guests) || 0), 0),
      checked_in_count: 0,
      unpaid_attempts: rows.filter((r) => {
        const due = amountDuePaise(Number(r.total_cost_paise) || 0, Number(r.amount_paid_paise) || 0);
        return due > 0;
      }).length,
      recent: [],
      migration_needed: true,
    });
  }

  const rows = data || [];
  const recent = rows
    .filter((r) => r.checked_in_at)
    .slice(0, 10)
    .map((r) => {
      const account = Array.isArray(r.alumni_accounts) ? r.alumni_accounts[0] : r.alumni_accounts;
      return {
        registration_code: r.registration_code,
        full_name: account?.full_name || '—',
        checked_in_at: r.checked_in_at,
        number_of_guests: r.number_of_guests,
      };
    });

  return NextResponse.json({
    registration_count: rows.length,
    people: rows.reduce((n, r) => n + (Number(r.number_of_guests) || 0), 0),
    checked_in_count: rows.filter((r) => r.checked_in_at).length,
    unpaid_count: rows.filter((r) => {
      const due = amountDuePaise(Number(r.total_cost_paise) || 0, Number(r.amount_paid_paise) || 0);
      return due > 0;
    }).length,
    people_on_site: rows
      .filter((r) => r.checked_in_at)
      .reduce((n, r) => n + (Number(r.number_of_guests) || 0), 0),
    recent,
    migration_needed: false,
  });
}
