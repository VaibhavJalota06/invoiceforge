/**
 * purchases.js — Purchase Orders & Supplier Bills Management Module
 */

async function renderPurchases() {
  const content = document.getElementById('page-content');
  if (!content) return;
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading Purchase Orders…</p></div>`;

  try {
    const [purchases, vendors] = await Promise.all([
      window.api.getPurchases(),
      window.api.getVendors()
    ]);
    _renderPurchaseList(purchases || [], vendors || []);
  } catch (err) {
    content.innerHTML = `<div class="loading-state"><p style="color:var(--danger)">Failed to load purchases: ${err.message}</p></div>`;
    console.error(err);
  }
}

function _pEsc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _renderPurchaseList(purchases, vendors) {
  const content = document.getElementById('page-content');
  if (!content) return;

  const vendorOptions = vendors.map(v =>
    `<option value="${v.id}">${_pEsc(v.name)} (${_pEsc(v.company_name || 'Individual')})</option>`
  ).join('');

  const rowsHtml = purchases.length === 0 ? '' : purchases.map(pur => `
    <tr data-id="${pur.id}" data-status="${pur.status}" data-vendor="${pur.vendor_id || ''}"
        data-date="${pur.purchase_date || ''}" data-search="${(pur.purchase_number + ' ' + (pur.vendor_name || '') + ' ' + (pur.vendor_company || '')).toLowerCase()}">
      <td><strong style="font-variant-numeric:tabular-nums;color:var(--accent);">${_pEsc(pur.purchase_number)}</strong></td>
      <td>
        ${pur.vendor_name
          ? `<div style="display:flex;align-items:center;gap:8px"><div class="client-avatar" style="background:var(--accent);color:#fff">${_pEsc(pur.vendor_name).charAt(0).toUpperCase()}</div><div><span style="font-weight:600;display:block">${_pEsc(pur.vendor_name)}</span>${pur.vendor_company ? `<span style="font-size:11px;color:var(--text-3)">${_pEsc(pur.vendor_company)}</span>` : ''}</div></div>`
          : '<span style="color:var(--text-3)">General Supplier</span>'}
      </td>
      <td>${pur.purchase_date || '—'}</td>
      <td>${pur.due_date || '—'}</td>
      <td><span style="color:var(--text-3);font-size:12px">${_pEsc(pur.currency || 'INR')}</span></td>
      <td style="text-align:right;font-variant-numeric:tabular-nums"><strong>${_pEsc(pur.currency === 'USD' ? '$' : '₹')} ${Number(pur.grand_total || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</strong></td>
      <td><span class="badge badge-${pur.status === 'paid' ? 'success' : (pur.status === 'received' ? 'info' : (pur.status === 'draft' ? 'secondary' : 'warning'))}">${pur.status.toUpperCase()}</span></td>
      <td>
        <div class="action-bar" style="justify-content:flex-end">
          <button class="btn-icon btn-edit-pur" data-id="${pur.id}" title="Edit Order">${ICONS.edit || ''}</button>
          ${pur.status !== 'paid'
            ? `<button class="btn-icon btn-mark-pur" data-id="${pur.id}" data-status="paid" title="Mark Paid" style="color:var(--success)">${ICONS.check || ''}</button>`
            : `<button class="btn-icon btn-mark-pur" data-id="${pur.id}" data-status="received" title="Mark Received">${ICONS.x || ''}</button>`
          }
          <button class="btn-icon danger btn-del-pur" data-id="${pur.id}" data-num="${_pEsc(pur.purchase_number)}" title="Delete">${ICONS.trash || ''}</button>
        </div>
      </td>
    </tr>
  `).join('');

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Purchase Orders &amp; Bills</h1>
        <p class="page-subtitle">${purchases.length} purchase record${purchases.length !== 1 ? 's' : ''} on file</p>
      </div>
      <button class="btn btn-primary btn-new-purchase-btn">${ICONS.plus || ''} New Purchase Order</button>
    </div>

    <div class="filter-bar">
      <div class="search-wrap" style="flex:1;max-width:320px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="search-input" type="text" id="pur-search" placeholder="Search PO # or vendor…"/>
      </div>
      <select class="form-select" id="pur-filter-status" style="min-width:130px">
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="pending">Pending</option>
        <option value="received">Received</option>
        <option value="paid">Paid</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <select class="form-select" id="pur-filter-vendor" style="min-width:160px">
        <option value="">All Suppliers</option>
        ${vendorOptions}
      </select>
    </div>

    <div class="table-wrap">
      ${purchases.length === 0 ? `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
          <h3>No purchase orders yet</h3>
          <p>Record your purchases from vendors to automatically restock your inventory and track cost of goods.</p>
          <button class="btn btn-primary btn-new-purchase-btn" style="margin-top:8px">${ICONS.plus || ''} New Purchase Order</button>
        </div>
      ` : `
        <table id="purchases-table" class="data-table">
          <thead>
            <tr>
              <th>Purchase #</th>
              <th>Vendor / Supplier</th>
              <th>Date</th>
              <th>Due Date</th>
              <th>Currency</th>
              <th style="text-align:right">Grand Total</th>
              <th>Status</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody id="purchases-tbody">
            ${rowsHtml}
          </tbody>
        </table>
      `}
    </div>
  `;

  // Attach search & filter handlers
  const filterRows = () => {
    const q = (document.getElementById('pur-search')?.value || '').toLowerCase().trim();
    const st = document.getElementById('pur-filter-status')?.value || '';
    const vId = document.getElementById('pur-filter-vendor')?.value || '';

    const trs = document.querySelectorAll('#purchases-tbody tr');
    trs.forEach(tr => {
      const matchSearch = !q || tr.dataset.search.includes(q);
      const matchStatus = !st || tr.dataset.status === st;
      const matchVendor = !vId || tr.dataset.vendor === vId;

      tr.style.display = (matchSearch && matchStatus && matchVendor) ? '' : 'none';
    });
  };

  document.getElementById('pur-search')?.addEventListener('input', filterRows);
  document.getElementById('pur-filter-status')?.addEventListener('change', filterRows);
  document.getElementById('pur-filter-vendor')?.addEventListener('change', filterRows);

  // Button Listeners
  content.querySelectorAll('.btn-new-purchase-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof openPurchaseEditor === 'function') openPurchaseEditor(null);
    });
  });

  content.querySelectorAll('.btn-edit-pur').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof openPurchaseEditor === 'function') openPurchaseEditor(Number(btn.dataset.id));
    });
  });

  content.querySelectorAll('.btn-mark-pur').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const newStatus = btn.dataset.status;
      try {
        await window.api.updatePurchaseStatus(id, newStatus);
        showToast(`Purchase status updated to ${newStatus.toUpperCase()}`, 'success');
        renderPurchases();
      } catch (err) {
        showToast(`Failed to update status: ${err.message}`, 'error');
      }
    });
  });

  content.querySelectorAll('.btn-del-pur').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const num = btn.dataset.num;
      showConfirm(
        'Delete Purchase Order',
        `Are you sure you want to delete purchase order "${num}"? Stock added from this purchase will be reverted.`,
        async () => {
          try {
            await window.api.deletePurchase(id);
            showToast('Purchase order deleted and stock restored', 'success');
            renderPurchases();
          } catch (err) {
            showToast(`Delete error: ${err.message}`, 'error');
          }
        }
      );
    });
  });
}

window.renderPurchases = renderPurchases;
