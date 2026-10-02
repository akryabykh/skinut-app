-- Apply before deploying codex/fix-project-data-safety. Old edit-link tabs
-- must reload: unversioned writes are deliberately no longer allowed.
begin;

-- Content versions change even within one transaction. Sharing/expiry
-- updates don't invalidate an otherwise current calculator snapshot.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  if tg_table_schema = 'public' and tg_table_name = 'app_projects' then
    if new.payload is not distinct from old.payload
      and new.name is not distinct from old.name
      and new.primary_currency is not distinct from old.primary_currency
      and new.secondary_currency is not distinct from old.secondary_currency
      and new.manual_rate is not distinct from old.manual_rate then
      new.updated_at := old.updated_at;
      return new;
    end if;
  end if;
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;

-- Lock the project before checking/changing ownership. owner_id is also
-- the cascading FK used when an account is deleted, so it must follow roles.
create or replace function public.transfer_project_ownership(
  p_project_id uuid, p_to_user_id uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_current_user uuid := auth.uid();
begin
  if v_current_user is null then raise exception 'Not authenticated'; end if;
  perform 1 from public.app_projects where id = p_project_id for update;
  if not found or not public.has_project_role(p_project_id, v_current_user, 'owner') then
    raise exception 'Only the current owner can transfer ownership';
  end if;
  if v_current_user = p_to_user_id then raise exception 'Cannot transfer ownership to yourself'; end if;
  if not exists (select 1 from public.project_members where project_id = p_project_id and user_id = p_to_user_id) then
    raise exception 'Target user is not a member of this project';
  end if;
  update public.project_members set role = 'editor'
    where project_id = p_project_id and user_id = v_current_user;
  update public.project_members set role = 'owner'
    where project_id = p_project_id and user_id = p_to_user_id;
  update public.app_projects set owner_id = p_to_user_id where id = p_project_id;
end;
$$;
revoke all on function public.transfer_project_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_project_ownership(uuid, uuid) to authenticated;

-- Repair previous transfers only when the current owner is unambiguous.
update public.app_projects p
set owner_id = m.user_id
from public.project_members m
where m.project_id = p.id and m.role = 'owner'
  and p.owner_id is distinct from m.user_id
  and (select count(*) from public.project_members owners where owners.project_id = p.id and owners.role = 'owner') = 1;

-- Anonymous/edit-link saves use the same compare-and-swap as account saves.
create or replace function public.save_anon_project(
  p_token uuid, p_payload jsonb, p_expected_updated_at timestamptz,
  p_name text default null
) returns table(updated_at timestamptz, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if p_expected_updated_at is null then
    raise exception 'Expected version is required' using errcode = '22023';
  end if;
  return query
    update public.app_projects p
    set payload = p_payload,
        name = coalesce(nullif(trim(p_name), ''), p.name),
        expires_at = case when p.owner_id is null then clock_timestamp() + interval '30 days' else null end
    where p.edit_token = p_token
      and (p.expires_at is null or p.expires_at > clock_timestamp())
      and p.updated_at = p_expected_updated_at
    returning p.updated_at, p.expires_at;
end;
$$;
revoke all on function public.save_anon_project(uuid, jsonb, timestamptz, text) from public;
grant execute on function public.save_anon_project(uuid, jsonb, timestamptz, text) to anon, authenticated;
-- Remove the bypass for stale web clients (also revoke PostgreSQL's default PUBLIC grant).
revoke all on function public.update_anon_project(uuid, jsonb, text) from public, anon, authenticated;

-- Only a server service-role client may write exchange rates. Remove all
-- existing cache entries because their provenance cannot be trusted.
revoke all on function public.upsert_exchange_rate(text, text, numeric) from public, anon, authenticated;
grant execute on function public.upsert_exchange_rate(text, text, numeric) to service_role;
delete from public.exchange_rates_cache;
commit;
