-- supabase/migrations/20261107_registration_self_lunch.sql
-- Flat ₹1,000 fee model: the alumnus can skip attending or lunch; guests always eat.
-- Idempotent: safe to run more than once.

alter table public.event_registrations
  add column if not exists attending boolean not null default true,
  add column if not exists self_lunch boolean not null default true,
  add column if not exists self_preference text not null default 'veg',
  add column if not exists guests jsonb not null default '[]'::jsonb;

alter table public.event_registrations
  drop constraint if exists event_registrations_self_preference_check;

alter table public.event_registrations
  add constraint event_registrations_self_preference_check
  check (self_preference in ('veg', 'non-veg'));

-- The app no longer writes these legacy meal and parking columns.
-- Relax them so inserts without them do not fail with a NOT NULL violation.
alter table public.event_registrations alter column parking_needed drop not null;
alter table public.event_registrations alter column lunch drop not null;
alter table public.event_registrations alter column dinner drop not null;
alter table public.event_registrations alter column food_preference drop not null;