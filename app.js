const STORAGE_KEYS = {
  transactions: 'budgetcopilot_transactions',
  budgets: 'budgetcopilot_budgets',
  rules: 'budgetcopilot_rules',
};

const defaultBudgets = [
  { category: 'Housing', amount: 1800, rollover: false },
  { category: 'Groceries', amount: 550, rollover: false },
  { category: 'Transportation', amount: 280, rollover: true },
  { category: 'Utilities', amount: 320, rollover: false },
  { category: 'Entertainment', amount: 200, rollover: true },
];

const sampleTransactions = [
  {
    id: crypto.randomUUID(),
    date: '2024-12-01',
    description: 'Rent payment',
    amount: 1785,
    category: 'Housing',
    source: 'Imported',
  },
  {
    id: crypto.randomUUID(),
    date: '2024-12-02',
    description: 'Grocery Store Market',
    amount: 126.5,
    category: 'Groceries',
    source: 'Imported',
  },
  {
    id: crypto.randomUUID(),
    date: '2024-12-03',
    description: 'Ride share',
    amount: 34.9,
    category: 'Transportation',
    source: 'Imported',
  },
];

const state = {
  transactions: loadFromStorage(STORAGE_KEYS.transactions, sampleTransactions),
  budgets: loadFromStorage(STORAGE_KEYS.budgets, defaultBudgets),
  rules: loadFromStorage(STORAGE_KEYS.rules, {}),
};

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.warn('Falling back to defaults', err);
    return fallback;
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(state.transactions));
  localStorage.setItem(STORAGE_KEYS.budgets, JSON.stringify(state.budgets));
  localStorage.setItem(STORAGE_KEYS.rules, JSON.stringify(state.rules));
}

function setActiveTab(tab) {
  document.querySelectorAll('.tab').forEach((button) => {
    const isActive = button.dataset.tab === tab;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', isActive);
  });

  document.querySelectorAll('.panel').forEach((panel) => {
    const isActive = panel.id === tab;
    panel.classList.toggle('active', isActive);
    panel.setAttribute('aria-hidden', !isActive);
  });
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function categorizeDescription(description) {
  const desc = description.toLowerCase();

  // Learned rules first
  for (const [keyword, category] of Object.entries(state.rules)) {
    if (desc.includes(keyword)) return category;
  }

  if (/(rent|mortgage)/.test(desc)) return 'Housing';
  if (/(grocery|market|supermarket|whole foods)/.test(desc)) return 'Groceries';
  if (/(uber|lyft|ride|fuel|gas|metro)/.test(desc)) return 'Transportation';
  if (/(netflix|spotify|hulu|cinema|movie|concert)/.test(desc)) return 'Entertainment';
  if (/(utility|electric|water|gas|internet|wifi)/.test(desc)) return 'Utilities';
  if (/(insurance|premium|policy)/.test(desc)) return 'Insurance';
  return 'Other';
}

function simulateExtraction(file) {
  const seed = hashString(file.name + file.size);
  const vendors = ['Grocery Mart', 'Fuel Station', 'City Utilities', 'Cinema Night', 'Gym Membership'];
  const templates = vendors.map((vendor, index) => ({
    date: new Date(Date.now() - (index + 2) * 86400000).toISOString().slice(0, 10),
    description: vendor,
    amount: Math.round(((seed % (index + 5)) + 20 + index * 7) * 10) / 10,
  }));

  return templates.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
    category: categorizeDescription(item.description),
    source: `Scan: ${file.name}`,
  }));
}

function learnFromCorrection(description, category) {
  const keyword = description
    .split(' ')
    .map((w) => w.toLowerCase())
    .find((w) => w.length > 3);
  if (keyword) {
    state.rules[keyword] = category;
    persistState();
    document.getElementById('learning-status').textContent = `Learning: "${keyword}" → ${category}`;
  }
}

