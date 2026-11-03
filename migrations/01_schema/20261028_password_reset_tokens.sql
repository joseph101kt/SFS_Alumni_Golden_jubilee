-- Single-use password reset tokens (hashed). Service role only.

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.alumni_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_account_created
  on public.password_reset_tokens (account_id, created_at desc);

create index if not exists idx_password_reset_tokens_expires
  on public.password_reset_tokens (expires_at)
  where used_at is null;

alter table public.password_reset_tokens enable row level security;

revoke all on table public.password_reset_tokens from anon, authenticated;
grant all on table public.password_reset_tokens to service_role;
