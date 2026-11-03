-- Table-based alumni auth (no Supabase Auth users per alumnus).
-- Service role bypasses RLS; do not grant client access to password_hash.

create table if not exists public.alumni_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  full_name text not null,
  phone_number text,
  role text not null default 'alumni' check (role in ('alumni', 'admin')),
  member_status text not null default 'pending'
    check (member_status in ('pending', 'verified', 'rejected', 'suspended')),
  batch integer,
  current_location text,
  profession text,
  bio text,
  profile_visibility boolean not null default true,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.alumni_accounts(id)
);

create unique index if not exists alumni_accounts_email_unique
  on public.alumni_accounts (lower(email));

create index if not exists idx_alumni_accounts_member_status_created_at
  on public.alumni_accounts (member_status, created_at);

alter table public.alumni_accounts enable row level security;

-- No policies for anon/authenticated: only service role (bypass) should access this table.
revoke all on table public.alumni_accounts from anon, authenticated;
grant all on table public.alumni_accounts to service_role;
