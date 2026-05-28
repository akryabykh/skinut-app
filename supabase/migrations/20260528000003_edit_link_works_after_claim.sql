-- Block 14c: update_anon_project работает и на заклеймленных проектах,
-- не трогая expires_at для owned.
--
-- Контекст: после Block 14b claim больше не обнуляет edit_token, но
-- update_anon_project имел фильтр `owner_id IS NULL` — то есть запросы
-- от анон-визитёров на /p/<token> после claim падали с P0002. Фронт
-- тоже параноидально возвращал 410, как только видел owner_id (фикс
-- в этом же PR).
--
-- Меняем тело update_anon_project:
--   1. Снимаем фильтр `owner_id IS NULL` — пишем и в анон, и в owned.
--   2. expires_at conditional: для анона +30 дней от now(), для
--      owned остаётся NULL (бессрочно).
--   3. Возвращаем NULL для owned, чтобы клиент мог не показывать
--      countdown-баннер.
--
-- Аддитивное изменение, только тело RPC. Схема не трогается, iOS
-- не затрагивается.

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
  v_owner_id    uuid;
  v_new_expires timestamptz;
  v_name        text := nullif(trim(coalesce(p_name, '')), '');
begin
  -- Сначала читаем owner_id чтобы решить, нужен ли TTL refresh.
  select owner_id
  into v_owner_id
  from public.app_projects
  where edit_token = p_token
    and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'Проект не найден или просрочен'
      using errcode = 'P0002';
  end if;

  -- Анон-проекты получают +30 дней с каждой правкой; owned остаются
  -- бессрочными (expires_at = null).
  v_new_expires := case
    when v_owner_id is null then now() + interval '30 days'
    else null
  end;

  update public.app_projects
  set payload    = p_payload,
      name       = coalesce(v_name, name),
      expires_at = v_new_expires
  where edit_token = p_token;

  return v_new_expires;
end;
$$;
