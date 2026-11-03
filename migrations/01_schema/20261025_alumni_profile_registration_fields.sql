-- Persist registration personal fields on the alumni account for Complete payment prefill.
alter table public.alumni_accounts
  add column if not exists last_name text,
  add column if not exists section text;
