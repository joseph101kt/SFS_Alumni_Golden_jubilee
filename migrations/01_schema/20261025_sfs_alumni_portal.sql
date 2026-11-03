-- Fresh-project bootstrap for the SFS Alumni portal.
-- Creates the profile table expected by the existing signup/login flow before extending it.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  phone_number text,
  role text not null default 'alumni' check (role in ('alumni','admin')),
  created_at timestamptz not null default now()
);

-- SFS Alumni portal extension. Back up and test in staging first.
-- Existing public.users RLS policies were not included in the uploaded ZIP.
alter table public.users
  add column if not exists member_status text not null default 'pending' check (member_status in ('pending','verified','rejected','suspended')),
  add column if not exists batch integer,
  add column if not exists current_location text,
  add column if not exists profession text,
  add column if not exists bio text,
  add column if not exists profile_visibility boolean not null default true,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.users(id);

-- Define admin helper before policies/triggers that call it.
create or replace function public.is_sfs_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.users u where u.id=auth.uid() and u.member_status='verified' and u.role='admin'); $$;
grant execute on function public.is_sfs_admin() to authenticated;

-- Access control for the existing users table. Review any pre-existing permissive
-- policies: PostgreSQL combines permissive policies with OR, so old broad policies
-- must be removed or tightened for these rules to be effective.
alter table public.users enable row level security;
drop policy if exists "SFS users read own profile or admins read users" on public.users;
create policy "SFS users read own profile or admins read users"
on public.users for select to authenticated
using (id = auth.uid() or public.is_sfs_admin());
drop policy if exists "SFS admins review membership" on public.users;
create policy "SFS admins review membership"
on public.users for update to authenticated
using (public.is_sfs_admin()) with check (public.is_sfs_admin());
drop policy if exists "SFS users create own pending profile" on public.users;
create policy "SFS users create own pending profile"
on public.users for insert to authenticated
with check (id = auth.uid() and role = 'alumni' and member_status = 'pending');

-- Ensure an authenticated user cannot self-assign an elevated role/status on insert.
create or replace function public.set_sfs_new_member_defaults()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and new.id = auth.uid() and not public.is_sfs_admin() then
    new.role := 'alumni';
    new.member_status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end; $$;
drop trigger if exists set_sfs_new_member_defaults_trigger on public.users;
create trigger set_sfs_new_member_defaults_trigger before insert on public.users
for each row execute function public.set_sfs_new_member_defaults();

create table if not exists public.alumni_events (
 id uuid primary key default gen_random_uuid(), title text not null, summary text not null, description text,
 starts_at timestamptz not null, venue text, registration_url text, published boolean not null default false,
 created_by uuid references public.users(id), created_at timestamptz not null default now()
);
create table if not exists public.alumni_stories (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references public.users(id) on delete cascade,
 title text not null, body text not null, status text not null default 'pending' check(status in ('pending','published','rejected')),
 created_at timestamptz not null default now(), reviewed_by uuid references public.users(id), reviewed_at timestamptz
);
create table if not exists public.alumni_memories (
 id uuid primary key default gen_random_uuid(), submitted_by uuid references public.users(id) on delete set null,
 title text not null, description text, image_url text, storage_path text, batch_label text,
 consent_confirmed boolean not null default false, status text not null default 'pending' check(status in ('pending','published','rejected')),
 created_at timestamptz not null default now(), reviewed_by uuid references public.users(id), reviewed_at timestamptz
);

create or replace function public.is_sfs_verified_member() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.users u where u.id=auth.uid() and u.member_status='verified'); $$;
create or replace function public.is_sfs_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.users u where u.id=auth.uid() and u.member_status='verified' and u.role='admin'); $$;
grant execute on function public.is_sfs_verified_member() to authenticated;
grant execute on function public.is_sfs_admin() to authenticated;

-- Prevent users changing their own role/status. Trusted SQL Editor operations can provision admins.
create or replace function public.protect_sfs_membership_fields() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and auth.uid()=old.id and not public.is_sfs_admin() then
  if new.role is distinct from old.role then raise exception 'Only an authorised administrator can change roles'; end if;
  if new.member_status is distinct from old.member_status then raise exception 'Only an authorised administrator can change membership status'; end if;
  if new.reviewed_by is distinct from old.reviewed_by or new.reviewed_at is distinct from old.reviewed_at then raise exception 'Only an authorised administrator can record membership review'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists protect_sfs_membership_fields_trigger on public.users;
create trigger protect_sfs_membership_fields_trigger before update on public.users for each row execute function public.protect_sfs_membership_fields();

