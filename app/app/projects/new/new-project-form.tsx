"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createProject, fetchCurrentRate } from "../actions";
import {
  CURRENCIES,
  DEFAULT_PRIMARY_CURRENCY,
  getCurrency,
} from "@/lib/currencies";

/**
 * Клиентская форма создания проекта.
 *
 * Назначение клиентского компонента — Block 13: показать рыночный курс
 * secondary→primary прямо во время заполнения, чтобы пользователь знал,
 * с какого значения стартует manual_rate проекта, и понимал, что в
 * настройках его потом можно поменять.
 *
 * Сама отправка по-прежнему идёт в server action `createProject`,
 * который сам делает live-fetch и записывает manual_rate. Курс,
 * показанный здесь, — справочный (на момент рендера); реальный курс
 * стампится при сабмите формы (могут быть микро-расхождения, если
 * пользователь сидит на форме часами).
 */
export function NewProjectForm() {
  const [primary, setPrimary] = useState<string>(DEFAULT_PRIMARY_CURRENCY);
  const [secondary, setSecondary] = useState<string>("");

  const [marketRate, setMarketRate] = useState<number | null>(null);
  const [marketRateLoading, setMarketRateLoading] = useState(false);

  // Подгружаем рыночный курс secondary→primary при выборе или смене.
  // Best-effort: если API не ответил, прячем хинт целиком, не мешая
  // пользователю заполнить форму и создать проект.
  useEffect(() => {
    let cancelled = false;
    if (!secondary || !primary || secondary === primary) {
      setMarketRate(null);
      return;
    }
    setMarketRateLoading(true);
    fetchCurrentRate(secondary, primary)
      .then((rate) => {
        if (!cancelled) setMarketRate(rate);
      })
      .catch(() => {
        if (!cancelled) setMarketRate(null);
      })
      .finally(() => {
        if (!cancelled) setMarketRateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [secondary, primary]);

  const primaryInfo = getCurrency(primary);
  const secondaryInfo = secondary ? getCurrency(secondary) : null;

  const inverseFormatted =
    marketRate && marketRate > 0
      ? (1 / marketRate).toPrecision(4).replace(/\.?0+$/, "")
      : null;

  return (
    <form action={createProject} className="grid gap-4 mt-2">
      <label className="grid gap-1.5">
        <span className="text-[0.82rem] font-medium text-muted">Название</span>
        <Input
          name="name"
          type="text"
          required
          maxLength={120}
          placeholder="Тбилиси · март"
          autoComplete="off"
          autoFocus
        />
      </label>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="grid gap-1.5">
          <span className="text-[0.82rem] font-medium text-muted">
            Основная валюта
          </span>
          <Select
            name="primary"
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            required
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name_ru}
              </option>
            ))}
          </Select>
          <span className="text-[0.78rem] text-muted">
            В этой валюте отображаются итоги
          </span>
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.82rem] font-medium text-muted">
            Дополнительная валюта
          </span>
          <Select
            name="secondary"
            value={secondary}
            onChange={(e) => setSecondary(e.target.value)}
          >
            <option value="">— Не нужна</option>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name_ru}
              </option>
            ))}
          </Select>
          <span className="text-[0.78rem] text-muted">
            Сменить дополнительную валюту после создания нельзя
          </span>
        </label>
      </div>

      {/* Block 13: рыночный курс + подсказка про изменение в настройках.
          Показываем только когда secondary выбран и отличается от primary. */}
      {secondary && secondary !== primary ? (
        <div className="rounded-control border border-line bg-paper p-3.5 grid gap-1.5">
          <span className="text-[0.82rem] font-medium text-muted">
            Курс при создании проекта
          </span>
          <span className="text-[0.92rem] font-mono tabular-nums text-ink">
            {marketRateLoading ? (
              <span className="text-muted">загрузка…</span>
            ) : marketRate && inverseFormatted ? (
              <>
                1 {primaryInfo?.symbol ?? primary} ≈ {inverseFormatted}{" "}
                {secondaryInfo?.symbol ?? secondary}{" "}
                <span className="font-sans font-normal text-muted text-[0.78rem]">
                  (биржевой, по умолчанию)
                </span>
              </>
            ) : (
              <span className="text-muted">
                Рыночный курс сейчас недоступен — будет подставлен при
                первой возможности.
              </span>
            )}
          </span>
          <p className="text-[0.78rem] text-muted leading-snug mt-0.5">
            Курс будет зафиксирован при создании. Если фактические комиссии
            за конвертацию отличаются — поменяете курс в настройках
            проекта, и все траты пересчитаются автоматически.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button type="submit" variant="primary" size="cta">
          Создать проект
        </Button>
        <Link
          href="/app/projects"
          className="inline-flex items-center h-11 sm:h-10 px-3 text-[0.92rem] font-semibold text-muted hover:text-ink transition-colors"
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}
