// Exchange-rate fetcher with Postgres-backed cache.
//
// Source: frankfurter.app — free, no API key, ECB-based rates that refresh
// once a day around 16:00 CET. That's plenty for bill-splitting in the
// trip-money context: when you record a 6 850 ₺ dinner the same evening,
// using yesterday's rate vs today's rate moves the rubble number by
// fractions of a percent at most.
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

const FRANKFURTER_BASE = "https://api.frankfurter.app";

// Treat cached rate as fresh for 6 hours. Frankfurter refreshes once
// per business day; refreshing more often inside the same day is wasted
// traffic and gives identical numbers.
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

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
    const liveRate = await fetchFrankfurterRate(baseCode, targetCode);

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
    if (cachedRate !== null && Number.isFinite(cachedRate) && cachedRate > 0) {
      console.warn(
        `[exchange-rate] upstream down, returning stale cache for ${baseCode}→${targetCode}`,
        err,
      );
      return {
        rate: cachedRate,
        source: "cache",
        cached_at: cached!.fetched_at as string,
      };
    }
    throw new Error(
      `Не удалось получить курс ${baseCode} → ${targetCode}. ` +
        `Сервис курсов недоступен и кэш пуст. Попробуйте позже.`,
    );
  }
}

/**
 * Hit frankfurter.app and parse out the single rate.
 *
 * Endpoint: /latest?from=BASE&to=TARGET
 * Response: { amount: 1, base: "TRY", date: "2026-05-22", rates: { RUB: 2.45 } }
 */
async function fetchFrankfurterRate(
  base: string,
  target: string,
): Promise<number> {
  const url = `${FRANKFURTER_BASE}/latest?from=${encodeURIComponent(
    base,
  )}&to=${encodeURIComponent(target)}`;

  const response = await fetch(url, {
    // Node fetch — small timeout via AbortSignal to keep server actions snappy.
    signal: AbortSignal.timeout(7000),
    // Frankfurter doesn't need auth.
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Frankfurter responded ${response.status} for ${base}→${target}`,
    );
  }

  const body = (await response.json()) as {
    rates?: Record<string, number>;
  };

  const rate = body.rates?.[target];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(
      `Frankfurter returned no valid rate for ${base}→${target}: ${JSON.stringify(
        body,
      )}`,
    );
  }

  return rate;
}
