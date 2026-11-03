-- Stories: point FKs at alumni_accounts; review_note; service-role only (table-auth).

alter table public.alumni_stories
  add column if not exists review_note text;

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'alumni_stories'
      and con.contype = 'f'
  loop
    execute format('alter table public.alumni_stories drop constraint if exists %I', r.conname);
  end loop;
end $$;

-- Orphan authors cannot be null (column is NOT NULL) — delete orphan pending rows, null reviewers.
delete from public.alumni_stories s
where not exists (select 1 from public.alumni_accounts a where a.id = s.author_id);

update public.alumni_stories s
set reviewed_by = null
where reviewed_by is not null
  and not exists (select 1 from public.alumni_accounts a where a.id = s.reviewed_by);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'alumni_stories_author_id_fkey'
  ) then
    alter table public.alumni_stories
      add constraint alumni_stories_author_id_fkey
      foreign key (author_id) references public.alumni_accounts(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'alumni_stories_reviewed_by_fkey'
  ) then
    alter table public.alumni_stories
      add constraint alumni_stories_reviewed_by_fkey
      foreign key (reviewed_by) references public.alumni_accounts(id) on delete set null;
  end if;
end $$;

create index if not exists idx_alumni_stories_status_created
  on public.alumni_stories (status, created_at desc);

revoke all on table public.alumni_stories from anon, authenticated;
grant all on table public.alumni_stories to service_role;
