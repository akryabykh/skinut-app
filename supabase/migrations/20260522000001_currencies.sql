-- Block 4: project currencies + exchange rate caching.
--
-- Adds optional multi-currency support to projects:
--   - app_projects.primary_currency: project's home currency (e.g. RUB).
--     All settlements and totals are computed in this currency.
--   - app_projects.secondary_currency: optional secondary currency for
--     expenses paid abroad (e.g. TRY for a trip to Turkey).
--
-- Expense-level currency lives inside the project's payload jsonb (the
-- calculator's state):
--   - expense.currency: ISO code, defaults to project's primary on the UI level
--   - expense.exchange_rate_used: number; multiplier to convert
--     from expense.currency to project.primary_currency. Recorded at
--     the time the expense was saved so historical totals don't drift
--     when fx rates change.
--
-- exchange_rates_cache is a small key/value table (base + target → rate)
-- written by the server-side fetcher to avoid hammering the upstream API
-- (frankfurter.app) on every save. Read-only for clients via grant; writes
-- happen via a SECURITY DEFINER RPC.
--
-- Safe to re-run.

-- ============================================================
-- 1. Currency columns on app_projects
-- ============================================================

-- ISO 4217 codes are 3 uppercase letters. We hardcode an allow-list in the
-- application (lib/currencies.ts) but at the DB level we only enforce the
-- format. This keeps the table flexible if the supported set ever grows.
alter table public.app_projects
  add column if not exists primary_currency text not null default 'RUB';

alter table public.app_projects
  add column if not exists secondary_currency text;

-- Drop previously created constraint if it exists, so re-runs don't fail.
alter table public.app_projects
  drop constraint if exists app_projects_primary_currency_check;
alter table public.app_projects
  drop constraint if exists app_projects_secondary_currency_check;
alter table public.app_projects
  drop constraint if exists app_projects_currencies_distinct;

alter table public.app_projects
  add constraint app_projects_primary_currency_check
    check (primary_currency ~ '^[A-Z]{3}$');

alter table public.app_projects
  add constraint app_projects_secondary_currency_check
    check (secondary_currency is null or secondary_currency ~ '^[A-Z]{3}$');

-- Secondary, if present, must differ from primary — otherwise it's redundant.
alter table public.app_projects
  add constraint app_projects_currencies_distinct
    check (secondary_currency is null or secondary_currency <> primary_currency);

-- ============================================================
-- 2. exchange_rates_cache
-- ============================================================
-- Stores the most recent (base → target) rate. Refreshed whenever the
-- server-side fetcher (lib/exchange-rate.ts) sees that the cached row is
-- older than the staleness threshold.
--
-- rate is "multiply 1 unit of `base` by this to get `target`".
-- Example: (base='TRY', target='RUB', rate=2.45) means 1 TRY = 2.45 RUB.

create table if not exists public.exchange_rates_cache (
  base       text not null,
  target     text not null,
  rate       numeric(20, 10) not null check (rate > 0),
  fetched_at timestamptz not null default now(),
  primary key (base, target)
);

alter table public.exchange_rates_cache
  drop constraint if exists exchange_rates_cache_base_format;
alter table public.exchange_rates_cache
  drop constraint if exists exchange_rates_cache_target_format;
alter table public.exchange_rates_cache
  drop constraint if exists exchange_rates_cache_distinct;

alter table public.exchange_rates_cache
  add constraint exchange_rates_cache_base_format
    check (base ~ '^[A-Z]{3}$');
alter table public.exchange_rates_cache
  add constraint exchange_rates_cache_target_format
    check (target ~ '^[A-Z]{3}$');
alter table public.exchange_rates_cache
  add constraint exchange_rates_cache_distinct
    check (base <> target);

-- RLS on the cache: enabled, but the table is read-public via a select-all
-- policy for both anon and authenticated. Writes only via the SECURITY
-- DEFINER upsert RPC below (no insert/update policies = nobody can write).
alter table public.exchange_rates_cache enable row level security;

drop policy if exists "Exchange rates cache is readable by anyone"
  on public.exchange_rates_cache;
