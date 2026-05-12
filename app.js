const STORAGE_KEY = "split-app-state-v1";

const state = {
  projectId: null,
  projectName: "Событие",
  people: [],
  expenses: [],
};

const remote = normalizeRemoteConfig(window.SPLIT_APP_CONFIG);
let isHydrating = false;
let remoteSaveTimer = null;

const currency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

const nodes = {
  projectName: document.querySelector("#projectName"),
  personForm: document.querySelector("#personForm"),
  personName: document.querySelector("#personName"),
  peopleList: document.querySelector("#peopleList"),
  peopleCount: document.querySelector("#peopleCount"),
  expenseForm: document.querySelector("#expenseForm"),
  expenseName: document.querySelector("#expenseName"),
  expenseAmount: document.querySelector("#expenseAmount"),
  expensePayer: document.querySelector("#expensePayer"),
  expenseParticipants: document.querySelector("#expenseParticipants"),
  expensesList: document.querySelector("#expensesList"),
  expensesCount: document.querySelector("#expensesCount"),
  totalAmount: document.querySelector("#totalAmount"),
  summaryList: document.querySelector("#summaryList"),
  selectAllButton: document.querySelector("#selectAllButton"),
  selectNoneButton: document.querySelector("#selectNoneButton"),
  resetButton: document.querySelector("#resetButton"),
  shareProjectButton: document.querySelector("#shareProjectButton"),
  emptyStateTemplate: document.querySelector("#emptyStateTemplate"),
};

