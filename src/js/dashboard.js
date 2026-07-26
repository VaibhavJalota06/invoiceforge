/**
 * dashboard.js — Dashboard page: stats + recent invoices
 */

async function renderDashboard() {
  const content = document.getElementById('page-content');
  if (!content) return;
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  let stats = {};
  let settings = {};
  try {
    stats = (await window.api.getDashboardStats()) || {};
    settings = (await window.api.getSettings()) || {};
  } catch (err) {
    console.error('Dashboard load error:', err);
    stats = { totalThisMonth: 0, outstanding: 0, clientCount: 0, invoiceCount: 0, recent: [], statusBreakdown: [] };
    settings = {};
  }

  const defaultCurrency = settings.default_currency || 'INR';
  const curr = getCurrency(defaultCurrency);

  const statusMap = {};
  const breakdown = stats?.statusBreakdown || [];
  if (Array.isArray(breakdown)) {
    breakdown.forEach(s => { statusMap[s.status] = s.count; });
  } else if (typeof breakdown === 'object') {
    Object.keys(breakdown).forEach(k => { statusMap[k] = breakdown[k]; });
  }

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Executive Dashboard</h1>
        <p class="page-subtitle">Real-time enterprise overview &amp; financial metrics</p>
      </div>
      <button class="btn btn-primary btn-new-inv-trigger" id="btn-dash-new-invoice">
        ${ICONS.plus} New Billed Invoice
      </button>
    </div>

    <div class="stats-grid">
      <div class="stat-card stat-card-link" data-page="reports" style="cursor:pointer" title="View Financial Reports">
        <div class="stat-label">Monthly Gross Billed Revenue</div>
        <div class="stat-value">${curr.symbol} ${Number(stats.totalThisMonth || 0).toLocaleString('en-IN', {minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div class="stat-sub">${defaultCurrency} · Current Billing Cycle</div>
      </div>
      <div class="stat-card warning stat-card-link" data-page="invoices" style="cursor:pointer" title="View Accounts Receivable">
        <div class="stat-label">Accounts Receivable (A/R)</div>
        <div class="stat-value">${curr.symbol} ${Number(stats.outstanding || 0).toLocaleString('en-IN', {minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div class="stat-sub">Pending Unpaid + Overdue Invoices</div>
      </div>
      <div class="stat-card success stat-card-link" data-page="clients" style="cursor:pointer" title="View Client Accounts">
        <div class="stat-label">Active Client Accounts</div>
        <div class="stat-value">${stats.clientCount || 0}</div>
        <div class="stat-sub">Registered Corporate Profiles</div>
      </div>
      <div class="stat-card info stat-card-link" data-page="invoices" style="cursor:pointer" title="View Invoices List">
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

  // Attach direct DOM event listeners
  content.querySelectorAll('.btn-new-inv-trigger').forEach(btn => {
    btn.addEventListener('click', () => createNewInvoice(null));
  });

  content.querySelectorAll('.recent-item-trigger').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id ? Number(item.dataset.id) : null;
      createNewInvoice(id);
    });
  });

  content.querySelectorAll('.stat-card-link').forEach(card => {
    card.addEventListener('click', () => {
      const page = card.dataset.page;
      if (page && typeof navigate === 'function') navigate(page);
    });
  });
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
        <button class="btn btn-primary btn-new-inv-trigger" style="margin-top:8px" onclick="createNewInvoice(null)">
          ${ICONS.plus} Create Invoice
        </button>
      </div>`;
  }

  return `<div class="recent-list">
    ${invoices.map(inv => {
      const c = getCurrency(inv.currency);
      const name = _escHtml(inv.client_name || 'Unknown Client');
      return `
        <div class="recent-item recent-item-trigger" data-id="${inv.id}" onclick="createNewInvoice(${inv.id})" title="Open invoice">
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
