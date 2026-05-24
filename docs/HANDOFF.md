# Handoff — Скинуться

Документ для следующего сеанса разработки (новый чат с Claude или другой ассистент). Цель — за 5 минут восстановить контекст: что готово, что не трогать, что в плане, по каким правилам мы работаем.

---

## TL;DR

Production-ready MVP веб-приложения для разделения совместных расходов с мультивалютой по «общему курсу проекта». Стек: Next.js 15 App Router + Supabase + Tailwind, деплой на Vercel (`main` → prod, `dev` → preview). 13 функциональных блоков отгружены в prod. Кодовая база чистая (lint зелёный, typecheck без ошибок), один технический долг описан ниже.

**Prod:** [skinut-app.vercel.app](https://skinut-app.vercel.app/) · [www.трип-мани.рф](https://www.xn----8sbwcshkgr.xn--p1ai/)
**Repo:** https://github.com/akryabykh/skinut-app
**Supabase:** Dashboard у владельца (`akryabykh`); схема — `supabase/migrations/*.sql`, актуальный снимок — `supabase/schema.sql`.

---

## Что сделано (по блокам)

| # | Блок | Артефакты |
|---|---|---|
| 1 | Дизайн-токены + лендинг | `app/globals.css`, `app/page.tsx`, шрифты Inter Tight + JetBrains Mono |
| 2 | UI-kit | `components/ui/{button,input,select,card}.tsx` |
| 3 | Калькулятор, проекты, RLS | `app_projects`, `project_members`, RPC `create_app_project`, share_token |
| 4 | Мультивалюта | `lib/currencies.ts`, `lib/exchange-rate.ts`, open.er-api.com, кэш в `exchange_rates_cache` |
| 5 | Редактирование валют проекта | `updateProjectCurrencies` action + UI в `project-management.tsx` |
| 6 | Категории трат | `lib/categories.ts`, donut, фильтр, агрегация |
| 7 | Графика | `components/ui/category-donut.tsx`, bars «кто сколько» |
| 8 | Экспорт | CSV (UTF-8 BOM) + печатный отчёт `/app/projects/<id>/report` |
| 9 | (пропущен — отменён) | email-уведомления не делали |
| 10 | Edit трат inline | inline-режим формы в калькуляторе |
| 11 | Google OAuth + persistent session | `signInWithOAuth` client-side, callback → `/app/projects` |
| 12 | Account/AppHeader/polish | `avatar_url`, `<AppHeader>`, UserMenu, share одной кнопкой, delete на карточке проекта, sync-indicator, save-as-PDF в отчёте |
| 13 | Manual rate + пересчёт | `app_projects.manual_rate`, фиксация курса при создании, ретроактивный пересчёт при изменении в настройках, рыночный курс на форме создания |

Полная история — `git log --oneline origin/main`.

---

## Не трогать без сильной причины (правила, нажитые опытом)

- **RLS-политики, server actions, миграции** — стабильны и завязаны на прод-данные. При UI-редизайне правится **только** разметка + CSS-токены, бизнес-логика не страдает.
- **Курс на старых тратах**. Для проектов, где `manual_rate` уже зафиксирован, `enrichPayloadCurrencies` стампит `exchange_rate_used` ровно из проектного курса. Если ввести опцию «сохранить старый курс» — придётся переделывать `updateProjectCurrencies` (сейчас он ретроактивно переписывает все траты в secondary при смене курса в настройках).
- **`payload` jsonb** хранит весь state калькулятора (people, expenses, projectName, expenseSort). Менять формат нужно осторожно — миграция данных через JSONB-операторы, а не через расширение типов TS.
- **Миграции применять до мерджа PR**. CI миграции не запускает, поэтому SQL надо вручную руками копировать в Supabase Dashboard SQL Editor **до** того, как смерджишь PR в `dev`/`main`. Без этого прод упадёт на runtime (был кейс с `profiles.avatar_url`).

---

## Принципы коммитов и веток

- Conventional commits: `feat(scope):`, `fix(scope):`, `chore:`, `refactor:`, `perf:`, `docs:`.
- Ветки: `feat/<feature>`, `fix/<thing>`, `chore/<task>` — всегда от свежего `origin/dev`, никогда напрямую от `main`.
- PR `feat → dev` → preview QA → PR `dev → main` → релиз.
- Hotfix: `fix/<thing>` от `origin/dev` (не от main — иначе разъедутся истории). Если совсем уж пожар — `fix/hotfix-prod` от `main` с явным `cherry-pick` обратно в dev.
- В описании PR с миграцией — всегда плашка `⚠️ APPLY MIGRATION FIRST` + сам SQL для копи-паста.

---

## Workflow пользователя

- Пользователь работает в **GitHub Desktop + Cursor + Supabase Dashboard**, общается на русском.
- Кодит на Mac, push идёт через GitHub Desktop (или Terminal с PAT в keychain).
- **Ждёт явного `готов`** перед стартом большого блока — Claude должен сначала описать план и риски, потом ждать подтверждения.
- Любит, когда после блока есть **«что войдёт в следующий блок»** — даёт ему контекст для решения «делать или нет».

---

## Технические долги

1. **`lib/public-config.ts` fallback на хардкод Supabase URL/anon key.** Прокомментировано `TODO(env)`. Причина — на Vercel build-time env могут быть не подсосаны, и страница падала. Лучше переделать через `process.env.NEXT_PUBLIC_*` с явным throw + Vercel env vars, когда будет настроение разбираться с CI.
2. **Лимит `TaskCreate`/`TaskList`** для пользователя — задач набралось 90 шт., интерфейс начинает гудеть. На новой сессии можно «архивировать» (удалять) старые таски в начале.
3. **Punycode-домен** `xn----8sbwcshkgr.xn--p1ai` показывается в адресной строке Chrome. Решается либо переходом на `.ru` / `.com`, либо принятием как есть.
4. **Mock localStorage в guest-режиме** калькулятора. При первой регистрации трат гостя не переносятся в новый проект — пользователь теряет данные. Лучше добавить «Сохранить как проект» при сайн-апе из гостевого режима.
5. **Отзыв старых PAT.** В Terminal-истории пользователя однажды светанулся токен (он его, по идее, отозвал). Стоит периодически чистить https://github.com/settings/tokens.

---

## План следующих блоков (предложения)

Не строгий roadmap, а заметки «куда логично двигаться, если не знаешь чем заняться»:

1. **История курса на трате.** В калькуляторе под суммой каждой траты в secondary показать «по курсу 1 ₽ = X ₺» — мелким шрифтом. В отчёте и `/share/[token]` — тоже. Снимает вопрос «а почему такая сумма».
2. **Распределение по членам в калькуляторе.** Сейчас «кто сколько потратил» в bars; добавить «кто кому сколько остался должен» как табличку прямо в калькуляторе, не только в отчёте.
3. **Мобильное приложение.** Очередь: PWA → TWA для Android (можно за пару дней) → Capacitor → React Native. Текущий PWA уже работает, но Add to Home Screen на iOS Safari — отдельная история.
4. **Распознавание чеков.** OCR через какой-нибудь Yandex Vision / Tesseract.js — фичу часто просят пользователи трип-калькуляторов. Сложная, но «маркетинговая».
5. **Повторяющиеся расходы.** Для use-case «снимаем квартиру вскладчину» — фича есть у Splitwise, у нас нет.
6. **Telegram-уведомления.** Дешёвая альтернатива email-нотификациям. Привязка через `/start <token>` к проекту, бот пишет «Ты должен X пользователю Y».
7. **Перенос гостевого `localStorage` в проект** при сайн-апе (см. техдолг #4).

---

## Ключевые файлы для быстрой ориентации

- `app/app/page.tsx` — точка входа в калькулятор; читает project + manual_rate, гонит lazy backfill для legacy.
- `app/app/projects/actions.ts` — все server actions (create, save, delete, currencies, fetch rate).
- `app/app/projects/[id]/project-management.tsx` — настройки проекта (валюты, курс, участники, share, danger zone).
- `components/expense-calculator.tsx` — главный калькулятор (~1400 строк, единственный «толстый» файл).
- `lib/exchange-rate.ts` — server-side fetch курсов open.er-api.com + кэш Supabase.
- `lib/split-calculator.ts` — чистые функции расчёта переводов («кто кому сколько»).
- `supabase/migrations/2026*.sql` — порядок применения по дате в имени файла.

---

## Где смотреть прод

- **Vercel:** https://vercel.com/akryabykh (deployment status, env vars, build logs).
- **Supabase:** Dashboard → проект `skinut-app` (Auth, SQL Editor для миграций, Table Editor).
- **GitHub Actions:** в репозитории → Actions → typecheck/lint/build на PR.

---

## Если совсем потерялся

Прочитай в этом порядке:
1. Этот файл (HANDOFF.md) — общий контекст.
2. `README.md` — как запустить, стек, структура.
3. `git log --oneline -30 origin/main` — последние блоки.
4. `supabase/migrations/` (по дате) — эволюция схемы.
5. `app/app/page.tsx` + `app/app/projects/actions.ts` — основной слой бизнес-логики.

Дальше задавай вопросы пользователю по конкретным фичам — он в курсе всего.