alter table public.alumni_events enable row level security;
alter table public.alumni_stories enable row level security;
alter table public.alumni_memories enable row level security;
drop policy if exists "SFS verified members read published events" on public.alumni_events;
create policy "SFS verified members read published events" on public.alumni_events for select to authenticated using(published=true and public.is_sfs_verified_member());
drop policy if exists "SFS admins manage events" on public.alumni_events;
create policy "SFS admins manage events" on public.alumni_events for all to authenticated using(public.is_sfs_admin()) with check(public.is_sfs_admin());
drop policy if exists "SFS verified members read published stories" on public.alumni_stories;
create policy "SFS verified members read published stories" on public.alumni_stories for select to authenticated using(status='published' and public.is_sfs_verified_member());
drop policy if exists "SFS verified members submit stories" on public.alumni_stories;
create policy "SFS verified members submit stories" on public.alumni_stories for insert to authenticated with check(author_id=auth.uid() and status='pending' and public.is_sfs_verified_member());
drop policy if exists "SFS admins manage stories" on public.alumni_stories;
create policy "SFS admins manage stories" on public.alumni_stories for all to authenticated using(public.is_sfs_admin()) with check(public.is_sfs_admin());
drop policy if exists "SFS verified members read published memories" on public.alumni_memories;
create policy "SFS verified members read published memories" on public.alumni_memories for select to authenticated using(status='published' and public.is_sfs_verified_member());
drop policy if exists "SFS verified members submit memories" on public.alumni_memories;
create policy "SFS verified members submit memories" on public.alumni_memories for insert to authenticated with check(submitted_by=auth.uid() and consent_confirmed=true and status='pending' and public.is_sfs_verified_member());
drop policy if exists "SFS admins manage memories" on public.alumni_memories;
create policy "SFS admins manage memories" on public.alumni_memories for all to authenticated using(public.is_sfs_admin()) with check(public.is_sfs_admin());

-- Directory RPC exposes only safe fields; it never returns email or phone number.
create or replace function public.search_sfs_alumni(search_term text default null,batch_filter integer default null)
returns table(id uuid,full_name text,batch integer,current_location text,profession text,bio text)
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.is_sfs_verified_member() then raise exception 'Verified SFS alumni membership required'; end if;
 return query select u.id,u.full_name,u.batch,u.current_location,u.profession,u.bio from public.users u
 where u.member_status='verified' and coalesce(u.profile_visibility,true)=true
 and (batch_filter is null or u.batch=batch_filter)
 and (search_term is null or btrim(search_term)='' or u.full_name ilike '%'||search_term||'%' or coalesce(u.current_location,'') ilike '%'||search_term||'%' or coalesce(u.profession,'') ilike '%'||search_term||'%')
 order by u.full_name limit 100;
end; $$;
grant execute on function public.search_sfs_alumni(text,integer) to authenticated;

-- REQUIRED BEFORE PRODUCTION:
-- Review existing public.users policies. Only admins should read pending applications and update member_status.
-- Keep private email/phone out of directory RPCs. Test every policy with member, pending user, admin and anon accounts.
-- Provision an authorised first admin manually in Supabase SQL Editor after identity verification:
-- update public.users set role='admin', member_status='verified' where email='CONFIRMED_COMMITTEE_EMAIL';

-- Create the profile automatically from Supabase Auth. This avoids a client-side
-- insert race and works when email confirmation is enabled (no authenticated session).
create or replace function public.handle_sfs_new_auth_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.users (id, email, full_name, phone_number, role, member_status)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    nullif(trim(new.raw_user_meta_data ->> 'phone_number'), ''),
    'alumni',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created_sfs_profile on auth.users;
create trigger on_auth_user_created_sfs_profile after insert on auth.users
for each row execute function public.handle_sfs_new_auth_user();

-- Restrict callable SECURITY DEFINER helpers. Trigger functions are not client RPCs.
revoke all on function public.handle_sfs_new_auth_user() from public, anon, authenticated;
revoke all on function public.set_sfs_new_member_defaults() from public, anon, authenticated;
revoke all on function public.protect_sfs_membership_fields() from public, anon, authenticated;
revoke all on function public.is_sfs_admin() from public, anon;
grant execute on function public.is_sfs_admin() to authenticated;
revoke all on function public.is_sfs_verified_member() from public, anon;
grant execute on function public.is_sfs_verified_member() to authenticated;
revoke all on function public.search_sfs_alumni(text,integer) from public, anon;
grant execute on function public.search_sfs_alumni(text,integer) to authenticated;

create index if not exists idx_users_reviewed_by on public.users(reviewed_by);
create index if not exists idx_users_member_status_created_at on public.users(member_status, created_at);
create index if not exists idx_alumni_events_created_by on public.alumni_events(created_by);
create index if not exists idx_alumni_stories_author_id on public.alumni_stories(author_id);
create index if not exists idx_alumni_stories_reviewed_by on public.alumni_stories(reviewed_by);
create index if not exists idx_alumni_memories_submitted_by on public.alumni_memories(submitted_by);
create index if not exists idx_alumni_memories_reviewed_by on public.alumni_memories(reviewed_by);
