// app/api/admin/events/route.ts
import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import {
  DIET_PRICE_WARNING,
  selectCatalog,
  withoutDietPrices,
  withoutFeeBatch,
  withoutRefundEmail,
} from '@/lib/events/catalog-select';
import { missingColumn } from '@/lib/events/registration-code';
import { normalizeRefundEmail } from '@/lib/events/refund-mailto';
import { EVENT_SELECT } from '@/lib/events/types';
import { parseNonNegInt, parseOptionalBatchYear } from '@/lib/events/pricing';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET() {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await selectCatalog((columns) =>
    admin.from('event_catalog').select(columns).order('starts_at', { ascending: true })
  );

  if (error) {
    console.error('admin events list', error);
    return NextResponse.json(
      { error: 'Could not load events. Apply the event_catalog migration.' },
      { status: 500 }
    );
  }
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || '').trim();
  const summary = String(body.summary || '').trim();
  const startsAt = String(body.starts_at || '').trim();
  if (!title || !summary || !startsAt) {
    return NextResponse.json({ error: 'Title, summary, and start time are required' }, { status: 400 });
  }

  const row = {
    title,
    summary,
    description: body.description ? String(body.description) : null,
    starts_at: startsAt,
    ends_at: body.ends_at ? String(body.ends_at) : null,
    venue: body.venue ? String(body.venue) : null,
    published: Boolean(body.published),
    lunch_paise: parseNonNegInt(body.lunch_paise),
    dinner_paise: parseNonNegInt(body.dinner_paise),
    lunch_nonveg_paise: parseNonNegInt(body.lunch_nonveg_paise),
    dinner_nonveg_paise: parseNonNegInt(body.dinner_nonveg_paise),
    parking_2w_paise: parseNonNegInt(body.parking_2w_paise),
    parking_4w_paise: parseNonNegInt(body.parking_4w_paise),
    base_ticket_paise: parseNonNegInt(body.base_ticket_paise),
    fee_batch_from: parseOptionalBatchYear(body.fee_batch_from),
    fee_batch_to: parseOptionalBatchYear(body.fee_batch_to),
    fee_batch_paise: parseNonNegInt(body.fee_batch_paise),
    refund_email: normalizeRefundEmail(body.refund_email),
    is_primary: Boolean(body.is_primary),
    created_by: me.id,
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  if (row.is_primary) {
    await admin.from('event_catalog').update({ is_primary: false }).eq('is_primary', true);
  }

  let { data, error } = await admin.from('event_catalog').insert(row).select(EVENT_SELECT).single();
  let warning: string | null = null;
  if (error && missingColumn(error)) {
    const stripped = withoutRefundEmail(withoutFeeBatch(withoutDietPrices(row)));
    const retry = await admin.from('event_catalog').insert(stripped).select(EVENT_SELECT).single();
    data = retry.data;
    error = retry.error;
    warning = DIET_PRICE_WARNING;
  }
  if (error) {
    console.error('admin events create', error);
    return NextResponse.json({ error: error.message || 'Could not create event' }, { status: 500 });
  }
  return NextResponse.json(warning ? { ...data, warning } : data, { status: 201 });
}
