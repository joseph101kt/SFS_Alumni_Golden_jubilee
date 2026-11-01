import type { EventCatalog } from '@/lib/events/types';

/** Short admin/public label for registration fee + optional batch range. */
export function registrationFeeLabel(
  event: Pick<EventCatalog, 'base_ticket_paise' | 'fee_batch_from' | 'fee_batch_to'>
): string {
  if (!(event.base_ticket_paise > 0)) return '';
  const amount = `Registration fee ₹${(event.base_ticket_paise / 100).toFixed(0)} / person`;
  const from = event.fee_batch_from;
  const to = event.fee_batch_to;
  if (from == null && to == null) return amount;
  if (from != null && to != null) {
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    return `${amount} (batches ${lo}–${hi})`;
  }
  return `${amount} (batch ${from ?? to})`;
}
