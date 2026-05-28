import { ExpenseCalculator } from "@/components/expense-calculator";
import { AnonExpiredPage } from "@/components/anon-expired-page";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_PRIMARY_CURRENCY } from "@/lib/currencies";

type AnonProjectRow = {
  id: string;
  name: string;
  payload: unknown;
  primary_currency: string | null;
  secondary_currency: string | null;
  manual_rate: number | null;
  share_token: string | null;
  expires_at: string | null;
  owner_id: string | null;
  updated_at: string | null;
};

type PageProps = {
  params: Promise<{ token: string }>;
};

// /p/[token] — публичная страница анон-проекта (Block 14).
// Кто угодно с URL читает И редактирует. Auth не обязателен.
// Для авторизованного юзера сверху всплывает claim-баннер.
//
// Просроченные / несуществующие токены → 410 Gone-страница с CTA.
export default async function AnonProjectPage({ params }: PageProps) {
  const { token } = await params;

  if (!isLikelyUuid(token)) {
    return <AnonExpiredPage />;
  }

  const supabase = await createSupabaseServerClient();
  const { data: rows, error } = await supabase.rpc("get_anon_project", {
    p_token: token,
  });

  const project = Array.isArray(rows) ? (rows[0] as AnonProjectRow | undefined) : undefined;

  if (error || !project) {
    return <AnonExpiredPage />;
  }

  // Если проект уже заклеймлен (owner_id IS NOT NULL) — get_anon_project
  // его уже не вернёт, потому что update_anon_project NULL'ит edit_token
  // при claim. Но на всякий пожарный — обрабатываем.
  if (project.owner_id) {
    return <AnonExpiredPage />;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const initialPayload = (project.payload ?? {}) as Record<string, unknown>;

  // ExpenseCalculator already renders its own <main>. AnonClaimBanner is
  // rendered inside the calculator (when anonIsAuthenticated) so we don't
  // nest <main> elements.
  return (
    <ExpenseCalculator
      anonToken={token}
      anonExpiresAt={project.expires_at}
      anonIsAuthenticated={Boolean(user)}
      initialName={project.name}
      initialPayload={initialPayload as never}
      canEdit={true}
      primaryCurrency={project.primary_currency ?? DEFAULT_PRIMARY_CURRENCY}
      secondaryCurrency={project.secondary_currency}
      shareToken={project.share_token}
      currentRate={project.manual_rate}
    />
  );
}

function isLikelyUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s,
  );
}
