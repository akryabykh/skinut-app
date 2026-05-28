-- Block 14: Анонимные проекты + редактирование по ссылке + 30-day TTL.
--
-- Цель: дать конкурентскую модель доступа (URL-as-identity) для тех,
-- кому регистрация — барьер. Параллельно сохраняем существующий
-- account-based флоу. Три режима после этой миграции:
--
--   - Локальный: localStorage в /app, без сервера. Не меняется.
--   - Анон-проект: owner_id IS NULL, edit_token uuid, 30 дней с
--     последней правки. Доступ только через RPC (RLS не пускает).
--   - Owned: как сейчас. + опциональный edit_token, который owner
--     может выставить из настроек и в любой момент сбросить.
--
-- iOS-импликации: аддитивная схема, две новые колонки + RPC. iOS
-- читает существующий PostgREST — анон-проектов он не видит (RLS
-- их режет, owner_id IS NULL не матчит auth.uid()). Никаких
-- breaking changes для iOS-клиента.

-- ============================================================
-- 1. Schema
-- ============================================================

-- Owner становится опциональным — анон-проекты живут без хозяина.
alter table public.app_projects
  alter column owner_id drop not null;

-- Edit-token для редактирования по URL. Отдельная колонка от
-- существующего share_token (тот — read-only, этот — read+write).
-- nullable: только проекты с активированным edit-by-link имеют
-- значение.
alter table public.app_projects
  add column if not exists edit_token uuid;

create unique index if not exists app_projects_edit_token_idx
  on public.app_projects (edit_token)
  where edit_token is not null;

-- TTL: NULL для owned (бессрочно), now() + 30d для анон при создании
-- и обновлении.
alter table public.app_projects
  add column if not exists expires_at timestamptz;

create index if not exists app_projects_expires_at_idx
  on public.app_projects (expires_at)
  where expires_at is not null;

-- ============================================================
-- 2. Обновляем trigger add_project_owner_as_member на NULL-safe
-- ============================================================

-- Существующий trigger пытается вставить (project_id, owner_id, 'owner')
-- в project_members после INSERT в app_projects. Для анон-проектов
-- owner_id IS NULL — нужно пропустить, иначе FK-failure.

create or replace function public.add_project_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is null then
    -- Анон-проект: владельца нет, в project_members не пишем.
    return new;
  end if;
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (project_id, user_id) do nothing;
  return new;
end;
$$;

-- ============================================================
-- 3. RPC: create_anon_project — создать анон, вернуть edit_token
-- ============================================================
--
-- Вызывается из server action на лендинге. SECURITY DEFINER, чтобы
-- обойти RLS-policy "Projects are insertable by owner" (она требует
-- auth.uid() = owner_id, что для анона ложно).

