"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListChecks, Receipt, Share2, Users, WalletCards } from "lucide-react";
import { publicConfig } from "@/lib/public-config";
import {
  calculatePersonalCosts,
  calculateTransfers,
  getTotalAmount,
  type Expense,
  type Person,
} from "@/lib/split-calculator";

type ExpenseSort = "created-desc" | "name-asc" | "name-desc" | "payer-asc" | "payer-desc";

type ProjectState = {
  projectId: string | null;
  projectName: string;
  expenseSort: ExpenseSort;
  people: Person[];
  expenses: Expense[];
};

type RemoteConfig = {
  enabled: boolean;
  url: string;
  anonKey: string;
  publicBaseUrl: string;
};

const STORAGE_KEY = "split-app-state-v1";
const DEFAULT_STATE: ProjectState = {
  projectId: null,
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

  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }

  return many;
}

function makeId() {
  if ("crypto" in window && "randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeProjectId() {
  return makeId().replaceAll("-", "").slice(0, 16);
}

function getValidExpenseSort(value: unknown): ExpenseSort {
  const allowed: ExpenseSort[] = ["created-desc", "name-asc", "name-desc", "payer-asc", "payer-desc"];
  return allowed.includes(value as ExpenseSort) ? (value as ExpenseSort) : "created-desc";
}

function normalizeState(value: Partial<ProjectState>): ProjectState {
  return {
    projectId: typeof value.projectId === "string" && value.projectId.trim() ? value.projectId : null,
    projectName: typeof value.projectName === "string" && value.projectName.trim() ? value.projectName : "Событие",
    expenseSort: getValidExpenseSort(value.expenseSort),
    people: Array.isArray(value.people) ? value.people.filter((person) => person.id && person.name) : [],
    expenses: Array.isArray(value.expenses)
      ? value.expenses.filter((expense) => expense.id && expense.name && expense.payerId && Number(expense.amount) > 0)
      : [],
  };
}

function getRemoteConfig(): RemoteConfig {
  const url = publicConfig.supabaseUrl.replace(/\/$/, "");
  const anonKey = publicConfig.supabaseAnonKey;
  const publicBaseUrl = publicConfig.publicBaseUrl.replace(/\/$/, "");

  return {
    enabled: Boolean(url && anonKey),
    url,
    anonKey,
    publicBaseUrl,
  };
}

function getProjectIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("project") || params.get("p");
}

function setProjectIdInUrl(projectId: string) {
  const url = new URL(window.location.href);
  url.searchParams.delete("data");
  url.searchParams.set("project", projectId);
  window.history.replaceState({}, "", url);
}

function makeProjectUrl(paramName: string, value: string, remote: RemoteConfig) {
  const baseUrl = remote.publicBaseUrl || `${window.location.origin}/app`;
  const url = new URL(baseUrl);
  url.pathname = "/app";
  url.searchParams.set(paramName, value);
  return url.toString();
}

function getPayload(state: ProjectState) {
  return {
    projectName: state.projectName,
    expenseSort: state.expenseSort,
    people: state.people,
    expenses: state.expenses,
  };
}

function getRemoteHeaders(remote: RemoteConfig, extra: Record<string, string> = {}) {
  return {
    apikey: remote.anonKey,
    Authorization: `Bearer ${remote.anonKey}`,
    ...extra,
  };
}

async function fetchRemoteProject(projectId: string, remote: RemoteConfig): Promise<Partial<ProjectState> | null> {
  try {
    const response = await fetch(
      `${remote.url}/rest/v1/projects?public_id=eq.${encodeURIComponent(projectId)}&select=public_id,name,payload`,
      {
        headers: getRemoteHeaders(remote),
      },
    );

    if (!response.ok) {
      throw new Error(`Supabase returned ${response.status}`);
    }

    const rows = (await response.json()) as Array<{ payload?: Partial<ProjectState> }>;
    return rows[0]?.payload ?? null;
  } catch (error) {
    console.warn("Unable to load remote project", error);
    return null;
  }
}

