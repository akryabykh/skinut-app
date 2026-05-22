// Exchange-rate fetcher with Postgres-backed cache.
//
// Source: open.er-api.com — free, no API key, daily-refreshed rates from
// exchangerate-api.com's open endpoint. Crucially, it supports RUB and all
// the regional currencies in lib/currencies.ts (GEL, AMD, KZT, AZN, BYN,
// UAH, AED, VND, EGP, etc.) — unlike frankfurter.app which uses ECB data
// and dropped RUB after 2022 sanctions.
//
// Cache policy:
//   - exchange_rates_cache (base, target, rate, fetched_at) is consulted first
//   - if a row exists AND is fresher than STALE_AFTER_MS, return its rate
//   - otherwise fetch from upstream, upsert via upsert_exchange_rate RPC,
//     return the new rate
//   - if upstream is down, return the stale cached rate (with a warning)
//
// Why server-only: the calculator must not trust a rate coming from the
// browser when computing canonical settlements. The client requests
// "save this expense in TRY" — the server decides what TRY→primary
// multiplier to record on it.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCurrencyCode } from "@/lib/currencies";

const OPEN_ER_API_BASE = "https://open.er-api.com/v6/latest";

// Treat cached rate as fresh for 12 hours. The upstream refreshes once
// a day on the free tier — anything fresher within the same day gives
// identical numbers anyway.
const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

export type RateResult = {
  /** Multiplier: 1 unit of `base` × rate = amount in `target`. */
  rate: number;
  /** "live" — just hit the upstream API. "cache" — read from cache. */
  source: "live" | "cache";
  /** Present when source = "cache". */
  cached_at?: string;
};

/**
 * Resolve `base → target` exchange rate. Trivial case (same code) returns 1.
 *
 * Throws when the upstream is down AND no cached row exists at all.
 * Callers should treat that as "user must retry later".
 */
export async function getExchangeRate(
  base: string,
  target: string,
): Promise<RateResult> {
  const baseCode = base?.toUpperCase();
  const targetCode = target?.toUpperCase();

  if (!isCurrencyCode(baseCode) || !isCurrencyCode(targetCode)) {
    throw new Error(`Invalid currency code(s): ${base}, ${target}`);
  }
  if (baseCode === targetCode) {
    return { rate: 1, source: "live" };
  }

  const supabase = await createSupabaseServerClient();

  // 1. Try cache.
  const { data: cached, error: cacheError } = await supabase
    .from("exchange_rates_cache")
    .select("rate, fetched_at")
    .eq("base", baseCode)
    .eq("target", targetCode)
    .maybeSingle();

  if (cacheError) {
    console.warn("[exchange-rate] cache read failed", cacheError);
  }

  const cachedRate = cached ? Number(cached.rate) : null;
  const cachedAt = cached ? new Date(cached.fetched_at).getTime() : 0;
  const isFresh =
    cachedRate !== null &&
    Number.isFinite(cachedRate) &&
    cachedRate > 0 &&
    Date.now() - cachedAt < STALE_AFTER_MS;

  if (isFresh && cachedRate !== null) {
    return {
      rate: cachedRate,
      source: "cache",
      cached_at: cached!.fetched_at as string,
    };
  }

  // 2. Stale or missing — fetch live.
  try {
    const liveRate = await fetchOpenErApiRate(baseCode, targetCode);

    // 3. Persist (best-effort — don't fail the user's save if this errors).
    const { error: upsertError } = await supabase.rpc("upsert_exchange_rate", {
      p_base: baseCode,
      p_target: targetCode,
      p_rate: liveRate,
    });
    if (upsertError) {
      console.warn("[exchange-rate] cache write failed", upsertError);
    }

    return { rate: liveRate, source: "live" };
  } catch (err) {
    // Upstream is down. Serve stale cache if we have any.
    console.error(
      `[exchange-rate] getExchangeRate failed for ${baseCode}→${targetCode}`,
      err,
    );
    if (cachedRate !== null && Number.isFinite(cachedRate) && cachedRate > 0) {
      console.warn(
        `[exchange-rate] upstream down, returning stale cache for ${baseCode}→${targetCode}`,
      );
      return {
        rate: cachedRate,
        source: "cache",
        cached_at: cached!.fetched_at as string,
      };
    }
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Не удалось получить курс ${baseCode} → ${targetCode}: ${reason}`,
    );
  }
}

/**
 * Hit open.er-api.com and parse out the target rate.
 *
 * Endpoint: /v6/latest/<BASE>
 * Response (truncated):
 *   {
 *     "result": "success",
 *     "base_code": "TRY",
 *     "rates": { "USD": 0.029, "RUB": 2.45, ... }
 *   }
 * 404 / "error-type" responses indicate the base currency is not supported.
 *
 * Up to 2 attempts with a short pause — covers transient 5xx / cold-edge
 * timeouts. 15s timeout stays well under Vercel's default function limit.
 */
async function fetchOpenErApiRate(
  base: string,
  target: string,
): Promise<number> {
  const url = `${OPEN_ER_API_BASE}/${encodeURIComponent(base)}`;

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `open.er-api.com responded ${response.status} for base ${base}`,
        );
      }

      const body = (await response.json()) as {
        result?: string;
        "error-type"?: string;
        rates?: Record<string, number>;
      };

      if (body.result !== "success") {
        throw new Error(
          `open.er-api.com returned non-success for base ${base}: ${
            body["error-type"] ?? "unknown"
          }`,
        );
      }

      const rate = body.rates?.[target];
      if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
        throw new Error(
          `open.er-api.com has no valid ${base}→${target} rate (rates: ${Object.keys(
            body.rates ?? {},
          )
            .slice(0, 10)
            .join(", ")}…)`,
        );
      }

      return rate;
    } catch (err) {
      lastError = err;
      console.error(
        `[exchange-rate] open.er-api attempt ${attempt}/2 failed for ${base}→${target}`,
        err,
      );
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`open.er-api.com failed for ${base}→${target}`);
}
