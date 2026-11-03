-- Jubilee event registration status on the account (UI source of truth).
alter table public.alumni_accounts
  add column if not exists jubilee_reg_status text not null default 'none'
    check (jubilee_reg_status in ('none', 'pending_payment', 'paid'));

create index if not exists idx_alumni_accounts_jubilee_reg_status
  on public.alumni_accounts (jubilee_reg_status);
