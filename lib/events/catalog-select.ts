import { missingColumn } from '@/lib/events/registration-code';
import { EVENT_SELECT, EVENT_SELECT_LEGACY } from '@/lib/events/types';

export const EVENT_SELECT_DIET = `${EVENT_SELECT},lunch_nonveg_paise,dinner_nonveg_paise`;
export const EVENT_SELECT_DIET_LEGACY = `${EVENT_SELECT_LEGACY},lunch_nonveg_paise,dinner_nonveg_paise`;

type CatalogError = { code?: string; message?: string } | null;
type CatalogResult<T> = { data: T; error: CatalogError };

/** Reads the catalog with diet + fee-batch columns, falling back when not migrated yet. */
export async function selectCatalog<T>(
  run: (columns: string) => PromiseLike<CatalogResult<T>>
): Promise<CatalogResult<T>> {
  const full = await run(EVENT_SELECT_DIET);
  if (!full.error || !missingColumn(full.error)) return full;
  const mid = await run(EVENT_SELECT_DIET_LEGACY);
  if (!mid.error || !missingColumn(mid.error)) return mid;
  const bare = await run(EVENT_SELECT);
  if (!bare.error || !missingColumn(bare.error)) return bare;
  return run(EVENT_SELECT_LEGACY);
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

export const DIET_PRICE_WARNING =
  'The event was saved. Veg and non-veg prices are not stored yet — run the meal diet price migration in Supabase, then save the event again.';
