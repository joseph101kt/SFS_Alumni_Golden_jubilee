-- If fee_batch_from/to already applied without amount, add fee_batch_paise.
alter table public.event_catalog
  add column if not exists fee_batch_paise integer not null default 0
    check (fee_batch_paise >= 0);
