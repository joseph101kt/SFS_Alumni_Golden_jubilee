import { missingColumn } from '@/lib/events/registration-code';
import {
  EVENT_SELECT,
  EVENT_SELECT_LEGACY,
  EVENT_SELECT_LEGACY_REFUND,
} from '@/lib/events/types';

export const EVENT_SELECT_DIET = `${EVENT_SELECT},lunch_nonveg_paise,dinner_nonveg_paise`;
export const EVENT_SELECT_DIET_LEGACY = `${EVENT_SELECT_LEGACY},lunch_nonveg_paise,dinner_nonveg_paise`;
export const EVENT_SELECT_DIET_LEGACY_REFUND = `${EVENT_SELECT_LEGACY_REFUND},lunch_nonveg_paise,dinner_nonveg_paise`;

type CatalogError = { code?: string; message?: string } | null;
type CatalogResult<T> = { data: T; error: CatalogError };

/** Reads the catalog with diet + fee-batch + refund columns, falling back when not migrated yet. */
export async function selectCatalog<T>(
  run: (columns: string) => PromiseLike<CatalogResult<T>>
): Promise<CatalogResult<T>> {
  const attempts = [
    EVENT_SELECT_DIET,
    EVENT_SELECT,
    EVENT_SELECT_DIET_LEGACY_REFUND,
    EVENT_SELECT_LEGACY_REFUND,
    EVENT_SELECT_DIET_LEGACY,
    EVENT_SELECT_LEGACY,
  ];
  let last: CatalogResult<T> = { data: null as T, error: { message: 'no attempt' } };
  for (const columns of attempts) {
    last = await run(columns);
    if (!last.error || !missingColumn(last.error)) return last;
  }
  return last;
}

export function withoutDietPrices<T extends Record<string, unknown>>(row: T): T {
  const next = { ...row };
  delete next.lunch_nonveg_paise;
  delete next.dinner_nonveg_paise;
  return next;
}

export function withoutFeeBatch<T extends Record<string, unknown>>(row: T): T {
  const next = { ...row };
  delete next.fee_batch_from;
  delete next.fee_batch_to;
  delete next.fee_batch_paise;
  return next;
}

export function withoutRefundEmail<T extends Record<string, unknown>>(row: T): T {
  const next = { ...row };
  delete next.refund_email;
  return next;
}

export const DIET_PRICE_WARNING =
  'The event was saved. Veg and non-veg prices are not stored yet — run the meal diet price migration in Supabase, then save the event again.';