create policy "Exchange rates cache is readable by anyone"
  on public.exchange_rates_cache
  for select
  to anon, authenticated
  using (true);

-- ============================================================
-- 3. upsert_exchange_rate RPC
-- ============================================================
-- SECURITY DEFINER so the server-side fetcher in lib/exchange-rate.ts can
-- write into the cache without needing a service-role key.

create or replace function public.upsert_exchange_rate(
  p_base   text,
  p_target text,
  p_rate   numeric
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Authentication is not required — anyone (including a share-token page
  -- viewer with no session) can trigger a rate refresh by viewing a
  -- multi-currency project. Validity is enforced by the CHECK constraints.
  insert into public.exchange_rates_cache (base, target, rate, fetched_at)
  values (p_base, p_target, p_rate, now())
  on conflict (base, target) do update
    set rate       = excluded.rate,
        fetched_at = excluded.fetched_at;
end;
$$;

grant execute on function public.upsert_exchange_rate(text, text, numeric)
  to anon, authenticated;

-- ============================================================
-- 4. Backfill primary_currency for existing rows
-- ============================================================
-- Existing projects predate currency support — default them to RUB
-- (matches the previous hardcoded Intl.NumberFormat in money()).
-- The column already has a default, so this only handles the unlikely
-- case where someone explicitly NULL'd it.

update public.app_projects
   set primary_currency = 'RUB'
 where primary_currency is null;

-- ============================================================
-- 5. Replace create_app_project RPC to accept currencies
-- ============================================================
-- Drop the parameterless version from Block 3b. The new version takes
-- the same arguments via parameters and uses the existing RLS-bypass
-- pattern to return the new id immediately.
--
-- We provide defaults so any existing callers that don't pass arguments
-- still work (defensive — the only known caller is updated in this PR).

drop function if exists public.create_app_project();
drop function if exists public.create_app_project(text, text, text);

create or replace function public.create_app_project(
  p_name              text default 'Новый проект',
  p_primary_currency  text default 'RUB',
  p_secondary_currency text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid := auth.uid();
  v_project_id uuid;
  v_name       text;
  v_primary    text;
  v_secondary  text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_name := nullif(trim(p_name), '');
  if v_name is null then
    v_name := 'Новый проект';
  end if;

  v_primary := upper(coalesce(nullif(trim(p_primary_currency), ''), 'RUB'));
  if v_primary !~ '^[A-Z]{3}$' then
    raise exception 'Invalid primary currency code: %', p_primary_currency;
  end if;

  v_secondary := nullif(trim(coalesce(p_secondary_currency, '')), '');
  if v_secondary is not null then
    v_secondary := upper(v_secondary);
    if v_secondary !~ '^[A-Z]{3}$' then
      raise exception 'Invalid secondary currency code: %', p_secondary_currency;
    end if;
    if v_secondary = v_primary then
      raise exception 'Secondary currency must differ from primary';
    end if;
  end if;

  insert into public.app_projects (
    owner_id, name, payload, primary_currency, secondary_currency
  )
  values (
    v_user_id, v_name, '{}'::jsonb, v_primary, v_secondary
  )
  returning id into v_project_id;

  -- The app_projects_add_owner_member trigger (Block 3b) will have run
  -- and inserted (v_project_id, v_user_id, 'owner') into project_members.

  return v_project_id;
end;
$$;

grant execute on function public.create_app_project(text, text, text)
  to authenticated;

-- ============================================================
-- 6. Replace get_public_project_summary to expose currencies
-- ============================================================
-- The /share/[token] page needs to know primary/secondary currency to
-- format expense amounts correctly. Drop and recreate so the return
-- signature can grow (PG can't change RETURNS TABLE in place).

drop function if exists public.get_public_project_summary(uuid);

create or replace function public.get_public_project_summary(p_token uuid)
returns table (
  name                text,
  payload             jsonb,
  primary_currency    text,
  secondary_currency  text,
  updated_at          timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select name, payload, primary_currency, secondary_currency, updated_at
  from public.app_projects
  where share_token = p_token
  limit 1;
$$;

grant execute on function public.get_public_project_summary(uuid)
  to anon, authenticated;
