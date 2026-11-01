import { NextResponse } from 'next/server';
import {
  aggregateRegistrations,
  classifyRegistration,
  EXCEPTION_LABELS,
  type ExceptionKind,
} from '@/lib/admin/event-exceptions';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { createAdminClient } from '@/lib/supabase-admin';

type RegRow = {
  id: string;
  event_id: string;
  payment_status: string;
  number_of_guests: number;
  total_cost_paise: number;
  amount_paid_paise?: number;
  registration_code?: string | null;
  checked_in_at?: string | null;
  event_catalog: { title: string } | { title: string }[] | null;
  alumni_accounts: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] || null : v;
}

async function loadRows(eventId: string): Promise<{ rows: RegRow[]; error: string | null }> {
  const admin = createAdminClient();
  const selectWithCheckIn =
    'id,event_id,payment_status,number_of_guests,total_cost_paise,amount_paid_paise,registration_code,checked_in_at,event_catalog(title),alumni_accounts(full_name,email)';
  const selectBase =
    'id,event_id,payment_status,number_of_guests,total_cost_paise,amount_paid_paise,registration_code,event_catalog(title),alumni_accounts(full_name,email)';

  for (const select of [selectWithCheckIn, selectBase]) {
    let query = admin.from('event_registrations').select(select).order('created_at', { ascending: false });
    if (eventId) query = query.eq('event_id', eventId);
    const { data, error } = await query;
    if (!error) return { rows: (data || []) as unknown as RegRow[], error: null };
  }
  return { rows: [], error: 'Could not load event ops' };
}

export async function GET(request: Request) {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const eventId = new URL(request.url).searchParams.get('event_id') || '';
  const { rows, error } = await loadRows(eventId);
  if (error) {
    console.error('event-ops', error);
    return NextResponse.json({ error }, { status: 500 });
  }

  const totals = aggregateRegistrations(
    rows.map((r) => ({
      payment_status: r.payment_status,
      number_of_guests: r.number_of_guests,
      total_cost_paise: r.total_cost_paise,
      amount_paid_paise: Math.max(0, Number(r.amount_paid_paise) || 0),
      checked_in_at: r.checked_in_at ?? null,
    }))
  );

  const kindCounts: Record<ExceptionKind, number> = {
    balance_due: 0,
    status_mismatch: 0,
    paid_no_code: 0,
    cancelled_with_money: 0,
    overpay: 0,
  };

  const exceptions = [];
  for (const r of rows) {
    const hit = classifyRegistration({
      id: r.id,
      payment_status: r.payment_status,
      total_cost_paise: r.total_cost_paise,
      amount_paid_paise: Math.max(0, Number(r.amount_paid_paise) || 0),
      registration_code: r.registration_code,
    });
    if (!hit) continue;
    for (const k of hit.kinds) kindCounts[k] += 1;
    const account = one(r.alumni_accounts);
    const event = one(r.event_catalog);
    exceptions.push({
      id: r.id,
      event_id: r.event_id,
      event_title: event?.title || 'Event',
      full_name: account?.full_name || '—',
      email: account?.email || '',
      registration_code: r.registration_code || null,
      payment_status: r.payment_status,
      total_cost_paise: hit.total_cost_paise,
      amount_paid_paise: hit.amount_paid_paise,
      amount_due_paise: hit.amount_due_paise,
      kinds: hit.kinds,
      kind_labels: hit.kinds.map((k) => EXCEPTION_LABELS[k]),
    });
  }

  return NextResponse.json({
    totals,
    kind_counts: kindCounts,
    exception_labels: EXCEPTION_LABELS,
    exceptions,
  });
}
