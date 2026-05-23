// Expense category reference (Block 6).
//
// Hardcoded list — 7 high-level categories that cover typical
// trip-money scenarios. The category lives inside the expense JSONB
// payload, so adding a new entry doesn't require a DB migration.

export type CategoryId =
  | "food"
  | "transport"
  | "lodging"
  | "leisure"
  | "shopping"
  | "services"
  | "other";

export type Category = {
  id: CategoryId;
  /** Russian display name for the picker / chip. */
  name_ru: string;
  /** Single-codepoint emoji prefix on chips & options. */
  emoji: string;
  /** Tailwind-arbitrary background color for the chip (light, low-saturation). */
  bg: string;
  /** Tailwind-arbitrary text color for the chip (darker complementary). */
  fg: string;
};

export const CATEGORIES: readonly Category[] = [
  {
    id: "food",
    name_ru: "Еда",
    emoji: "🍔",
    bg: "#FCE9E1",
    fg: "#A13A14",
  },
  {
    id: "transport",
    name_ru: "Транспорт",
    emoji: "🚕",
    bg: "#E3EEFD",
    fg: "#1E4D8C",
  },
  {
    id: "lodging",
    name_ru: "Жильё",
    emoji: "🏨",
    bg: "#ECE3FD",
    fg: "#5B3FAE",
  },
  {
    id: "leisure",
    name_ru: "Развлечения",
    emoji: "🎉",
    bg: "#FDF3D6",
    fg: "#8C6A11",
  },
  {
    id: "shopping",
    name_ru: "Покупки",
    emoji: "🛍",
    bg: "#FDE3EE",
    fg: "#9C2C66",
  },
  {
    id: "services",
    name_ru: "Услуги",
    emoji: "🛠️",
    bg: "#E1F4E6",
    fg: "#1F6B33",
  },
  {
    id: "other",
    name_ru: "Прочее",
    emoji: "📌",
    bg: "#F4F4F1",
    fg: "#52525B",
  },
] as const;

const CATEGORY_BY_ID: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
);

const VALID_IDS: ReadonlySet<string> = new Set(CATEGORIES.map((c) => c.id));

export const DEFAULT_CATEGORY: CategoryId = "other";

/** Type-guard for an unknown value. */
export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && VALID_IDS.has(value);
}

/**
 * Lookup category metadata by id. Falls back to "other" for unknown/missing
 * ids so legacy expenses without a category still render predictably.
 */
export function getCategory(id: string | undefined | null): Category {
  if (id && CATEGORY_BY_ID[id]) return CATEGORY_BY_ID[id];
  return CATEGORY_BY_ID[DEFAULT_CATEGORY];
}
