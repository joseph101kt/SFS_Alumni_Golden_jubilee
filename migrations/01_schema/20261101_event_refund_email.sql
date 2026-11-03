-- Committee email for refund requests (shown on registration when alumnus has paid).

alter table public.event_catalog
  add column if not exists refund_email text;

comment on column public.event_catalog.refund_email is
  'Committee email for refund requests; blank hides the registration CTA';
