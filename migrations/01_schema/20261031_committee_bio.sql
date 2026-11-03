-- Optional short bio for committee members (Association / About).
alter table public.committee_members
  add column if not exists bio text;
