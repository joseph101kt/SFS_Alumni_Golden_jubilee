begin;

alter table public.event_registrations
  add column has_parking boolean not null default false,
  add column two_wheeler_count integer not null default 0,
  add column four_wheeler_count integer not null default 0,
  add constraint event_registrations_two_wheeler_count_check check (two_wheeler_count >= 0),
  add constraint event_registrations_four_wheeler_count_check check (four_wheeler_count >= 0),
  add constraint event_registrations_parking_counts_check check (
    has_parking or (two_wheeler_count = 0 and four_wheeler_count = 0)
  );

update public.event_registrations
set
  has_parking = parking_needed is not null and parking_needed <> 'none',
  two_wheeler_count = case when parking_needed = '2-wheeler' then 1 else 0 end,
  four_wheeler_count = case when parking_needed = '4-wheeler' then 1 else 0 end;

alter table public.event_registrations
  drop constraint event_registrations_parking_needed_check,
  drop column parking_needed;

commit;