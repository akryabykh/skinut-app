-- Block 2: user-owned projects.
--
-- Drops the legacy public.projects table (was used for anonymous "share by
-- URL" mode in the calculator — that feature is being removed in this block)
-- and creates app_projects scoped to authenticated users.

-- ---- Drop legacy table ----
-- cascade removes the row-level policies and trigger that lived on it.
drop table if exists public.projects cascade;

-- ---- New table ----
create table if not exists public.app_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Новый проект',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reuse the updated_at helper that was defined in Block 1.
drop trigger if exists app_projects_set_updated_at on public.app_projects;
create trigger app_projects_set_updated_at
  before update on public.app_projects
  for each row
  execute function public.set_updated_at();

-- Index used by the "my projects" listing (sorted by recent activity).
create index if not exists app_projects_owner_updated_idx
  on public.app_projects (owner_id, updated_at desc);

-- ---- Row-level security ----
alter table public.app_projects enable row level security;

drop policy if exists "Projects are viewable by owner" on public.app_projects;
create policy "Projects are viewable by owner"
  on public.app_projects
  for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "Projects are insertable by owner" on public.app_projects;
create policy "Projects are insertable by owner"
  on public.app_projects
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "Projects are updatable by owner" on public.app_projects;
create policy "Projects are updatable by owner"
  on public.app_projects
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Projects are deletable by owner" on public.app_projects;
create policy "Projects are deletable by owner"
  on public.app_projects
  for delete
  to authenticated
  using (auth.uid() = owner_id);
