/**
 * payments.js — Cash & Bank Payment Ledger Register
 */

async function renderPayments() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Cash & Bank Payment Ledger</h1>
        <p class="page-subtitle">Track incoming customer receipts, outgoing vendor payments, and cash register liquidity</p>
      </div>
      <div>
        <button class="btn btn-primary" id="btn-record-payment">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Record Voucher / Payment
        </button>
      </div>
    </div>

    <!-- Account Balances Cards -->
    <div class="stats-grid" id="payment-stats-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 24px;">
      <div class="stat-card">
        <div class="stat-label">Cash-in-Hand</div>
        <div class="stat-value" id="bal-cash">₹0.00</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Bank Account Balance</div>
        <div class="stat-value" id="bal-bank">₹0.00</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">UPI / Wallet Balance</div>
        <div class="stat-value" id="bal-upi">₹0.00</div>
      </div>
      <div class="stat-card" style="border-left:3px solid var(--accent)">
        <div class="stat-label">Total Liquid Cash</div>
        <div class="stat-value" id="bal-total" style="color:var(--accent)">₹0.00</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar" style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <input type="text" class="form-control" id="search-payments" placeholder="Search reference # or party name..." style="max-width:320px">
      <select class="form-control" id="filter-payment-type" style="max-width:180px">
        <option value="">All Voucher Types</option>
        <option value="receipt">Customer Receipt (+)</option>
        <option value="payment">Vendor Payment (-)</option>
      </select>
      <select class="form-control" id="filter-payment-account" style="max-width:180px">
        <option value="">All Accounts</option>
        <option value="Cash">Cash</option>
        <option value="Bank">Bank Account</option>
        <option value="UPI">UPI / Wallet</option>
      </select>
    </div>

    <!-- Ledger Table -->
    <div class="card p-0">
      <table class="table" id="payments-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Voucher Type</th>
            <th>Party Name</th>
            <th>Account</th>
            <th>Reference #</th>
            <th style="text-align:right">Amount</th>
            <th style="text-align:center">Actions</th>
          </tr>
        </thead>
        <tbody id="payments-tbody">
          <tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-3)">Loading ledger records...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-record-payment').addEventListener('click', () => openPaymentModal());
  document.getElementById('search-payments').addEventListener('input', () => loadPaymentsList());
  document.getElementById('filter-payment-type').addEventListener('change', () => loadPaymentsList());
  document.getElementById('filter-payment-account').addEventListener('change', () => loadPaymentsList());

  await updateAccountBalances();
  await loadPaymentsList();
}

async function updateAccountBalances() {
  try {
    const balances = await window.api.getAccountBalances();
    document.getElementById('bal-cash').textContent = formatCurrency(balances.cashBalance);
    document.getElementById('bal-bank').textContent = formatCurrency(balances.bankBalance);
    document.getElementById('bal-upi').textContent = formatCurrency(balances.upiBalance);
    document.getElementById('bal-total').textContent = formatCurrency(balances.totalBalance);
  } catch (err) {
    console.error('Error fetching account balances:', err);
  }
}

async function loadPaymentsList() {
  const tbody = document.getElementById('payments-tbody');
  if (!tbody) return;

  const search = document.getElementById('search-payments')?.value || '';
  const type = document.getElementById('filter-payment-type')?.value || '';
  const account_type = document.getElementById('filter-payment-account')?.value || '';

  try {
    const records = await window.api.getPayments({ search, type, account_type });
    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-3)">No ledger payments recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = records.map(p => {
      const isReceipt = p.type === 'receipt';
      const typeBadge = isReceipt
        ? `<span class="badge badge-success">CUSTOMER RECEIPT</span>`
        : `<span class="badge badge-danger">VENDOR PAYMENT</span>`;

      const amtFormatted = isReceipt
        ? `<span style="color:var(--success);font-weight:700">+${formatCurrency(p.amount)}</span>`
        : `<span style="color:var(--danger);font-weight:700">-${formatCurrency(p.amount)}</span>`;

      const partyName = isReceipt ? (p.client_name || 'Direct Customer') : (p.vendor_name || 'Vendor');

      return `
        <tr>
          <td>${escapeHtml(p.payment_date)}</td>
          <td>${typeBadge}</td>
          <td style="font-weight:600">${escapeHtml(partyName)}</td>
          <td><span class="badge" style="background:rgba(255,255,255,0.06);color:var(--text-2);border:1px solid var(--border-color)">${escapeHtml(p.account_type)}</span></td>
          <td>${escapeHtml(p.reference_no || '—')}</td>
          <td style="text-align:right">${amtFormatted}</td>
          <td style="text-align:center">
            <button class="btn btn-icon text-danger" onclick="confirmDeletePayment(${p.id})" title="Delete Payment Record">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading payment records:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--danger)">Error: ${err.message}</td></tr>`;
  }
}

