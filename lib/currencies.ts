// Currency reference list for skinut-app (Block 4).
//
// Hardcoded subset of ISO 4217 — about ~30 high-traffic currencies that
// cover the user base's likely travel destinations + reserve / regional
// money. If you need to add more, the DB-level constraint only checks
// /^[A-Z]{3}$/, so this list can grow without a migration.
//
// `symbol` is what shows up next to the number in compact UI (e.g.
// chip on an expense row). `name_ru` is the full Russian name shown
// inside select options.

export type CurrencyCode =
  | "RUB"
  | "USD"
  | "EUR"
  | "GBP"
  | "TRY"
  | "GEL"
  | "AMD"
  | "KZT"
  | "AZN"
  | "BYN"
  | "UAH"
  | "AED"
  | "THB"
  | "VND"
  | "IDR"
  | "MYR"
  | "SGD"
  | "JPY"
  | "CNY"
  | "KRW"
  | "INR"
  | "HKD"
  | "AUD"
  | "NZD"
  | "CAD"
  | "CHF"
  | "NOK"
  | "SEK"
  | "DKK"
  | "PLN"
  | "CZK"
  | "HUF"
  | "RSD"
  | "ILS"
  | "EGP";

export type Currency = {
  code: CurrencyCode;
  /** Short symbol or ticker shown in compact UI (e.g. "₽", "$", "₺"). */
  symbol: string;
  /** Full Russian name for select options ("Российский рубль"). */
  name_ru: string;
  /** Used when Intl.NumberFormat needs a fallback display style. */
  display_decimals: number;
};

export const CURRENCIES: readonly Currency[] = [
  // Базовые
  { code: "RUB", symbol: "₽", name_ru: "Российский рубль", display_decimals: 2 },
  { code: "USD", symbol: "$", name_ru: "Доллар США", display_decimals: 2 },
  { code: "EUR", symbol: "€", name_ru: "Евро", display_decimals: 2 },
  { code: "GBP", symbol: "£", name_ru: "Британский фунт", display_decimals: 2 },

  // СНГ / соседи
  { code: "TRY", symbol: "₺", name_ru: "Турецкая лира", display_decimals: 2 },
  { code: "GEL", symbol: "₾", name_ru: "Грузинский лари", display_decimals: 2 },
  { code: "AMD", symbol: "֏", name_ru: "Армянский драм", display_decimals: 0 },
  { code: "KZT", symbol: "₸", name_ru: "Казахстанский тенге", display_decimals: 0 },
  { code: "AZN", symbol: "₼", name_ru: "Азербайджанский манат", display_decimals: 2 },
  { code: "BYN", symbol: "Br", name_ru: "Белорусский рубль", display_decimals: 2 },
  { code: "UAH", symbol: "₴", name_ru: "Украинская гривна", display_decimals: 2 },

  // Юго-Восточная Азия / Ближний Восток
  { code: "AED", symbol: "د.إ", name_ru: "Дирхам ОАЭ", display_decimals: 2 },
  { code: "THB", symbol: "฿", name_ru: "Тайский бат", display_decimals: 2 },
  { code: "VND", symbol: "₫", name_ru: "Вьетнамский донг", display_decimals: 0 },
  { code: "IDR", symbol: "Rp", name_ru: "Индонезийская рупия", display_decimals: 0 },
  { code: "MYR", symbol: "RM", name_ru: "Малайзийский ринггит", display_decimals: 2 },
  { code: "SGD", symbol: "S$", name_ru: "Сингапурский доллар", display_decimals: 2 },
  { code: "JPY", symbol: "¥", name_ru: "Японская иена", display_decimals: 0 },
  { code: "CNY", symbol: "¥", name_ru: "Китайский юань", display_decimals: 2 },
  { code: "KRW", symbol: "₩", name_ru: "Южнокорейская вона", display_decimals: 0 },
  { code: "INR", symbol: "₹", name_ru: "Индийская рупия", display_decimals: 2 },
  { code: "HKD", symbol: "HK$", name_ru: "Гонконгский доллар", display_decimals: 2 },

  // Океания / Северная Америка
  { code: "AUD", symbol: "A$", name_ru: "Австралийский доллар", display_decimals: 2 },
  { code: "NZD", symbol: "NZ$", name_ru: "Новозеландский доллар", display_decimals: 2 },
  { code: "CAD", symbol: "C$", name_ru: "Канадский доллар", display_decimals: 2 },

  // Европа (нон-EUR)
  { code: "CHF", symbol: "CHF", name_ru: "Швейцарский франк", display_decimals: 2 },
  { code: "NOK", symbol: "kr", name_ru: "Норвежская крона", display_decimals: 2 },
  { code: "SEK", symbol: "kr", name_ru: "Шведская крона", display_decimals: 2 },
  { code: "DKK", symbol: "kr", name_ru: "Датская крона", display_decimals: 2 },
  { code: "PLN", symbol: "zł", name_ru: "Польский злотый", display_decimals: 2 },
  { code: "CZK", symbol: "Kč", name_ru: "Чешская крона", display_decimals: 2 },
  { code: "HUF", symbol: "Ft", name_ru: "Венгерский форинт", display_decimals: 0 },
  { code: "RSD", symbol: "дин.", name_ru: "Сербский динар", display_decimals: 0 },

  // Прочие популярные
  { code: "ILS", symbol: "₪", name_ru: "Израильский шекель", display_decimals: 2 },
  { code: "EGP", symbol: "E£", name_ru: "Египетский фунт", display_decimals: 2 },
] as const;

