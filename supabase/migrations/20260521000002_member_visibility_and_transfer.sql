-- Block 3b step 2: visibility between co-members + atomic ownership transfer.

-- ============================================================
-- 1. Project co-members can see each other's profile
-- ============================================================
-- The original "Profiles are viewable by owner" policy from Block 1 stays.
-- This is an additive policy: PostgreSQL combines them with OR.

drop policy if exists "Profiles visible to project co-members" on public.profiles;
create policy "Profiles visible to project co-members"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.project_members me, public.project_members other
      where me.user_id = auth.uid()
        and other.user_id = profiles.id
        and me.project_id = other.project_id
    )
  );

-- ============================================================
-- 2. Atomic ownership transfer
-- ============================================================
-- Demotes the current owner to editor and promotes target to owner in a
-- single transaction. Guards against accidentally leaving a project with
-- no owner.

create or replace function public.transfer_project_ownership(
  p_project_id uuid,
  p_to_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user uuid := auth.uid();
begin
  if v_current_user is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_project_role(p_project_id, v_current_user, 'owner') then
    raise exception 'Only the current owner can transfer ownership';
  end if;

  if v_current_user = p_to_user_id then
    raise exception 'Cannot transfer ownership to yourself';
  end if;

  if not exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = p_to_user_id
  ) then
    raise exception 'Target user is not a member of this project';
  end if;

  update public.project_members
     set role = 'editor'
   where project_id = p_project_id
     and user_id    = v_current_user;

  update public.project_members
     set role = 'owner'
   where project_id = p_project_id
     and user_id    = p_to_user_id;
end;
$$;
