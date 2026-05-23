-- Block 12: avatar_url on profiles + smarter display_name fallback.
--
-- Google OAuth populates auth.users.raw_user_meta_data with these keys:
--   - "avatar_url" (some providers) / "picture" (Google)
--   - "full_name" or "name" (Google)
--   - "display_name" (we set this from our email/password sign-up form)
--
-- Before Block 12 the trigger only looked at "display_name", so users
-- who signed up via Google got the email-prefix as their display_name
-- and no avatar. This migration:
--   1. Adds profiles.avatar_url
--   2. Rewrites handle_new_user with a wider COALESCE chain
--   3. Backfills avatar_url for existing users who already have it in
--      their raw_user_meta_data (Google-OAuth signups).

alter table public.profiles
  add column if not exists avatar_url text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  );
  return new;
end;
$$;

-- Backfill existing rows where the trigger ran before the new logic.
update public.profiles p
set
  display_name = coalesce(
    p.display_name,
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ),
  avatar_url = coalesce(
    p.avatar_url,
    u.raw_user_meta_data->>'avatar_url',
    u.raw_user_meta_data->>'picture'
  )
from auth.users u
where p.id = u.id
  and (
    p.avatar_url is null
    or p.display_name is null
    or p.display_name = split_part(u.email, '@', 1)
  );