function makeId() {
  if ("crypto" in window && "randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeProjectId() {
  return makeId().replaceAll("-", "").slice(0, 16);
}

function money(value) {
  return currency.format(value).replace(",00", "");
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleRemoteSave();
}

async function loadState() {
  isHydrating = true;
  const projectId = getProjectIdFromUrl();

  if (projectId && remote.enabled) {
    const remoteState = await fetchRemoteProject(projectId);
    if (remoteState) {
      Object.assign(state, normalizeState({ ...remoteState, projectId }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      isHydrating = false;
      return;
    }
  }

  const sharedState = new URLSearchParams(window.location.search).get("data");

  if (sharedState) {
    try {
      const decoded = JSON.parse(decodeURIComponent(escape(atob(sharedState))));
      Object.assign(state, normalizeState(decoded));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.history.replaceState({}, "", window.location.pathname);
      isHydrating = false;
      return;
    } catch (error) {
      console.warn("Unable to read shared project data", error);
    }
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    if (projectId) {
      state.projectId = projectId;
    }
    isHydrating = false;
    return;
  }

  try {
    Object.assign(state, normalizeState(JSON.parse(saved)));
    if (projectId) {
      state.projectId = projectId;
    }
  } catch (error) {
    console.warn("Unable to read saved project data", error);
  }

  isHydrating = false;
}

function normalizeState(value) {
  return {
    projectId: typeof value.projectId === "string" && value.projectId.trim() ? value.projectId : null,
    projectName: typeof value.projectName === "string" && value.projectName.trim() ? value.projectName : "Событие",
    people: Array.isArray(value.people) ? value.people.filter((person) => person.id && person.name) : [],
    expenses: Array.isArray(value.expenses)
      ? value.expenses.filter((expense) => expense.id && expense.name && expense.payerId && Number(expense.amount) > 0)
      : [],
  };
}

function normalizeRemoteConfig(config) {
  const url = config?.supabaseUrl?.replace(/\/$/, "");
  const anonKey = config?.supabaseAnonKey;
  const publicBaseUrl = config?.publicBaseUrl?.replace(/\/$/, "");

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

function setProjectIdInUrl(projectId) {
  const url = new URL(window.location.href);
  url.searchParams.delete("data");
  url.searchParams.set("project", projectId);
  window.history.replaceState({}, "", url);
}

function makeProjectUrl(paramName, value) {
  const baseUrl = remote.publicBaseUrl || `${window.location.origin}${window.location.pathname}`;
  const url = new URL(baseUrl);
  url.searchParams.set(paramName, value);
  return url.toString();
}

function getPayload() {
  return {
    projectName: state.projectName,
    people: state.people,
    expenses: state.expenses,
  };
}

function getRemoteHeaders(extra = {}) {
  return {
    apikey: remote.anonKey,
    Authorization: `Bearer ${remote.anonKey}`,
    ...extra,
  };
}

async function fetchRemoteProject(projectId) {
  try {
    const response = await fetch(
      `${remote.url}/rest/v1/projects?public_id=eq.${encodeURIComponent(projectId)}&select=public_id,name,payload`,
      {
        headers: getRemoteHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`Supabase returned ${response.status}`);
    }

    const rows = await response.json();
    return rows[0]?.payload ?? null;
  } catch (error) {
    console.warn("Unable to load remote project", error);
    return null;
  }
}

function scheduleRemoteSave() {
  if (isHydrating || !remote.enabled) {
    return;
  }

  clearTimeout(remoteSaveTimer);
  remoteSaveTimer = setTimeout(() => {
    saveRemoteProject().catch((error) => console.warn("Unable to save remote project", error));
  }, 450);
}

async function saveRemoteProject() {
  if (!remote.enabled) {
    return null;
  }

  if (!state.projectId) {
    state.projectId = makeProjectId();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setProjectIdInUrl(state.projectId);
  }

  const response = await fetch(`${remote.url}/rest/v1/projects?on_conflict=public_id`, {
    method: "POST",
    headers: getRemoteHeaders({
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    }),
    body: JSON.stringify({
      public_id: state.projectId,
      name: state.projectName,
      payload: getPayload(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase returned ${response.status}`);
  }

  return state.projectId;
}

function makeEmptyState(title, text) {
  const element = nodes.emptyStateTemplate.content.firstElementChild.cloneNode(true);
  element.querySelector("strong").textContent = title;
  element.querySelector("span").textContent = text;
  return element;
}

function getPersonName(personId) {
  return state.people.find((person) => person.id === personId)?.name ?? "Неизвестно";
}

function getSelectedParticipantIds() {
  return [...nodes.expenseParticipants.querySelectorAll("input:checked")].map((input) => input.value);
}

function renderPeople() {
  nodes.peopleCount.textContent = `${state.people.length} ${plural(state.people.length, "человек", "человека", "человек")}`;
  nodes.peopleList.replaceChildren();

  if (!state.people.length) {
    nodes.peopleList.append(makeEmptyState("Пока никого", "Добавьте участников, чтобы завести первый расход."));
  } else {
    state.people.forEach((person) => {
      const chip = document.createElement("div");
      chip.className = "chip";

      const label = document.createElement("span");
      label.textContent = person.name;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.setAttribute("aria-label", `Удалить ${person.name}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => removePerson(person.id));

      chip.append(label, remove);
      nodes.peopleList.append(chip);
    });
  }

  renderPayerOptions();
  renderParticipantOptions();
}

function renderPayerOptions() {
  nodes.expensePayer.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = state.people.length ? "Выберите" : "Сначала добавьте людей";
  nodes.expensePayer.append(placeholder);

  state.people.forEach((person) => {
    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = person.name;
    nodes.expensePayer.append(option);
  });
}

function renderParticipantOptions() {
  const previousSelection = new Set(getSelectedParticipantIds());
  nodes.expenseParticipants.replaceChildren();

  if (!state.people.length) {
    nodes.expenseParticipants.append(makeEmptyState("Нет участников", "После добавления людей здесь появится выбор."));
    return;
  }

  state.people.forEach((person) => {
    const label = document.createElement("label");
    label.className = "participant-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = person.id;
    checkbox.checked = previousSelection.size ? previousSelection.has(person.id) : true;

    const name = document.createElement("span");
    name.textContent = person.name;

    label.append(checkbox, name);
    nodes.expenseParticipants.append(label);
  });
}

function renderExpenses() {
  nodes.expensesCount.textContent = `${state.expenses.length} ${plural(state.expenses.length, "запись", "записи", "записей")}`;
  nodes.expensesList.replaceChildren();

  if (!state.expenses.length) {
    nodes.expensesList.append(makeEmptyState("Расходов пока нет", "Добавьте первую покупку или общий платеж."));
    return;
  }

  state.expenses.forEach((expense) => {
    const item = document.createElement("article");
    item.className = "expense-item";

    const main = document.createElement("div");
    main.className = "expense-main";

    const title = document.createElement("strong");
    title.textContent = expense.name;

    const amount = document.createElement("span");
    amount.className = "money";
    amount.textContent = money(expense.amount);

    const remove = document.createElement("button");
    remove.className = "expense-remove";
    remove.type = "button";
    remove.setAttribute("aria-label", `Удалить ${expense.name}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => removeExpense(expense.id));

    const amountBox = document.createElement("div");
    amountBox.className = "expense-main";
    amountBox.append(amount, remove);

    main.append(title, amountBox);

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = `Оплатил: ${getPersonName(expense.payerId)}. Участвуют: ${expense.participantIds.map(getPersonName).join(", ")}.`;

    item.append(main, meta);
    nodes.expensesList.append(item);
  });
}

function renderSummary() {
  const total = state.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  nodes.totalAmount.textContent = `${money(total)} всего`;
  nodes.summaryList.replaceChildren();

  const transfers = calculateTransfers();

  if (!state.expenses.length) {
    nodes.summaryList.append(makeEmptyState("Нет расчета", "Итог появится после добавления расходов."));
    return;
  }

  if (!transfers.length) {
    nodes.summaryList.append(makeEmptyState("Все ровно", "Никому не нужно переводить деньги."));
    return;
  }

  transfers.forEach((transfer) => {
    const item = document.createElement("article");
    item.className = "summary-item";

    const main = document.createElement("div");
    main.className = "summary-main";

    const text = document.createElement("strong");
    text.textContent = `${getPersonName(transfer.from)} → ${getPersonName(transfer.to)}`;

    const amount = document.createElement("span");
    amount.className = "money";
    amount.textContent = money(transfer.amount);

    main.append(text, amount);
    item.append(main);
    nodes.summaryList.append(item);
  });
}

function render() {
  nodes.projectName.value = state.projectName;
  renderPeople();
  renderExpenses();
  renderSummary();
}

function calculateTransfers() {
  const balances = new Map(state.people.map((person) => [person.id, 0]));

  state.expenses.forEach((expense) => {
    const amount = Number(expense.amount);
    const participantIds = expense.participantIds.filter((id) => balances.has(id));
    if (!participantIds.length || !balances.has(expense.payerId)) {
      return;
    }

    balances.set(expense.payerId, balances.get(expense.payerId) + amount);

    const share = amount / participantIds.length;
    participantIds.forEach((personId) => {
      balances.set(personId, balances.get(personId) - share);
    });
  });

  const debtors = [];
  const creditors = [];

  balances.forEach((balance, personId) => {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded < -0.009) {
      debtors.push({ personId, amount: Math.abs(rounded) });
    }
    if (rounded > 0.009) {
      creditors.push({ personId, amount: rounded });
    }
  });

  const transfers = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.009) {
      transfers.push({
        from: debtor.personId,
        to: creditor.personId,
        amount: Math.round(amount * 100) / 100,
      });
    }

    debtor.amount = Math.round((debtor.amount - amount) * 100) / 100;
    creditor.amount = Math.round((creditor.amount - amount) * 100) / 100;

    if (debtor.amount <= 0.009) {
      debtorIndex += 1;
    }
    if (creditor.amount <= 0.009) {
      creditorIndex += 1;
    }
  }

  return transfers;
}

function addPerson(name) {
  const cleanName = name.trim();
  if (!cleanName) {
    return;
  }

  const exists = state.people.some((person) => person.name.toLowerCase() === cleanName.toLowerCase());
  if (exists) {
    nodes.personName.setCustomValidity("Такой участник уже есть");
    nodes.personName.reportValidity();
    nodes.personName.setCustomValidity("");
    return;
  }

  state.people.push({ id: makeId(), name: cleanName });
  saveState();
  render();
}

function removePerson(personId) {
  const isUsed = state.expenses.some(
    (expense) => expense.payerId === personId || expense.participantIds.includes(personId),
  );

  if (isUsed) {
    alert("Участник уже есть в расходах. Сначала удалите связанные расходы.");
    return;
  }

  state.people = state.people.filter((person) => person.id !== personId);
  saveState();
  render();
}

function removeExpense(expenseId) {
  state.expenses = state.expenses.filter((expense) => expense.id !== expenseId);
  saveState();
  render();
}

function addExpense() {
  const participantIds = getSelectedParticipantIds();
  const payerId = nodes.expensePayer.value;
  const amount = Number(nodes.expenseAmount.value);

  if (!state.people.length) {
    alert("Сначала добавьте участников.");
    return;
  }

  if (!participantIds.length) {
    alert("Выберите хотя бы одного участника расхода.");
    return;
  }

  state.expenses.push({
    id: makeId(),
    name: nodes.expenseName.value.trim(),
    amount,
    payerId,
    participantIds,
    createdAt: new Date().toISOString(),
  });

  nodes.expenseForm.reset();
  renderParticipantOptions();
  saveState();
  render();
}

function plural(count, one, few, many) {
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

async function shareProject() {
  let url;

  if (remote.enabled) {
    const projectId = await saveRemoteProject();
    url = makeProjectUrl("project", projectId);
  } else {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    url = makeProjectUrl("data", encoded);
  }

  const text = `Расчет "${state.projectName}"`;

  if (navigator.share) {
    await navigator.share({ title: "Скинуться", text, url });
    return;
  }

  await navigator.clipboard.writeText(url);
  alert("Ссылка скопирована.");
}

function resetProject() {
  if (!confirm("Очистить весь расчет?")) {
    return;
  }

  state.projectName = "Событие";
  state.projectId = remote.enabled ? makeProjectId() : null;
  state.people = [];
  state.expenses = [];
  saveState();
  if (state.projectId) {
    setProjectIdInUrl(state.projectId);
  }
  render();
}

nodes.projectName.addEventListener("input", (event) => {
  state.projectName = event.target.value.trim() || "Событие";
  saveState();
});

nodes.personForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addPerson(nodes.personName.value);
  nodes.personName.value = "";
  nodes.personName.focus();
});

nodes.expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addExpense();
});

nodes.selectAllButton.addEventListener("click", () => {
  nodes.expenseParticipants.querySelectorAll("input").forEach((input) => {
    input.checked = true;
  });
});

nodes.selectNoneButton.addEventListener("click", () => {
  nodes.expenseParticipants.querySelectorAll("input").forEach((input) => {
    input.checked = false;
  });
});

nodes.resetButton.addEventListener("click", resetProject);
nodes.shareProjectButton.addEventListener("click", () => {
  shareProject().catch((error) => console.warn("Share failed", error));
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("Service worker failed", error));
  });
}

loadState().then(() => {
  render();
});
