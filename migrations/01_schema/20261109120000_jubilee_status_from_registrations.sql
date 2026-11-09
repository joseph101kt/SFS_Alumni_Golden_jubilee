-- supabase/migrations/20261109120000_jubilee_status_from_registrations.sql
-- alumni_accounts.jubilee_reg_status is derived from the registration, in the database.
-- It is "paid" when the committee has verified the registration, or when the fee and any
-- linked donation are both settled. It is "pending_payment" when an open registration still
-- owes money, and "none" when there is no open registration. Only the primary (jubilee) event
-- counts. Triggers keep it correct for app writes and for manual database edits.

create or replace function public.sync_jubilee_status(p_account_id uuid, p_event_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_is_primary boolean;
  v_status text;
begin
  select is_primary into v_is_primary
  from public.event_catalog
  where id = p_event_id;

  if not coalesce(v_is_primary, false) then
    return;
  end if;

  select case
    when bool_or(r.core_committee_manually_verified is true) then 'paid'
    when bool_or(
      r.payment_status = 'paid'
      and (r.donation_id is null
           or exists (
             select 1 from public.donations d
             where d.id = r.donation_id
               and d.payment_status in ('paid', 'failed')
           ))
    ) then 'paid'
    when count(*) > 0 then 'pending_payment'
    else 'none'
  end
  into v_status
  from public.event_registrations r
  where r.account_id = p_account_id
    and r.event_id = p_event_id
    and r.payment_status in ('pending', 'partial', 'paid');

  update public.alumni_accounts
    set jubilee_reg_status = coalesce(v_status, 'none')
    where id = p_account_id
      and jubilee_reg_status is distinct from coalesce(v_status, 'none');
end;
$$;

create or replace function public.trg_registration_sync_jubilee()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.sync_jubilee_status(new.account_id, new.event_id);
  if tg_op = 'UPDATE' and (old.event_id <> new.event_id or old.account_id <> new.account_id) then
    perform public.sync_jubilee_status(old.account_id, old.event_id);
  end if;
  return null;
end;
$$;

drop trigger if exists event_registrations_sync_jubilee on public.event_registrations;
create trigger event_registrations_sync_jubilee
  after insert or update on public.event_registrations
  for each row execute function public.trg_registration_sync_jubilee();

create or replace function public.trg_donation_sync_jubilee()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select account_id, event_id
    from public.event_registrations
    where donation_id = new.id
  loop
    perform public.sync_jubilee_status(r.account_id, r.event_id);
  end loop;
  return null;
end;
$$;

drop trigger if exists donations_sync_jubilee on public.donations;
create trigger donations_sync_jubilee
  after update of payment_status on public.donations
  for each row execute function public.trg_donation_sync_jubilee();

-- Backfill every existing account that has a registration for a primary event.
do $$
declare
  r record;
begin
  for r in
    select distinct account_id, event_id
    from public.event_registrations
  loop
    perform public.sync_jubilee_status(r.account_id, r.event_id);
  end loop;
end;
$$;