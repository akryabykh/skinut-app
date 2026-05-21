-- Block 3b fix: createProject server action vs RLS race condition.
--
-- After the Block 3b RLS rewrite, this:
--
--   insert into app_projects (...) values (...) returning id
--
-- stops returning a row when called by a normal authenticated user.
-- Reason: the new SELECT policy uses is_project_member(id, auth.uid()),
-- but the after-insert trigger that creates the owner-membership row
-- only fires AFTER the row is inserted — RETURNING is computed before
-- that, so RLS hides the freshly inserted row from the caller.
--
-- Fix: wrap the insert in a SECURITY DEFINER RPC. The function runs
-- with the function-owner's privileges and bypasses RLS, so it can
-- safely return the new id. The after-insert trigger still fires
-- normally and adds the caller as 'owner' in project_members.

create or replace function public.create_app_project()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.app_projects (owner_id, name, payload)
  values (v_user_id, 'Новый проект', '{}'::jsonb)
  returning id into v_project_id;

  -- The app_projects_add_owner_member trigger will have run here
  -- and inserted (v_project_id, v_user_id, 'owner') into project_members.

  return v_project_id;
end;
$$;
