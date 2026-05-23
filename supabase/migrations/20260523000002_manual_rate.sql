-- Block 12 polish: optional manual override of the secondary→primary
-- exchange rate on a per-project basis.
--
-- Use case: in a trip, every participant pays a different conversion
-- fee on their card (1%, 3%, 5%...). The market rate from open.er-api
-- gives a clean number that doesn't reflect what people actually paid
-- in rubles. With this column the owner can set a single "наш курс"
-- on the project (e.g. 1 RUB = 0.40 TRY → rate(TRY→RUB) = 2.50) and
-- all newly saved TRY expenses get stamped with that rate instead of
-- the live one.
--
-- Storage convention: this column holds rate(secondary → primary) —
-- the same direction we already stamp on `expense.exchange_rate_used`,
-- so server-side enrichment in saveProjectPayload can substitute it
-- directly without any direction-flipping.
--
-- The UI shows it as "1 primary = X secondary" (inverse) for human
-- readability — that conversion is done in components, not in the DB.
--
-- Safe to re-run.

alter table public.app_projects
  add column if not exists manual_rate numeric(20, 10);

alter table public.app_projects
  drop constraint if exists app_projects_manual_rate_positive;

alter table public.app_projects
  add constraint app_projects_manual_rate_positive
    check (manual_rate is null or manual_rate > 0);
