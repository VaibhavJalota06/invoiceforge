/**
 * dashboard.js — Dashboard page: stats + recent invoices
 */

async function renderDashboard() {
  const content = document.getElementById('page-content');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  const stats = await window.api.getDashboardStats();
  const settings = await window.api.getSettings();
  const defaultCurrency = settings.default_currency || 'INR';
  const curr = getCurrency(defaultCurrency);

  const statusMap = {};
  (stats.statusBreakdown || []).forEach(s => statusMap[s.status] = s.count);

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Executive Dashboard</h1>
        <p class="page-subtitle">Real-time enterprise overview &amp; financial metrics</p>
      </div>
      <button class="btn btn-primary" onclick="navigate('invoices'); setTimeout(()=>openInvoiceEditor(null),50)">
        ${ICONS.plus} New Billed Invoice
      </button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Monthly Gross Billed Revenue</div>
        <div class="stat-value">${curr.symbol} ${Number(stats.totalThisMonth || 0).toLocaleString('en-IN', {minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div class="stat-sub">${defaultCurrency} · Current Billing Cycle</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-label">Accounts Receivable (A/R)</div>
        <div class="stat-value">${curr.symbol} ${Number(stats.outstanding || 0).toLocaleString('en-IN', {minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div class="stat-sub">Pending Unpaid + Overdue Invoices</div>
      </div>
      <div class="stat-card success">
        <div class="stat-label">Active Client Accounts</div>
        <div class="stat-value">${stats.clientCount || 0}</div>
        <div class="stat-sub">Registered Corporate Profiles</div>
      </div>
      <div class="stat-card info">
        <div class="stat-label">Billed Transactions</div>
        <div class="stat-value">${stats.invoiceCount || 0}</div>
        <div class="stat-sub">${statusMap.paid||0} settled · ${statusMap.unpaid||0} pending · ${statusMap.overdue||0} overdue</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Recent Transactions &amp; Invoices</div>
      ${_renderRecentList(stats.recent || [])}
    </div>
  `;
}

function _renderRecentList(invoices) {
  if (!invoices.length) {
    return `
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <h3>No invoices yet</h3>
        <p>Create your first invoice to get started</p>
        <button class="btn btn-primary" style="margin-top:8px" onclick="navigate('invoices'); setTimeout(()=>openInvoiceEditor(null),50)">
          ${ICONS.plus} Create Invoice
        </button>
      </div>`;
  }

  return `<div class="recent-list">
    ${invoices.map(inv => {
      const c = getCurrency(inv.currency);
      const name = _escHtml(inv.client_name || 'Unknown Client');
      return `
        <div class="recent-item" onclick="navigate('invoices'); setTimeout(()=>openInvoiceEditor(${inv.id}),50)" title="Open invoice">
          <div class="client-avatar">${name.charAt(0).toUpperCase()}</div>
          <div class="recent-item-info">
            <div class="recent-item-name">${_escHtml(inv.invoice_number)} &nbsp;·&nbsp; ${name}</div>
            <div class="recent-item-sub">${formatDate(inv.invoice_date)}${inv.due_date ? ' &nbsp;·&nbsp; Due ' + formatDate(inv.due_date) : ''}</div>
          </div>
          ${statusBadge(inv.status)}
          <div class="recent-item-amount">${c.symbol} ${Number(inv.grand_total).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        </div>`;
    }).join('')}
  </div>`;
}

function _escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
