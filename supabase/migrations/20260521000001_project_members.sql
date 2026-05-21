-- Block 3b: project_members for collaborative projects.
--
-- Projects become collective — anyone in project_members has access at
-- a given role (owner, editor, viewer). RLS on app_projects is rewritten
-- to check membership instead of the original owner_id.
--
-- Safe to re-run.

-- ============================================================
-- 1. project_members table
-- ============================================================

create table if not exists public.project_members (
  project_id uuid not null references public.app_projects(id) on delete cascade,
  user_id   uuid not null references auth.users(id)            on delete cascade,
  role      text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_idx
  on public.project_members (user_id);

-- ============================================================
-- 2. Backfill: every existing project's owner becomes its first member
-- ============================================================

insert into public.project_members (project_id, user_id, role)
select id, owner_id, 'owner'
from public.app_projects
on conflict (project_id, user_id) do nothing;

-- ============================================================
-- 3. Helpers (SECURITY DEFINER) — avoid RLS recursion
-- ============================================================

-- "Is user a member of this project, in any role?"
create or replace function public.is_project_member(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = p_user_id
  );
$$;

-- "Is user a member of this project with at least the given role?"
-- Role hierarchy: viewer < editor < owner.
create or replace function public.has_project_role(
  p_project_id uuid,
  p_user_id uuid,
  p_min_role text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id
      and user_id = p_user_id
      and (
        (p_min_role = 'viewer')
        or (p_min_role = 'editor' and role in ('editor', 'owner'))
        or (p_min_role = 'owner' and role = 'owner')
      )
  );
$$;

-- Lookup user_id by email through profiles (auth.users isn't directly
-- readable via RLS). Used by inviteMember server action so it doesn't
-- need the admin/service-role client.
create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where email = p_email limit 1;
$$;

-- ============================================================
-- 4. Trigger: auto-add creator as owner when project is created
-- ============================================================

create or replace function public.add_project_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (project_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists app_projects_add_owner_member on public.app_projects;
create trigger app_projects_add_owner_member
  after insert on public.app_projects
  for each row
  execute function public.add_project_owner_as_member();

-- ============================================================
-- 5. Trigger: delete project when last member leaves
-- ============================================================

create or replace function public.delete_project_if_empty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining int;
begin
  select count(*) into remaining
  from public.project_members
  where project_id = old.project_id;

  if remaining = 0 then
    delete from public.app_projects where id = old.project_id;
  end if;

  return old;
end;
$$;

drop trigger if exists project_members_cleanup_empty on public.project_members;
create trigger project_members_cleanup_empty
  after delete on public.project_members
  for each row
  execute function public.delete_project_if_empty();

-- ============================================================
-- 6. RLS on project_members
-- ============================================================

alter table public.project_members enable row level security;

-- Members of a project can see all members of that project.
drop policy if exists "Members visible within project" on public.project_members;
create policy "Members visible within project"
  on public.project_members
  for select
  to authenticated
  using (public.is_project_member(project_id, auth.uid()));

-- Only owners can add new members (invites).
drop policy if exists "Owners can add members" on public.project_members;
create policy "Owners can add members"
  on public.project_members
  for insert
  to authenticated
  with check (public.has_project_role(project_id, auth.uid(), 'owner'));

-- Only owners can change roles of others.
drop policy if exists "Owners can change member roles" on public.project_members;
create policy "Owners can change member roles"
  on public.project_members
  for update
  to authenticated
  using (public.has_project_role(project_id, auth.uid(), 'owner'))
  with check (public.has_project_role(project_id, auth.uid(), 'owner'));

-- Anyone can remove themselves (leave). Owners can remove anyone.
drop policy if exists "Self-remove or owner-remove" on public.project_members;
create policy "Self-remove or owner-remove"
  on public.project_members
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.has_project_role(project_id, auth.uid(), 'owner')
  );

-- ============================================================
-- 7. Rewrite RLS on app_projects to use membership
-- ============================================================

-- Drop legacy policies from Block 2 that referenced owner_id directly.
drop policy if exists "Projects are viewable by owner"     on public.app_projects;
drop policy if exists "Projects are insertable by owner"   on public.app_projects;
drop policy if exists "Projects are updatable by owner"    on public.app_projects;
drop policy if exists "Projects are deletable by owner"    on public.app_projects;

-- New: members of any role can see the project.
create policy "Projects are viewable by members"
  on public.app_projects
  for select
  to authenticated
  using (public.is_project_member(id, auth.uid()));

-- New: any authenticated user can create projects; the after-insert
-- trigger ensures the creator becomes the first owner.
create policy "Authenticated users can create projects"
  on public.app_projects
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

-- New: editors and owners can update payload/name.
create policy "Projects are updatable by editor-or-owner"
  on public.app_projects
  for update
  to authenticated
  using (public.has_project_role(id, auth.uid(), 'editor'))
  with check (public.has_project_role(id, auth.uid(), 'editor'));

-- New: only owners can delete the row directly.
-- (The trigger from §5 also auto-deletes when membership drops to 0.)
create policy "Projects are deletable by owner"
  on public.app_projects
  for delete
  to authenticated
  using (public.has_project_role(id, auth.uid(), 'owner'));
