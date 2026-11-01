create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.alumni_accounts(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_account_id_idx
  on public.push_subscriptions (account_id);

create table if not exists public.event_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  deep_link text,
  created_by uuid references public.alumni_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_count integer not null default 0
);

alter table public.push_subscriptions enable row level security;
alter table public.event_broadcasts enable row level security;
