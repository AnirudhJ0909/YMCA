/* Expense Tracker - Vanilla JS, LocalStorage persistence */
(function() {
  'use strict';

  // Storage Keys
  const STORAGE_KEYS = {
    expenses: 'et_expenses_v1',
    categories: 'et_categories_v1',
    settings: 'et_settings_v1'
  };

  // State
  /** @type {{ id: string, date: string, amount: number, category: string, description: string, createdAt: string, updatedAt: string }[]} */
  let expenses = [];
  /** @type {string[]} */
  let categories = [];
  /** @type {{ currencySymbol: string, currencyPosition: 'prefix'|'suffix', monthlyBudget: number }} */
  let settings = { currencySymbol: '$', currencyPosition: 'prefix', monthlyBudget: 0 };

  // DOM refs
  const refs = {
    addExpenseBtn: document.getElementById('add-expense-btn'),
    exportJsonBtn: document.getElementById('export-json-btn'),
    exportCsvBtn: document.getElementById('export-csv-btn'),
    importBtn: document.getElementById('import-btn'),
    openSettingsBtn: document.getElementById('open-settings-btn'),
    manageCategoriesBtn: document.getElementById('manage-categories-btn'),

    // Filters
    filterFrom: document.getElementById('filter-from'),
    filterTo: document.getElementById('filter-to'),
    filterCategory: document.getElementById('filter-category'),
    filterSearch: document.getElementById('filter-search'),
    sortSelect: document.getElementById('sort-select'),
    clearFiltersBtn: document.getElementById('clear-filters-btn'),

    // Table
    expensesTbody: document.getElementById('expenses-tbody'),
    emptyState: document.getElementById('empty-state'),

    // Summary
    summaryTotal: document.getElementById('summary-total'),
    monthSummary: document.getElementById('month-summary'),
    budgetProgressBar: document.getElementById('budget-progress-bar'),
    budgetProgressText: document.getElementById('budget-progress-text'),

    // Modals: Expense
    expenseModal: document.getElementById('expense-modal'),
    closeExpenseModal: document.getElementById('close-expense-modal'),
    expenseForm: document.getElementById('expense-form'),
    expenseModalTitle: document.getElementById('expense-modal-title'),
    expenseId: document.getElementById('expense-id'),
    expenseDate: document.getElementById('expense-date'),
    expenseAmount: document.getElementById('expense-amount'),
    expenseCategory: document.getElementById('expense-category'),
    expenseDescription: document.getElementById('expense-description'),
    cancelExpenseBtn: document.getElementById('cancel-expense-btn'),

    // Modals: Categories
    categoriesModal: document.getElementById('categories-modal'),
    closeCategoriesModal: document.getElementById('close-categories-modal'),
    categoriesList: document.getElementById('categories-list'),
    newCategoryInput: document.getElementById('new-category-input'),
    addCategoryBtn: document.getElementById('add-category-btn'),

    // Modals: Settings
    settingsModal: document.getElementById('settings-modal'),
    closeSettingsModal: document.getElementById('close-settings-modal'),
    settingsForm: document.getElementById('settings-form'),
    currencySymbol: document.getElementById('currency-symbol'),
    currencyPosition: document.getElementById('currency-position'),
    monthlyBudget: document.getElementById('monthly-budget'),

    // Import
    importModal: document.getElementById('import-modal'),
    closeImportModal: document.getElementById('close-import-modal'),
    importFileInput: document.getElementById('import-file-input'),
    cancelImportBtn: document.getElementById('cancel-import-btn'),
    confirmImportBtn: document.getElementById('confirm-import-btn'),

    // Charts
    categoryChartCanvas: document.getElementById('categoryChart'),
    monthlyChartCanvas: document.getElementById('monthlyChart'),
  };

  // Utils
  function generateId() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function todayISODate() {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getMonthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function getMonthEnd(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function formatCurrency(amount) {
    const formatted = Number(amount).toFixed(2);
    return settings.currencyPosition === 'prefix'
      ? `${settings.currencySymbol}${formatted}`
      : `${formatted} ${settings.currencySymbol}`;
  }

  function loadState() {
    try {
      const e = JSON.parse(localStorage.getItem(STORAGE_KEYS.expenses) || '[]');
      const c = JSON.parse(localStorage.getItem(STORAGE_KEYS.categories) || '[]');
      const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || 'null');
      if (Array.isArray(e)) expenses = e;
      if (Array.isArray(c) && c.length) categories = c;
      if (s && typeof s === 'object') settings = { ...settings, ...s };
    } catch (err) {
      console.warn('Failed to load state', err);
    }

    if (!categories || categories.length === 0) {
      categories = [
        'Other',
        'Food', 'Transport', 'Housing', 'Utilities', 'Entertainment',
        'Healthcare', 'Education', 'Shopping', 'Travel'
      ];
    }
  }

  function saveExpenses() {
    localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(expenses));
  }
  function saveCategories() {
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories));
  }
  function saveSettings() {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }

  // Filtering & Sorting
  function getFilters() {
    return {
      from: refs.filterFrom.value ? new Date(refs.filterFrom.value) : null,
      to: refs.filterTo.value ? new Date(refs.filterTo.value) : null,
      category: refs.filterCategory.value,
      search: refs.filterSearch.value.trim().toLowerCase(),
      sort: refs.sortSelect.value,
    };
  }

  function applyFiltersAndSorting(list) {
    const { from, to, category, search, sort } = getFilters();
    let out = list.slice();

    if (from) {
      const fromTime = new Date(from.toDateString()).getTime();
      out = out.filter(x => new Date(x.date).getTime() >= fromTime);
    }
    if (to) {
      const toTime = new Date(to.toDateString()).getTime() + 24*60*60*1000 - 1;
      out = out.filter(x => new Date(x.date).getTime() <= toTime);
    }
    if (category && category !== 'all') {
      out = out.filter(x => x.category === category);
    }
    if (search) {
      out = out.filter(x => (x.description || '').toLowerCase().includes(search));
    }

    switch (sort) {
      case 'date_asc':
        out.sort((a,b) => new Date(a.date) - new Date(b.date));
        break;
      case 'amount_desc':
        out.sort((a,b) => b.amount - a.amount);
        break;
      case 'amount_asc':
        out.sort((a,b) => a.amount - b.amount);
        break;
      case 'date_desc':
      default:
        out.sort((a,b) => new Date(b.date) - new Date(a.date));
    }

    return out;
  }

  // Rendering
  function renderCategoryOptions() {
    // For expense form
    refs.expenseCategory.innerHTML = '';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      refs.expenseCategory.appendChild(opt);
    });

    // For filter select (preserve 'all')
    const prev = refs.filterCategory.value || 'all';
    refs.filterCategory.innerHTML = '<option value="all">All</option>' + categories.map(c => `<option value="${c}">${c}</option>`).join('');
    refs.filterCategory.value = prev;
  }

  function renderExpenses() {
    const filtered = applyFiltersAndSorting(expenses);
    refs.expensesTbody.innerHTML = '';

    if (filtered.length === 0) {
      refs.emptyState.hidden = false;
    } else {
      refs.emptyState.hidden = true;
    }

    for (const exp of filtered) {
      const tr = document.createElement('tr');

      const tdDate = document.createElement('td');
      tdDate.textContent = exp.date;
      tr.appendChild(tdDate);

      const tdCat = document.createElement('td');
      tdCat.textContent = exp.category;
      tr.appendChild(tdCat);

      const tdDesc = document.createElement('td');
      tdDesc.textContent = exp.description || '';
      tr.appendChild(tdDesc);

      const tdAmt = document.createElement('td');
      tdAmt.className = 'text-right';
      tdAmt.textContent = formatCurrency(exp.amount);
      tr.appendChild(tdAmt);

      const tdActions = document.createElement('td');
      tdActions.className = 'actions';
      const editBtn = document.createElement('button');
      editBtn.className = 'btn-icon';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => openExpenseModal(exp));
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-icon btn-danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => deleteExpense(exp.id));
      tdActions.append(editBtn, delBtn);
      tr.appendChild(tdActions);

      refs.expensesTbody.appendChild(tr);
    }

    renderSummary(filtered);
    renderCharts(filtered);
  }

  function renderSummary(filtered) {
    const sum = filtered.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    refs.summaryTotal.textContent = formatCurrency(sum);

    // Month-to-date vs budget
    const now = new Date();
    const monthStart = getMonthStart(now);
    const monthEnd = getMonthEnd(now);
    const mtd = expenses
      .filter(e => {
        const t = new Date(e.date).getTime();
        return t >= monthStart.getTime() && t <= monthEnd.getTime();
      })
      .reduce((acc, e) => acc + Number(e.amount || 0), 0);

    refs.monthSummary.textContent = formatCurrency(mtd);

    const budget = Number(settings.monthlyBudget || 0);
    const pct = budget > 0 ? clamp((mtd / budget) * 100, 0, 100) : 0;
    refs.budgetProgressBar.style.width = `${pct}%`;
    refs.budgetProgressBar.style.background = pct >= 100 ? 'linear-gradient(90deg, var(--danger), #dc2626)' : 'linear-gradient(90deg, var(--primary), #10b981)';
    refs.budgetProgressText.textContent = `${formatCurrency(mtd)} / ${formatCurrency(budget)}`;
  }

  // Charts (Chart.js)
  let categoryChartInstance = null;
  let monthlyChartInstance = null;

  function renderCharts(filtered) {
    if (!window.Chart) return; // Chart.js not loaded

    // By Category (based on filtered set)
    const byCatMap = new Map();
    for (const e of filtered) {
      byCatMap.set(e.category, (byCatMap.get(e.category) || 0) + Number(e.amount || 0));
    }
    const catLabels = Array.from(byCatMap.keys());
    const catData = Array.from(byCatMap.values());

    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(refs.categoryChartCanvas, {
      type: 'bar',
      data: {
        labels: catLabels,
        datasets: [{
          label: 'Amount',
          data: catData,
          backgroundColor: 'rgba(34,197,94,0.6)',
          borderColor: 'rgba(34,197,94,1)',
          borderWidth: 1,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,0.08)' } }, x: { ticks: { color: '#cbd5e1' } } },
        plugins: { legend: { labels: { color: '#cbd5e1' } } }
      }
    });

    // Last 12 months (based on all expenses)
    const now = new Date();
    const months = [];
    const monthSums = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months.push(key);
      const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const end = new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999).getTime();
      const sum = expenses.filter(e => {
        const t = new Date(e.date).getTime();
        return t >= start && t <= end;
      }).reduce((acc, e) => acc + Number(e.amount||0), 0);
      monthSums.push(sum);
    }

    if (monthlyChartInstance) monthlyChartInstance.destroy();
    monthlyChartInstance = new Chart(refs.monthlyChartCanvas, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          label: 'Total',
          data: monthSums,
          borderColor: 'rgba(124,58,237,1)',
          backgroundColor: 'rgba(124,58,237,0.3)',
          tension: 0.25,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,0.08)' } }, x: { ticks: { color: '#cbd5e1' } } },
        plugins: { legend: { labels: { color: '#cbd5e1' } } }
      }
    });
  }

  // Expense CRUD
  function openExpenseModal(expense) {
    refs.expenseModal.hidden = false;
    document.body.style.overflow = 'hidden';
    if (expense) {
      refs.expenseModalTitle.textContent = 'Edit Expense';
      refs.expenseId.value = expense.id;
      refs.expenseDate.value = expense.date;
      refs.expenseAmount.value = String(expense.amount);
      refs.expenseCategory.value = expense.category;
      refs.expenseDescription.value = expense.description || '';
    } else {
      refs.expenseModalTitle.textContent = 'Add Expense';
      refs.expenseId.value = '';
      refs.expenseDate.value = todayISODate();
      refs.expenseAmount.value = '';
      refs.expenseCategory.value = categories[0] || 'Other';
      refs.expenseDescription.value = '';
    }
  }

  function closeExpenseModal() {
    refs.expenseModal.hidden = true;
    document.body.style.overflow = '';
  }

  function upsertExpenseFromForm(ev) {
    ev.preventDefault();
    const id = refs.expenseId.value || generateId();
    const date = refs.expenseDate.value;
    const amount = Number(refs.expenseAmount.value);
    const category = refs.expenseCategory.value;
    const description = refs.expenseDescription.value.trim();

    if (!date || !category || !Number.isFinite(amount) || amount < 0) {
      alert('Please enter a valid date, category and non-negative amount.');
      return;
    }

    const existingIndex = expenses.findIndex(e => e.id === id);
    const nowIso = new Date().toISOString();

    if (existingIndex >= 0) {
      expenses[existingIndex] = {
        ...expenses[existingIndex],
        date, amount, category, description,
        updatedAt: nowIso,
      };
    } else {
      expenses.push({ id, date, amount, category, description, createdAt: nowIso, updatedAt: nowIso });
    }

    saveExpenses();
    closeExpenseModal();
    renderExpenses();
  }

  function deleteExpense(id) {
    const exp = expenses.find(e => e.id === id);
    if (!exp) return;
    if (!confirm(`Delete expense: ${formatCurrency(exp.amount)} on ${exp.date}?`)) return;
    expenses = expenses.filter(e => e.id !== id);
    saveExpenses();
    renderExpenses();
  }

  // Categories
  function openCategoriesModal() {
    refs.categoriesModal.hidden = false;
    document.body.style.overflow = 'hidden';
    renderCategoriesList();
  }
  function closeCategoriesModal() {
    refs.categoriesModal.hidden = true;
    document.body.style.overflow = '';
  }
  function renderCategoriesList() {
    refs.categoriesList.innerHTML = '';
    categories.forEach(cat => {
      const li = document.createElement('li');
      li.className = 'category-item';
      const left = document.createElement('div');
      left.className = 'name';
      left.textContent = cat;
      const actions = document.createElement('div');
      actions.className = 'category-actions';

      const renameBtn = document.createElement('button');
      renameBtn.className = 'btn btn-light';
      renameBtn.textContent = 'Rename';
      renameBtn.disabled = (cat === 'Other');
      renameBtn.addEventListener('click', () => {
        const newName = prompt('Rename category', cat);
        if (!newName) return;
        if (categories.includes(newName)) {
          alert('Category already exists.');
          return;
        }
        const idx = categories.indexOf(cat);
        categories[idx] = newName;
        // Update existing expenses
        expenses = expenses.map(e => e.category === cat ? { ...e, category: newName } : e);
        saveCategories();
        saveExpenses();
        renderCategoryOptions();
        renderCategoriesList();
        renderExpenses();
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.disabled = (cat === 'Other');
      deleteBtn.addEventListener('click', () => {
        if (!confirm(`Delete category "${cat}"? Expenses will be moved to "Other".`)) return;
        categories = categories.filter(c => c !== cat);
        expenses = expenses.map(e => e.category === cat ? { ...e, category: 'Other' } : e);
        saveCategories();
        saveExpenses();
        renderCategoryOptions();
        renderCategoriesList();
        renderExpenses();
      });

      actions.append(renameBtn, deleteBtn);
      li.append(left, actions);
      refs.categoriesList.appendChild(li);
    });
  }

  function addCategory() {
    const name = refs.newCategoryInput.value.trim();
    if (!name) return;
    if (categories.includes(name)) {
      alert('Category already exists.');
      return;
    }
    categories.push(name);
    saveCategories();
    refs.newCategoryInput.value = '';
    renderCategoryOptions();
    renderCategoriesList();
  }

  // Settings
  function openSettingsModal() {
    refs.settingsModal.hidden = false;
    document.body.style.overflow = 'hidden';
    refs.currencySymbol.value = settings.currencySymbol || '$';
    refs.currencyPosition.value = settings.currencyPosition || 'prefix';
    refs.monthlyBudget.value = String(settings.monthlyBudget || 0);
  }
  function closeSettingsModal() {
    refs.settingsModal.hidden = true;
    document.body.style.overflow = '';
  }
  function saveSettingsFromForm(ev) {
    ev.preventDefault();
    const symbol = refs.currencySymbol.value.trim() || '$';
    const position = /** @type {'prefix'|'suffix'} */ (refs.currencyPosition.value === 'suffix' ? 'suffix' : 'prefix');
    const budget = Number(refs.monthlyBudget.value || 0);
    settings = { currencySymbol: symbol, currencyPosition: position, monthlyBudget: budget >= 0 ? budget : 0 };
    saveSettings();
    closeSettingsModal();
    renderExpenses();
  }

  // Import / Export
  function exportJSON() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      expenses,
      categories,
      settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `expenses-${new Date().toISOString().slice(0,10)}.json`);
  }

  function exportCSV() {
    const header = ['date','amount','category','description'];
    const lines = [header.join(',')];
    for (const e of expenses) {
      lines.push([
        e.date,
        String(e.amount),
        csvEscape(e.category),
        csvEscape(e.description || '')
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    triggerDownload(blob, `expenses-${new Date().toISOString().slice(0,10)}.csv`);
  }

  function csvEscape(text) {
    const t = String(text);
    if (t.includes(',') || t.includes('"') || t.includes('\n')) {
      return '"' + t.replace(/"/g, '""') + '"';
    }
    return t;
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function openImportModal() {
    refs.importModal.hidden = false;
    document.body.style.overflow = 'hidden';
    refs.importFileInput.value = '';
  }
  function closeImportModal() {
    refs.importModal.hidden = true;
    document.body.style.overflow = '';
  }
  function doImport() {
    const file = refs.importFileInput.files && refs.importFileInput.files[0];
    if (!file) { alert('Choose a file to import'); return; }
    const mode = /** @type {'append'|'replace'} */ (document.querySelector('input[name="import-mode"]:checked')?.value || 'append');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        if (file.name.endsWith('.json')) importFromJSON(text, mode);
        else if (file.name.endsWith('.csv')) importFromCSV(text, mode);
        else throw new Error('Unsupported file type.');
        closeImportModal();
        renderCategoryOptions();
        renderExpenses();
      } catch (err) {
        console.error(err);
        alert('Failed to import: ' + (err && err.message ? err.message : 'Unknown error'));
      }
    };
    reader.readAsText(file);
  }

  function importFromJSON(text, mode) {
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== 'object') throw new Error('Invalid JSON');

    const importedExpenses = Array.isArray(obj.expenses) ? obj.expenses : [];
    const importedCategories = Array.isArray(obj.categories) ? obj.categories : [];
    const importedSettings = obj.settings && typeof obj.settings === 'object' ? obj.settings : null;

    if (mode === 'replace') {
      expenses = importedExpenses.map(coerceExpense);
    } else {
      // append, avoid id collisions
      const existingIds = new Set(expenses.map(e => e.id));
      for (const e of importedExpenses) {
        const ne = coerceExpense(e);
        if (existingIds.has(ne.id)) ne.id = generateId();
        expenses.push(ne);
      }
    }
    if (importedCategories.length) {
      const merged = new Set([ ...categories, ...importedCategories ]);
      categories = Array.from(merged);
    }
    if (importedSettings) {
      settings = { ...settings, ...importedSettings };
    }

    saveExpenses();
    saveCategories();
    saveSettings();
  }

  function importFromCSV(text, mode) {
    const rows = parseCSV(text);
    // Expect header: date,amount,category,description
    const [header, ...dataRows] = rows;
    if (!header || header.length < 3) throw new Error('CSV header missing');
    const idxDate = header.findIndex(h => h.toLowerCase() === 'date');
    const idxAmount = header.findIndex(h => h.toLowerCase() === 'amount');
    const idxCategory = header.findIndex(h => h.toLowerCase() === 'category');
    const idxDesc = header.findIndex(h => h.toLowerCase() === 'description');
    if (idxDate < 0 || idxAmount < 0 || idxCategory < 0) throw new Error('CSV must include date, amount, category');

    const imported = [];
    for (const r of dataRows) {
      if (!r || r.length === 0) continue;
      const date = (r[idxDate] || '').slice(0,10);
      const amount = Number(r[idxAmount] || 0);
      const category = String(r[idxCategory] || '').trim() || 'Other';
      const description = idxDesc >= 0 ? String(r[idxDesc] || '') : '';
      if (!date || !Number.isFinite(amount)) continue;
      imported.push(coerceExpense({ id: generateId(), date, amount, category, description, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
    }

    if (mode === 'replace') {
      expenses = imported;
    } else {
      expenses.push(...imported);
    }

    // Merge categories
    const catSet = new Set(categories);
    for (const e of imported) catSet.add(e.category);
    categories = Array.from(catSet);

    saveExpenses();
    saveCategories();
  }

  function coerceExpense(e) {
    return {
      id: String(e.id || generateId()),
      date: String(e.date || todayISODate()).slice(0,10),
      amount: Number(e.amount || 0),
      category: String(e.category || 'Other'),
      description: typeof e.description === 'string' ? e.description : '',
      createdAt: e.createdAt ? String(e.createdAt) : new Date().toISOString(),
      updatedAt: e.updatedAt ? String(e.updatedAt) : new Date().toISOString(),
    };
  }

  // Simple CSV parser supporting quotes
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i+1] === '"') { cell += '"'; i++; }
          else { quoted = false; }
        } else {
          cell += ch;
        }
      } else {
        if (ch === '"') { quoted = true; }
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else if (ch === '\r') { /* ignore */ }
        else { cell += ch; }
      }
    }
    if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.length && r.some(c => String(c).trim().length));
  }

  // Init
  function initDefaults() {
    // set default filter range to current month
    const now = new Date();
    const start = getMonthStart(now);
    const end = getMonthEnd(now);
    refs.filterFrom.value = start.toISOString().slice(0,10);
    refs.filterTo.value = end.toISOString().slice(0,10);
  }

  function bindEvents() {
    refs.addExpenseBtn.addEventListener('click', () => openExpenseModal(null));
    refs.closeExpenseModal.addEventListener('click', closeExpenseModal);
    refs.cancelExpenseBtn.addEventListener('click', closeExpenseModal);
    refs.expenseForm.addEventListener('submit', upsertExpenseFromForm);

    refs.manageCategoriesBtn.addEventListener('click', openCategoriesModal);
    refs.closeCategoriesModal.addEventListener('click', closeCategoriesModal);
    refs.addCategoryBtn.addEventListener('click', addCategory);

    refs.openSettingsBtn.addEventListener('click', openSettingsModal);
    refs.closeSettingsModal.addEventListener('click', closeSettingsModal);
    refs.settingsForm.addEventListener('submit', saveSettingsFromForm);
    document.getElementById('cancel-settings-btn').addEventListener('click', closeSettingsModal);

    refs.exportJsonBtn.addEventListener('click', exportJSON);
    refs.exportCsvBtn.addEventListener('click', exportCSV);
    refs.importBtn.addEventListener('click', openImportModal);
    refs.closeImportModal.addEventListener('click', closeImportModal);
    refs.cancelImportBtn.addEventListener('click', closeImportModal);
    refs.confirmImportBtn.addEventListener('click', doImport);

    // Filters
    [refs.filterFrom, refs.filterTo, refs.filterCategory, refs.filterSearch, refs.sortSelect].forEach(el => {
      el.addEventListener('change', renderExpenses);
      el.addEventListener('input', () => {
        if (el === refs.filterSearch) renderExpenses();
      });
    });
    refs.clearFiltersBtn.addEventListener('click', () => {
      refs.filterFrom.value = '';
      refs.filterTo.value = '';
      refs.filterCategory.value = 'all';
      refs.filterSearch.value = '';
      refs.sortSelect.value = 'date_desc';
      renderExpenses();
    });
  }

  function renderAll() {
    renderCategoryOptions();
    renderExpenses();
  }

  function main() {
    loadState();
    initDefaults();
    bindEvents();
    renderAll();
  }

  // DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
