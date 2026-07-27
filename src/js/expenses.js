/**
 * expenses.js — Operational Expense Management View & Logger
 */

async function renderExpenses() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Operational Expenses</h1>
        <p class="page-subtitle">Track non-vendor operational costs, rent, utilities, and staff salaries</p>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary" id="btn-manage-categories">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          Manage Categories
        </button>
        <button class="btn btn-primary" id="btn-add-expense">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Log Expense
        </button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="stats-grid" id="expense-stats-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 24px;">
      <div class="stat-card">
        <div class="stat-label">Total Expenses Logged</div>
        <div class="stat-value" id="stat-total-expenses">₹0.00</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Expense Count</div>
        <div class="stat-value" id="stat-expense-count">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Top Category</div>
        <div class="stat-value" id="stat-top-category" style="font-size:18px">—</div>
      </div>
    </div>

    <!-- Filters & Search -->
    <div class="filter-bar" style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <input type="text" class="form-control" id="search-expenses" placeholder="Search expenses by title or notes..." style="max-width:320px">
      <select class="form-control" id="filter-expense-category" style="max-width:200px">
        <option value="">All Categories</option>
      </select>
    </div>

    <!-- Expenses Table -->
    <div class="card p-0">
      <table class="table" id="expenses-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Title</th>
            <th>Category</th>
            <th>Payment Method</th>
            <th style="text-align:right">Amount</th>
            <th style="text-align:center">Actions</th>
          </tr>
        </thead>
        <tbody id="expenses-tbody">
          <tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-3)">Loading expenses...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-add-expense').addEventListener('click', () => openExpenseModal());
  document.getElementById('btn-manage-categories').addEventListener('click', () => openExpenseCategoriesModal());
  document.getElementById('search-expenses').addEventListener('input', () => loadExpensesList());
  document.getElementById('filter-expense-category').addEventListener('change', () => loadExpensesList());

  await populateCategoryDropdowns();
  await loadExpensesList();
}

async function populateCategoryDropdowns() {
  try {
    const categories = await window.api.getExpenseCategories();
    const filterSelect = document.getElementById('filter-expense-category');
    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">All Categories</option>' +
        categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    }
  } catch (err) {
    console.error('Error populating expense categories:', err);
  }
}

async function loadExpensesList() {
  const tbody = document.getElementById('expenses-tbody');
  if (!tbody) return;

  const search = document.getElementById('search-expenses')?.value || '';
  const category_id = document.getElementById('filter-expense-category')?.value || '';

  try {
    const expenses = await window.api.getExpenses({ search, category_id });
    
    // Update summary cards
    let totalAmt = 0;
    const catTotals = {};
    expenses.forEach(e => {
      totalAmt += Number(e.amount) || 0;
      const cat = e.category_name || 'General';
      catTotals[cat] = (catTotals[cat] || 0) + (Number(e.amount) || 0);
    });

    let topCat = '—';
    let maxCatAmt = 0;
    Object.keys(catTotals).forEach(c => {
      if (catTotals[c] > maxCatAmt) {
        maxCatAmt = catTotals[c];
        topCat = c;
      }
    });

    const statTotal = document.getElementById('stat-total-expenses');
    const statCount = document.getElementById('stat-expense-count');
    const statTop = document.getElementById('stat-top-category');
    if (statTotal) statTotal.textContent = formatCurrency(totalAmt);
    if (statCount) statCount.textContent = expenses.length;
    if (statTop) statTop.textContent = topCat;

    if (expenses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-3)">No expenses recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = expenses.map(e => `
      <tr>
        <td>${escapeHtml(e.expense_date)}</td>
        <td style="font-weight:600;color:var(--text-1)">${escapeHtml(e.title)}</td>
        <td><span class="badge" style="background:rgba(99,102,241,0.15);color:#818cf8;border:1px solid rgba(99,102,241,0.3)">${escapeHtml(e.category_name || 'Uncategorized')}</span></td>
        <td>${escapeHtml(e.payment_method || 'Cash')}</td>
        <td style="text-align:right;font-weight:700;color:var(--danger)">-${formatCurrency(e.amount)}</td>
        <td style="text-align:center">
          <button class="btn btn-icon" onclick="openExpenseModal(${e.id})" title="Edit Expense">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button class="btn btn-icon text-danger" onclick="confirmDeleteExpense(${e.id})" title="Delete Expense">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading expenses:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--danger)">Error loading expenses: ${err.message}</td></tr>`;
  }
}

