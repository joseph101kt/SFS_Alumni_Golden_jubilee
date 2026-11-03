-- Venue registration ID. Issued by the app once a registration is fully paid.
-- Multiple unpaid rows stay null; the unique index allows that.

alter table public.event_registrations
  add column if not exists registration_code text;

create unique index if not exists event_registrations_registration_code_unique
  on public.event_registrations (registration_code)
  where registration_code is not null;
