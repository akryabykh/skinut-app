-- Block 3c: public share token for read-only access to a project's result.
--
-- Idea: any member with editor/owner role can generate a random uuid that
-- becomes a "magic" URL — anyone who has the URL can see the project's
-- name + the calculator's payload (people, expenses, transfers). Anyone
-- without it sees 404. Token is opaque, not enumerable.

alter table public.app_projects
  add column if not exists share_token uuid;

create unique index if not exists app_projects_share_token_idx
  on public.app_projects (share_token)
  where share_token is not null;

-- Returns a single row (name, payload, updated_at) for the project with
-- the given token. SECURITY DEFINER so it can be called by anonymous
-- visitors regardless of RLS on app_projects. Returns no rows when no
-- project has that token, which the route handler maps to 404.
create or replace function public.get_public_project_summary(p_token uuid)
returns table (
  name text,
  payload jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select name, payload, updated_at
  from public.app_projects
  where share_token = p_token
  limit 1;
$$;

-- Allow both anon and authenticated to call the RPC.
grant execute on function public.get_public_project_summary(uuid)
  to anon, authenticated;