create or replace function public.create_anon_project(
  p_name               text default null,
  p_primary_currency   text default 'RUB',
  p_secondary_currency text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edit_token uuid := gen_random_uuid();
  v_name       text;
  v_primary    text;
  v_secondary  text;
begin
  v_name := nullif(trim(coalesce(p_name, '')), '');
  if v_name is null then
    v_name := 'Расчёт от ' ||
      to_char(now() at time zone 'Europe/Moscow', 'DD.MM.YYYY');
  end if;

  v_primary := upper(coalesce(nullif(trim(p_primary_currency), ''), 'RUB'));
  if v_primary !~ '^[A-Z]{3}$' then
    raise exception 'Invalid primary currency code: %', p_primary_currency;
  end if;

  v_secondary := nullif(trim(coalesce(p_secondary_currency, '')), '');
  if v_secondary is not null then
    v_secondary := upper(v_secondary);
    if v_secondary !~ '^[A-Z]{3}$' or v_secondary = v_primary then
      raise exception 'Invalid secondary currency code: %', p_secondary_currency;
    end if;
  end if;

  insert into public.app_projects (
    name, owner_id,
    primary_currency, secondary_currency,
    edit_token, share_token,
    expires_at, payload
  )
  values (
    v_name, null,
    v_primary, v_secondary,
    v_edit_token, null,
    now() + interval '30 days',
    jsonb_build_object(
      'projectName', v_name,
      'expenseSort', 'created-desc',
      'people',      '[]'::jsonb,
      'expenses',    '[]'::jsonb
    )
  );

  return v_edit_token;
end;
$$;

-- ============================================================
-- 4. RPC: get_anon_project — прочитать анон по edit_token
-- ============================================================
--
-- Возвращает 0 или 1 строку. Просроченные (expires_at < now()) не
-- возвращаются. Cron-job всё равно удалит их физически, но это
-- защищает от race condition между чтением и cleanup.

create or replace function public.get_anon_project(p_token uuid)
returns table (
  id                 uuid,
  name               text,
  payload            jsonb,
  primary_currency   text,
  secondary_currency text,
  manual_rate        double precision,
  share_token        uuid,
  expires_at         timestamptz,
  owner_id           uuid,
  updated_at         timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    id, name, payload,
    primary_currency, secondary_currency, manual_rate,
    share_token, expires_at, owner_id, updated_at
  from public.app_projects
  where edit_token = p_token
    and (expires_at is null or expires_at > now())
  limit 1;
$$;

-- ============================================================
-- 5. RPC: update_anon_project — пишет payload + бампит expires_at
-- ============================================================
--
-- Каждый успешный сейв продлевает срок жизни на 30 дней. Если
-- проект уже заклеймлен (owner_id IS NOT NULL) — RPC ничего не
-- делает и бросает ошибку, чтобы клиент с устаревшим edit-token
-- не писал поверх чужих изменений.

create or replace function public.update_anon_project(
  p_token   uuid,
  p_payload jsonb,
  p_name    text default null
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_expires timestamptz := now() + interval '30 days';
  v_name        text := nullif(trim(coalesce(p_name, '')), '');
begin
  update public.app_projects
  set payload    = p_payload,
      name       = coalesce(v_name, name),
      expires_at = v_new_expires
  where edit_token = p_token
    and owner_id is null
    and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'Анонимный проект не найден, просрочен или уже забран'
      using errcode = 'P0002';
  end if;

  return v_new_expires;
end;
$$;

-- ============================================================
-- 6. RPC: claim_anon_project — авторизованный юзер забирает анон
-- ============================================================
--
-- Первый кто жмёт — побеждает. NULL'ит edit_token (старая ссылка
-- умирает), снимает expires_at (теперь бессрочный), вставляет
-- авторизованного как owner в project_members.
--
-- Если token уже NULL'ен (проект забрали) или просрочен — exception.

create or replace function public.claim_anon_project(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_user_id    uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Нужна аутентификация для овладения проектом'
      using errcode = '42501';
  end if;

  update public.app_projects
  set owner_id   = v_user_id,
      edit_token = null,
      expires_at = null
  where edit_token = p_token
    and owner_id is null
    and (expires_at is null or expires_at > now())
  returning id into v_project_id;

  if v_project_id is null then
    raise exception 'Проект не найден, просрочен или уже забран'
      using errcode = 'P0002';
  end if;

  -- Тригер add_project_owner_as_member НЕ срабатывает на UPDATE —
  -- только AFTER INSERT. Поэтому членство добавляем руками.
  insert into public.project_members (project_id, user_id, role)
  values (v_project_id, v_user_id, 'owner')
  on conflict (project_id, user_id) do nothing;

  return v_project_id;
end;
$$;

-- ============================================================
-- 7. Grants
-- ============================================================
-- create/get/update — для anon (неавторизованные посетители) и
-- authenticated. claim — только для authenticated (нужен auth.uid).

grant execute on function public.create_anon_project(text, text, text)
  to anon, authenticated;
grant execute on function public.get_anon_project(uuid)
  to anon, authenticated;
grant execute on function public.update_anon_project(uuid, jsonb, text)
  to anon, authenticated;
grant execute on function public.claim_anon_project(uuid)
  to authenticated;

-- ============================================================
-- 8. Daily cleanup (pg_cron, опционально)
-- ============================================================
-- Удаляем анон-проекты, у которых expires_at в прошлом. Запуск
-- ежедневно в 03:00 UTC. Если pg_cron extension не включён в
-- Supabase Dashboard → Database → Extensions — schedule пропускается
-- с NOTICE, кому надо включить вручную или добавить Vercel-cron.

do $cleanup$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Идемпотентность: убираем старую запись с тем же именем (если
    -- миграция применяется повторно).
    perform cron.unschedule(jobid)
    from cron.job where jobname = 'cleanup-anon-projects';

    perform cron.schedule(
      'cleanup-anon-projects',
      '0 3 * * *',
      'DELETE FROM public.app_projects WHERE owner_id IS NULL AND expires_at < now()'
    );
    raise notice 'Scheduled cleanup-anon-projects daily at 03:00 UTC';
  else
    raise notice 'pg_cron extension not installed — schedule cleanup externally (Vercel cron, или вручную в Supabase Dashboard)';
  end if;
end
$cleanup$;
