-- Registration fee applies only to alumnus batches in [fee_batch_from, fee_batch_to]
-- when both bounds are set. Null bounds = fee applies to all (legacy behaviour).

alter table public.event_catalog
  add column if not exists fee_batch_from integer
    check (fee_batch_from is null or fee_batch_from >= 1900),
  add column if not exists fee_batch_to integer
    check (fee_batch_to is null or fee_batch_to >= 1900);

comment on column public.event_catalog.fee_batch_from is
  'Inclusive batch year lower bound for registration fee; null with fee_batch_to null = all batches';
comment on column public.event_catalog.fee_batch_to is
  'Inclusive batch year upper bound for registration fee';
