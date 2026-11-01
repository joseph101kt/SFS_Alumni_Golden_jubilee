export type EventCatalog = {
  id: string;
  title: string;
  summary: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  published: boolean;
  lunch_paise: number;
  dinner_paise: number;
  lunch_nonveg_paise?: number | null;
  dinner_nonveg_paise?: number | null;
  parking_2w_paise: number;
  parking_4w_paise: number;
  base_ticket_paise: number;
  /** Inclusive batch lower bound for alternate fee; both null = everyone pays base. */
  fee_batch_from?: number | null;
  /** Inclusive batch upper bound for alternate fee. */
  fee_batch_to?: number | null;
  /** Fee (paise) for batches in range; 0 allowed. */
  fee_batch_paise?: number | null;
  /** Committee email for refund requests; null/blank hides CTA. */
  refund_email?: string | null;
  is_primary: boolean;
  created_at?: string;
  updated_at?: string;
};

export const EVENT_SELECT =
  'id,title,summary,description,starts_at,ends_at,venue,published,lunch_paise,dinner_paise,parking_2w_paise,parking_4w_paise,base_ticket_paise,fee_batch_from,fee_batch_to,fee_batch_paise,refund_email,is_primary,created_at,updated_at';

/** Pre–fee-batch-range columns (migration not applied yet). */
export const EVENT_SELECT_LEGACY =
  'id,title,summary,description,starts_at,ends_at,venue,published,lunch_paise,dinner_paise,parking_2w_paise,parking_4w_paise,base_ticket_paise,is_primary,created_at,updated_at';

/** Legacy pricing columns plus refund email when fee-batch cols are absent. */
export const EVENT_SELECT_LEGACY_REFUND = `${EVENT_SELECT_LEGACY},refund_email`;
