/**
 * sales-returns.js — Sales Returns, Credit Notes & Inventory Restock Module for InvoiceForge
 */

let _returnsState = {
  returns: [],
  search: '',
  statusFilter: '',
  invoices: []
};

async function renderSalesReturns() {
  const content = document.getElementById('page-content');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading Sales Returns &amp; Credit Notes…</p></div>`;

  try {
    _returnsState.returns = await window.api.getAllSalesReturns({
      search: _returnsState.search,
      status: _returnsState.statusFilter
    });
    const fetchInvoices = window.api.getInvoices || window.api.getAllInvoices;
    _returnsState.invoices = fetchInvoices ? await fetchInvoices({}) : [];
  } catch (err) {
    showToast('Failed to load sales returns: ' + err.message, 'error');
    _returnsState.returns = [];
  }

  const returns = _returnsState.returns;
  const totalCount = returns.length;
  const totalAmount = returns.reduce((sum, r) => sum + (Number(r.grand_total) || 0), 0);
  const refundedCount = returns.filter(r => r.refund_status === 'refunded').length;

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Sales Returns &amp; Credit Notes</h1>
        <p class="page-subtitle">Process customer returns, issue credit notes, and auto-restock inventory</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-new-return">
          ${ICONS.plus} Create Sales Return
        </button>
      </div>
    </div>

    <!-- Summary KPI Cards -->
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card">
        <div class="stat-icon purple">${ICONS.rotateCcw}</div>
        <div class="stat-content">
          <span class="stat-label">Total Sales Returns</span>
          <span class="stat-value">${totalCount}</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon red">${ICONS.dollar}</div>
        <div class="stat-content">
          <span class="stat-label">Total Returned Value</span>
          <span class="stat-value">₹ ${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon green">${ICONS.fileText}</div>
        <div class="stat-content">
          <span class="stat-label">Credit Notes Issued</span>
          <span class="stat-value">${creditNotesCount}</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon amber">${ICONS.package}</div>
        <div class="stat-content">
          <span class="stat-label">Direct Cash Refunded</span>
          <span class="stat-value">${refundedCount}</span>
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <div class="search-wrap" style="flex:1;max-width:380px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="returns-search-input" class="search-input" placeholder="Search by Return #, Invoice #, or Client Name…" value="${escHtml(_returnsState.search)}" />
      </div>

      <select id="returns-status-filter" class="form-select" style="min-width:180px">
        <option value="" ${_returnsState.statusFilter === '' ? 'selected' : ''}>All Refund Types</option>
        <option value="credit_note" ${_returnsState.statusFilter === 'credit_note' ? 'selected' : ''}>Credit Note Issued</option>
        <option value="refunded" ${_returnsState.statusFilter === 'refunded' ? 'selected' : ''}>Direct Refunded</option>
        <option value="pending" ${_returnsState.statusFilter === 'pending' ? 'selected' : ''}>Pending Action</option>
      </select>
    </div>

    <!-- Sales Returns Data Table -->
    <div class="table-wrap">
      ${returns.length === 0 ? `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          <h3>No sales returns yet</h3>
          <p>Process customer returns or issue credit notes to track refunds.</p>
        </div>
      ` : `
        <table>
          <thead>
            <tr>
              <th>Return #</th>
              <th>Return Date</th>
              <th>Original Invoice #</th>
              <th>Client Name</th>
              <th>Reason</th>
              <th style="text-align:right">Returned Amount</th>
              <th style="text-align:center">Refund Type</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${returns.map(r => `
              <tr>
                <td><strong style="color:var(--accent)">${escHtml(r.return_number)}</strong></td>
                <td>${escHtml(r.return_date || '')}</td>
                <td><span class="badge badge-draft">${escHtml(r.invoice_number || 'Direct')}</span></td>
                <td><strong>${escHtml(r.client_name)}</strong></td>
                <td><span style="font-size:12px;color:var(--text-2)">${escHtml(r.reason || 'Customer Return')}</span></td>
                <td style="text-align:right;font-weight:700;color:var(--danger)">
                  ₹ ${(Number(r.grand_total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td style="text-align:center">
                  ${r.refund_status === 'credit_note'
                    ? '<span class="badge badge-info">Credit Note</span>'
                    : r.refund_status === 'refunded'
                      ? '<span class="badge badge-success">Refunded</span>'
                      : '<span class="badge badge-warning">Pending</span>'
                  }
                </td>
                <td style="text-align:right">
                  <div style="display:flex;gap:4px;justify-content:flex-end">
                    <button class="btn-icon btn-view-return" data-id="${r.id}" title="View Details">${ICONS.eye}</button>
                    <button class="btn-icon danger btn-delete-return" data-id="${r.id}" title="Delete &amp; Revert Stock">${ICONS.trash}</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;

  // Attach Event Listeners
  document.getElementById('btn-new-return')?.addEventListener('click', () => openSalesReturnModal());

  const searchInput = document.getElementById('returns-search-input');
  searchInput?.addEventListener('input', debounce(e => {
    _returnsState.search = e.target.value.trim();
    renderSalesReturns();
  }, 350));

  document.getElementById('returns-status-filter')?.addEventListener('change', e => {
    _returnsState.statusFilter = e.target.value;
    renderSalesReturns();
  });

  document.querySelectorAll('.btn-view-return').forEach(btn => {
    btn.addEventListener('click', () => viewReturnDetails(Number(btn.dataset.id)));
  });

  document.querySelectorAll('.btn-delete-return').forEach(btn => {
    btn.addEventListener('click', () => deleteReturn(Number(btn.dataset.id)));
  });
}

async function openSalesReturnModal(prefilledInvoiceId = null) {
  const nextReturnObj = await window.api.getNextReturnNumber();
  const fetchInvoices = window.api.getInvoices || window.api.getAllInvoices;
  const invoices = fetchInvoices ? await fetchInvoices({}) : [];
  const fetchProducts = window.api.getProducts || window.api.getAllProducts;
  const products = fetchProducts ? await fetchProducts() : [];

  let selectedInv = prefilledInvoiceId ? invoices.find(i => i.id === prefilledInvoiceId) : null;
  if (!selectedInv && invoices.length > 0) {
    selectedInv = invoices[0];
  }

  let invDetail = selectedInv ? await window.api.getInvoice(selectedInv.id) : null;

  const bodyHtml = `
    <form id="form-sales-return" style="display:flex;flex-direction:column;gap:16px">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Return / Credit Note Number</label>
          <input class="form-input" name="return_number" type="text" value="${escHtml(nextReturnObj.fullNumber)}" readonly style="background:var(--bg-3);font-weight:700;color:var(--accent)" />
        </div>
        <div class="form-group">
          <label class="form-label">Return Date <span style="color:var(--danger)">*</span></label>
          <input class="form-input" name="return_date" type="date" value="${new Date().toISOString().slice(0, 10)}" required />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Select Original Invoice <span style="color:var(--danger)">*</span></label>
          <select class="form-select" id="return-invoice-select" name="invoice_id">
            ${invoices.map(i => `
              <option value="${i.id}" ${selectedInv && selectedInv.id === i.id ? 'selected' : ''}>
                ${escHtml(i.invoice_number)} — ${escHtml(i.client_name || 'Customer')} (₹ ${(Number(i.grand_total) || 0).toFixed(2)})
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Return Reason</label>
          <select class="form-select" name="reason">
            <option value="Defective / Damaged Item">Defective / Damaged Item</option>
            <option value="Customer Exchange">Customer Exchange</option>
            <option value="Incorrect Item Shipped">Incorrect Item Shipped</option>
            <option value="Order Cancellation">Order Cancellation</option>
            <option value="Customer Dissatisfied">Customer Dissatisfied</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Refund Action</label>
          <select class="form-select" name="refund_status">
            <option value="credit_note" selected>Issue Credit Note (Customer Balance Credit)</option>
            <option value="refunded">Direct Cash / Bank Refund</option>
            <option value="pending">Mark Refund as Pending</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Client Name</label>
          <input class="form-input" id="return-client-name" name="client_name" type="text" value="${escHtml(invDetail?.client_name || '')}" placeholder="Walk-in Customer" />
        </div>
      </div>

      <!-- Items Return Table -->
      <div style="margin-top:10px">
        <label class="form-label" style="display:flex;justify-content:space-between">
          <span>Items Returned to Catalog Inventory</span>
          <span style="font-size:11px;color:var(--accent)">📦 Auto-Restocks Warehouse Stock</span>
        </label>

        <div class="table-wrap" style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-md);margin-top:6px">
          <table>
            <thead>
              <tr>
                <th>Item Description</th>
                <th style="width:90px">Unit</th>
                <th style="width:100px;text-align:right">Qty Returned</th>
                <th style="width:110px;text-align:right">Rate (₹)</th>
                <th style="width:120px;text-align:right">Total (₹)</th>
              </tr>
            </thead>
            <tbody id="return-items-tbody">
              ${invDetail && Array.isArray(invDetail.items) && invDetail.items.length > 0 ? invDetail.items.map((item, idx) => `
                <tr class="return-item-row">
                  <td>
                    <input type="hidden" class="row-product-id" value="${item.product_id || 0}" />
                    <input class="form-input row-desc" type="text" value="${escHtml(item.description || '')}" />
                  </td>
                  <td><input class="form-input row-unit" type="text" value="${escHtml(item.unit || 'Pcs')}" /></td>
                  <td><input class="form-input row-qty" type="number" step="any" min="0" value="${item.quantity || 1}" style="text-align:right" /></td>
                  <td><input class="form-input row-rate" type="number" step="any" min="0" value="${item.rate || 0}" style="text-align:right" /></td>
                  <td style="text-align:right;font-weight:700" class="row-amount">₹ ${(Number(item.amount) || 0).toFixed(2)}</td>
                </tr>
              `).join('') : `
                <tr class="return-item-row">
                  <td>
                    <input type="hidden" class="row-product-id" value="0" />
                    <input class="form-input row-desc" type="text" placeholder="Returned item description" required />
                  </td>
                  <td><input class="form-input row-unit" type="text" value="Pcs" /></td>
                  <td><input class="form-input row-qty" type="number" step="any" min="0" value="1" style="text-align:right" /></td>
                  <td><input class="form-input row-rate" type="number" step="any" min="0" value="0" style="text-align:right" /></td>
                  <td style="text-align:right;font-weight:700" class="row-amount">₹ 0.00</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-3);padding:14px;border-radius:var(--radius-md);margin-top:6px">
        <span style="font-size:13.5px;font-weight:600;color:var(--text)">Total Credit Note Amount:</span>
        <span style="font-size:18px;font-weight:800;color:var(--danger)" id="return-grand-total">₹ 0.00</span>
      </div>
    </form>
  `;

  openModal({
    title: '🔄 Process Sales Return & Credit Note',
    body: bodyHtml,
    bodyHtml: bodyHtml,
    wide: true,
    confirmText: 'Issue Credit Note & Restock',
    cancelText: 'Cancel',
    onConfirm: async () => {
      const form = document.getElementById('form-sales-return');
      if (!form) return true;

      const fd = new FormData(form);
      const rows = document.querySelectorAll('.return-item-row');
      const items = [];
      let grandTotal = 0;

      rows.forEach(r => {
        const desc = r.querySelector('.row-desc')?.value.trim();
        const qty = Number(r.querySelector('.row-qty')?.value) || 0;
        const rate = Number(r.querySelector('.row-rate')?.value) || 0;
        const pId = Number(r.querySelector('.row-product-id')?.value) || 0;
        const unit = r.querySelector('.row-unit')?.value || 'Pcs';
        const amt = qty * rate;

        if (desc && qty > 0) {
          items.push({ product_id: pId, description: desc, unit, quantity: qty, rate, amount: amt });
          grandTotal += amt;
        }
      });

      if (items.length === 0) {
        showToast('Please specify at least one item to return.', 'warning');
        return false;
      }

      const invSelect = document.getElementById('return-invoice-select');
      const invNum = invSelect ? invSelect.options[invSelect.selectedIndex]?.text.split('—')[0].trim() : '';

      const returnData = {
        return_number: fd.get('return_number'),
        return_date: fd.get('return_date'),
        invoice_id: Number(fd.get('invoice_id')) || 0,
        invoice_number: invNum,
        client_name: fd.get('client_name'),
        reason: fd.get('reason'),
        refund_status: fd.get('refund_status'),
        subtotal: grandTotal,
        tax_amount: 0,
        grand_total: grandTotal,
        items
      };

      try {
        await window.api.saveSalesReturn(returnData);
        showToast('Sales Return processed! Inventory restocked cleanly.', 'success');
        renderSalesReturns();
        return true;
      } catch (err) {
        showToast('Return save failed: ' + err.message, 'error');
        return false;
      }
    }
  });

  // Calculate live row total
  const recalcTotals = () => {
    let total = 0;
    document.querySelectorAll('.return-item-row').forEach(r => {
      const q = Number(r.querySelector('.row-qty')?.value) || 0;
      const rate = Number(r.querySelector('.row-rate')?.value) || 0;
      const amt = q * rate;
      const amtEl = r.querySelector('.row-amount');
      if (amtEl) amtEl.textContent = `₹ ${amt.toFixed(2)}`;
      total += amt;
    });
    const gtEl = document.getElementById('return-grand-total');
    if (gtEl) gtEl.textContent = `₹ ${total.toFixed(2)}`;
  };

  document.querySelectorAll('.row-qty, .row-rate').forEach(input => {
    input.addEventListener('input', recalcTotals);
  });
  recalcTotals();

  // Invoice change listener
  document.getElementById('return-invoice-select')?.addEventListener('change', async (e) => {
    const invId = Number(e.target.value);
    if (!invId) return;
    const inv = await window.api.getInvoice(invId);
    if (!inv) return;

    const clientNameInput = document.getElementById('return-client-name');
    if (clientNameInput) clientNameInput.value = inv.client_name || '';

    const tbody = document.getElementById('return-items-tbody');
    if (tbody && Array.isArray(inv.items)) {
      tbody.innerHTML = inv.items.map(item => `
        <tr class="return-item-row">
          <td>
            <input type="hidden" class="row-product-id" value="${item.product_id || 0}" />
            <input class="form-input row-desc" type="text" value="${escHtml(item.description || '')}" />
          </td>
          <td><input class="form-input row-unit" type="text" value="${escHtml(item.unit || 'Pcs')}" /></td>
          <td><input class="form-input row-qty" type="number" step="any" min="0" value="${item.quantity || 1}" style="text-align:right" /></td>
          <td><input class="form-input row-rate" type="number" step="any" min="0" value="${item.rate || 0}" style="text-align:right" /></td>
          <td style="text-align:right;font-weight:700" class="row-amount">₹ ${(Number(item.amount) || 0).toFixed(2)}</td>
        </tr>
      `).join('');

      document.querySelectorAll('.row-qty, .row-rate').forEach(input => {
        input.addEventListener('input', recalcTotals);
      });
      recalcTotals();
    }
  });
}

async function viewReturnDetails(id) {
  const ret = await window.api.getSalesReturn(id);
  if (!ret) return;

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg-3);border-radius:var(--radius-md)">
        <div>
          <h3 style="font-size:16px;font-weight:700;color:var(--accent)">${escHtml(ret.return_number)}</h3>
          <p style="font-size:12px;color:var(--text-3)">Date: ${escHtml(ret.return_date || '')} • Invoice #${escHtml(ret.invoice_number || 'N/A')}</p>
        </div>
        <span class="badge ${ret.refund_status === 'credit_note' ? 'badge-info' : 'badge-success'}">
          ${escHtml(ret.refund_status.toUpperCase())}
        </span>
      </div>

      <div style="display:flex;justify-content:space-between;font-size:13px">
        <span>Client: <strong>${escHtml(ret.client_name)}</strong></span>
        <span>Reason: <strong>${escHtml(ret.reason)}</strong></span>
      </div>

      <div class="table-wrap" style="margin-top:8px">
        <table>
          <thead>
            <tr>
              <th>Returned Item</th>
              <th style="text-align:right">Qty</th>
              <th style="text-align:right">Rate</th>
              <th style="text-align:right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${Array.isArray(ret.items) ? ret.items.map(i => `
              <tr>
                <td>${escHtml(i.description)}</td>
                <td style="text-align:right">${i.quantity} ${escHtml(i.unit)}</td>
                <td style="text-align:right">₹ ${Number(i.rate).toFixed(2)}</td>
                <td style="text-align:right;font-weight:700">₹ ${Number(i.amount).toFixed(2)}</td>
              </tr>
            `).join('') : ''}
          </tbody>
        </table>
      </div>

      <div style="text-align:right;font-size:16px;font-weight:800;color:var(--danger);margin-top:10px">
        Total Credit Value: ₹ ${(Number(ret.grand_total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </div>
    </div>
  `;

  openModal({
    title: '📄 Sales Return & Credit Note Details',
    body: bodyHtml,
    bodyHtml: bodyHtml,
    confirmText: '',
    cancelText: 'Close'
  });
}

async function deleteReturn(id) {
  if (!confirm('Are you sure you want to delete this sales return record? This will revert the restocked inventory quantities.')) return;
  try {
    await window.api.deleteSalesReturn(id);
    showToast('Sales return deleted and inventory reverted.', 'info');
    renderSalesReturns();
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}

window.renderSalesReturns = renderSalesReturns;
window.openSalesReturnModal = openSalesReturnModal;
