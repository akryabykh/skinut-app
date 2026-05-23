"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CloudOff,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Settings,
  Trash2,
  UserCircle2,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { CategoryDonut } from "@/components/ui/category-donut";
import { ShareProjectButton } from "@/components/share-project-button";
import {
  fetchCurrentRate,
  saveProjectPayload,
} from "@/app/app/projects/actions";
import {
  calculatePersonalCosts,
  calculateTransfers,
  getTotalAmount,
  toPrimary,
  type Expense,
  type Person,
} from "@/lib/split-calculator";
import {
  DEFAULT_PRIMARY_CURRENCY,
  formatMoney,
  getCurrency,
} from "@/lib/currencies";
import {
  CATEGORIES,
  DEFAULT_CATEGORY,
  getCategory,
  isCategoryId,
} from "@/lib/categories";

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
  projectId?: string;
  initialName?: string;
  initialPayload?: Partial<ProjectState>;
  canEdit?: boolean;
  primaryCurrency?: string;
  secondaryCurrency?: string | null;
  /** Share token if the owner/editor enabled the public link. Powers the
   *  "Поделиться" button in the calculator header. */
  shareToken?: string | null;
};

type SyncStatus = "idle" | "saving" | "saved" | "error";

const STORAGE_KEY = "split-app-state-v1";

const DEFAULT_STATE: ProjectState = {
  projectName: "Событие",
  expenseSort: "created-desc",
  people: [],
  expenses: [],
};