async function openPaymentModal() {
  let clients = [];
  let vendors = [];
  try { clients = (await window.api.getClients()) || []; } catch (e) { console.error('Error fetching clients:', e); }
  try { vendors = (await window.api.getVendors()) || []; } catch (e) { console.error('Error fetching vendors:', e); }

  const esc = window.escHtml || window.escapeHtml || (s => String(s || ''));
  const clientOpts = clients.map(c => `<option value="${c.id}">${esc(c.name || c.company_name || 'Client #' + c.id)}</option>`).join('');
  const vendorOpts = vendors.map(v => `<option value="${v.id}">${esc(v.name || v.company_name || 'Vendor #' + v.id)}</option>`).join('');

  const modalHtml = `
    <div class="modal-backdrop" id="payment-modal-backdrop">
      <div class="modal card" style="max-width:480px;width:100%;margin:auto">
        <div class="modal-header">
          <h2>Record Payment Voucher</h2>
          <button class="btn-close" id="modal-pay-close">&times;</button>
        </div>
        <form id="payment-form" class="modal-body">
          <div class="form-group mb-3">
            <label class="form-label">Voucher Type *</label>
            <select class="form-control" id="pay-type">
              <option value="receipt">Customer Receipt (Money In +)</option>
              <option value="payment">Vendor Payment (Money Out -)</option>
            </select>
          </div>
          <div class="form-group mb-3" id="group-client">
            <label class="form-label">Select Client *</label>
            <select class="form-control" id="pay-client">
              <option value="0">-- Direct Customer --</option>
              ${clientOpts}
            </select>
          </div>
          <div class="form-group mb-3" id="group-vendor" style="display:none">
            <label class="form-label">Select Vendor *</label>
            <select class="form-control" id="pay-vendor">
              <option value="0">-- General Vendor --</option>
              ${vendorOpts}
            </select>
          </div>
          <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group mb-3">
              <label class="form-label">Amount (₹) *</label>
              <input type="number" step="0.01" class="form-control" id="pay-amount" placeholder="0.00" required>
            </div>
            <div class="form-group mb-3">
              <label class="form-label">Account *</label>
              <select class="form-control" id="pay-account">
                <option value="Cash">Cash</option>
                <option value="Bank">Bank Account</option>
                <option value="UPI">UPI / Wallet</option>
              </select>
            </div>
          </div>
          <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group mb-3">
              <label class="form-label">Payment Date *</label>
              <input type="date" class="form-control" id="pay-date" value="${new Date().toISOString().slice(0, 10)}">
            </div>
            <div class="form-group mb-3">
              <label class="form-label">Ref / Transaction #</label>
              <input type="text" class="form-control" id="pay-ref" placeholder="Cheque / UTR / Txn #">
            </div>
          </div>
          <div class="form-group mb-3">
            <label class="form-label">Notes</label>
            <textarea class="form-control" id="pay-notes" rows="2" placeholder="Payment notes..."></textarea>
          </div>
          <div class="modal-footer" style="margin-top:20px;display:flex;justify-content:flex-end;gap:10px">
            <button type="button" class="btn btn-secondary" id="btn-cancel-pay">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Voucher</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const existing = document.getElementById('payment-modal-backdrop');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const closeModal = () => document.getElementById('payment-modal-backdrop')?.remove();
  document.getElementById('modal-pay-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-pay').addEventListener('click', closeModal);

  document.getElementById('pay-type').addEventListener('change', e => {
    const isReceipt = e.target.value === 'receipt';
    document.getElementById('group-client').style.display = isReceipt ? 'block' : 'none';
    document.getElementById('group-vendor').style.display = isReceipt ? 'none' : 'block';
  });

  document.getElementById('payment-form').addEventListener('submit', async e => {
    e.preventDefault();
    const type = document.getElementById('pay-type').value;
    const isReceipt = type === 'receipt';
    const party_id = isReceipt ? parseInt(document.getElementById('pay-client').value) : parseInt(document.getElementById('pay-vendor').value);

    const data = {
      type,
      party_type: isReceipt ? 'client' : 'vendor',
      party_id,
      amount: parseFloat(document.getElementById('pay-amount').value) || 0,
      account_type: document.getElementById('pay-account').value,
      payment_date: document.getElementById('pay-date').value,
      reference_no: document.getElementById('pay-ref').value.trim(),
      notes: document.getElementById('pay-notes').value.trim()
    };

    try {
      await window.api.savePayment(data);
      closeModal();
      await updateAccountBalances();
      await loadPaymentsList();
    } catch (err) {
      alert(`Failed to save payment voucher: ${err.message}`);
    }
  });
}

async function confirmDeletePayment(id) {
  if (confirm('Delete this payment voucher record?')) {
    await window.api.deletePayment(id);
    await updateAccountBalances();
    await loadPaymentsList();
  }
}
