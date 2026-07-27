/**
 * invoices.js — Invoice list page: table, filters, actions
 * Defines renderInvoices() used by the router (app.js)
 */

async function renderInvoices() {
  const content = document.getElementById('page-content');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  try {
    const [invoices, clients] = await Promise.all([
      window.api.getInvoices(),
      window.api.getClients()
    ]);
    _renderInvoiceList(invoices, clients);
  } catch (err) {
    content.innerHTML = `<div class="loading-state"><p style="color:var(--danger)">Error: ${err.message}</p></div>`;
    console.error(err);
  }
}

function _renderInvoiceList(invoices, clients) {
  const content = document.getElementById('page-content');

  const clientOptions = clients.map(c =>
    `<option value="${c.id}">${_iEsc(c.name)}</option>`
  ).join('');

  const rowsHtml = invoices.length === 0 ? '' : invoices.map(inv => `
    <tr data-id="${inv.id}" data-status="${inv.status}" data-client="${inv.client_id || ''}"
        data-date="${inv.invoice_date || ''}" data-search="${(inv.invoice_number + ' ' + (inv.client_name || '')).toLowerCase()}">
      <td>
        ${inv.invoice_number && inv.invoice_number.toUpperCase().includes('DUPLICATE') ? `<span class="badge badge-warning" style="margin-right:6px">DUPLICATE</span>` : ''}
        <strong style="font-variant-numeric:tabular-nums">${_iEsc(inv.invoice_number)}</strong>
      </td>
      <td>
        ${inv.client_name
          ? `<div style="display:flex;align-items:center;gap:8px"><div class="client-avatar">${_iEsc(inv.client_name).charAt(0).toUpperCase()}</div><span>${_iEsc(inv.client_name)}</span></div>`
          : '<span style="color:var(--text-3)">—</span>'}
      </td>
      <td>${formatDate(inv.invoice_date)}</td>
      <td>${inv.due_date ? formatDate(inv.due_date) : '—'}</td>
      <td><span style="color:var(--text-3);font-size:12px">${_iEsc(inv.currency)}</span></td>
      <td style="text-align:right;font-variant-numeric:tabular-nums"><strong>${formatCurrency(inv.grand_total, inv.currency)}</strong></td>
      <td>${statusBadge(inv.status)}</td>
      <td>
        <div class="action-bar">
          <button class="btn-icon btn-edit-inv" data-id="${inv.id}" title="Edit">${ICONS.edit}</button>
          ${inv.status !== 'paid'
            ? `<button class="btn-icon btn-mark-inv" data-id="${inv.id}" data-status="paid" title="Mark as Paid" style="color:var(--success)">${ICONS.check}</button>`
            : `<button class="btn-icon btn-mark-inv" data-id="${inv.id}" data-status="unpaid" title="Mark as Unpaid">${ICONS.x}</button>`
          }
          <button class="btn-icon btn-return-inv" data-id="${inv.id}" title="Create Sales Return / Credit Note" style="color:var(--warning)">🔄</button>
          <button class="btn-icon btn-dup-inv" data-id="${inv.id}" title="Duplicate">${ICONS.copy}</button>
          <button class="btn-icon btn-wa-inv" data-id="${inv.id}" title="Share on WhatsApp" style="color:#25D366">${ICONS.whatsapp}</button>
          <button class="btn-icon btn-email-inv" data-id="${inv.id}" title="Share via Email" style="color:#3b82f6">${ICONS.mail}</button>
          <button class="btn-icon btn-pdf-inv" data-id="${inv.id}" title="Export PDF" style="color:var(--accent)">${ICONS.pdf}</button>
          <button class="btn-icon danger btn-del-inv" data-id="${inv.id}" data-num="${_iEsc(inv.invoice_number)}" title="Delete">${ICONS.trash}</button>
        </div>
      </td>
    </tr>
  `).join('');

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Invoices</h1>
        <p class="page-subtitle">${invoices.length} invoice${invoices.length !== 1 ? 's' : ''} total</p>
      </div>
      <button class="btn btn-primary btn-new-inv-btn">${ICONS.plus} New Invoice</button>
    </div>

    <div class="filter-bar">
      <div class="search-wrap" style="flex:1;max-width:320px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="search-input" type="text" id="inv-search" placeholder="Search invoice # or client…"/>
      </div>
      <select class="form-select" id="inv-filter-status" style="min-width:130px">
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="unpaid">Unpaid</option>
        <option value="paid">Paid</option>
        <option value="overdue">Overdue</option>
      </select>
      <select class="form-select" id="inv-filter-client" style="min-width:150px">
        <option value="">All Clients</option>
        ${clientOptions}
      </select>
      <input class="form-input" type="date" id="inv-filter-from" title="From date" style="width:140px"/>
      <input class="form-input" type="date" id="inv-filter-to" title="To date" style="width:140px"/>
      <button class="btn btn-ghost btn-sm" id="btn-clear-inv-filters">Clear</button>
    </div>

    ${invoices.length === 0
      ? `<div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <h3>No invoices yet</h3>
          <p>Create your first invoice to get started.</p>
          <button class="btn btn-primary btn-new-inv-btn" style="margin-top:12px">${ICONS.plus} Create Invoice</button>
        </div>`
      : `<div class="table-wrap">
          <table id="inv-table">
            <thead><tr>
              <th>Invoice #</th>
              <th>Client</th>
              <th>Date</th>
              <th>Due</th>
              <th>Currency</th>
              <th style="text-align:right">Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr></thead>
            <tbody id="inv-tbody">${rowsHtml}</tbody>
          </table>
        </div>`
    }
  `;

  // Attach direct DOM event listeners
  content.querySelectorAll('.btn-new-inv-btn').forEach(btn => {
    btn.addEventListener('click', () => openInvoiceEditor(null));
  });

  content.querySelectorAll('.btn-edit-inv').forEach(btn => {
    btn.addEventListener('click', () => openInvoiceEditor(Number(btn.dataset.id)));
  });

  content.querySelectorAll('.btn-mark-inv').forEach(btn => {
    btn.addEventListener('click', () => markInvoice(Number(btn.dataset.id), btn.dataset.status, btn));
  });

  content.querySelectorAll('.btn-return-inv').forEach(btn => {
    btn.addEventListener('click', () => {
      const invId = Number(btn.dataset.id);
      if (typeof openSalesReturnModal === 'function') {
        openSalesReturnModal(invId);
      }
    });
  });

  content.querySelectorAll('.btn-dup-inv').forEach(btn => {
    btn.addEventListener('click', () => dupInvoice(Number(btn.dataset.id)));
  });

  content.querySelectorAll('.btn-pdf-inv').forEach(btn => {
    btn.addEventListener('click', () => exportInvoicePdf(Number(btn.dataset.id), btn));
  });

  content.querySelectorAll('.btn-wa-inv').forEach(btn => {
    btn.addEventListener('click', () => shareInvoiceOnWhatsApp(Number(btn.dataset.id)));
  });

  content.querySelectorAll('.btn-email-inv').forEach(btn => {
    btn.addEventListener('click', () => shareInvoiceViaEmail(Number(btn.dataset.id)));
  });

  content.querySelectorAll('.btn-del-inv').forEach(btn => {
    btn.addEventListener('click', () => delInvoice(Number(btn.dataset.id), btn.dataset.num));
  });

  document.getElementById('btn-clear-inv-filters')?.addEventListener('click', () => clearInvFilters());

  // Search & filter handlers
  function applyFilters() {
    const q = (document.getElementById('inv-search')?.value || '').toLowerCase();
    const s = document.getElementById('inv-filter-status')?.value || '';
    const c = document.getElementById('inv-filter-client')?.value || '';
    const df = document.getElementById('inv-filter-from')?.value || '';
    const dt = document.getElementById('inv-filter-to')?.value || '';

    const rows = document.querySelectorAll('#inv-tbody tr');
    rows.forEach(tr => {
      const matchQry = !q  || tr.dataset.search.includes(q);
      const matchSt  = !s  || tr.dataset.status === s;
      const matchCl  = !c  || tr.dataset.client === c;
      const rowDt    = tr.dataset.date;
      const matchFr  = !df || (rowDt && rowDt >= df);
      const matchTo  = !dt || (rowDt && rowDt <= dt);

      tr.style.display = (matchQry && matchSt && matchCl && matchFr && matchTo) ? '' : 'none';
    });
  }

  ['inv-search', 'inv-filter-status', 'inv-filter-client', 'inv-filter-from', 'inv-filter-to'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', applyFilters);
  });
}

function clearInvFilters() {
  ['inv-search', 'inv-filter-status', 'inv-filter-client', 'inv-filter-from', 'inv-filter-to'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const rows = document.querySelectorAll('#inv-tbody tr');
  rows.forEach(tr => tr.style.display = '');
}

async function markInvoice(id, newStatus, btnEl) {
  try {
    await window.api.updateInvoiceStatus(id, newStatus);
    showToast(`Invoice marked as ${newStatus}`, 'success');
    renderInvoices();
  } catch (e) {
    showToast('Failed to update status: ' + e.message, 'error');
  }
}

async function dupInvoice(id) {
  try {
    const newId = await window.api.duplicateInvoice(id);
    showToast('Invoice duplicated', 'success');
    openInvoiceEditor(newId);
  } catch (e) {
    showToast('Failed to duplicate invoice: ' + e.message, 'error');
  }
}

async function exportInvoicePdf(id, btn) {
  if (btn) { btn.disabled = true; btn.style.opacity = '0.4'; }
  try {
    const [inv, settings] = await Promise.all([
      window.api.getInvoice(id),
      window.api.getSettings()
    ]);
    const html = buildInvoicePrintHtml(inv, settings);
    const res = await window.api.exportPdf(html, `${inv.invoice_number}.pdf`);
    if (res?.success) showToast('PDF saved!', 'success');
    else if (res?.reason !== 'canceled') showToast('PDF export failed', 'error');
  } catch (e) {
    showToast('Export error: ' + e.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.style.opacity = ''; }
}

function delInvoice(id, num) {
  showConfirm(
    'Delete Invoice',
    `Are you sure you want to permanently delete invoice <strong>${_iEsc(num)}</strong>? This cannot be undone.`,
    async () => {
      try {
        await window.api.deleteInvoice(id);
        showToast('Invoice deleted', 'info');
        renderInvoices();
      } catch (e) {
        showToast('Failed to delete invoice: ' + e.message, 'error');
      }
    }
  );
}

function _iEsc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function shareInvoiceOnWhatsApp(invoiceId) {
  try {
    const inv = await window.api.getInvoice(invoiceId);
    if (!inv) { showToast('Invoice not found', 'error'); return; }
    const settings = (await window.api.getSettings()) || {};
    const text = generateInvoiceShareText(inv, settings, { name: inv.client_name });
    
    window.api.copyToClipboard(text);
    
    const res = await window.api.shareInvoiceWhatsApp({
      phone: inv.client_phone || '',
      text
    });

    if (res?.success) {
      showToast('Opening WhatsApp… Invoice summary copied to clipboard!', 'success');
    } else {
      showToast('Could not open WhatsApp: ' + (res?.reason || 'Unknown error'), 'error');
    }
  } catch (err) {
    showToast('Failed to share invoice: ' + err.message, 'error');
  }
}

async function shareInvoiceViaEmail(invoiceId) {
  try {
    const inv = await window.api.getInvoice(invoiceId);
    if (!inv) { showToast('Invoice not found', 'error'); return; }
    const settings = (await window.api.getSettings()) || {};
    const rawText = generateInvoiceShareText(inv, settings, { name: inv.client_name });
    const text = rawText.replace(/\*/g, '');
    const subject = `Invoice #${inv.invoice_number || ''} from ${settings.company_name || 'InvoiceForge'}`;

    const res = await window.api.shareInvoiceEmail({
      email: inv.client_email || '',
      subject,
      body: text
    });

    if (res?.success) {
      showToast('Opening default Email client…', 'info');
    } else {
      showToast('Could not open email client: ' + (res?.reason || 'Unknown error'), 'error');
    }
  } catch (err) {
    showToast('Failed to share via email: ' + err.message, 'error');
  }
}

window.renderInvoices = renderInvoices;
window.shareInvoiceOnWhatsApp = shareInvoiceOnWhatsApp;
window.shareInvoiceViaEmail = shareInvoiceViaEmail;
window.markInvoice = markInvoice;
window.dupInvoice = dupInvoice;
window.exportInvoicePdf = exportInvoicePdf;
window.delInvoice = delInvoice;
window.clearInvFilters = clearInvFilters;
