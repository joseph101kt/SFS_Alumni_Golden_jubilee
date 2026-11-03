-- Allow public (anon) read of published committee members only.
-- Service role remains full access for admin writes.

grant select on table public.committee_members to anon, authenticated;

drop policy if exists committee_members_public_read on public.committee_members;
create policy committee_members_public_read
  on public.committee_members
  for select
  to anon, authenticated
  using (published = true);
