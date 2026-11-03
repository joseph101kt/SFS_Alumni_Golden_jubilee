-- Username plus first and last name. Email stays unique and is the default username.

alter table public.alumni_accounts
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists username text;

update public.alumni_accounts
set
  first_name = coalesce(nullif(first_name, ''), split_part(full_name, ' ', 1)),
  last_name = coalesce(
    nullif(last_name, ''),
    nullif(btrim(substring(full_name from position(' ' in full_name) + 1)), '')
  )
where full_name is not null and btrim(full_name) <> '';

update public.alumni_accounts
set username = lower(email)
where username is null or btrim(username) = '';

create unique index if not exists alumni_accounts_username_unique
  on public.alumni_accounts (lower(username));
