export type Person = {
  id: string;
  name: string;
};

export type Expense = {
  id: string;
  name: string;
  amount: number;
  payerId: string;
  participantIds: string[];
  createdAt?: string;
  /**
   * ISO 4217 currency code the expense was paid in. Optional for backwards
   * compatibility with pre-Block-4 records — when missing, the expense is
   * treated as denominated in the project's primary currency.
   */
  currency?: string;
  /**
   * Multiplier captured at the moment the expense was saved.
   * To convert the expense's amount into the project's primary currency:
   *
   *     primary_amount = expense.amount * expense.exchange_rate_used
   *
   * When undefined (legacy record or expense already in primary currency),
   * a multiplier of 1 is assumed and `amount` is treated as primary directly.
   */
  exchange_rate_used?: number;
  /**
   * Category id from lib/categories.ts (Block 6). Optional for backwards
   * compatibility — missing/unknown ids fall back to "other" in the UI
   * via getCategory().
   */
  category?: string;
  /**
   * Optional weighted split: maps participant id → number of shares.
   * When present, the expense is divided proportionally to shares
   * (sum of weights → 100%). When absent or empty, the split is equal
   * across `participantIds` — the historical behaviour.
   *
   * Persisted inside the project's `payload jsonb`. Additive change:
   * older clients (including iOS) that don't know about `shares` will
   * still read/render the expense, just falling back to equal split.
   */
  shares?: Record<string, number>;
};

export type Transfer = {
  from: string;
  to: string;
  amount: number;
};

export type PersonalCost = {
  personId: string;
  amount: number;
};

const MONEY_EPSILON = 0.009;

/**
 * Convert an expense's amount to the project's primary currency.
 * Pre-Block-4 records have neither `currency` nor `exchange_rate_used`
 * and are treated as already-in-primary (multiplier 1).
 *
 * Note: split-calculator never sees the project's primary currency code
 * directly — the conversion only relies on the multiplier captured on the
 * expense at save time. This keeps historical math stable when fx rates
 * change later.
 */
export function toPrimary(expense: Expense): number {
  const rate =
    typeof expense.exchange_rate_used === "number" &&
    Number.isFinite(expense.exchange_rate_used) &&
    expense.exchange_rate_used > 0
      ? expense.exchange_rate_used
      : 1;
  return Number(expense.amount) * rate;
}

export function getTotalAmount(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + toPrimary(expense), 0);
}

/**
 * Resolves how much each participant owes for a single expense.
 * Returns a map of participantId → amount in the project's primary currency.
 *
 * Two modes:
 *  - `shares` is defined and at least one participant has weight > 0
 *    → weighted split: each participant pays `amount * (weight / totalWeight)`
 *    Participants in `participantIds` without an entry in `shares`
 *    (or with weight 0) get 0 — they're listed but don't pay.
 *  - otherwise → equal split across `participantIds`.
 *
 * `validIds` filters out participants whose Person was removed.
 */
function shareBreakdown(expense: Expense, validIds: string[]): Map<string, number> {
  const out = new Map<string, number>();
  if (!validIds.length) return out;

  const amount = toPrimary(expense);
  const shares = expense.shares;

  if (shares && typeof shares === "object") {
    let totalWeight = 0;
    for (const id of validIds) {
      const w = shares[id];
      if (typeof w === "number" && Number.isFinite(w) && w > 0) {
        totalWeight += w;
      }
    }
    if (totalWeight > 0) {
      for (const id of validIds) {
        const w = shares[id];
        const weight =
          typeof w === "number" && Number.isFinite(w) && w > 0 ? w : 0;
        out.set(id, amount * (weight / totalWeight));
      }
      return out;
    }
    // Falls through to equal split if all weights are 0 / invalid.
  }

  const equal = amount / validIds.length;
  for (const id of validIds) out.set(id, equal);
  return out;
}

export function calculatePersonalCosts(people: Person[], expenses: Expense[]): PersonalCost[] {
  const costs = new Map(people.map((person) => [person.id, 0]));

  expenses.forEach((expense) => {
    const participantIds = expense.participantIds.filter((id) => costs.has(id));
    if (!participantIds.length) {
      return;
    }
    const breakdown = shareBreakdown(expense, participantIds);
    breakdown.forEach((value, personId) => {
      costs.set(personId, (costs.get(personId) ?? 0) + value);
    });
  });

  return people.map((person) => ({
    personId: person.id,
    amount: Math.round((costs.get(person.id) ?? 0) * 100) / 100,
  }));
}

export function calculateTransfers(people: Person[], expenses: Expense[]): Transfer[] {
  const balances = new Map(people.map((person) => [person.id, 0]));

  expenses.forEach((expense) => {
    const amount = toPrimary(expense);
    const participantIds = expense.participantIds.filter((id) => balances.has(id));
    if (!participantIds.length || !balances.has(expense.payerId)) {
      return;
    }

    balances.set(expense.payerId, (balances.get(expense.payerId) ?? 0) + amount);

    const breakdown = shareBreakdown(expense, participantIds);
    breakdown.forEach((value, personId) => {
      balances.set(personId, (balances.get(personId) ?? 0) - value);
    });
  });

  const debtors: Array<{ personId: string; amount: number }> = [];
  const creditors: Array<{ personId: string; amount: number }> = [];

  balances.forEach((balance, personId) => {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded < -MONEY_EPSILON) {
      debtors.push({ personId, amount: Math.abs(rounded) });
    }
    if (rounded > MONEY_EPSILON) {
      creditors.push({ personId, amount: rounded });
    }
  });

  const transfers: Transfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > MONEY_EPSILON) {
      transfers.push({
        from: debtor.personId,
        to: creditor.personId,
        amount: Math.round(amount * 100) / 100,
      });
    }

    debtor.amount = Math.round((debtor.amount - amount) * 100) / 100;
    creditor.amount = Math.round((creditor.amount - amount) * 100) / 100;

    if (debtor.amount <= MONEY_EPSILON) {
      debtorIndex += 1;
    }
    if (creditor.amount <= MONEY_EPSILON) {
      creditorIndex += 1;
    }
  }

  return transfers;
}
