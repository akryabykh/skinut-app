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

export function getTotalAmount(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
}

export function calculatePersonalCosts(people: Person[], expenses: Expense[]): PersonalCost[] {
  const costs = new Map(people.map((person) => [person.id, 0]));

  expenses.forEach((expense) => {
    const amount = Number(expense.amount);
    const participantIds = expense.participantIds.filter((id) => costs.has(id));
    if (!participantIds.length) {
      return;
    }

    const share = amount / participantIds.length;
    participantIds.forEach((personId) => {
      costs.set(personId, (costs.get(personId) ?? 0) + share);
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
    const amount = Number(expense.amount);
    const participantIds = expense.participantIds.filter((id) => balances.has(id));
    if (!participantIds.length || !balances.has(expense.payerId)) {
      return;
    }

    balances.set(expense.payerId, (balances.get(expense.payerId) ?? 0) + amount);

    const share = amount / participantIds.length;
    participantIds.forEach((personId) => {
      balances.set(personId, (balances.get(personId) ?? 0) - share);
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
