"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  clearGuestState,
  countGuestData,
  hasGuestData,
  readGuestState,
} from "@/lib/guest-storage";
import { importGuestProject } from "@/app/app/projects/actions";
import { Button } from "@/components/ui/button";

/**
 * Banner shown on /app/projects when the user has a non-empty guest state
 * sitting in localStorage. Lets them either:
 *  - import it as a new project (creates row + saves payload), or
 *  - discard the local state.
 *
 * Renders nothing if there's no guest data. SSR-safe (returns null on
 * first server render; useEffect populates on mount).
 */
export function GuestImportBanner() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState<{ people: number; expenses: number }>({
    people: 0,
    expenses: 0,
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasGuestData()) {
      setStats(countGuestData());
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function handleImport() {
    setError(null);
    startTransition(async () => {
      try {
        const state = readGuestState();
        if (!state) {
          setVisible(false);
          return;
        }
        const result = await importGuestProject(state);
        clearGuestState();
        router.push(`/app?project=${result.id}`);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Не удалось сохранить локальный расчёт",
        );
      }
    });
  }

  function handleDiscard() {
    clearGuestState();
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Локальный расчёт"
      className="mb-4 rounded-card border border-[#F8D4C5] bg-[#FCE9E1] p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-white text-accent"
        >
          {/* Tray-with-arrow glyph (inline SVG to avoid icon-name churn) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 14h6l2 3h2l2-3h6" />
            <path d="M5 14V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8" />
            <path d="M12 4v8m0 0l-3-3m3 3l3-3" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[1.02rem] font-bold text-ink leading-snug tracking-[-0.01em]">
            У вас есть локальный расчёт
          </p>
          <p className="text-[0.9rem] text-muted leading-snug mt-1">
            Пока вы пользовались калькулятором без регистрации, мы сохранили{" "}
            <strong className="text-ink font-semibold">
              {stats.people}{" "}
              {pluralPeople(stats.people)}
            </strong>{" "}
            и{" "}
            <strong className="text-ink font-semibold">
              {stats.expenses}{" "}
              {pluralExpenses(stats.expenses)}
            </strong>{" "}
            на этом устройстве. Перенести в облако?
          </p>
          {error ? (
            <p className="mt-2 text-[0.85rem] font-semibold text-danger">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleImport}
              disabled={isPending}
            >
              {isPending ? "Сохраняю…" : "Сохранить как проект"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDiscard}
              disabled={isPending}
            >
              Не сохранять
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDiscard}
          disabled={isPending}
          aria-label="Закрыть"
          className="shrink-0 -mt-1 -mr-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-white hover:text-ink transition-colors disabled:opacity-50"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// Quick ru-RU pluralizers — duplicated from app/app/projects/page.tsx
// (small enough that DRY-extracting them is more friction than payoff).
function pluralPeople(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "человека";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return "человек";
  return "человек";
}

function pluralExpenses(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "трату";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return "траты";
  return "трат";
}
