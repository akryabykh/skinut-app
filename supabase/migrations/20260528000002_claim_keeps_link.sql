-- Block 14b: claim_anon_project НЕ обнуляет edit_token.
--
-- Контекст: исходный claim в миграции 20260528000001 при «забрать
-- проект себе» делал owner_id = auth.uid() И edit_token = NULL —
-- это рвало ссылку для всех, кому она была отправлена. В теории
-- хорошо как защита от «угона» чужого расчёта (никто кроме первого
-- claimer'а не сможет редактировать), на практике плохо для нормального
-- сценария: автор отправил ссылку друзьям, потом решил сохранить в
-- свой аккаунт — друзья внезапно получают 410.
--
-- Меняем поведение: claim только привязывает owner_id и снимает
-- expires_at (проект становится бессрочным). edit_token остаётся,
-- ссылка продолжает работать. Контроль у нового owner'а — в
-- настройках проекта есть «Сбросить ссылку» (rotate token) и
-- «Отключить» (полный disable), которые он может применить в любой
-- момент.
--
-- Аддитивное изменение: схема не трогается, только тело RPC.
-- iOS не затрагивается (ничего не читает через эту функцию).

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
      expires_at = null
      -- edit_token НЕ обнуляется намеренно (Block 14b). Owner может
      -- сбросить или отключить из настроек проекта позже.
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
