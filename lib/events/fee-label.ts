import type { EventCatalog } from '@/lib/events/types';

/** Short admin/public label for registration fee + optional batch exception. */
export function registrationFeeLabel(
  event: Pick<
    EventCatalog,
    'base_ticket_paise' | 'fee_batch_from' | 'fee_batch_to' | 'fee_batch_paise'
  >
): string {
  const defaultFee = Math.max(0, event.base_ticket_paise || 0);
  const from = event.fee_batch_from;
  const to = event.fee_batch_to;
  const rangeFee = Math.max(0, Number(event.fee_batch_paise) || 0);
  const hasRange = from != null || to != null;

  if (!hasRange) {
    if (defaultFee <= 0) return '';
    return `Registration fee ₹${(defaultFee / 100).toFixed(0)} / person`;
  }

  const rangeText =
    from != null && to != null
      ? `batches ${Math.min(from, to)}–${Math.max(from, to)}`
      : `batch ${from ?? to}`;
  const bits: string[] = [];
  bits.push(`${rangeText} ₹${(rangeFee / 100).toFixed(0)}`);
  bits.push(`others ₹${(defaultFee / 100).toFixed(0)}`);
  return `Registration fee / person: ${bits.join(' · ')}`;
}