function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function makeId() {
  if (
    typeof window !== "undefined" &&
    "crypto" in window &&
    "randomUUID" in window.crypto
  ) {
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
  return allowed.includes(value as ExpenseSort)
    ? (value as ExpenseSort)
    : "created-desc";
}

function normalizeState(
  value: Partial<ProjectState> | null | undefined,
): ProjectState {
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

// Format a cleaned numeric string with thousand spaces.
function formatThousands(raw: string): string {
  if (!raw) return "";
  const [int, dec] = raw.split(".");
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return dec !== undefined ? `${intFmt}.${dec}` : intFmt;
}

// Strip user input down to a "machine-friendly" decimal string.
function sanitizeAmountInput(value: string): string {
  const cleaned = value
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return (
    cleaned.slice(0, firstDot + 1) +
    cleaned.slice(firstDot + 1).replace(/\./g, "")
  );
}

export function ExpenseCalculator({
  projectId,
  initialName,
  initialPayload,
  canEdit = true,
  primaryCurrency = DEFAULT_PRIMARY_CURRENCY,
  secondaryCurrency = null,
  shareToken = null,
}: ExpenseCalculatorProps = {}) {
  const isOwnedProject = Boolean(projectId);
  const isReadOnly = !canEdit;
  const hasSecondary = Boolean(secondaryCurrency);

  const [state, setState] = useState<ProjectState>(() => {
    if (isOwnedProject) {
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
  const [isAmountFocused, setIsAmountFocused] = useState(false);
  const [expensePayer, setExpensePayer] = useState("");
  const [expenseCurrency, setExpenseCurrency] =
    useState<string>(primaryCurrency);
  const [expenseCategory, setExpenseCategory] =
    useState<string>(DEFAULT_CATEGORY);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(
    [],
  );
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [lastAddedExpenseId, setLastAddedExpenseId] = useState<string | null>(
    null,
  );
  // Block 10: editing existing expense in-place via the same form.
  // When non-null, the "Новая трата" form switches to edit mode and the
  // submit button updates the existing record instead of appending a new one.
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(isOwnedProject);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  // Block 12 (8): user-visible sync indicator. Reflects the calculator's
  // save lifecycle (`saving` → `saved` after a debounce round-trip, or
  // `error` if the server action throws). Guests using localStorage only
  // ever stay in `idle` — there's no remote sync to surface.
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const syncResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { confirm, dialog: confirmDialog } = useConfirm();
  const { showToast, toast } = useToast();

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
      if (syncResetTimer.current) clearTimeout(syncResetTimer.current);
    };
  }, [isOwnedProject]);

  useEffect(() => {
    setSelectedParticipantIds((prev) => {
      const valid = prev.filter((id) => peopleIds.includes(id));
      return valid.length ? valid : peopleIds;
    });
    setExpensePayer((current) =>
      current && peopleIds.includes(current) ? current : "",
    );
  }, [peopleIdsKey, peopleIds]);

  const persistState = useCallback(
    (nextState: ProjectState) => {
      if (isReadOnly) return;
      if (isOwnedProject && projectId) {
        // Immediately flip to "saving" — user sees feedback before the
        // 600ms debounce even kicks in.
        setSyncStatus("saving");
        if (syncResetTimer.current) {
          clearTimeout(syncResetTimer.current);
          syncResetTimer.current = null;
        }
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          saveProjectPayload(projectId, nextState)
            .then(() => {
              setSyncStatus("saved");
              // Fade "saved" back to idle so it doesn't sit forever.
              syncResetTimer.current = setTimeout(() => {
                setSyncStatus((current) =>
                  current === "saved" ? "idle" : current,
                );
                syncResetTimer.current = null;
              }, 2000);
            })
            .catch((error: unknown) => {
              console.warn("Unable to save project", error);
              setSyncStatus("error");
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
          compareText(
            getPersonName(a.expense.payerId),
            getPersonName(b.expense.payerId),
          ) || a.index - b.index
        );
      }
      if (state.expenseSort === "payer-desc") {
        return (
          compareText(
            getPersonName(b.expense.payerId),
            getPersonName(a.expense.payerId),
          ) || a.index - b.index
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
  const totalAmountPrimary = useMemo(
    () => getTotalAmount(state.expenses),
    [state.expenses],
  );

  // Aggregate spend per category, in primary currency.
  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const expense of state.expenses) {
      const cat =
        expense.category && isCategoryId(expense.category)
          ? expense.category
          : DEFAULT_CATEGORY;
      totals.set(cat, (totals.get(cat) ?? 0) + toPrimary(expense));
    }
    return CATEGORIES.map((c) => ({
      category: c,
      amount: Math.round((totals.get(c.id) ?? 0) * 100) / 100,
    })).filter((row) => row.amount > 0);
  }, [state.expenses]);

  const usedCategories = useMemo(() => {
    const used = new Set<string>();
    for (const e of state.expenses) {
      const cat =
        e.category && isCategoryId(e.category) ? e.category : DEFAULT_CATEGORY;
      used.add(cat);
    }
    return used;
  }, [state.expenses]);

  // Category filter — affects the expense list view only, not totals.
  const visibleExpenses = useMemo(() => {
    if (categoryFilter === "all") return sortedExpenses;
    return sortedExpenses.filter((e) => {
      const cat =
        e.category && isCategoryId(e.category) ? e.category : DEFAULT_CATEGORY;
      return cat === categoryFilter;
    });
  }, [sortedExpenses, categoryFilter]);

  // Sum of what each person actually paid out of pocket, in primary currency.
  // Different from personalCosts (which is the share they should bear).
  const paidByPerson = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of state.expenses) {
      map.set(e.payerId, (map.get(e.payerId) ?? 0) + toPrimary(e));
    }
    return state.people
      .map((p) => ({
        personId: p.id,
        amount: Math.round((map.get(p.id) ?? 0) * 100) / 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [state.expenses, state.people]);

  const maxPaid = useMemo(
    () => paidByPerson.reduce((max, x) => Math.max(max, x.amount), 0),
    [paidByPerson],
  );

  function addPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = personName.trim();
    if (!cleanName) return;

    const exists = state.people.some(
      (p) => p.name.toLowerCase() === cleanName.toLowerCase(),
    );
    if (exists) {
      showToast("Такой участник уже есть", "error");
      return;
    }

    commitState({
      ...state,
      people: [...state.people, { id: makeId(), name: cleanName }],
    });
    setPersonName("");
  }

  async function removePerson(personId: string) {
    const isUsed = state.expenses.some(
      (e) => e.payerId === personId || e.participantIds.includes(personId),
    );
    if (isUsed) {
      showToast(
        "Участник в тратах. Сначала удалите его траты.",
        "error",
      );
      return;
    }
    const person = state.people.find((p) => p.id === personId);
    const ok = await confirm({
      title: `Удалить ${person?.name ?? "участника"}?`,
      description: "Участник пропадёт из списка. Это нельзя отменить.",
      confirmLabel: "Удалить",
      cancelLabel: "Отмена",
      variant: "danger",
    });
    if (!ok) return;
    commitState({
      ...state,
      people: state.people.filter((p) => p.id !== personId),
    });
  }

  function resetExpenseForm() {
    setExpenseName("");
    setExpenseAmount("");
    setExpensePayer("");
    setSelectedParticipantIds(state.people.map((p) => p.id));
    setExpenseCurrency(primaryCurrency);
    setExpenseCategory(DEFAULT_CATEGORY);
  }

  function startEditingExpense(expense: Expense) {
    setEditingExpenseId(expense.id);
    setExpenseName(expense.name);
    setExpenseAmount(String(expense.amount));
    setExpensePayer(expense.payerId);
    setSelectedParticipantIds(expense.participantIds);
    setExpenseCurrency(expense.currency ?? primaryCurrency);
    setExpenseCategory(
      expense.category && isCategoryId(expense.category)
        ? expense.category
        : DEFAULT_CATEGORY,
    );
    setLastAddedExpenseId(null);
    // Scroll the form into view so the user sees what they're editing.
    setTimeout(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function cancelEditingExpense() {
    setEditingExpenseId(null);
    resetExpenseForm();
  }

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isAddingExpense) return;

    const amount = Number(expenseAmount);

    if (!state.people.length) {
      showToast("Сначала добавьте участников", "error");
      return;
    }
    if (!selectedParticipantIds.length) {
      showToast("Выберите хотя бы одного участника", "error");
      return;
    }
    if (!expensePayer) {
      showToast("Выберите, кто оплатил", "error");
      return;
    }

    const cleanExpenseName = expenseName.trim();
    if (!cleanExpenseName || Number.isNaN(amount) || amount <= 0) return;

    const isEditing = editingExpenseId !== null;
    const existing = isEditing
      ? state.expenses.find((e) => e.id === editingExpenseId)
      : null;

    // Determine the rate:
    //   - same currency as existing → preserve the previously stamped rate
    //     (history is frozen at first save, per the Block 4 contract)
    //   - currency changed or new expense → fetch fresh
    let exchangeRate = 1;
    const currencyChanged =
      isEditing && existing && existing.currency !== expenseCurrency;
    const needsFetch =
      expenseCurrency !== primaryCurrency &&
      (!isEditing || currencyChanged || !existing?.exchange_rate_used);

    if (needsFetch) {
      setIsAddingExpense(true);
      try {
        exchangeRate = await fetchCurrentRate(expenseCurrency, primaryCurrency);
      } catch (err) {
        console.warn("Не удалось получить курс валюты", err);
        const reason =
          err instanceof Error && err.message
            ? err.message
            : "сервис курсов недоступен";
        showToast(`Курс не получен: ${reason}`, "error");
        setIsAddingExpense(false);
        return;
      }
      setIsAddingExpense(false);
    } else if (isEditing && existing) {
      exchangeRate = existing.exchange_rate_used ?? 1;
    }

    const category = isCategoryId(expenseCategory)
      ? expenseCategory
      : DEFAULT_CATEGORY;

    if (isEditing && existing) {
      // Update in place.
      commitState({
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === editingExpenseId
            ? {
                ...e,
                name: cleanExpenseName,
                amount,
                payerId: expensePayer,
                participantIds: selectedParticipantIds,
                currency: expenseCurrency,
                exchange_rate_used: exchangeRate,
                category,
              }
            : e,
        ),
      });
      setEditingExpenseId(null);
      resetExpenseForm();
      showToast("Трата обновлена");
    } else {
      // Append new.
      const newId = makeId();
      commitState({
        ...state,
        expenses: [
          ...state.expenses,
          {
            id: newId,
            name: cleanExpenseName,
            amount,
            payerId: expensePayer,
            participantIds: selectedParticipantIds,
            createdAt: new Date().toISOString(),
            currency: expenseCurrency,
            exchange_rate_used: exchangeRate,
            category,
          },
        ],
      });
      setLastAddedExpenseId(newId);
      resetExpenseForm();

      setTimeout(() => {
        summaryRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 50);
    }
  }

  function removeExpense(expenseId: string) {
    commitState({
      ...state,
      expenses: state.expenses.filter((e) => e.id !== expenseId),
    });
    // If we were editing the one being removed, clear editing state.
    if (editingExpenseId === expenseId) {
      setEditingExpenseId(null);
      resetExpenseForm();
    }
  }

  function changeSort(value: string) {
    commitState({ ...state, expenseSort: getValidExpenseSort(value) });
  }

  async function resetProject() {
    const ok = await confirm({
      title: "Очистить весь расчёт?",
      description:
        "Все участники и траты будут удалены. Это нельзя отменить.",
      confirmLabel: "Очистить",
      cancelLabel: "Отмена",
      variant: "danger",
    });
    if (!ok) return;
    commitState({ ...DEFAULT_STATE });
    setPersonName("");
    setExpenseName("");
    setExpenseAmount("");
    setExpensePayer("");
    setSelectedParticipantIds([]);
    setExpenseCurrency(primaryCurrency);
    setExpenseCategory(DEFAULT_CATEGORY);
    setCategoryFilter("all");
  }

  function toggleParticipant(personId: string) {
    setSelectedParticipantIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId],
    );
  }

  const primaryCurrencyInfo = getCurrency(primaryCurrency);
  const expenseCurrencyInfo = getCurrency(expenseCurrency);
  const secondaryCurrencyInfo = secondaryCurrency
    ? getCurrency(secondaryCurrency)
    : null;

  return (
    <main className="mx-auto w-full max-w-[760px] px-4 sm:px-6 pt-[calc(env(safe-area-inset-top)+24px)] pb-16">
      {/* === Header === */}
      <header className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="grid gap-1 min-w-0">
          <div className="flex items-center gap-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted">
              Калькулятор расходов
            </p>
            {isOwnedProject ? <SyncIndicator status={syncStatus} /> : null}
          </div>
          <Brand href={isOwnedProject ? "/account" : "/"} />
        </div>
        {isOwnedProject && projectId ? (
          <div className="flex items-center gap-1.5 shrink-0">
            {canEdit ? (
              <ShareProjectButton
                projectId={projectId}
                shareToken={shareToken}
                onCopied={() => showToast("Ссылка скопирована")}
                onCopyFailed={(url) =>
                  showToast(`Скопируйте вручную: ${url}`, "error")
                }
              />
            ) : null}
            <Link
              href="/account"
              className="inline-flex items-center justify-center h-10 sm:h-9 px-2 sm:px-3 rounded-control border border-line bg-white text-ink hover:border-[#D4D4D8] hover:bg-[#F4F4F1] transition-colors gap-1.5"
              aria-label="Личный кабинет"
            >
              <UserCircle2 size={16} aria-hidden="true" />
              <span className="hidden sm:inline text-[0.88rem] font-semibold">
                Личный кабинет
              </span>
            </Link>
            <Link
              href={`/app/projects/${projectId}`}
              className="inline-flex items-center justify-center h-10 sm:h-9 px-2 sm:px-3 rounded-control border border-line bg-white text-ink hover:border-[#D4D4D8] hover:bg-[#F4F4F1] transition-colors gap-1.5"
              aria-label="Настройки проекта"
            >
              <Settings size={16} aria-hidden="true" />
              <span className="hidden sm:inline text-[0.88rem] font-semibold">
                Настройки проекта
              </span>
            </Link>
          </div>
        ) : null}
      </header>

      {isReadOnly ? (
        <p
          role="status"
          className="rounded-control border border-[#F8D4C5] bg-accent-soft text-accent-dark text-[0.93rem] leading-snug px-3.5 py-2.5 mb-6"
        >
          Режим просмотра — изменения не сохраняются. Попросите владельца
          сделать вас редактором.
        </p>
      ) : null}

      <fieldset className="border-0 p-0 m-0 min-w-0 disabled:opacity-70" disabled={isReadOnly}>
        <div className="grid gap-3">
          {/* === Project title === */}
          <Card className="!p-5">
            <label
              htmlFor="projectName"
              className="block text-[0.82rem] font-medium text-muted mb-1.5"
            >
              Название
            </label>
            <Input
              id="projectName"
              type="text"
              autoComplete="off"
              value={state.projectName}
              onChange={(event) =>
                commitState({
                  ...state,
                  projectName:
                    event.target.value.trim() || DEFAULT_STATE.projectName,
                })
              }
              disabled={!isReady}
              className="!h-12 !text-[1.1rem] !font-semibold"
            />
            {isOwnedProject ? (
              <p className="text-[0.82rem] text-muted mt-2">
                Итоги в {primaryCurrency}
                {primaryCurrencyInfo ? ` (${primaryCurrencyInfo.symbol})` : ""}
                {hasSecondary && secondaryCurrency && secondaryCurrencyInfo
                  ? ` · доп: ${secondaryCurrency} (${secondaryCurrencyInfo.symbol})`
                  : ""}
              </p>
            ) : null}
          </Card>

          {/* === Participants === */}
          <Card className="!p-5">
            <SectionHeader
              icon={<Users size={16} aria-hidden="true" />}
              title="Участники"
              meta={`${state.people.length} ${plural(
                state.people.length,
                "человек",
                "человека",
                "человек",
              )}`}
            />
            <form
              className="grid grid-cols-[1fr_auto] gap-2 mt-1"
              onSubmit={addPerson}
            >
              <Input
                type="text"
                placeholder="Имя"
                autoComplete="off"
                value={personName}
                onChange={(event) => setPersonName(event.target.value)}
                required
              />
              <Button type="submit" variant="primary" size="md">
                <Plus size={16} aria-hidden="true" />
                <span>Добавить</span>
              </Button>
            </form>
            <div
              className="flex flex-wrap gap-2 mt-4 min-h-[36px]"
              aria-live="polite"
            >
              {!state.people.length ? (
                <EmptyState
                  title="Пока никого"
                  hint="Добавьте участников, чтобы завести первую трату."
                />
              ) : (
                state.people.map((person) => (
                  <span
                    key={person.id}
                    className="inline-flex items-center gap-1.5 h-8 pl-3 pr-1 rounded-full border border-line bg-paper text-[0.9rem] font-semibold text-ink"
                  >
                    <span className="max-w-[180px] truncate">{person.name}</span>
                    <button
                      type="button"
                      onClick={() => removePerson(person.id)}
                      aria-label={`Удалить ${person.name}`}
                      className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#F4F4F1] text-muted hover:bg-[#FBEAE7] hover:text-danger transition-colors"
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </Card>

          {/* === Expense form === */}
          <div ref={formRef}>
          <Card className="!p-5">
            <SectionHeader
              icon={<Receipt size={16} aria-hidden="true" />}
              title={editingExpenseId ? "Редактировать трату" : "Новая трата"}
              meta={
                editingExpenseId
                  ? "Поменяйте поля и сохраните"
                  : "Кто оплатил и на кого делим"
              }
            />
            <form className="grid gap-3 mt-1" onSubmit={addExpense}>
              <label className="grid gap-1.5">
                <span className="text-[0.82rem] font-medium text-muted">
                  Название
                </span>
                <Input
                  type="text"
                  placeholder="Такси, продукты, подарок"
                  value={expenseName}
                  onChange={(event) => setExpenseName(event.target.value)}
                  required
                />
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="grid gap-1.5">
                  <span className="text-[0.82rem] font-medium text-muted">
                    Сумма
                    {expenseCurrencyInfo
                      ? `, ${expenseCurrencyInfo.symbol}`
                      : ""}
                  </span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={
                      isAmountFocused
                        ? expenseAmount
                        : formatThousands(expenseAmount)
                    }
                    onChange={(event) =>
                      setExpenseAmount(sanitizeAmountInput(event.target.value))
                    }
                    onFocus={() => setIsAmountFocused(true)}
                    onBlur={() => setIsAmountFocused(false)}
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[0.82rem] font-medium text-muted">
                    Кто платил
                  </span>
                  <Select
                    value={expensePayer}
                    onChange={(event) => setExpensePayer(event.target.value)}
                    required
                  >
                    <option value="">
                      {state.people.length
                        ? "Выберите"
                        : "Сначала добавьте людей"}
                    </option>
                    {state.people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
              {hasSecondary && secondaryCurrency ? (
                <div className="grid gap-1.5">
                  <span className="text-[0.82rem] font-medium text-muted">
                    Валюта
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="Валюта расхода"
                    className="inline-flex gap-1 rounded-control bg-[#F4F4F1] p-1 self-start"
                  >
                    <CurrencyToggle
                      active={expenseCurrency === primaryCurrency}
                      onClick={() => setExpenseCurrency(primaryCurrency)}
                      label={`${primaryCurrency} ${primaryCurrencyInfo?.symbol ?? ""}`}
                    />
                    <CurrencyToggle
                      active={expenseCurrency === secondaryCurrency}
                      onClick={() => setExpenseCurrency(secondaryCurrency)}
                      label={`${secondaryCurrency} ${secondaryCurrencyInfo?.symbol ?? ""}`}
                    />
                  </div>
                </div>
              ) : null}
              <label className="grid gap-1.5">
                <span className="text-[0.82rem] font-medium text-muted">
                  Категория
                </span>
                <Select
                  value={expenseCategory}
                  onChange={(event) => setExpenseCategory(event.target.value)}
                  required
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name_ru}
                    </option>
                  ))}
                </Select>
              </label>
              <fieldset className="rounded-control border border-line p-3 min-w-0">
                <legend className="px-1.5 text-[0.78rem] font-medium text-muted">
                  Кто участвует
                </legend>
                <div className="flex gap-2 mb-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setSelectedParticipantIds(state.people.map((p) => p.id))
                    }
                  >
                    Все
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedParticipantIds([])}
                  >
                    Никто
                  </Button>
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
                  {!state.people.length ? (
                    <EmptyState
                      title="Нет участников"
                      hint="После добавления людей здесь появится выбор."
                    />
                  ) : (
                    state.people.map((person) => (
                      <label
                        key={person.id}
                        className="grid grid-cols-[auto_1fr] items-center gap-2 min-h-10 sm:min-h-[36px] px-3 rounded-control border border-line bg-white text-[0.92rem] font-medium hover:border-[#D4D4D8] cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          value={person.id}
                          checked={selectedParticipantIds.includes(person.id)}
                          onChange={() => toggleParticipant(person.id)}
                          className="h-4 w-4 accent-accent"
                        />
                        <span className="truncate">{person.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </fieldset>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="cta"
                  disabled={isAddingExpense}
                  className="flex-1"
                >
                  {isAddingExpense ? (
                    <span>Сохраняем…</span>
                  ) : editingExpenseId ? (
                    <span>Сохранить</span>
                  ) : (
                    <>
                      <Plus size={16} aria-hidden="true" />
                      <span>Добавить расход</span>
                    </>
                  )}
                </Button>
                {editingExpenseId ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="cta"
                    onClick={cancelEditingExpense}
                  >
                    Отмена
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>
          </div>

          {/* === Expense list === */}
          <Card className="!p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <SectionHeader
                icon={<ListChecks size={16} aria-hidden="true" />}
                title="Траты"
                meta={`${state.expenses.length} ${plural(
                  state.expenses.length,
                  "запись",
                  "записи",
                  "записей",
                )}`}
                bare
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetProject}
                aria-label="Очистить расчёт"
              >
                <Trash2 size={14} aria-hidden="true" />
                <span className="hidden sm:inline">Очистить</span>
              </Button>
            </div>
            <label
              htmlFor="expenseSort"
              className="grid gap-1.5 max-w-[280px] mb-3"
            >
              <span className="text-[0.78rem] font-medium text-muted">
                Сортировка
              </span>
              <Select
                id="expenseSort"
                value={state.expenseSort}
                onChange={(event) => changeSort(event.target.value)}
              >
                <option value="created-desc">По добавлению</option>
                <option value="name-asc">Покупки А-Я</option>
                <option value="name-desc">Покупки Я-А</option>
                <option value="payer-asc">Платившие А-Я</option>
                <option value="payer-desc">Платившие Я-А</option>
              </Select>
            </label>
            {usedCategories.size > 1 ? (
              <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label="Фильтр по категории">
                <CategoryFilterChip
                  active={categoryFilter === "all"}
                  onClick={() => setCategoryFilter("all")}
                  label="Все"
                />
                {CATEGORIES.filter((c) => usedCategories.has(c.id)).map((c) => (
                  <CategoryFilterChip
                    key={c.id}
                    active={categoryFilter === c.id}
                    onClick={() => setCategoryFilter(c.id)}
                    label={`${c.emoji} ${c.name_ru}`}
                  />
                ))}
              </div>
            ) : null}
            <div className="grid gap-2">
              {!state.expenses.length ? (
                <EmptyState
                  title="Трат пока нет"
                  hint="Добавьте первую покупку или общий платёж."
                />
              ) : visibleExpenses.length === 0 ? (
                <EmptyState
                  title="Нет трат в этой категории"
                  hint="Снимите фильтр или добавьте новую трату."
                />
              ) : (
                visibleExpenses.map((expense) => {
                  const code = expense.currency ?? primaryCurrency;
                  const isSecondary = code !== primaryCurrency;
                  const justAdded = expense.id === lastAddedExpenseId;
                  const cat = getCategory(expense.category);
                  return (
                    <article
                      key={expense.id}
                      className={[
                        "border border-line rounded-card bg-paper px-4 py-3 grid gap-1.5",
                        justAdded ? "animate-[slideUp_220ms_ease-out]" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex flex-col items-start gap-1.5">
                          <strong className="text-[0.98rem] font-semibold text-ink min-w-0 break-words">
                            {expense.name}
                          </strong>
                          <span
                            className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[0.72rem] font-semibold"
                            style={{
                              backgroundColor: cat.bg,
                              color: cat.fg,
                            }}
                          >
                            <span aria-hidden="true">{cat.emoji}</span>
                            <span>{cat.name_ru}</span>
                          </span>
                        </div>
                        <div className="flex items-start gap-2 shrink-0">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-mono tabular-nums font-semibold text-ink whitespace-nowrap text-[0.95rem]">
                              {formatMoney(expense.amount, code, {
                                compact: true,
                              })}
                            </span>
                            {isSecondary ? (
                              <span className="text-[0.76rem] text-muted font-mono tabular-nums whitespace-nowrap">
                                ≈{" "}
                                {formatMoney(
                                  toPrimary(expense),
                                  primaryCurrency,
                                  { compact: true },
                                )}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <button
                              type="button"
                              aria-label={`Редактировать ${expense.name}`}
                              onClick={() => startEditingExpense(expense)}
                              className="inline-flex items-center justify-center h-7 w-7 rounded-control bg-[#F4F4F1] text-muted hover:bg-accent-soft hover:text-accent-dark transition-colors"
                            >
                              <Pencil size={13} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Удалить ${expense.name}`}
                              onClick={() => removeExpense(expense.id)}
                              className="inline-flex items-center justify-center h-7 w-7 rounded-control bg-[#F4F4F1] text-muted hover:bg-[#FBEAE7] hover:text-danger transition-colors"
                            >
                              <X size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <p className="text-[0.85rem] text-muted leading-snug">
                        Оплатил: {getPersonName(expense.payerId)}. Участвуют:{" "}
                        {expense.participantIds.map(getPersonName).join(", ")}.
                      </p>
                    </article>
                  );
                })
              )}
            </div>
          </Card>

          {/* === Summary === */}
          <div ref={summaryRef}>
            <Card className="!p-5 !bg-gradient-to-b from-white to-accent-soft/40">
              <SectionHeader
                icon={<WalletCards size={16} aria-hidden="true" />}
                title="Итог"
                meta={`${formatMoney(totalAmountPrimary, primaryCurrency, {
                  compact: true,
                })} всего`}
              />
              <div className="grid gap-2 mt-1">
                {!state.expenses.length ? (
                  <EmptyState
                    title="Нет расчёта"
                    hint="Итог появится после добавления трат."
                  />
                ) : !transfers.length ? (
                  <EmptyState
                    title="Все ровно"
                    hint="Никому не нужно переводить деньги."
                  />
                ) : (
                  transfers.map((transfer) => (
                    <article
                      key={`${transfer.from}-${transfer.to}-${transfer.amount}`}
                      className="border border-line rounded-card bg-white px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <strong className="text-[0.95rem] font-semibold text-ink truncate">
                            {getPersonName(transfer.from)}
                          </strong>
                          <ArrowRight
                            size={14}
                            aria-hidden="true"
                            className="text-muted shrink-0"
                          />
                          <strong className="text-[0.95rem] font-semibold text-ink truncate">
                            {getPersonName(transfer.to)}
                          </strong>
                        </div>
                        <span className="font-mono tabular-nums font-bold text-accent whitespace-nowrap">
                          {formatMoney(transfer.amount, primaryCurrency, {
                            compact: true,
                          })}
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </div>
              {categoryTotals.length > 0 ? (
                <div className="mt-4 pt-4 border-t border-line">
                  <h3 className="text-[0.78rem] font-semibold uppercase tracking-[0.1em] text-muted mb-3">
                    По категориям
                  </h3>
                  <div className="grid sm:grid-cols-[auto_1fr] items-center gap-4 sm:gap-6">
                    <CategoryDonut
                      slices={categoryTotals}
                      totalAmount={totalAmountPrimary}
                      currency={primaryCurrency}
                      size={140}
                    />
                    <div className="grid gap-1.5">
                      {categoryTotals.map(({ category, amount }) => (
                        <div
                          key={category.id}
                          className="flex items-center justify-between gap-3"
                        >
                          <span
                            className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[0.78rem] font-semibold"
                            style={{
                              backgroundColor: category.bg,
                              color: category.fg,
                            }}
                          >
                            <span aria-hidden="true">{category.emoji}</span>
                            <span>{category.name_ru}</span>
                          </span>
                          <span className="font-mono tabular-nums font-semibold text-ink whitespace-nowrap text-[0.92rem]">
                            {formatMoney(amount, primaryCurrency, {
                              compact: true,
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              <details className="group mt-4 pt-4 border-t border-line">
                <summary className="inline-flex items-center gap-2 text-[0.92rem] font-semibold text-muted hover:text-ink cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className="transition-transform group-open:rotate-180"
                  />
                  <span>Больше информации</span>
                </summary>
                <div className="grid gap-4 pt-4">
                  <p className="text-[0.95rem] text-muted">
                    Всего потрачено:{" "}
                    <strong className="text-ink font-mono tabular-nums font-semibold">
                      {formatMoney(totalAmountPrimary, primaryCurrency, {
                        compact: true,
                      })}
                    </strong>
                  </p>
                  {paidByPerson.length > 0 && maxPaid > 0 ? (
                    <div className="grid gap-3">
                      <h3 className="text-[1rem] font-bold text-ink">
                        Кто сколько оплатил
                      </h3>
                      <div className="grid gap-2.5">
                        {paidByPerson.map(({ personId, amount }) => (
                          <div key={personId}>
                            <div className="flex items-center justify-between gap-3 mb-1">
                              <span className="text-[0.92rem] text-ink">
                                {getPersonName(personId)}
                              </span>
                              <strong className="font-mono tabular-nums text-[0.92rem] font-semibold text-ink">
                                {formatMoney(amount, primaryCurrency, {
                                  compact: true,
                                })}
                              </strong>
                            </div>
                            <div className="h-2 rounded-full bg-[#F4F4F1] overflow-hidden">
                              <div
                                className="h-full bg-accent transition-[width]"
                                style={{
                                  width: `${
                                    maxPaid > 0
                                      ? Math.round((amount / maxPaid) * 100)
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <h3 className="text-[1rem] font-bold text-ink">
                    Стоимость для каждого
                  </h3>
                  <div className="grid gap-2">
                    {!personalCosts.length ? (
                      <EmptyState
                        title="Нет участников"
                        hint="Добавьте людей и траты."
                      />
                    ) : (
                      personalCosts.map((cost) => (
                        <div
                          key={cost.personId}
                          className="flex items-center justify-between gap-4 border border-line rounded-control bg-white px-3.5 py-2.5"
                        >
                          <span className="text-[0.93rem] text-ink truncate">
                            {getPersonName(cost.personId)}
                          </span>
                          <strong className="font-mono tabular-nums font-semibold text-ink whitespace-nowrap">
                            {formatMoney(cost.amount, primaryCurrency, {
                              compact: true,
                            })}
                          </strong>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </details>
            </Card>
          </div>
        </div>
      </fieldset>

      {confirmDialog}
      {toast}
    </main>
  );
}

function SectionHeader({
  icon,
  title,
  meta,
  bare = false,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  bare?: boolean;
}) {
  return (
    <div className={bare ? "" : "mb-4"}>
      <div className="flex items-center gap-2">
        <span className="inline-grid place-items-center h-7 w-7 rounded-control bg-[#F4F4F1] text-ink">
          {icon}
        </span>
        <h2 className="text-[1.05rem] font-bold tracking-[-0.01em] text-ink">
          {title}
        </h2>
      </div>
      {meta ? (
        <p className="text-[0.85rem] text-muted mt-1 ml-9">{meta}</p>
      ) : null}
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="grid gap-1 border border-dashed border-line rounded-card bg-paper px-4 py-5 text-center">
      <strong className="text-[0.95rem] font-semibold text-ink">{title}</strong>
      <span className="text-[0.85rem] text-muted leading-snug">{hint}</span>
    </div>
  );
}

function CurrencyToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "inline-flex items-center justify-center h-9 px-3 rounded-[6px] text-[0.88rem] font-semibold transition-colors",
        active
          ? "bg-white text-ink shadow-xs"
          : "bg-transparent text-muted hover:text-ink",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function SyncIndicator({ status }: { status: SyncStatus }) {
  if (status === "idle") return null;
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-[0.72rem] font-medium text-muted">
        <Loader2 size={12} aria-hidden="true" className="animate-spin" />
        <span>Сохраняется…</span>
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-[0.72rem] font-medium text-accent-dark">
        <Check size={12} aria-hidden="true" />
        <span>Сохранено</span>
      </span>
    );
  }
  // error
  return (
    <span className="inline-flex items-center gap-1 text-[0.72rem] font-medium text-danger">
      <CloudOff size={12} aria-hidden="true" />
      <span>Не сохранено</span>
    </span>
  );
}

function CategoryFilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "inline-flex items-center h-7 px-3 rounded-full text-[0.78rem] font-semibold transition-colors border",
        active
          ? "bg-ink text-white border-ink"
          : "bg-white text-muted border-line hover:border-[#D4D4D8] hover:text-ink",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
