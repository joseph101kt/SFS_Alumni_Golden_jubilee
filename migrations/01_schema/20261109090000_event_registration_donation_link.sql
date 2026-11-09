-- supabase/migrations/20261109090000_event_registration_donation_link.sql
-- Event registrations: one shared food choice for everyone eating, a guest eating count
-- instead of a per-guest list, and a link to the event donation.
-- Donations can belong to an event as well as a cause.
-- event_catalog is not changed.
-- Demo data only: no backfill. Columns and values that no longer apply are dropped or reset.

-- 1. Donations can belong to an event as well as a cause.
alter table public.donations
  alter column cause_id drop not null;

alter table public.donations
  add column if not exists event_id uuid null
    references public.event_catalog (id) on delete set null;

alter table public.donations
  drop constraint if exists donations_target_check;

alter table public.donations
  add constraint donations_target_check
  check (cause_id is not null or event_id is not null);

create index if not exists donations_event_id_idx
  on public.donations (event_id)
  where event_id is not null;

create unique index if not exists donations_razorpay_order_id_uidx
  on public.donations (razorpay_order_id)
  where razorpay_order_id is not null;

-- 2. The registration points at its donation. Its payment_status describes the fee only.
alter table public.event_registrations
  add column if not exists donation_id uuid null
    references public.donations (id) on delete set null;

create index if not exists event_registrations_donation_id_idx
  on public.event_registrations (donation_id)
  where donation_id is not null;

-- 3. Lunch is a yes/no for the alumnus. Null is treated as not eating.
update public.event_registrations
  set lunch = false
  where lunch is null;

alter table public.event_registrations
  alter column lunch set default false;

alter table public.event_registrations
  alter column lunch set not null;

-- 4. One food choice shared by everyone who is eating. Null when nobody is eating.
alter table public.event_registrations
  drop constraint if exists event_registrations_food_preference_check;

update public.event_registrations
  set food_preference = null
  where food_preference is not null
    and food_preference not in ('veg', 'non-veg');

alter table public.event_registrations
  add constraint event_registrations_food_preference_check
  check (food_preference is null or food_preference in ('veg', 'non-veg'));

-- 5. Guests eating is a count, not a list. Guests have no individual food choice.
alter table public.event_registrations
  add column if not exists guests_eating integer not null default 0;

alter table public.event_registrations
  drop constraint if exists event_registrations_guests_eating_check;

alter table public.event_registrations
  add constraint event_registrations_guests_eating_check
  check (guests_eating >= 0 and guests_eating <= number_of_guests);

-- 6. The per-guest list is no longer stored.
alter table public.event_registrations
  drop column if exists guests;

-- Rollback (demo data only, so no data is preserved):
-- alter table public.event_registrations add column if not exists guests jsonb not null default '[]'::jsonb;
-- alter table public.event_registrations drop constraint if exists event_registrations_guests_eating_check;
-- alter table public.event_registrations drop column if exists guests_eating;
-- alter table public.event_registrations drop column if exists donation_id;
-- alter table public.event_registrations alter column lunch drop not null;
-- alter table public.event_registrations alter column lunch drop default;
-- alter table public.donations drop constraint if exists donations_target_check;
-- alter table public.donations drop column if exists event_id;
-- alter table public.donations alter column cause_id set not null;