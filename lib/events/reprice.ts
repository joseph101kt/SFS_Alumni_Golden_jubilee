// lib/events/reprice.ts
// Rewrites open registrations for one event from the current fee rule. Paid amounts stay.
// The donation is never changed here. A registration that becomes fully paid gets its code
// through the same rule the payment path uses.

import { OPEN_PAYMENT_STATUSES, jubileeStatusFromPayment } from '@/lib/events/balance';
import { selectCatalog } from '@/lib/events/catalog-select';
import {
  donationDuePaise,
  issueRegistrationCodeIfEligible,
  loadDonation,
} from '@/lib/events/mark-paid';
import { repriceRegistration } from '@/lib/events/reprice-math';
import type { EventCatalog } from '@/lib/events/types';
import { createAdminClient } from '@/lib/supabase-admin';

export { repriceRegistration } from '@/lib/events/reprice-math';

type StoredReg = {
  id: string;
  account_id: string;
  attending: boolean;
  lunch: boolean;
  number_of_guests: number | null;
  guests_eating: number | null;
  amount_paid_paise: number | null;
  total_cost_paise: number;
  payment_status: string;
  donation_id: string | null;
  core_committee_manually_verified: boolean | null;
  alumni_accounts?: { batch?: number | null } | { batch?: number | null }[] | null;
};

function batchFrom(account: StoredReg['alumni_accounts']): number | null {
  const row = Array.isArray(account) ? account[0] : account;
  const raw = row?.batch;
  if (typeof raw === 'number') return raw;
  if (raw != null && String(raw).trim() !== '') return Number(raw) || null;
  return null;
}

/** Rewrite open registrations for one event from the current fee rule. Returns how many changed. */
export async function repriceEventRegistrations(eventId: string): Promise<number> {
  const id = String(eventId || '').trim();
  if (!id) return 0;
  const admin = createAdminClient();

  const { data: event, error } = await selectCatalog((columns) =>
    admin.from('event_catalog').select(columns).eq('id', id).maybeSingle()
  );
  if (error || !event) return 0;
  const catalog = event as unknown as EventCatalog;

  const { data: rows, error: regError } = await admin
    .from('event_registrations')
    .select(
      'id,account_id,attending,lunch,number_of_guests,guests_eating,amount_paid_paise,total_cost_paise,payment_status,donation_id,core_committee_manually_verified,alumni_accounts(batch)'
    )
    .eq('event_id', id)
    .in('payment_status', [...OPEN_PAYMENT_STATUSES]);
  if (regError || !rows) {
    if (regError) console.error('reprice list', regError);
    return 0;
  }

  let updated = 0;
  for (const row of rows as unknown as StoredReg[]) {
    const next = repriceRegistration({
      attending: row.attending,
      lunch: row.lunch,
      number_of_guests: row.number_of_guests,
      guests_eating: row.guests_eating,
      batch: batchFrom(row.alumni_accounts),
      amount_paid_paise: row.amount_paid_paise,
    });

    const changed =
      next.total_cost_paise !== row.total_cost_paise || next.payment_status !== row.payment_status;

    if (changed) {
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

      if (catalog.is_primary) {
        const { error: statusError } = await admin
          .from('alumni_accounts')
          .update({ jubilee_reg_status: jubileeStatusFromPayment(next.payment_status) })
          .eq('id', row.account_id);
        if (statusError) console.error('reprice account status', statusError);
      }
    }

    // A fully paid fee can still lack a code (for example after a price drop). Issue it here.
    // Issuing is idempotent, so this is safe to repeat.
    if (next.payment_status === 'paid') {
      const donation = await loadDonation(admin, row.donation_id);
      await issueRegistrationCodeIfEligible(admin, row.id, {
        paymentStatus: 'paid',
        donationDuePaise: donationDuePaise(donation),
        verified: Boolean(row.core_committee_manually_verified),
      });
    }
  }
  return updated;
}