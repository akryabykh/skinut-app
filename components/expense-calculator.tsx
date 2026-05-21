"use client";

import Image from "next/image";
import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ListChecks, Receipt, Settings, Users, WalletCards } from "lucide-react";
import { saveProjectPayload } from "@/app/app/projects/actions";
import {
  calculatePersonalCosts,
  calculateTransfers,
  getTotalAmount,
  type Expense,
  type Person,
} from "@/lib/split-calculator";

type ExpenseSort =
  | "created-desc"
  | "name-asc"
  | "name-desc"
  | "payer-asc"
  | "payer-desc";

type ProjectState = {
  projectName: string;
  expenseSort: ExpenseSort;
  people: Person[];
  expenses: Expense[];
};

type ExpenseCalculatorProps = {
  // When a project is loaded from the DB, the parent server component
  // passes its id, initial title and payload here. The calculator then
  // persists every change back to that row via saveProjectPayload().
  //
  // When the props are omitted (guest mode, no auth), the calculator
  // falls back to localStorage just like the legacy version.
  projectId?: string;
  initialName?: string;
  initialPayload?: Partial<ProjectState>;
  // Defaults to true for backward compatibility. Set to false when the
  // current user has the "viewer" role on this project — the UI becomes
  // a read-only snapshot and persistState becomes a noop.
  canEdit?: boolean;
};

const STORAGE_KEY = "split-app-state-v1";

const DEFAULT_STATE: ProjectState = {
  projectName: "Событие",
  expenseSort: "created-desc",
  people: [],
  expenses: [],
};

const currency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

function money(value: number) {
  return currency.format(value).replace(",00", "");
}

