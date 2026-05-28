"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

/**
 * Постоянный баннер в шапке анонимного калькулятора. Показывает
 * обратный отсчёт «удалится через N дней» от expires_at и зовёт
 * зарегистрироваться, чтобы сохранить навсегда.
 *
 * Не dismissible — это важная информация про долговечность, не nag.
 *
 * Обновляет отсчёт раз в минуту (тик), потому что expires_at прыгает
 * после каждого save (родитель передаёт свежее значение через prop).
 */
type Props = {
  expiresAt: string | null;
  isAuthenticated: boolean;
};

export function AnonExpiryBanner({ expiresAt, isAuthenticated }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!expiresAt) return null;

  const expiresMs = new Date(expiresAt).getTime();
  const diff = expiresMs - now;
  const days = Math.max(0, Math.floor(diff / 86_400_000));
  const hours = Math.max(0, Math.floor((diff % 86_400_000) / 3_600_000));

  const countdown =
    days > 0
      ? `${days} ${pluralDays(days)}`
      : hours > 0
        ? `${hours} ${pluralHours(hours)}`
        : "меньше часа";

  return (
    <div
      role="region"
      aria-label="Срок жизни локального расчёта"
      className="mb-3 rounded-card border border-line bg-white px-4 py-3 flex items-start gap-3"
    >
      <span
        aria-hidden="true"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-dark"
      >
        <Clock size={14} />
      </span>
      <div className="min-w-0 flex-1 text-[0.9rem] leading-snug">
        <p className="text-ink">
          <span className="font-semibold">Расчёт без аккаунта.</span>{" "}
          <span className="text-muted">
            Удалится через <span className="font-semibold text-ink">{countdown}</span>{" "}
            без правок. Каждая новая правка продлевает на 30 дней.
          </span>
        </p>
        {!isAuthenticated ? (
          <p className="mt-1 text-[0.86rem]">
            <Link
              href="/auth/sign-up"
              className="font-semibold text-accent hover:text-accent-dark underline-offset-2 hover:underline"
            >
              Зарегистрируйтесь
            </Link>
            <span className="text-muted">
              {" "}
              — расчёт сохранится навсегда, появится в «Моих проектах».
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

function pluralHours(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "час";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "часа";
  return "часов";
}
