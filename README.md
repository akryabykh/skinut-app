# Скинуться

Веб-приложение для разделения совместных расходов в поездках, общих покупках и встречах. Поддерживает мультивалютные проекты, категории трат, графики, экспорт отчётов и совместный доступ через приглашение или публичную ссылку.

- **Production:** [skinut-app.vercel.app](https://skinut-app.vercel.app/)
- **Кастомный домен:** [www.трип-мани.рф](https://www.xn----8sbwcshkgr.xn--p1ai/)

---

## Возможности

- Создание проектов с основной и опциональной дополнительной валютой (RUB, USD, EUR, TRY, GEL и др., всего 35+ кодов).
- Калькулятор расходов: люди, траты, плательщик, участники, автоматический расчёт минимальных переводов «кто кому сколько».
- Категории трат с цветными метками, фильтр и агрегация по категориям, donut-диаграмма.
- Мультивалюта: трата в валюте, конвертация в основную через [open.er-api.com](https://open.er-api.com), курс фиксируется на трате и не плывёт при изменении курсов.
- Редактирование сумм, категорий, валют у существующих трат.
- Графика: donut по категориям, bars «кто сколько оплатил», «стоимость для каждого».
- Совместная работа: приглашение участников по e-mail с ролями `owner` / `editor` / `viewer`, передача владения, выход из проекта.
- Публичная ссылка `/share/<token>` — итог расчёта без авторизации.
- Экспорт CSV (Excel/Google Sheets) и печатный отчёт `/app/projects/<id>/report` (Cmd/Ctrl+P → Save as PDF).
- PWA-манифест и service worker для добавления на homescreen.

---

## Стек

- **Next.js 15** (App Router) + **React 19** + **TypeScript**.
- **Tailwind CSS v3** + кастомные дизайн-токены в `app/globals.css`.
- **Supabase**: Postgres + Auth + Row-Level Security. `@supabase/ssr` для server/middleware-cookies.
- **Vercel** хостинг + Vercel Edge.
- Шрифты Inter Tight + JetBrains Mono через `next/font/google`.
- Курсы валют — публичный API [open.er-api.com](https://open.er-api.com), без ключа, с кэшем в Supabase-таблице `exchange_rates_cache`.

---

## Структура проекта

```
app/
  page.tsx              — лендинг
  layout.tsx            — корневой layout (шрифты, метаданные, PWA-регистрация)
  globals.css           — дизайн-токены и базовые стили
  auth/                 — sign-in/sign-up + server actions
  account/              — личный кабинет, удаление аккаунта
  app/
    page.tsx            — калькулятор (открывается с ?project=<id>)
    projects/
      page.tsx          — список проектов
      new/page.tsx      — форма создания проекта
      actions.ts        — server actions (create/save/delete/updateCurrencies, fetchCurrentRate)
      members-actions.ts, share-actions.ts — коллаборация и публичная ссылка
      [id]/
        page.tsx        — страница управления проектом
        project-management.tsx — клиентская часть (участники, share, валюты, экспорт, «Внимание»)
        report/page.tsx — печатный отчёт по проекту
  share/[token]/page.tsx — публичный итог без авторизации
components/
  brand.tsx             — word-mark «Скинуться.»
  expense-calculator.tsx — главный калькулятор
  ui/                   — Button, Input, Select, Card, Modal (useConfirm), Toast (useToast), CategoryDonut
lib/
  currencies.ts         — справочник валют + formatMoney
  categories.ts         — справочник категорий (eda, transport, lodging, …)
  exchange-rate.ts      — server-side fetch курсов через open.er-api.com + кэш
  split-calculator.ts   — чистые функции расчёта (toPrimary, calculateTransfers, …)
  database.types.ts     — типы Supabase (ручная синхронизация с миграциями)
  supabase/             — server/middleware client фабрики
supabase/
  schema.sql            — снимок схемы для документации
  migrations/           — SQL-миграции, применяются вручную через Supabase Dashboard
middleware.ts           — refresh Supabase-сессии
```

---

## Локальный запуск

```bash
npm install
npm run dev
```

Открыть http://127.0.0.1:3000.

### Команды

```bash
npm run dev    # dev-сервер с HMR
npm run lint   # ESLint
npm run build  # production-сборка (typecheck + bundle)
```

### Переменные окружения

`.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

В коде есть fallback на публичные значения (`lib/public-config.ts`), поэтому локальная сборка работает даже без `.env.local`. Для своего Supabase-проекта значения нужно прописать в Vercel Environment Variables.

---

## База данных

Все миграции лежат в `supabase/migrations/` и применяются вручную через Supabase Dashboard → SQL Editor перед мерджем PR с миграцией.

Таблицы:

- `profiles` — мирроринг `auth.users` (email, display_name).
- `app_projects` — проекты с `payload jsonb` (вся state-машина калькулятора), `primary_currency` / `secondary_currency`, `share_token`.
- `project_members` — связь project ↔ user с ролью owner/editor/viewer.
- `exchange_rates_cache` — кэш курсов base→target с TTL 12 ч.

Ключевые RPC:

- `create_app_project(name, primary, secondary)` — создание проекта (SECURITY DEFINER, обходит RLS-recursion).
- `get_public_project_summary(token)` — публичный read-only доступ по share-token.
- `transfer_project_ownership(project_id, to_user_id)` — атомарная передача владения.
- `upsert_exchange_rate(base, target, rate)` — запись в кэш.
- `find_user_id_by_email(email)`, `is_project_member(...)`, `has_project_role(...)`.

RLS включён на всех таблицах. Проекты видны только участникам, кэш курсов — read-public.

---

## Workflow

- `main` — production. Vercel автоматически деплоит на основной домен.
- `dev` — стейджинг. На каждый PR в `dev` Vercel создаёт preview.
- Feature-ветки: `feat/<feature>` → PR в `dev` → merge → preview QA → PR `dev → main` → release.
- Conventional commits (`feat:`, `fix:`, `chore:`, `feat(scope):`).
- CI прогоняет typecheck + lint + build на каждый PR через GitHub Actions (`.github/workflows/`).

### Применение миграций при релизе

Если PR в `dev` содержит SQL-миграцию — её **нужно применить вручную** в Supabase Dashboard до мерджа PR. CI не запускает миграции, поэтому без этого шага production упадёт на runtime.

```sql
-- Supabase Dashboard → SQL Editor → paste content of supabase/migrations/2026XXXX_xxx.sql → Run
```

---

## API курсов валют

Используется `https://open.er-api.com/v6/latest/<BASE>` (free, без ключа, обновление раз в сутки, поддерживает 161+ валюту включая RUB и все региональные коды). Реализация — `lib/exchange-rate.ts` с кэшем в Postgres-таблице `exchange_rates_cache` (TTL 12 ч). При недоступности upstream возвращается stale-cache, если он есть.

Сменили с frankfurter.app в Блоке 4, потому что frankfurter (на основе данных ECB) перестал публиковать курс RUB после 2022 года.

---

## Лицензия

Приватный проект. Все права защищены.
