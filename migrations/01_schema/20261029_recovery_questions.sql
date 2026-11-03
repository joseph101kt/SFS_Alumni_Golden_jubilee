-- Member recovery questions (hashed answers) for password reset without email.
alter table public.alumni_accounts
  add column if not exists recovery_q1 text,
  add column if not exists recovery_a1_hash text,
  add column if not exists recovery_q2 text,
  add column if not exists recovery_a2_hash text;

comment on column public.alumni_accounts.recovery_q1 is 'Recovery question id 1 from fixed bank';
comment on column public.alumni_accounts.recovery_a1_hash is 'bcrypt hash of normalized answer 1';
comment on column public.alumni_accounts.recovery_q2 is 'Recovery question id 2 from fixed bank';
comment on column public.alumni_accounts.recovery_a2_hash is 'bcrypt hash of normalized answer 2';
