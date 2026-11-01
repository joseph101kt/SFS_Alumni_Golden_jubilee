import {
  jubileeStatusFromPayment,
  OPEN_PAYMENT_STATUSES,
} from '@/lib/events/balance';
import { selectCatalog } from '@/lib/events/catalog-select';
import { eventToPricing } from '@/lib/events/pricing';
import { type EventCatalog } from '@/lib/events/types';
import { repriceRegistration } from '@/lib/events/reprice-math';
import type { GuestChoice } from '@/lib/registration';
import { createAdminClient } from '@/lib/supabase-admin';

export { repriceRegistration } from '@/lib/events/reprice-math';

type StoredReg = {
  id: string;
  account_id: string;
  number_of_guests: number;
  lunch: boolean;
  dinner: boolean;
  parking_needed: string;
  food_preference?: string | null;
  guests?: GuestChoice[] | null;
  amount_paid_paise?: number | null;
  total_cost_paise: number;
  payment_status: string;
  alumni_accounts?:
    | { batch?: number | null }
    | { batch?: number | null }[]
    | null;
};

/** Rewrite open registrations for one event from its current catalog rates. Paid amounts stay. */
export async function repriceEventRegistrations(eventId: string): Promise<number> {
  const id = String(eventId || '').trim();
  if (!id) return 0;
  const admin = createAdminClient();
  const { data: event, error } = await selectCatalog((columns) =>
    admin.from('event_catalog').select(columns).eq('id', id).maybeSingle()
  );
  if (error || !event) return 0;

  const catalog = event as unknown as EventCatalog;
  const pricing = eventToPricing(catalog);
  const { data: rows, error: regError } = await admin
    .from('event_registrations')
    .select(
      'id,account_id,number_of_guests,food_preference,lunch,dinner,guests,parking_needed,amount_paid_paise,total_cost_paise,payment_status,alumni_accounts(batch)'
    )
    .eq('event_id', id)
    .in('payment_status', [...OPEN_PAYMENT_STATUSES]);
  if (regError || !rows) {
    if (regError) console.error('reprice list', regError);
    return 0;
  }

  let updated = 0;
  for (const row of rows as StoredReg[]) {
    const account = Array.isArray(row.alumni_accounts) ? row.alumni_accounts[0] : row.alumni_accounts;
    const batchRaw = account?.batch;
    const batch =
      typeof batchRaw === 'number'
        ? batchRaw
        : batchRaw != null && String(batchRaw).trim() !== ''
          ? Number(batchRaw) || null
          : null;
    const next = repriceRegistration(pricing, { ...row, batch });
    if (next.total_cost_paise === row.total_cost_paise && next.payment_status === row.payment_status) {
      continue;
    }
    const { error: upd } = await admin
      .from('event_registrations')
      .update({
        total_cost_paise: next.total_cost_paise,
        payment_status: next.payment_status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (upd) {
      console.error('reprice registration', upd);
      continue;
    }
    updated += 1;
    if (catalog.is_primary && next.payment_status !== row.payment_status) {
      const { error: statusError } = await admin
        .from('alumni_accounts')
        .update({ jubilee_reg_status: jubileeStatusFromPayment(next.payment_status) })
        .eq('id', row.account_id);
      if (statusError) console.error('reprice account status', statusError);
    }
  }
  return updated;
}