function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function makeId() {
  if (typeof window !== "undefined" && "crypto" in window && "randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getValidExpenseSort(value: unknown): ExpenseSort {
  const allowed: ExpenseSort[] = [
    "created-desc",
    "name-asc",
    "name-desc",
    "payer-asc",
    "payer-desc",
  ];
  return allowed.includes(value as ExpenseSort) ? (value as ExpenseSort) : "created-desc";
}

function normalizeState(value: Partial<ProjectState> | null | undefined): ProjectState {
  const v = value ?? {};
  return {
    projectName:
      typeof v.projectName === "string" && v.projectName.trim()
        ? v.projectName
        : DEFAULT_STATE.projectName,
    expenseSort: getValidExpenseSort(v.expenseSort),
    people: Array.isArray(v.people)
      ? v.people.filter((p) => p && p.id && p.name)
      : [],
    expenses: Array.isArray(v.expenses)
      ? v.expenses.filter(
          (e) => e && e.id && e.name && e.payerId && Number(e.amount) > 0,
        )
      : [],
  };
}

function compareText(first: string, second: string) {
  return first.localeCompare(second, "ru", { sensitivity: "base" });
}

export function ExpenseCalculator({
  projectId,
  initialName,
  initialPayload,
  canEdit = true,
}: ExpenseCalculatorProps = {}) {
  const isOwnedProject = Boolean(projectId);
  const isReadOnly = !canEdit;

  const [state, setState] = useState<ProjectState>(() => {
    if (isOwnedProject) {
      // Server-provided initial data — render with it on the first paint.
      return normalizeState({
        ...(initialPayload ?? {}),
        projectName: initialName ?? initialPayload?.projectName,
      });
    }
    return DEFAULT_STATE;
  });

  const [personName, setPersonName] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePayer, setExpensePayer] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  // Owned projects render with server data immediately, guests need to
  // hydrate from localStorage first.
  const [isReady, setIsReady] = useState(isOwnedProject);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const peopleIds = useMemo(() => state.people.map((p) => p.id), [state.people]);
  const peopleIdsKey = peopleIds.join("|");

  // Guest mode: load saved state from localStorage on mount.
  useEffect(() => {
    if (isOwnedProject) return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setState(normalizeState(JSON.parse(saved) as Partial<ProjectState>));
      }
    } catch (error) {
      console.warn("Unable to read saved project data", error);
    }
    setIsReady(true);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [isOwnedProject]);

  // Keep selectedParticipantIds and expensePayer in sync with the
  // current people list (drop removed people, default to "everyone").
  useEffect(() => {
    setSelectedParticipantIds((prev) => {
      const valid = prev.filter((id) => peopleIds.includes(id));
      return valid.length ? valid : peopleIds;
    });
    setExpensePayer((current) =>
      current && peopleIds.includes(current) ? current : "",
    );
  }, [peopleIdsKey, peopleIds]);

  // Persist current state — debounced server-action save for owned
  // projects, synchronous localStorage for guests.
  const persistState = useCallback(
    (nextState: ProjectState) => {
      // Viewers don't get to write. Their UI is already disabled via the
      // <fieldset disabled> wrapper below, but this is the second layer.
      if (isReadOnly) return;

      if (isOwnedProject && projectId) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          saveProjectPayload(projectId, nextState).catch((error: unknown) => {
            console.warn("Unable to save project", error);
          });
        }, 600);
      } else {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
        } catch (error) {
          console.warn("Unable to save project", error);
        }
      }
    },
    [isOwnedProject, projectId, isReadOnly],
  );

  function commitState(nextState: ProjectState) {
    setState(nextState);
    persistState(nextState);
  }

  const getPersonName = useCallback(
    (personId: string) =>
      state.people.find((p) => p.id === personId)?.name ?? "Неизвестно",
    [state.people],
  );

  const sortedExpenses = useMemo(() => {
    const indexed = state.expenses.map((expense, index) => ({ expense, index }));

    indexed.sort((a, b) => {
      if (state.expenseSort === "name-asc") {
        return compareText(a.expense.name, b.expense.name) || a.index - b.index;
      }
      if (state.expenseSort === "name-desc") {
        return compareText(b.expense.name, a.expense.name) || a.index - b.index;
      }
      if (state.expenseSort === "payer-asc") {
        return (
          compareText(getPersonName(a.expense.payerId), getPersonName(b.expense.payerId)) ||
          a.index - b.index
        );
      }
      if (state.expenseSort === "payer-desc") {
        return (
          compareText(getPersonName(b.expense.payerId), getPersonName(a.expense.payerId)) ||
          a.index - b.index
        );
      }
      return a.index - b.index;
    });

    return indexed.map(({ expense }) => expense);
  }, [getPersonName, state.expenseSort, state.expenses]);

  const transfers = useMemo(
    () => calculateTransfers(state.people, state.expenses),
    [state.people, state.expenses],
  );
  const personalCosts = useMemo(
    () => calculatePersonalCosts(state.people, state.expenses),
    [state.people, state.expenses],
  );
  const totalAmount = useMemo(() => getTotalAmount(state.expenses), [state.expenses]);

  function addPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = personName.trim();
    if (!cleanName) return;

    const exists = state.people.some(
      (p) => p.name.toLowerCase() === cleanName.toLowerCase(),
    );
    if (exists) {
      alert("Такой участник уже есть");
      return;
    }

    commitState({
      ...state,
      people: [...state.people, { id: makeId(), name: cleanName }],
    });
    setPersonName("");
  }

  function removePerson(personId: string) {
    const isUsed = state.expenses.some(
      (e) => e.payerId === personId || e.participantIds.includes(personId),
    );
    if (isUsed) {
      alert("Участник уже есть в расходах. Сначала удалите связанные расходы.");
      return;
    }

    commitState({
      ...state,
      people: state.people.filter((p) => p.id !== personId),
    });
  }

  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(expenseAmount);

    if (!state.people.length) {
      alert("Сначала добавьте участников.");
      return;
    }
    if (!selectedParticipantIds.length) {
      alert("Выберите хотя бы одного участника расхода.");
      return;
    }
    if (!expensePayer) {
      alert("Выберите, кто оплатил расход.");
      return;
    }

    const cleanExpenseName = expenseName.trim();
    if (!cleanExpenseName || Number.isNaN(amount) || amount <= 0) return;

    commitState({
      ...state,
      expenses: [
        ...state.expenses,
        {
          id: makeId(),
          name: cleanExpenseName,
          amount,
          payerId: expensePayer,
          participantIds: selectedParticipantIds,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    setExpenseName("");
    setExpenseAmount("");
    setExpensePayer("");
    setSelectedParticipantIds(state.people.map((p) => p.id));
  }

  function removeExpense(expenseId: string) {
    commitState({
      ...state,
      expenses: state.expenses.filter((e) => e.id !== expenseId),
    });
  }

  function changeSort(value: string) {
    commitState({ ...state, expenseSort: getValidExpenseSort(value) });
  }

  function resetProject() {
    if (!confirm("Очистить весь расчет?")) return;

    commitState({ ...DEFAULT_STATE });
    setPersonName("");
    setExpenseName("");
    setExpenseAmount("");
    setExpensePayer("");
    setSelectedParticipantIds([]);
  }

  function toggleParticipant(personId: string) {
    setSelectedParticipantIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId],
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Калькулятор расходов</p>
          <h1 className="app-title">
            <Image
              src="/logo.svg"
              alt=""
              width={38}
              height={38}
              className="brand-mark"
              priority
            />
            Скинуться
          </h1>
        </div>
        {isOwnedProject && projectId ? (
          <Link
            href={`/app/projects/${projectId}`}
            className="nav-button calc-nav-link"
            aria-label="Настройки проекта"
          >
            <Settings size={18} aria-hidden="true" />
            <span>Настройки</span>
          </Link>
        ) : null}
      </header>

      {isReadOnly ? (
        <p className="auth-banner auth-banner-success calc-readonly-banner">
          Режим просмотра — изменения не сохраняются. Попросите владельца
          сделать вас редактором.
        </p>
      ) : null}

      <fieldset className="calc-fieldset" disabled={isReadOnly}>
      <section className="project-panel" aria-labelledby="projectTitleLabel">
        <label className="field-label" id="projectTitleLabel" htmlFor="projectName">
          Название
        </label>
        <input
          id="projectName"
          className="text-input project-title"
          type="text"
          autoComplete="off"
          value={state.projectName}
          onChange={(event) =>
            commitState({
              ...state,
              projectName: event.target.value.trim() || DEFAULT_STATE.projectName,
            })
          }
          disabled={!isReady}
        />
      </section>

      <section className="workspace">
        <div className="section-header">
          <div>
            <h2>
              <span className="section-icon" aria-hidden="true">
                <Users size={20} />
              </span>
              Участники
            </h2>
            <p>
              {state.people.length}{" "}
              {plural(state.people.length, "человек", "человека", "человек")}
            </p>
          </div>
        </div>
        <form className="inline-form" onSubmit={addPerson}>
          <input
            className="text-input"
            type="text"
            placeholder="Имя"
            autoComplete="off"
            value={personName}
            onChange={(event) => setPersonName(event.target.value)}
            required
          />
          <button className="primary-button" type="submit">
            <span className="button-icon" aria-hidden="true">+</span>
            Добавить
          </button>
        </form>
        <div className="chip-list" aria-live="polite">
          {!state.people.length ? (
            <div className="empty-state">
              <strong>Пока никого</strong>
              <span>Добавьте участников, чтобы завести первый расход.</span>
            </div>
          ) : (
            state.people.map((person) => (
              <div className="chip" key={person.id}>
                <span>{person.name}</span>
                <button
                  type="button"
                  aria-label={`Удалить ${person.name}`}
                  onClick={() => removePerson(person.id)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="workspace">
        <div className="section-header">
          <div>
            <h2>
              <span className="section-icon" aria-hidden="true">
                <Receipt size={20} />
              </span>
              Расход
            </h2>
            <p>Кто оплатил и на кого делим</p>
          </div>
        </div>
        <form className="expense-form" onSubmit={addExpense}>
          <label className="field">
            <span className="field-label">Название</span>
            <input
              className="text-input"
              type="text"
              placeholder="Такси, продукты, подарок"
              value={expenseName}
              onChange={(event) => setExpenseName(event.target.value)}
              required
            />
          </label>
          <div className="two-columns">
            <label className="field">
              <span className="field-label">Сумма</span>
              <input
                className="text-input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0"
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Кто платил</span>
              <select
                className="text-input"
                value={expensePayer}
                onChange={(event) => setExpensePayer(event.target.value)}
                required
              >
                <option value="">
                  {state.people.length ? "Выберите" : "Сначала добавьте людей"}
                </option>
                {state.people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="participants-box">
            <legend>Кто участвует</legend>
            <div className="payer-actions">
              <button
                className="ghost-button"
                type="button"
                onClick={() =>
                  setSelectedParticipantIds(state.people.map((p) => p.id))
                }
              >
                Все
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setSelectedParticipantIds([])}
              >
                Никто
              </button>
            </div>
            <div className="participant-grid">
              {!state.people.length ? (
                <div className="empty-state">
                  <strong>Нет участников</strong>
                  <span>После добавления людей здесь появится выбор.</span>
                </div>
              ) : (
                state.people.map((person) => (
                  <label className="participant-option" key={person.id}>
                    <input
                      type="checkbox"
                      value={person.id}
                      checked={selectedParticipantIds.includes(person.id)}
                      onChange={() => toggleParticipant(person.id)}
                    />
                    <span>{person.name}</span>
                  </label>
                ))
              )}
            </div>
          </fieldset>
          <button className="primary-button full-width" type="submit">
            <span className="button-icon" aria-hidden="true">+</span>
            Добавить расход
          </button>
        </form>
      </section>

      <section className="workspace">
        <div className="section-header">
          <div>
            <h2>
              <span className="section-icon" aria-hidden="true">
                <ListChecks size={20} />
              </span>
              Расходы
            </h2>
            <p>
              {state.expenses.length}{" "}
              {plural(state.expenses.length, "запись", "записи", "записей")}
            </p>
          </div>
          <button className="ghost-button danger" type="button" onClick={resetProject}>
            Очистить
          </button>
        </div>
        <div className="filter-bar" aria-label="Сортировка расходов">
          <label className="field sort-field" htmlFor="expenseSort">
            <span className="field-label">Сортировка</span>
            <select
              id="expenseSort"
              className="text-input compact-select"
              value={state.expenseSort}
              onChange={(event) => changeSort(event.target.value)}
            >
              <option value="created-desc">По добавлению</option>
              <option value="name-asc">Покупки А-Я</option>
              <option value="name-desc">Покупки Я-А</option>
              <option value="payer-asc">Платившие А-Я</option>
              <option value="payer-desc">Платившие Я-А</option>
            </select>
          </label>
        </div>
        <div className="expense-list">
          {!state.expenses.length ? (
            <div className="empty-state">
              <strong>Расходов пока нет</strong>
              <span>Добавьте первую покупку или общий платеж.</span>
            </div>
          ) : (
            sortedExpenses.map((expense) => (
              <article className="expense-item" key={expense.id}>
                <div className="expense-main">
                  <strong>{expense.name}</strong>
                  <div className="expense-main">
                    <span className="money">{money(expense.amount)}</span>
                    <button
                      className="expense-remove"
                      type="button"
                      aria-label={`Удалить ${expense.name}`}
                      onClick={() => removeExpense(expense.id)}
                    >
                      ×
                    </button>
                  </div>
                </div>
                <p className="meta">
                  Оплатил: {getPersonName(expense.payerId)}. Участвуют:{" "}
                  {expense.participantIds.map(getPersonName).join(", ")}.
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="workspace summary-panel">
        <div className="section-header">
          <div>
            <h2>
              <span className="section-icon" aria-hidden="true">
                <WalletCards size={20} />
              </span>
              Итог
            </h2>
            <p>{money(totalAmount)} всего</p>
          </div>
        </div>
        <div className="summary-list">
          {!state.expenses.length ? (
            <div className="empty-state">
              <strong>Нет расчета</strong>
              <span>Итог появится после добавления расходов.</span>
            </div>
          ) : !transfers.length ? (
            <div className="empty-state">
              <strong>Все ровно</strong>
              <span>Никому не нужно переводить деньги.</span>
            </div>
          ) : (
            transfers.map((transfer) => (
              <article
                className="summary-item"
                key={`${transfer.from}-${transfer.to}-${transfer.amount}`}
              >
                <div className="summary-main">
                  <strong>
                    {getPersonName(transfer.from)} → {getPersonName(transfer.to)}
                  </strong>
                  <span className="money">{money(transfer.amount)}</span>
                </div>
              </article>
            ))
          )}
        </div>
        <details className="details-panel">
          <summary>
            <span className="details-arrow" aria-hidden="true" />
            <span>Больше информации</span>
          </summary>
          <div className="details-content">
            <p className="details-total">
              <strong>Всего потрачено денег:</strong>{" "}
              <span>{money(totalAmount)}</span>
            </p>
            <h3>Стоимость для каждого:</h3>
            <div className="person-cost-list">
              {!personalCosts.length ? (
                <div className="empty-state">
                  <strong>Нет участников</strong>
                  <span>
                    Добавьте людей и расходы, чтобы увидеть стоимость для каждого.
                  </span>
                </div>
              ) : (
                personalCosts.map((cost) => (
                  <div className="person-cost-item" key={cost.personId}>
                    <span>{getPersonName(cost.personId)}</span>
                    <strong>{money(cost.amount)}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </details>
      </section>
      </fieldset>
    </main>
  );
}
