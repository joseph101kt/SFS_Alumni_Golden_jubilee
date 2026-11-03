-- Member donations to named causes (Razorpay). Service role only.

create table if not exists public.donation_causes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_donation_causes_active_sort
  on public.donation_causes (active, sort_order, title);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.alumni_accounts (id) on delete restrict,
  cause_id uuid not null references public.donation_causes (id) on delete restrict,
  amount_paise integer not null check (amount_paise >= 100),
  message text,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed')),
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_donations_account_created
  on public.donations (account_id, created_at desc);

create index if not exists idx_donations_cause
  on public.donations (cause_id);

create index if not exists idx_donations_razorpay_order
  on public.donations (razorpay_order_id);

create index if not exists idx_donations_payment_status
  on public.donations (payment_status, created_at desc);

alter table public.donation_causes enable row level security;
alter table public.donations enable row level security;

revoke all on table public.donation_causes from anon, authenticated;
revoke all on table public.donations from anon, authenticated;
grant all on table public.donation_causes to service_role;
grant all on table public.donations to service_role;

insert into public.donation_causes (title, description, active, sort_order)
select * from (
  values
    (
      'Golden Jubilee Fund',
      'Support the golden jubilee celebrations and lasting school improvements.',
      true,
      0
    ),
    (
      'Student support',
      'Help current students with scholarships and hardship assistance.',
      true,
      1
    ),
    (
      'Association operations',
      'Keep alumni programmes, outreach, and community events running.',
      true,
      2
    )
) as v(title, description, active, sort_order)
where not exists (select 1 from public.donation_causes limit 1);
