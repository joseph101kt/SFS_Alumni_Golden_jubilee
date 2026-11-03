-- Party-size balance (amount_paid + partial) and Razorpay audit fields.

alter table public.event_registrations
  add column if not exists amount_paid_paise integer not null default 0
    check (amount_paid_paise >= 0);

alter table public.event_registrations
  add column if not exists razorpay_order_id text;

alter table public.event_registrations
  add column if not exists razorpay_payment_id text;

alter table public.event_registrations
  add column if not exists razorpay_signature text;

-- Widen payment_status to include partial (drop old check, add new).
alter table public.event_registrations
  drop constraint if exists event_registrations_payment_status_check;

alter table public.event_registrations
  add constraint event_registrations_payment_status_check
  check (payment_status in ('pending', 'partial', 'paid', 'cancelled'));

-- Recreate open-registration unique to include partial.
drop index if exists public.event_registrations_one_open;

create unique index event_registrations_one_open
  on public.event_registrations (event_id, account_id)
  where payment_status in ('pending', 'partial', 'paid');

create unique index if not exists event_registrations_razorpay_order_id_uidx
  on public.event_registrations (razorpay_order_id)
  where razorpay_order_id is not null;

-- Backfill: treat existing paid rows as fully paid.
update public.event_registrations
set amount_paid_paise = total_cost_paise
where payment_status = 'paid'
  and amount_paid_paise = 0
  and total_cost_paise > 0;
