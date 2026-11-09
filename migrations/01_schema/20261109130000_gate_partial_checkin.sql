-- supabase/migrations/20261109130000_gate_partial_checkin.sql
-- Gate check-in can admit the alumnus and any number of guests, in separate steps.
-- checked_in_at records the alumnus's entry (existing column). guests_checked_in records how many
-- guests have entered. The app enforces guests_checked_in <= number_of_guests, because a check
-- constraint would block the form from lowering the guest count after someone has entered.

alter table public.event_registrations
  add column if not exists guests_checked_in integer not null default 0;

alter table public.event_registrations
  drop constraint if exists event_registrations_guests_checked_in_check;

alter table public.event_registrations
  add constraint event_registrations_guests_checked_in_check
  check (guests_checked_in >= 0);