const CURRENCY_BY_CODE: Record<string, Currency> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c]),
);

const VALID_CODES: ReadonlySet<string> = new Set(CURRENCIES.map((c) => c.code));

/** Returns true if `code` is one of the supported ISO-4217 codes. */
export function isCurrencyCode(code: unknown): code is CurrencyCode {
  return typeof code === "string" && VALID_CODES.has(code);
}

/** Lookup currency metadata by code. Returns null when unknown. */
export function getCurrency(code: string): Currency | null {
  return CURRENCY_BY_CODE[code] ?? null;
}

/**
 * Format a number as money for display.
 *
 * Uses Intl.NumberFormat with the proper currency code. Falls back to a
 * plain "<num> <symbol>" rendering for codes Intl doesn't recognise.
 *
 *   formatMoney(1240, "RUB")  // "1 240 ₽"
 *   formatMoney(2500, "TRY")  // "2 500 ₺" (or "2 500,00 ₺" depending on Intl)
 *   formatMoney(70000, "RUB", { compact: true })  // "70 000 ₽"
 */
export function formatMoney(
  amount: number,
  code: string,
  opts: { compact?: boolean } = {},
): string {
  if (!Number.isFinite(amount)) return "—";

  const currency = getCurrency(code);
  const decimals = currency?.display_decimals ?? 2;
  const fallbackSymbol = currency?.symbol ?? code;

  // Round to the currency's natural decimal places, but trim trailing
  // ",00" for cleaner display when `compact` is on.
  try {
    const formatter = new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: code,
      maximumFractionDigits: decimals,
      minimumFractionDigits: opts.compact ? 0 : Math.min(decimals, 2),
    });
    let formatted = formatter.format(amount);
    if (opts.compact) {
      formatted = formatted.replace(/[,.]00(?=\D|$)/, "");
    }
    return formatted;
  } catch {
    // Intl threw — code not recognised by the runtime. Fallback.
    const num = new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: decimals,
      minimumFractionDigits: opts.compact ? 0 : Math.min(decimals, 2),
    }).format(amount);
    return `${num} ${fallbackSymbol}`;
  }
}

/** Suggested default for new projects when the user hasn't picked one. */
export const DEFAULT_PRIMARY_CURRENCY: CurrencyCode = "RUB";
