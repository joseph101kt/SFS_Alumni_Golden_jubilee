-- Event catalog with per-event pricing + registrations (table-auth / service role).
-- No anon/authenticated grants; service role bypasses RLS.

create table if not exists public.event_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue text,
  published boolean not null default false,
  lunch_paise integer not null default 0 check (lunch_paise >= 0),
  dinner_paise integer not null default 0 check (dinner_paise >= 0),
  parking_2w_paise integer not null default 0 check (parking_2w_paise >= 0),
  parking_4w_paise integer not null default 0 check (parking_4w_paise >= 0),
  base_ticket_paise integer not null default 0 check (base_ticket_paise >= 0),
  is_primary boolean not null default false,
  created_by uuid references public.alumni_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists event_catalog_one_primary
  on public.event_catalog (is_primary)
  where is_primary = true;

create index if not exists idx_event_catalog_published_starts
  on public.event_catalog (published, starts_at);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_catalog(id) on delete cascade,
  account_id uuid not null references public.alumni_accounts(id) on delete cascade,
  phone_number text,
  number_of_guests integer not null default 0 check (number_of_guests >= 0),
  food_preference text,
  parking_needed text not null default 'none'
    check (parking_needed in ('none', '2-wheeler', '4-wheeler')),
  lunch boolean not null default false,
  dinner boolean not null default false,
  attending boolean not null default true,
  total_cost_paise integer not null check (total_cost_paise >= 0),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists event_registrations_one_open
  on public.event_registrations (event_id, account_id)
  where payment_status in ('pending', 'paid');

create index if not exists idx_event_registrations_event_status
  on public.event_registrations (event_id, payment_status);

create index if not exists idx_event_registrations_account
  on public.event_registrations (account_id);

alter table public.event_catalog enable row level security;
alter table public.event_registrations enable row level security;

revoke all on table public.event_catalog from anon, authenticated;
revoke all on table public.event_registrations from anon, authenticated;
grant all on table public.event_catalog to service_role;
grant all on table public.event_registrations to service_role;

-- Seed Golden Jubilee as primary published event (idempotent by title+primary).
insert into public.event_catalog (
  title,
  summary,
  description,
  starts_at,
  venue,
  published,
  lunch_paise,
  dinner_paise,
  parking_2w_paise,
  parking_4w_paise,
  base_ticket_paise,
  is_primary
)
select
  'SFS Golden Jubilee Homecoming',
  'Celebrate 50 years of SFS Shanthinagar with alumni, faculty, and families.',
  'Golden Jubilee reunion — meals and parking priced per registration options.',
  '2026-12-20 10:00:00+05:30'::timestamptz,
  'SFS High School, Shanthinagar, Secunderabad',
  true,
  30000,
  50000,
  5000,
  20000,
  0,
  true
where not exists (
  select 1 from public.event_catalog where is_primary = true
);
