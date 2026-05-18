## Что изменилось

<!-- 1-3 предложения о цели этого PR. -->

## Как проверить

- [ ] Локально `npm run build` проходит без ошибок
- [ ] CI зелёный (typecheck + lint + build на GitHub Actions)
- [ ] Если есть миграции — SQL приложен в PR и применён в Supabase Dashboard
- [ ] Если меняли auth — проверено: signup, signin, signout, /account
- [ ] Если затронут UI — приложен скриншот ниже

## Чек-лист

- [ ] Коммиты осмысленные, в формате [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, …)
- [ ] Нет hardcoded секретов или приватных ключей
- [ ] Если добавлены новые ENV — обновлён `.env.example` и они заведены в Vercel

## Скриншоты / ссылки

<!-- Preview URL от Vercel, скриншоты UI, ссылки на связанные тикеты. -->