function renderScanResults(transactions) {
  const container = document.getElementById('scan-results');
  if (!transactions.length) {
    container.innerHTML = '<p class="small">No scans yet.</p>';
    return;
  }

  const total = transactions.reduce((sum, t) => sum + t.amount, 0).toFixed(2);
  const categories = transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + 1;
    return acc;
  }, {});

  container.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Extraction preview</p>
        <h3>${transactions.length} transactions added · $${total}</h3>
      </div>
      <div class="tag">Auto-labeled with AI</div>
    </div>
    <div class="inline small" style="gap: 8px; flex-wrap: wrap;">
      ${Object.entries(categories)
        .map(([cat, count]) => `<span class="badge">${cat}: ${count}</span>`)
        .join('')}
    </div>
  `;
}

function renderTransactions() {
  const container = document.getElementById('transactions-table');
  if (!state.transactions.length) {
    container.innerHTML = '<p class="small">No transactions yet. Scan a document to add some.</p>';
    return;
  }

  const rows = state.transactions
    .map(
      (t) => `
        <tr>
          <td>${t.date}</td>
          <td>
            <div>${t.description}</div>
            <div class="small">${t.source}</div>
          </td>
          <td>
            <select data-id="${t.id}" class="category-picker">
              ${renderCategoryOptions(t.category)}
            </select>
          </td>
          <td class="amount">$${t.amount.toFixed(2)}</td>
        </tr>
      `,
    )
    .join('');

  container.innerHTML = `
    <div class="alert">Changes instantly update the model for future auto-labeling.</div>
    <table class="table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Category</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  container.querySelectorAll('.category-picker').forEach((select) => {
    select.addEventListener('change', (event) => {
      const { value } = event.target;
      const id = event.target.dataset.id;
      const tx = state.transactions.find((t) => t.id === id);
      if (!tx) return;
      tx.category = value;
      learnFromCorrection(tx.description, value);
      persistState();
      renderBudgetSummary();
      renderTransactions();
    });
  });
}

function renderCategoryOptions(selected) {
  const categories = Array.from(
    new Set([...state.budgets.map((b) => b.category), selected, 'Other'].filter(Boolean)),
  );
  return categories
    .sort()
    .map((category) => `<option value="${category}" ${selected === category ? 'selected' : ''}>${category}</option>`) // eslint-disable-line
    .join('');
}

function renderBudgetForm() {
  const container = document.getElementById('budget-form');
  container.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Categories</p>
        <h3>Edit your plan</h3>
      </div>
    </div>
    <form id="new-budget" class="form-row">
      <div>
        <label class="small">Category</label>
        <input type="text" name="category" placeholder="Travel" required />
      </div>
      <div>
        <label class="small">Amount</label>
        <input type="number" name="amount" placeholder="500" min="0" step="10" required />
      </div>
      <div class="inline" style="gap: 8px; align-self: center;">
        <input type="checkbox" name="rollover" id="rollover" />
        <label for="rollover">Rollover unused balance</label>
      </div>
      <div>
        <button class="primary" type="submit">Add / update</button>
      </div>
    </form>
  `;

  container.querySelector('#new-budget').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const category = data.get('category').trim();
    const amount = Number(data.get('amount'));
    const rollover = data.get('rollover') === 'on';

    if (!category || Number.isNaN(amount)) return;
    const existing = state.budgets.find((b) => b.category.toLowerCase() === category.toLowerCase());
    if (existing) {
      existing.amount = amount;
      existing.rollover = rollover;
    } else {
      state.budgets.push({ category, amount, rollover });
    }
    persistState();
    renderBudgetSummary();
    renderCategoryOptions();
    renderTransactions();
    event.target.reset();
  });
}

function renderBudgetSummary() {
  const container = document.getElementById('budget-summary');
  const spendByCategory = state.transactions.reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
    return acc;
  }, {});

  const cards = state.budgets
    .map((budget) => {
      const spent = spendByCategory[budget.category] || 0;
      const pct = Math.min(100, Math.round((spent / budget.amount) * 100));
      const remaining = Math.max(0, budget.amount - spent).toFixed(2);
      return `
        <div class="card" style="margin-bottom: 10px;">
          <div class="panel-header">
            <div>
              <p class="eyebrow">${budget.rollover ? 'Rollover' : 'Resets monthly'}</p>
              <h3>${budget.category}</h3>
            </div>
            <div class="badge">Budget: $${budget.amount.toFixed(2)}</div>
          </div>
          <p class="small">Spent: $${spent.toFixed(2)} · Remaining: $${remaining}</p>
          <div class="progress"><span style="width: ${pct}%;"></span></div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Overview</p>
        <h3>Category performance</h3>
      </div>
      <div class="tag">${state.budgets.length} categories</div>
    </div>
    ${cards || '<p class="small">Add categories to start planning.</p>'}
  `;
}

function handleFile(file) {
  const newTransactions = simulateExtraction(file);
  state.transactions = [...newTransactions, ...state.transactions];
  persistState();
  renderScanResults(newTransactions);
  renderTransactions();
  renderBudgetSummary();
}

function setupUpload() {
  const input = document.getElementById('statement-input');
  const dropZone = document.getElementById('drop-zone');
  const button = document.getElementById('upload-button');

  button.addEventListener('click', () => input.click());
  input.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', (event) => {
      const target = event.currentTarget.dataset.tab;
      setActiveTab(target);
    });
  });
}

function init() {
  setupTabs();
  setupUpload();
  renderScanResults([]);
  renderTransactions();
  renderBudgetForm();
  renderBudgetSummary();
}

document.addEventListener('DOMContentLoaded', init);
