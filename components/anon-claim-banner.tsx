"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { claimAnonProject } from "@/app/app/projects/anon-actions";

/**
 * Баннер для авторизованного пользователя, открывшего анон-проект через
 * /p/<token>. Один клик — привязывает проект к его аккаунту.
 *
 * После claim (Block 14b — миграция 20260528000002):
 *   - owner_id ставится в auth.uid() → проект появляется в «Моих»
 *   - expires_at снимается → бессрочное хранение
 *   - юзер появляется в project_members как owner
 *   - edit_token СОХРАНЯЕТСЯ → исходная ссылка продолжает работать
 *     для всех, кому она была отправлена
 *   - редиректим в /app?project=<id>, дальше owner управляет
 *     ссылкой из настроек: rotate или disable в любой момент
 */
type Props = {
  token: string;
};

export function AnonClaimBanner({ token }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClaim() {
    setError(null);
    startTransition(async () => {
      try {
        const { id } = await claimAnonProject(token);
        router.push(`/app?project=${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не получилось");
      }
    });
  }

  return (
    <div className="mb-4 rounded-card border border-[#F8D4C5] bg-[#FCE9E1] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-white text-accent"
        >
          <Bookmark size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[1.02rem] font-bold text-ink leading-snug tracking-[-0.01em]">
            Сохранить в свои проекты?
          </p>
          <p className="text-[0.9rem] text-muted leading-snug mt-1">
            Этот расчёт сейчас живёт только пока кто-то его редактирует.
            Заберите его себе — он станет вашим проектом без срока жизни.
            Ссылка для других участников продолжит работать; отозвать
            доступ можно в любой момент в настройках проекта.
          </p>
          {error ? (
            <p className="mt-2 text-[0.85rem] font-semibold text-danger">
              {error}
            </p>
          ) : null}
          <div className="mt-3">
            <Button
              variant="primary"
              size="sm"
              onClick={handleClaim}
              disabled={isPending}
            >
              {isPending ? "Сохраняю…" : "Сохранить как мой проект"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
