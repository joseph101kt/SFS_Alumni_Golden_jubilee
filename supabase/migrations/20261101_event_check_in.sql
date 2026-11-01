-- Gate check-in timestamps on event registrations
alter table public.event_registrations
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by text;

create index if not exists event_registrations_checked_in_at_idx
  on public.event_registrations (checked_in_at)
  where checked_in_at is not null;
