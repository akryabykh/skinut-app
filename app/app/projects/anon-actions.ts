"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Тонкие обёртки вокруг RPC из миграции 20260528_anon_projects.sql.
// SECURITY DEFINER на стороне БД отвечает за реальную авторизацию;
// здесь — только нормализация ошибок + редиректы для UX.

/** Создаёт анонимный проект с дефолтными параметрами (RUB, без secondary)
 *  и редиректит на `/p/<edit_token>`. URL в адресной строке сразу
 *  shareable — точно как у конкурентов skolkoskinut.ru. */
export async function createAnonProject(): Promise<never> {
  const supabase = await createSupabaseServerClient();
  const { data: token, error } = await supabase.rpc("create_anon_project", {
    p_name: null,
    p_primary_currency: "RUB",
    p_secondary_currency: null,
  });
  if (error || !token) {
    throw new Error(error?.message ?? "Не удалось создать расчёт");
  }
  redirect(`/p/${token}`);
}

/** Пишет payload анон-проекта. Возвращает новый expires_at, чтобы клиент
 *  мог сразу обновить баннер «удалится через N дней». Если RPC бросает
 *  P0002 (проект заклеймлен / просрочен) — пробрасываем как обычную
 *  ошибку, клиент обработает (показав 410 или ре-фетчнув). */
export async function saveAnonProjectPayload(
  token: string,
  payload: unknown,
  name?: string,
): Promise<{ expiresAt: string }> {
  if (!token) throw new Error("Пустой token");
  const supabase = await createSupabaseServerClient();
  // Cast through unknown: payload arrives as the calculator's ProjectState
  // which is JSON-compatible at runtime but TS's Json union is narrower.
  const { data, error } = await supabase.rpc("update_anon_project", {
    p_token: token,
    p_payload: payload as never,
    p_name: name ?? null,
  });
  if (error) throw new Error(error.message);
  return { expiresAt: data as string };
}

/** Авторизованный юзер забирает анон в свою собственность. Возвращает
 *  новый project id; клиент после успеха редиректит на /app?project=<id>. */
export async function claimAnonProject(
  token: string,
): Promise<{ id: string }> {
  if (!token) throw new Error("Пустой token");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("claim_anon_project", {
    p_token: token,
  });
  if (error || !data) {
    throw new Error(error?.message ?? "Не удалось сохранить проект себе");
  }
  revalidatePath("/app/projects");
  return { id: data as string };
}
