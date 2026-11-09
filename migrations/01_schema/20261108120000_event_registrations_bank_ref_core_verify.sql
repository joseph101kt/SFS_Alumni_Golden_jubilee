-- supabase/migrations/20261108120000_event_registrations_bank_ref_core_verify.sql

alter table public.event_registrations
  add column if not exists bank_reference text null,
  add column if not exists core_committee_manually_verified boolean null,
  drop column if exists dinner,
  drop column if exists self_lunch,
  drop column if exists self_preference;

-- Rollback (data in dropped columns is not recoverable from this file):
-- alter table public.event_registrations
--   add column if not exists dinner boolean null default false,
--   add column if not exists self_lunch boolean not null default true,
--   add column if not exists self_preference text not null default 'veg'::text,
--   drop column if exists bank_reference,
--   drop column if exists core_committee_manually_verified;
-- alter table public.event_registrations
--   add constraint event_registrations_self_preference_check
--   check (self_preference = any (array['veg'::text, 'non-veg'::text]));