async function saveRemoteProject(state: ProjectState, remote: RemoteConfig) {
  if (!remote.enabled || !state.projectId) {
    return null;
  }

  const response = await fetch(`${remote.url}/rest/v1/projects?on_conflict=public_id`, {
    method: "POST",
    headers: getRemoteHeaders(remote, {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    }),
    body: JSON.stringify({
      public_id: state.projectId,
      name: state.projectName,
      payload: getPayload(state),
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase returned ${response.status}`);
  }

  return state.projectId;
}

function compareText(first: string, second: string) {
  return first.localeCompare(second, "ru", { sensitivity: "base" });
}

function encodeState(state: ProjectState) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

function decodeState(value: string) {
  return JSON.parse(decodeURIComponent(escape(atob(value)))) as Partial<ProjectState>;
}

export function ExpenseCalculator() {
  const [state, setState] = useState<ProjectState>(DEFAULT_STATE);
  const [personName, setPersonName] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePayer, setExpensePayer] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const remote = useMemo(getRemoteConfig, []);
  const remoteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const peopleIds = useMemo(() => state.people.map((person) => person.id), [state.people]);
  const peopleIdsKey = peopleIds.join("|");

  useEffect(() => {
    let isMounted = true;

    async function loadState() {
      const projectId = getProjectIdFromUrl();

      if (projectId && remote.enabled) {
        const remoteState = await fetchRemoteProject(projectId, remote);
        if (remoteState && isMounted) {
          const nextState = normalizeState({ ...remoteState, projectId });
          setState(nextState);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
          setIsReady(true);
          return;
        }
      }

      const sharedState = new URLSearchParams(window.location.search).get("data");

      if (sharedState) {
        try {
          const nextState = normalizeState(decodeState(sharedState));
          if (isMounted) {
            setState(nextState);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
            window.history.replaceState({}, "", window.location.pathname);
            setIsReady(true);
          }
          return;
        } catch (error) {
          console.warn("Unable to read shared project data", error);
        }
      }

      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        if (projectId && isMounted) {
          setState({ ...DEFAULT_STATE, projectId });
        }
        if (isMounted) {
          setIsReady(true);
        }
        return;
      }

      try {
        const nextState = normalizeState(JSON.parse(saved) as Partial<ProjectState>);
        if (projectId) {
          nextState.projectId = projectId;
        }
        if (isMounted) {
          setState(nextState);
        }
      } catch (error) {
        console.warn("Unable to read saved project data", error);
      }

      if (isMounted) {
        setIsReady(true);
      }
    }

    void loadState();

    return () => {
      isMounted = false;
      if (remoteSaveTimer.current) {
        clearTimeout(remoteSaveTimer.current);
      }
    };
  }, [remote]);

  useEffect(() => {
    setSelectedParticipantIds((previousSelection) => {
      const validSelection = previousSelection.filter((id) => peopleIds.includes(id));
      return validSelection.length ? validSelection : peopleIds;
    });

    setExpensePayer((currentPayer) => (currentPayer && peopleIds.includes(currentPayer) ? currentPayer : ""));
  }, [peopleIdsKey, peopleIds]);

  function scheduleRemoteSave(nextState: ProjectState) {
    if (!remote.enabled) {
      return;
    }

    if (remoteSaveTimer.current) {
      clearTimeout(remoteSaveTimer.current);
    }

    remoteSaveTimer.current = setTimeout(() => {
      saveRemoteProject(nextState, remote).catch((error: unknown) => console.warn("Unable to save remote project", error));
    }, 450);
  }

  function commitState(nextState: ProjectState) {
    let stateToSave = nextState;

    if (remote.enabled && !stateToSave.projectId) {
      const projectId = makeProjectId();
      stateToSave = { ...stateToSave, projectId };
      setProjectIdInUrl(projectId);
    }

    setState(stateToSave);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    scheduleRemoteSave(stateToSave);
  }

  const getPersonName = useCallback(
    (personId: string) => state.people.find((person) => person.id === personId)?.name ?? "Неизвестно",
    [state.people],
  );

  const sortedExpenses = useMemo(() => {
    const indexedExpenses = state.expenses.map((expense, index) => ({ expense, index }));

    indexedExpenses.sort((first, second) => {
      if (state.expenseSort === "name-asc") {
        return compareText(first.expense.name, second.expense.name) || first.index - second.index;
      }
      if (state.expenseSort === "name-desc") {
        return compareText(second.expense.name, first.expense.name) || first.index - second.index;
      }
      if (state.expenseSort === "payer-asc") {
        return compareText(getPersonName(first.expense.payerId), getPersonName(second.expense.payerId)) || first.index - second.index;
      }
      if (state.expenseSort === "payer-desc") {
        return compareText(getPersonName(second.expense.payerId), getPersonName(first.expense.payerId)) || first.index - second.index;
      }

      return first.index - second.index;
    });

    return indexedExpenses.map(({ expense }) => expense);
  }, [getPersonName, state.expenseSort, state.expenses]);

  const transfers = useMemo(() => calculateTransfers(state.people, state.expenses), [state.people, state.expenses]);
  const personalCosts = useMemo(() => calculatePersonalCosts(state.people, state.expenses), [state.people, state.expenses]);
  const totalAmount = useMemo(() => getTotalAmount(state.expenses), [state.expenses]);

  function addPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = personName.trim();
    if (!cleanName) {
      return;
    }

    const exists = state.people.some((person) => person.name.toLowerCase() === cleanName.toLowerCase());
    if (exists) {
      alert("Такой участник уже есть");
      return;
    }

    commitState({ ...state, people: [...state.people, { id: makeId(), name: cleanName }] });
    setPersonName("");
  }

  function removePerson(personId: string) {
    const isUsed = state.expenses.some(
      (expense) => expense.payerId === personId || expense.participantIds.includes(personId),
    );

    if (isUsed) {
      alert("Участник уже есть в расходах. Сначала удалите связанные расходы.");
      return;
    }

    commitState({ ...state, people: state.people.filter((person) => person.id !== personId) });
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
    if (!cleanExpenseName || Number.isNaN(amount) || amount <= 0) {
      return;
    }

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
    setSelectedParticipantIds(state.people.map((person) => person.id));
  }

  function removeExpense(expenseId: string) {
    commitState({ ...state, expenses: state.expenses.filter((expense) => expense.id !== expenseId) });
  }

  function changeSort(value: string) {
    commitState({ ...state, expenseSort: getValidExpenseSort(value) });
  }

  function resetProject() {
    if (!confirm("Очистить весь расчет?")) {
      return;
    }

    const nextState: ProjectState = {
      ...DEFAULT_STATE,
      projectId: remote.enabled ? makeProjectId() : null,
    };

    if (nextState.projectId) {
      setProjectIdInUrl(nextState.projectId);
    }

    commitState(nextState);
    setPersonName("");
    setExpenseName("");
    setExpenseAmount("");
    setExpensePayer("");
    setSelectedParticipantIds([]);
  }

  function toggleParticipant(personId: string) {
    setSelectedParticipantIds((current) =>
      current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId],
    );
  }

  async function shareProject() {
    let nextState = state;

    if (remote.enabled && !nextState.projectId) {
      const projectId = makeProjectId();
      nextState = { ...nextState, projectId };
      setProjectIdInUrl(projectId);
      commitState(nextState);
    }

    let url: string;

    if (remote.enabled && nextState.projectId) {
      await saveRemoteProject(nextState, remote);
      url = makeProjectUrl("project", nextState.projectId, remote);
    } else {
      url = makeProjectUrl("data", encodeState(nextState), remote);
    }

    const text = `Расчет "${nextState.projectName}"`;

    if (navigator.share) {
      await navigator.share({ title: "Скинуться", text, url });
      return;
    }

    await navigator.clipboard.writeText(url);
    alert("Ссылка скопирована.");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Калькулятор расходов</p>
          <h1 className="app-title">
            <Image src="/logo.svg" alt="" width={38} height={38} className="brand-mark" priority />
            Скинуться
          </h1>
        </div>
        <button className="icon-button" type="button" aria-label="Поделиться расчетом" onClick={() => void shareProject()}>
          <Share2 size={21} aria-hidden="true" />
        </button>
      </header>

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
          onChange={(event) => commitState({ ...state, projectName: event.target.value.trim() || "Событие" })}
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
              {state.people.length} {plural(state.people.length, "человек", "человека", "человек")}
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
            <span className="button-icon" aria-hidden="true">
              +
            </span>
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
                <button type="button" aria-label={`Удалить ${person.name}`} onClick={() => removePerson(person.id)}>
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
                <option value="">{state.people.length ? "Выберите" : "Сначала добавьте людей"}</option>
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
              <button className="ghost-button" type="button" onClick={() => setSelectedParticipantIds(state.people.map((person) => person.id))}>
                Все
              </button>
              <button className="ghost-button" type="button" onClick={() => setSelectedParticipantIds([])}>
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
            <span className="button-icon" aria-hidden="true">
              +
            </span>
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
              {state.expenses.length} {plural(state.expenses.length, "запись", "записи", "записей")}
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
                    <button className="expense-remove" type="button" aria-label={`Удалить ${expense.name}`} onClick={() => removeExpense(expense.id)}>
                      ×
                    </button>
                  </div>
                </div>
                <p className="meta">
                  Оплатил: {getPersonName(expense.payerId)}. Участвуют: {expense.participantIds.map(getPersonName).join(", ")}.
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
              <article className="summary-item" key={`${transfer.from}-${transfer.to}-${transfer.amount}`}>
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
              <strong>Всего потрачено денег:</strong> <span>{money(totalAmount)}</span>
            </p>
            <h3>Стоимость для каждого:</h3>
            <div className="person-cost-list">
              {!personalCosts.length ? (
                <div className="empty-state">
                  <strong>Нет участников</strong>
                  <span>Добавьте людей и расходы, чтобы увидеть стоимость для каждого.</span>
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
    </main>
  );
}
