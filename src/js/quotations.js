/**
 * quotations.js — Quotations & Estimates List View
 */

async function renderQuotations() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Quotations & Estimates</h1>
        <p class="page-subtitle">Create price quotes for prospective clients and convert them to invoices with 1 click</p>
      </div>
      <div>
        <button class="btn btn-primary" id="btn-create-quotation">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Quotation
        </button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar" style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <input type="text" class="form-control" id="search-quotations" placeholder="Search by quote # or client name..." style="max-width:320px">
      <select class="form-control" id="filter-quotation-status" style="max-width:180px">
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="sent">Sent</option>
        <option value="accepted">Accepted</option>
        <option value="declined">Declined</option>
        <option value="converted">Converted to Invoice</option>
      </select>
    </div>

    <!-- Quotations Table -->
    <div class="card p-0">
      <table class="table" id="quotations-table">
        <thead>
          <tr>
            <th>Quotation #</th>
            <th>Date</th>
            <th>Client</th>
            <th>Valid Until</th>
            <th style="text-align:right">Total</th>
            <th style="text-align:center">Status</th>
            <th style="text-align:center">Actions</th>
          </tr>
        </thead>
        <tbody id="quotations-tbody">
          <tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-3)">Loading quotations...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-create-quotation').addEventListener('click', () => navigate('quotation-editor'));
  document.getElementById('search-quotations').addEventListener('input', () => loadQuotationsList());
  document.getElementById('filter-quotation-status').addEventListener('change', () => loadQuotationsList());

  await loadQuotationsList();
}

async function loadQuotationsList() {
  const tbody = document.getElementById('quotations-tbody');
  if (!tbody) return;

  const search = document.getElementById('search-quotations')?.value || '';
  const status = document.getElementById('filter-quotation-status')?.value || '';

  try {
    const quotations = await window.api.getQuotations({ search, status });
    if (quotations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-3)">No quotations found.</td></tr>';
      return;
    }

    tbody.innerHTML = quotations.map(q => {
      let statusBadge = `<span class="badge badge-secondary">${q.status.toUpperCase()}</span>`;
      if (q.status === 'converted') {
        statusBadge = `<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3)">CONVERTED</span>`;
      } else if (q.status === 'sent') {
        statusBadge = `<span class="badge" style="background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3)">SENT</span>`;
      } else if (q.status === 'accepted') {
        statusBadge = `<span class="badge badge-success">ACCEPTED</span>`;
      } else if (q.status === 'declined') {
        statusBadge = `<span class="badge badge-danger">DECLINED</span>`;
      }

      const convertBtn = q.status !== 'converted' ? `
        <button class="btn btn-sm btn-primary" onclick="convertQuoteToInvoice(${q.id})" title="Convert Quote to Invoice" style="margin-right:6px">
          ⚡ Convert to Invoice
        </button>
      ` : `<span style="font-size:12px;color:var(--text-3);margin-right:6px">Inv Created</span>`;

      return `
        <tr>
          <td style="font-weight:700;color:var(--accent)">${escapeHtml(q.quotation_number)}</td>
          <td>${escapeHtml(q.quotation_date)}</td>
          <td style="font-weight:600">${escapeHtml(q.client_name || 'Direct Customer')}</td>
          <td>${escapeHtml(q.valid_until || '—')}</td>
          <td style="text-align:right;font-weight:700">${formatCurrency(q.grand_total, q.currency)}</td>
          <td style="text-align:center">${statusBadge}</td>
          <td style="text-align:center">
            ${convertBtn}
            <button class="btn btn-icon" onclick="navigate('quotation-editor', { id: ${q.id} })" title="Edit Quotation">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="btn btn-icon text-danger" onclick="confirmDeleteQuotation(${q.id})" title="Delete Quotation">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading quotations:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--danger)">Error: ${err.message}</td></tr>`;
  }
}

async function convertQuoteToInvoice(quotationId) {
  if (confirm('Convert this Quotation into a live Invoice draft?')) {
    try {
      const newInvoice = await window.api.convertQuotationToInvoice(quotationId);
      alert(`Invoice ${newInvoice.invoice_number} created successfully! Opening editor...`);
      navigate('invoice-editor', { id: newInvoice.id });
    } catch (err) {
      alert(`Error converting quotation: ${err.message}`);
    }
  }
}

async function confirmDeleteQuotation(id) {
  if (confirm('Delete this quotation?')) {
    await window.api.deleteQuotation(id);
    await loadQuotationsList();
  }
}
