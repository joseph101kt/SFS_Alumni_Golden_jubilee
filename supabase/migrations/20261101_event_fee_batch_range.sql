-- Registration fee by batch: default base_ticket_paise for everyone;
-- optional [fee_batch_from, fee_batch_to] uses fee_batch_paise instead (may be 0).

alter table public.event_catalog
  add column if not exists fee_batch_from integer
    check (fee_batch_from is null or fee_batch_from >= 1900),
  add column if not exists fee_batch_to integer
    check (fee_batch_to is null or fee_batch_to >= 1900),
  add column if not exists fee_batch_paise integer not null default 0
    check (fee_batch_paise >= 0);

comment on column public.event_catalog.fee_batch_from is
  'Inclusive batch year lower bound for the alternate registration fee';
comment on column public.event_catalog.fee_batch_to is
  'Inclusive batch year upper bound for the alternate registration fee';
comment on column public.event_catalog.fee_batch_paise is
  'Registration fee (paise) for batches in [fee_batch_from, fee_batch_to]; 0 allowed';