async function openExpenseModal(expenseId = null) {
  let expense = { title: '', amount: 0, category_id: '', payment_method: 'Cash', expense_date: new Date().toISOString().slice(0, 10), notes: '' };
  if (expenseId) {
    expense = await window.api.getExpense(expenseId) || expense;
  }

  const categories = await window.api.getExpenseCategories();
  const categoryOptions = categories.map(c => `
    <option value="${c.id}" ${String(c.id) === String(expense.category_id) ? 'selected' : ''}>${escapeHtml(c.name)}</option>
  `).join('');

  const modalHtml = `
    <div class="modal-backdrop" id="expense-modal-backdrop">
      <div class="modal card" style="max-width:500px;width:100%;margin:auto">
        <div class="modal-header">
          <h2>${expenseId ? 'Edit Operational Expense' : 'Log New Expense'}</h2>
          <button class="btn-close" id="modal-expense-close">&times;</button>
        </div>
        <form id="expense-form" class="modal-body">
          <div class="form-group mb-3">
            <label class="form-label">Expense Title / Description *</label>
            <input type="text" class="form-control" id="exp-title" value="${escapeHtml(expense.title)}" placeholder="e.g. Office Electricity Bill - July" required>
          </div>
          <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group mb-3">
              <label class="form-label">Amount (₹) *</label>
              <input type="number" step="0.01" class="form-control" id="exp-amount" value="${expense.amount || ''}" placeholder="0.00" required>
            </div>
            <div class="form-group mb-3">
              <label class="form-label">Expense Category</label>
              <select class="form-control" id="exp-category">
                <option value="">-- Select Category --</option>
                ${categoryOptions}
              </select>
            </div>
          </div>
          <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group mb-3">
              <label class="form-label">Expense Date *</label>
              <input type="date" class="form-control" id="exp-date" value="${expense.expense_date}">
            </div>
            <div class="form-group mb-3">
              <label class="form-label">Payment Method</label>
              <select class="form-control" id="exp-method">
                <option value="Cash" ${expense.payment_method === 'Cash' ? 'selected' : ''}>Cash</option>
                <option value="Bank" ${expense.payment_method === 'Bank' ? 'selected' : ''}>Bank Transfer</option>
                <option value="UPI" ${expense.payment_method === 'UPI' ? 'selected' : ''}>UPI / Wallet</option>
                <option value="Credit Card" ${expense.payment_method === 'Credit Card' ? 'selected' : ''}>Credit Card</option>
              </select>
            </div>
          </div>
          <div class="form-group mb-3">
            <label class="form-label">Notes / Reference No.</label>
            <textarea class="form-control" id="exp-notes" rows="2" placeholder="Reference transaction ID or bill number...">${escapeHtml(expense.notes || '')}</textarea>
          </div>
          <div class="modal-footer" style="margin-top:20px;display:flex;justify-content:flex-end;gap:10px">
            <button type="button" class="btn btn-secondary" id="btn-cancel-exp">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Expense</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const existing = document.getElementById('expense-modal-backdrop');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const closeModal = () => document.getElementById('expense-modal-backdrop')?.remove();
  document.getElementById('modal-expense-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-exp').addEventListener('click', closeModal);

  document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      id: expenseId,
      title: document.getElementById('exp-title').value.trim(),
      amount: parseFloat(document.getElementById('exp-amount').value) || 0,
      category_id: document.getElementById('exp-category').value || null,
      expense_date: document.getElementById('exp-date').value,
      payment_method: document.getElementById('exp-method').value,
      notes: document.getElementById('exp-notes').value.trim()
    };

    try {
      await window.api.saveExpense(data);
      closeModal();
      await loadExpensesList();
    } catch (err) {
      alert(`Failed to save expense: ${err.message}`);
    }
  });
}

async function confirmDeleteExpense(id) {
  if (confirm('Are you sure you want to delete this expense record?')) {
    await window.api.deleteExpense(id);
    await loadExpensesList();
  }
}

async function openExpenseCategoriesModal() {
  const categories = await window.api.getExpenseCategories();
  const listHtml = categories.map(c => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border-color)">
      <div>
        <div style="font-weight:600">${escapeHtml(c.name)}</div>
        <div style="font-size:12px;color:var(--text-3)">${escapeHtml(c.description || '')}</div>
      </div>
      <button class="btn btn-icon text-danger" onclick="deleteCategory(${c.id})" title="Delete Category">&times;</button>
    </div>
  `).join('');

  const modalHtml = `
    <div class="modal-backdrop" id="categories-modal-backdrop">
      <div class="modal card" style="max-width:440px;width:100%">
        <div class="modal-header">
          <h2>Expense Categories</h2>
          <button class="btn-close" id="modal-cat-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="add-category-form" style="display:flex;gap:8px;margin-bottom:16px">
            <input type="text" class="form-control" id="cat-name-input" placeholder="New Category Name" required>
            <button type="submit" class="btn btn-primary" style="white-space:nowrap">+ Add</button>
          </form>
          <div style="max-height:260px;overflow-y:auto;border:1px solid var(--border-color);border-radius:8px">
            ${listHtml || '<div style="padding:16px;text-align:center;color:var(--text-3)">No custom categories</div>'}
          </div>
        </div>
      </div>
    </div>
  `;

  const existing = document.getElementById('categories-modal-backdrop');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('modal-cat-close').addEventListener('click', () => document.getElementById('categories-modal-backdrop')?.remove());
  document.getElementById('add-category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('cat-name-input').value.trim();
    if (name) {
      await window.api.saveExpenseCategory({ name });
      document.getElementById('categories-modal-backdrop').remove();
      openExpenseCategoriesModal();
      populateCategoryDropdowns();
    }
  });
}

async function deleteCategory(id) {
  if (confirm('Delete this expense category?')) {
    await window.api.deleteExpenseCategory(id);
    document.getElementById('categories-modal-backdrop')?.remove();
    openExpenseCategoriesModal();
    populateCategoryDropdowns();
  }
}
