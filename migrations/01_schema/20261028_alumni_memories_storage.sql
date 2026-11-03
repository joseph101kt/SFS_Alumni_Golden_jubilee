-- Memories: batch_year + review_note; point FKs at alumni_accounts; private Storage bucket.

alter table public.alumni_memories
  add column if not exists batch_year integer,
  add column if not exists review_note text;

-- Drop legacy FKs to public.users if present (names vary by Postgres).
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
      and rel.relname = 'alumni_memories'
      and con.contype = 'f'
  loop
    execute format('alter table public.alumni_memories drop constraint if exists %I', r.conname);
  end loop;
end $$;

-- Clear orphan submitter/reviewer ids that are not alumni_accounts rows.
update public.alumni_memories m
set submitted_by = null
where submitted_by is not null
  and not exists (select 1 from public.alumni_accounts a where a.id = m.submitted_by);

update public.alumni_memories m
set reviewed_by = null
where reviewed_by is not null
  and not exists (select 1 from public.alumni_accounts a where a.id = m.reviewed_by);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'alumni_memories_submitted_by_fkey'
  ) then
    alter table public.alumni_memories
      add constraint alumni_memories_submitted_by_fkey
      foreign key (submitted_by) references public.alumni_accounts(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'alumni_memories_reviewed_by_fkey'
  ) then
    alter table public.alumni_memories
      add constraint alumni_memories_reviewed_by_fkey
      foreign key (reviewed_by) references public.alumni_accounts(id) on delete set null;
  end if;
end $$;

create index if not exists idx_alumni_memories_status_batch_created
  on public.alumni_memories (status, batch_year, created_at desc);

-- App uses service role; tighten client grants.
revoke all on table public.alumni_memories from anon, authenticated;
grant all on table public.alumni_memories to service_role;

-- Private memories bucket (create in Dashboard if this insert is denied).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'alumni-memories',
  'alumni-memories',
  false,
  4000000,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
