/**
 * quotation-editor.js — Quotations & Estimates Form Editor
 */

async function openQuotationEditor(quotationId = null) {
  const content = document.getElementById('page-content');

  let quote = {
    id: null,
    quotation_number: '',
    client_id: null,
    quotation_date: new Date().toISOString().slice(0, 10),
    valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    currency: 'INR',
    subtotal: 0,
    discount_type: 'flat',
    discount_value: 0,
    discount_amount: 0,
    tax_amount: 0,
    grand_total: 0,
    notes: 'Quotation valid for 30 days from date of issue.',
    status: 'draft',
    items: []
  };

  if (quotationId) {
    const fetched = await window.api.getQuotation(quotationId);
    if (fetched) quote = fetched;
  } else {
    const nextNumObj = await window.api.getNextQuotationNumber();
    quote.quotation_number = nextNumObj.formatted;
  }

  const clients = await window.api.getClients();
  const products = await window.api.getProducts();

  const clientOptions = clients.map(c => `
    <option value="${c.id}" ${String(c.id) === String(quote.client_id) ? 'selected' : ''}>
      ${escapeHtml(c.name)} ${c.company_name ? `(${escapeHtml(c.company_name)})` : ''}
    </option>
  `).join('');

  content.innerHTML = `
    <div class="page-header mb-4">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-icon" id="btn-back-quotations">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 class="page-title">${quotationId ? 'Edit Quotation' : 'New Quotation / Estimate'}</h1>
          <p class="page-subtitle">${escapeHtml(quote.quotation_number)}</p>
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary" id="btn-cancel-q-editor">Cancel</button>
        <button class="btn btn-primary" id="btn-save-quotation">Save Quotation</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns: 2fr 1fr;gap:24px">
      <!-- Main Form -->
      <div>
        <div class="card mb-4">
          <h3 style="margin-bottom:16px;font-size:16px;font-weight:700">Client Details</h3>
          <div class="form-group mb-3">
            <label class="form-label">Select Client *</label>
            <select class="form-control" id="q-client-id">
              <option value="">-- Choose Existing Client --</option>
              ${clientOptions}
            </select>
          </div>
        </div>

        <div class="card mb-4">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="font-size:16px;font-weight:700">Line Items</h3>
            <button class="btn btn-sm btn-secondary" id="btn-add-q-item">+ Add Line Item</button>
          </div>
          <table class="table" id="q-items-table">
            <thead>
              <tr>
                <th style="width:35%">Item Description</th>
                <th style="width:15%">Unit</th>
                <th style="width:15%">Qty</th>
                <th style="width:15%">Rate (₹)</th>
                <th style="width:15%;text-align:right">Amount (₹)</th>
                <th style="width:5%"></th>
              </tr>
            </thead>
            <tbody id="q-items-tbody"></tbody>
          </table>
        </div>

        <div class="card">
          <h3 style="margin-bottom:12px;font-size:16px;font-weight:700">Notes &amp; Terms</h3>
          <textarea class="form-control" id="q-notes" rows="3">${escapeHtml(quote.notes)}</textarea>
        </div>
      </div>

      <!-- Side Details Panel -->
      <div>
        <div class="card mb-4">
          <h3 style="margin-bottom:16px;font-size:16px;font-weight:700">Quotation Metadata</h3>
          <div class="form-group mb-3">
            <label class="form-label">Quotation Number *</label>
            <input type="text" class="form-control" id="q-number" value="${escapeHtml(quote.quotation_number)}">
          </div>
          <div class="form-group mb-3">
            <label class="form-label">Quotation Date *</label>
            <input type="date" class="form-control" id="q-date" value="${quote.quotation_date}">
          </div>
          <div class="form-group mb-3">
            <label class="form-label">Valid Until</label>
            <input type="date" class="form-control" id="q-valid-until" value="${quote.valid_until}">
          </div>
          <div class="form-group mb-3">
            <label class="form-label">Status</label>
            <select class="form-control" id="q-status">
              <option value="draft" ${quote.status === 'draft' ? 'selected' : ''}>Draft</option>
              <option value="sent" ${quote.status === 'sent' ? 'selected' : ''}>Sent</option>
              <option value="accepted" ${quote.status === 'accepted' ? 'selected' : ''}>Accepted</option>
              <option value="declined" ${quote.status === 'declined' ? 'selected' : ''}>Declined</option>
            </select>
          </div>
        </div>

        <div class="card" style="background:var(--bg-card);border:1px solid var(--border-color)">
          <h3 style="margin-bottom:16px;font-size:16px;font-weight:700">Summary</h3>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span>Subtotal</span>
            <span id="q-summary-subtotal" style="font-weight:600">₹0.00</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;align-items:center">
            <span>Discount</span>
            <div style="display:flex;gap:4px">
              <input type="number" id="q-discount-val" class="form-control" style="width:70px;padding:4px 8px" value="${quote.discount_value || 0}">
              <select id="q-discount-type" class="form-control" style="width:60px;padding:4px 4px">
                <option value="flat" ${quote.discount_type === 'flat' ? 'selected' : ''}>₹</option>
                <option value="percent" ${quote.discount_type === 'percent' ? 'selected' : ''}>%</option>
              </select>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:12px">
            <span>Tax Amount</span>
            <span id="q-summary-tax" style="font-weight:600">₹0.00</span>
          </div>
          <hr style="border-color:var(--border-color);margin:12px 0">
          <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;color:var(--accent)">
            <span>Grand Total</span>
            <span id="q-summary-grand">₹0.00</span>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-back-quotations').addEventListener('click', () => navigate('quotations'));
  document.getElementById('btn-cancel-q-editor').addEventListener('click', () => navigate('quotations'));

  // Items rendering
  const tbody = document.getElementById('q-items-tbody');

  function renderRows(items) {
    tbody.innerHTML = '';
    if (items.length === 0) {
      items.push({ product_id: 0, description: '', unit: 'Pcs', quantity: 1, rate: 0, amount: 0 });
    }
    items.forEach((item, idx) => {
      const prodOptions = products.map(p => `
        <option value="${p.id}" ${String(p.id) === String(item.product_id) ? 'selected' : ''}>${escapeHtml(p.name)}</option>
      `).join('');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <select class="form-control mb-1 item-prod-select" data-idx="${idx}">
            <option value="0">-- Custom / Select Product --</option>
            ${prodOptions}
          </select>
          <input type="text" class="form-control item-desc" data-idx="${idx}" value="${escapeHtml(item.description || '')}" placeholder="Item description...">
        </td>
        <td><input type="text" class="form-control item-unit" data-idx="${idx}" value="${escapeHtml(item.unit || 'Pcs')}"></td>
        <td><input type="number" class="form-control item-qty" data-idx="${idx}" value="${item.quantity || 1}" min="1"></td>
        <td><input type="number" step="0.01" class="form-control item-rate" data-idx="${idx}" value="${item.rate || 0}"></td>
        <td style="text-align:right;font-weight:700" class="item-amt" data-idx="${idx}">${formatCurrency((item.quantity || 1) * (item.rate || 0))}</td>
        <td style="text-align:center"><button class="btn btn-icon text-danger btn-remove-item" data-idx="${idx}">&times;</button></td>
      `;
      tbody.appendChild(tr);
    });
    attachEvents();
    recalculateTotals();
  }

  function attachEvents() {
    tbody.querySelectorAll('.item-prod-select').forEach(sel => {
      sel.addEventListener('change', e => {
        const idx = parseInt(e.target.dataset.idx);
        const pId = parseInt(e.target.value);
        if (pId) {
          const prod = products.find(p => p.id === pId);
          if (prod) {
            quote.items[idx].product_id = prod.id;
            quote.items[idx].description = prod.name;
            quote.items[idx].unit = prod.unit || 'Pcs';
            quote.items[idx].rate = prod.selling_rate || 0;
            renderRows(quote.items);
          }
        }
      });
    });

    tbody.querySelectorAll('.item-desc').forEach(inp => {
      inp.addEventListener('input', e => { quote.items[parseInt(e.target.dataset.idx)].description = e.target.value; });
    });
    tbody.querySelectorAll('.item-unit').forEach(inp => {
      inp.addEventListener('input', e => { quote.items[parseInt(e.target.dataset.idx)].unit = e.target.value; });
    });
    tbody.querySelectorAll('.item-qty').forEach(inp => {
      inp.addEventListener('input', e => {
        const idx = parseInt(e.target.dataset.idx);
        quote.items[idx].quantity = parseFloat(e.target.value) || 0;
        recalculateTotals();
      });
    });
    tbody.querySelectorAll('.item-rate').forEach(inp => {
      inp.addEventListener('input', e => {
        const idx = parseInt(e.target.dataset.idx);
        quote.items[idx].rate = parseFloat(e.target.value) || 0;
        recalculateTotals();
      });
    });
    tbody.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(e.target.dataset.idx);
        quote.items.splice(idx, 1);
        renderRows(quote.items);
      });
    });
  }

  function recalculateTotals() {
    let subtotal = 0;
    quote.items.forEach((it, i) => {
      const amt = (it.quantity || 0) * (it.rate || 0);
      it.amount = amt;
      subtotal += amt;
      const amtTd = tbody.querySelector(`.item-amt[data-idx="${i}"]`);
      if (amtTd) amtTd.textContent = formatCurrency(amt);
    });

    const discVal = parseFloat(document.getElementById('q-discount-val')?.value) || 0;
    const discType = document.getElementById('q-discount-type')?.value || 'flat';
    let discAmt = discType === 'percent' ? (subtotal * discVal) / 100 : discVal;

    const grand = Math.max(0, subtotal - discAmt);

    document.getElementById('q-summary-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('q-summary-grand').textContent = formatCurrency(grand);

    quote.subtotal = subtotal;
    quote.discount_value = discVal;
    quote.discount_type = discType;
    quote.discount_amount = discAmt;
    quote.grand_total = grand;
  }

  document.getElementById('btn-add-q-item').addEventListener('click', () => {
    quote.items.push({ product_id: 0, description: '', unit: 'Pcs', quantity: 1, rate: 0, amount: 0 });
    renderRows(quote.items);
  });

  document.getElementById('q-discount-val').addEventListener('input', recalculateTotals);
  document.getElementById('q-discount-type').addEventListener('change', recalculateTotals);

  renderRows(quote.items.length ? quote.items : [{ product_id: 0, description: '', unit: 'Pcs', quantity: 1, rate: 0, amount: 0 }]);

  // Save Quotation Handler
  document.getElementById('btn-save-quotation').addEventListener('click', async () => {
    const clientId = document.getElementById('q-client-id').value;
    const qNum = document.getElementById('q-number').value.trim();
    if (!qNum) return alert('Quotation Number is required.');

    quote.quotation_number = qNum;
    quote.client_id = clientId ? parseInt(clientId) : null;
    quote.quotation_date = document.getElementById('q-date').value;
    quote.valid_until = document.getElementById('q-valid-until').value;
    quote.status = document.getElementById('q-status').value;
    quote.notes = document.getElementById('q-notes').value.trim();

    try {
      await window.api.saveQuotation(quote);
      navigate('quotations');
    } catch (err) {
      alert(`Failed to save quotation: ${err.message}`);
    }
  });
}
