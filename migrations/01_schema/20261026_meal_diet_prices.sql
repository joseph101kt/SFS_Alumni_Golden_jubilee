-- Separate non-veg meal rates. Existing lunch_paise / dinner_paise stay the veg rates.
-- Nulls are filled from the veg rate once, so a later intentional 0 is not overwritten.
alter table public.event_catalog
  add column if not exists lunch_nonveg_paise integer,
  add column if not exists dinner_nonveg_paise integer;

update public.event_catalog
set lunch_nonveg_paise = lunch_paise
where lunch_nonveg_paise is null;

update public.event_catalog
set dinner_nonveg_paise = dinner_paise
where dinner_nonveg_paise is null;

alter table public.event_catalog
  alter column lunch_nonveg_paise set default 0,
  alter column dinner_nonveg_paise set default 0;

alter table public.event_catalog
  alter column lunch_nonveg_paise set not null,
  alter column dinner_nonveg_paise set not null;

alter table public.event_catalog
  drop constraint if exists event_catalog_lunch_nonveg_paise_check,
  drop constraint if exists event_catalog_dinner_nonveg_paise_check;

alter table public.event_catalog
  add constraint event_catalog_lunch_nonveg_paise_check check (lunch_nonveg_paise >= 0),
  add constraint event_catalog_dinner_nonveg_paise_check check (dinner_nonveg_paise >= 0);
