-- Alumni committee members for public landing / about pages (admin-maintained).

create table if not exists public.committee_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role text not null,
  email text not null,
  batch integer not null,
  phone_number text,
  photo_path text,
  sort_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_committee_members_published_sort
  on public.committee_members (published, sort_order, full_name);

alter table public.committee_members enable row level security;

revoke all on table public.committee_members from anon, authenticated;
grant all on table public.committee_members to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'committee-photos',
  'committee-photos',
  true,
  4000000,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
