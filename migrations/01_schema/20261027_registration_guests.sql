-- Per-person meal/diet choices for event registrations.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS; empty-only backfill; expand only length-1 rows.

alter table public.event_registrations
  add column if not exists guests jsonb not null default '[]'::jsonb;

-- One guest from legacy columns when still empty.
update public.event_registrations
set guests = jsonb_build_array(
  jsonb_build_object(
    'preference', case
      when food_preference = 'non-veg' then 'non-veg'
      when food_preference = 'none' then 'none'
      else 'veg'
    end,
    'lunch', lunch,
    'dinner', dinner
  )
)
where guests = '[]'::jsonb;

-- Expand to number_of_guests identical clones (aggregate only inside the CTE).
with built as (
  select
    e.id,
    jsonb_agg(e.guests -> 0) as guests
  from public.event_registrations e
  cross join lateral generate_series(
    1,
    greatest(coalesce(e.number_of_guests, 1), 1)
  ) as g
  where jsonb_array_length(e.guests) = 1
    and greatest(coalesce(e.number_of_guests, 1), 1) > 1
  group by e.id
)
update public.event_registrations as r
set guests = built.guests
from built
where r.id = built.id;
