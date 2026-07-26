/**
 * purchase-editor.js — Purchase Bill & Order Creation Module
 * Handles line items, product cost rates, multi-tax, vendor selection, and stock auto-restocking.
 */

let _editorPurchase = null;
let _editorVendors = [];
let _editorPurchaseItems = [];
let _editorPurchaseTaxLines = [];

async function openPurchaseEditor(purchaseId = null, options = {}) {
  const content = document.getElementById('page-content');
  if (!content) return;
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Opening Purchase Order Editor…</p></div>`;

  try {
    const [settingsRes, vendorsRes, productsRes] = await Promise.all([
      window.api?.getSettings?.().catch(() => ({})) || {},
      window.api?.getVendors?.().catch(() => []) || [],
      window.api?.getProducts?.().catch(() => []) || []
    ]);

    const settings = settingsRes || {};
    const vendors = vendorsRes || [];
    const products = productsRes || [];

    _editorVendors = vendors;
    window._editorPurchaseProducts = products;
    _editorPurchase = null;

    let purchase = null;
    if (purchaseId && window.api?.getPurchase) {
      purchase = await window.api.getPurchase(purchaseId).catch(() => null);
    }
    _editorPurchase = purchase;

    const targetVendorId = purchase?.vendor_id || options?.vendor_id || null;
    const defaultCurrency = purchase?.currency || settings.default_currency || 'INR';
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    let purchaseNumber = purchase?.purchase_number || '';
    if (!purchaseNumber) {
      const result = (await window.api?.getNextPurchaseNumber?.().catch(() => ({}))) || {};
      purchaseNumber = result.purchaseNumber || 'PUR-2026-001';
    }

    _editorPurchaseItems = purchase?.items?.length
      ? purchase.items.map(i => ({ unit: 'Pcs', cost_price: i.cost_price || i.rate || 0, ...i }))
      : [{ product_id: 0, description: '', quantity: 1, unit: 'Pcs', cost_price: 0, amount: 0 }];

    _editorPurchaseTaxLines = purchase?.tax_lines?.length
      ? purchase.tax_lines.map(t => ({ ...t }))
      : [
          { name: 'CGST', rate: settings.default_tax_rate ? settings.default_tax_rate / 2 : 9, amount: 0 },
          { name: 'SGST', rate: settings.default_tax_rate ? settings.default_tax_rate / 2 : 9, amount: 0 }
        ];

    content.innerHTML = `
      <div class="page-header">
        <div>
          <button class="btn btn-ghost btn-sm" onclick="renderPurchases()" style="margin-bottom:6px">&larr; Back to Purchase Orders</button>
          <h1 class="page-title">${purchase ? 'Edit Purchase Order' : 'New Purchase Order'}</h1>
          <p class="page-subtitle" style="color:var(--text-3)">${purchaseNumber}</p>
        </div>
        <div class="invoice-view-actions">
          <button class="btn btn-ghost" id="btn-save-pur-draft">Save Draft</button>
          <button class="btn btn-primary" id="btn-save-pur-received">${purchase ? 'Update Purchase' : 'Save &amp; Add Stock'}</button>
        </div>
      </div>

      <div class="invoice-editor">
        <!-- Meta Details -->
        <div class="card">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Purchase PO #</label>
              <input class="form-input" id="pur-number" type="text" value="${_peEsc(purchaseNumber)}">
            </div>
            <div class="form-group">
              <label class="form-label">Purchase Date</label>
              <input class="form-input" id="pur-date" type="date" value="${purchase?.purchase_date || today}">
            </div>
            <div class="form-group">
              <label class="form-label">Payment Due Date</label>
              <input class="form-input" id="pur-due" type="date" value="${purchase?.due_date || due}">
            </div>
            <div class="form-group">
              <label class="form-label">Order Status</label>
              <select class="form-select" id="pur-status">
                <option value="received" ${(!purchase || purchase.status==='received') ? 'selected':''}>Received (Restock Active)</option>
                <option value="paid"     ${purchase?.status==='paid'     ? 'selected':''}>Paid (Restock Active)</option>
                <option value="pending"  ${purchase?.status==='pending'  ? 'selected':''}>Pending Delivery</option>
                <option value="draft"    ${purchase?.status==='draft'    ? 'selected':''}>Draft</option>
                <option value="cancelled"${purchase?.status==='cancelled'? 'selected':''}>Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Vendor & Currency -->
        <div class="card">
          <div class="form-row">
            <div class="form-group" style="flex:2">
              <label class="form-label">Supplier / Vendor</label>
              <select class="form-select" id="pur-vendor">
                <option value="">— Select a supplier —</option>
                ${vendors.map(v =>
                  `<option value="${v.id}" ${targetVendorId == v.id ? 'selected':''}>${_peEsc(v.name)}${v.company_name ? ' — '+_peEsc(v.company_name):''}</option>`
                ).join('')}
              </select>
              <span class="inline-add-client" id="btn-add-inline-vendor" style="cursor:pointer;color:var(--accent);font-size:12px;display:inline-flex;align-items:center;gap:4px;margin-top:6px">+ Add new vendor</span>
            </div>
            <div class="form-group">
              <label class="form-label">Currency</label>
              <select class="form-select" id="pur-currency">
                <option value="INR" ${defaultCurrency === 'INR' ? 'selected' : ''}>INR (₹)</option>
                <option value="USD" ${defaultCurrency === 'USD' ? 'selected' : ''}>USD ($)</option>
                <option value="EUR" ${defaultCurrency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                <option value="GBP" ${defaultCurrency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
              </select>
            </div>
          </div>
          <div id="vendor-preview" style="margin-top:8px;padding:10px;background:var(--bg-3);border-radius:var(--radius-sm);font-size:12.5px;color:var(--text-2);display:none;line-height:1.6"></div>
        </div>

        <!-- Line Items -->
        <div class="card">
          <div class="form-section-title" style="margin-bottom:12px;font-weight:700">Purchased Items &amp; Stock Cost</div>
          <div class="table-wrap" style="overflow-x:auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="min-width:240px">Product / Item Description</th>
                  <th style="width:90px">Qty</th>
                  <th style="width:110px">Unit</th>
                  <th style="width:130px">Cost Rate</th>
                  <th style="width:130px;text-align:right">Amount</th>
                  <th style="width:40px"></th>
                </tr>
              </thead>
              <tbody id="pur-line-items-body"></tbody>
            </table>
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-add-pur-line" style="margin-top:10px">${ICONS.plus || ''} Add Item Row</button>
        </div>

        <!-- Totals & Notes -->
        <div class="card">
          <div style="display:grid;grid-template-columns:1fr 340px;gap:24px">
            <div>
              <div class="form-group">
                <label class="form-label">Purchase Notes &amp; Supplier Instructions</label>
                <textarea class="form-input" id="pur-notes" rows="4" placeholder="Add terms, tracking numbers, or warehouse notes…">${_peEsc(purchase?.notes || '')}</textarea>
              </div>
            </div>

            <!-- Calculation Summary -->
            <div style="background:var(--bg-3);padding:16px;border-radius:8px;border:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
                <span style="color:var(--text-3)">Subtotal:</span>
                <strong id="pur-subtotal-val">₹ 0.00</strong>
              </div>

              <!-- Discount -->
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font-size:13px">
                <div style="display:flex;align-items:center;gap:6px">
                  <span style="color:var(--text-3)">Discount:</span>
                  <select class="form-select" id="pur-discount-type" style="padding:2px 6px;font-size:11px">
                    <option value="flat" ${purchase?.discount_type==='flat'?'selected':''}>Flat</option>
                    <option value="percent" ${purchase?.discount_type==='percent'?'selected':''}>%</option>
                  </select>
                </div>
                <input class="form-input" id="pur-discount-val" type="number" step="0.01" min="0" value="${purchase?.discount_value || 0}" style="width:80px;padding:4px 8px;text-align:right">
              </div>

              <!-- Taxes -->
              <div id="pur-tax-lines-wrap" style="margin-bottom:8px"></div>

              <div style="border-top:2px solid var(--border);padding-top:10px;margin-top:10px;display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:15px;font-weight:700;color:var(--text)">Grand Total:</span>
                <span id="pur-grand-total-val" style="font-size:20px;font-weight:800;color:var(--accent)">₹ 0.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Render Rows & Tax Lines
    _renderPurchaseItemRows();
    _renderPurchaseTaxRows();
    _recalcPurchaseTotals();

    // Attach Event Handlers
    document.getElementById('pur-vendor')?.addEventListener('change', (e) => {
      _updateVendorPreview(Number(e.target.value));
    });
    if (targetVendorId) _updateVendorPreview(Number(targetVendorId));

    document.getElementById('btn-add-inline-vendor')?.addEventListener('click', () => {
      openVendorModal(null, (newVendor) => {
        _editorVendors.push(newVendor);
        const sel = document.getElementById('pur-vendor');
        if (sel) {
          const opt = document.createElement('option');
          opt.value = newVendor.id;
          opt.textContent = `${newVendor.name}${newVendor.company_name ? ' — '+newVendor.company_name : ''}`;
          opt.selected = true;
          sel.appendChild(opt);
          _updateVendorPreview(newVendor.id);
        }
      });
    });

    document.getElementById('btn-add-pur-line')?.addEventListener('click', () => {
      _editorPurchaseItems.push({ product_id: 0, description: '', quantity: 1, unit: 'Pcs', cost_price: 0, amount: 0 });
      _renderPurchaseItemRows();
      _recalcPurchaseTotals();
    });

    document.getElementById('pur-discount-type')?.addEventListener('change', () => _recalcPurchaseTotals());
    document.getElementById('pur-discount-val')?.addEventListener('input', () => _recalcPurchaseTotals());

    document.getElementById('btn-save-pur-draft')?.addEventListener('click', () => _savePurchaseOrder('draft'));
    document.getElementById('btn-save-pur-received')?.addEventListener('click', () => _savePurchaseOrder(document.getElementById('pur-status')?.value || 'received'));

  } catch (err) {
    showToast(`Error initializing editor: ${err.message}`, 'error');
    console.error(err);
  }
}

function _peEsc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _updateVendorPreview(vendorId) {
  const container = document.getElementById('vendor-preview');
  if (!container) return;
  const vendor = _editorVendors.find(v => Number(v.id) === Number(vendorId));
  if (!vendor) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  container.innerHTML = `
    <strong>${_peEsc(vendor.name)}</strong> ${vendor.company_name ? '— ' + _peEsc(vendor.company_name) : ''}<br>
    ${vendor.address ? _peEsc(vendor.address) + '<br>' : ''}
    ${vendor.phone ? 'Phone: ' + _peEsc(vendor.phone) + ' · ' : ''} ${vendor.email ? 'Email: ' + _peEsc(vendor.email) : ''}
    ${vendor.gstin ? '<br>GSTIN: <span class="td-mono">' + _peEsc(vendor.gstin) + '</span>' : ''}
  `;
}

function _renderPurchaseItemRows() {
  const tbody = document.getElementById('pur-line-items-body');
  if (!tbody) return;

  const products = window._editorPurchaseProducts || [];
  const prodOptionsHtml = products.map(p =>
    `<option value="${p.id}" data-name="${_peEsc(p.name)}" data-unit="${_peEsc(p.unit||'Pcs')}" data-cost="${p.cost_price || 0}">${_peEsc(p.name)} (${p.sku ? _peEsc(p.sku) + ' · ' : ''}Cost: ₹${p.cost_price || 0})</option>`
  ).join('');

  tbody.innerHTML = _editorPurchaseItems.map((item, index) => `
    <tr>
      <td>
        <select class="form-select item-prod-select" data-index="${index}" style="margin-bottom:6px">
          <option value="0">— Custom Description / Select Product —</option>
          ${prodOptionsHtml}
        </select>
        <input class="form-input item-desc-input" data-index="${index}" type="text" placeholder="Item description / specifications" value="${_peEsc(item.description)}">
      </td>
      <td>
        <input class="form-input item-qty-input" data-index="${index}" type="number" min="0.01" step="0.01" value="${item.quantity || 1}">
      </td>
      <td>
        <select class="form-select item-unit-select" data-index="${index}">
          <option value="Pcs" ${(!item.unit || item.unit==='Pcs')?'selected':''}>Pcs</option>
          <option value="Box" ${item.unit==='Box'?'selected':''}>Box</option>
          <option value="Pack" ${item.unit==='Pack'?'selected':''}>Pack</option>
          <option value="Kg" ${item.unit==='Kg'?'selected':''}>Kg</option>
          <option value="Litre" ${item.unit==='Litre'?'selected':''}>Litre</option>
          <option value="Set" ${item.unit==='Set'?'selected':''}>Set</option>
        </select>
      </td>
      <td>
        <input class="form-input item-cost-input" data-index="${index}" type="number" min="0" step="0.01" value="${item.cost_price || 0}">
      </td>
      <td style="text-align:right;font-weight:700;vertical-align:middle" class="item-amount-td" data-index="${index}">
        ₹ ${Number(item.amount || 0).toFixed(2)}
      </td>
      <td style="vertical-align:middle;text-align:center">
        <button class="btn-icon danger btn-del-pur-row" data-index="${index}" title="Remove row">${ICONS.trash || '×'}</button>
      </td>
    </tr>
  `).join('');

  // Attach Row Listeners
  tbody.querySelectorAll('.item-prod-select').forEach(select => {
    const idx = Number(select.dataset.index);
    if (_editorPurchaseItems[idx]?.product_id) {
      select.value = _editorPurchaseItems[idx].product_id;
    }
    select.addEventListener('change', (e) => {
      const pId = Number(e.target.value);
      _editorPurchaseItems[idx].product_id = pId;
      if (pId > 0) {
        const prod = products.find(p => Number(p.id) === pId);
        if (prod) {
          _editorPurchaseItems[idx].description = prod.name;
          _editorPurchaseItems[idx].unit = prod.unit || 'Pcs';
          _editorPurchaseItems[idx].cost_price = Number(prod.cost_price) || 0;
          _renderPurchaseItemRows();
          _recalcPurchaseTotals();
        }
      }
    });
  });

  tbody.querySelectorAll('.item-desc-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.index);
      _editorPurchaseItems[idx].description = e.target.value;
    });
  });

  tbody.querySelectorAll('.item-qty-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.index);
      _editorPurchaseItems[idx].quantity = Number(e.target.value) || 0;
      _recalcPurchaseTotals();
    });
  });

  tbody.querySelectorAll('.item-unit-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const idx = Number(e.target.dataset.index);
      _editorPurchaseItems[idx].unit = e.target.value;
    });
  });

  tbody.querySelectorAll('.item-cost-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.index);
      _editorPurchaseItems[idx].cost_price = Number(e.target.value) || 0;
      _recalcPurchaseTotals();
    });
  });

  tbody.querySelectorAll('.btn-del-pur-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.index);
      if (_editorPurchaseItems.length > 1) {
        _editorPurchaseItems.splice(idx, 1);
        _renderPurchaseItemRows();
        _recalcPurchaseTotals();
      }
    });
  });
}

function _renderPurchaseTaxRows() {
  const container = document.getElementById('pur-tax-lines-wrap');
  if (!container) return;

  container.innerHTML = _editorPurchaseTaxLines.map((tax, idx) => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:12.5px">
      <div style="display:flex;align-items:center;gap:4px">
        <input class="form-input tax-name-input" data-index="${idx}" type="text" value="${_peEsc(tax.name)}" style="width:70px;padding:2px 6px;font-size:11px">
        <input class="form-input tax-rate-input" data-index="${idx}" type="number" step="0.1" value="${tax.rate || 0}" style="width:50px;padding:2px 6px;font-size:11px">%
      </div>
      <span class="tax-amount-span" data-index="${idx}" style="font-weight:600">₹ 0.00</span>
    </div>
  `).join('');

  container.querySelectorAll('.tax-name-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.index);
      _editorPurchaseTaxLines[idx].name = e.target.value;
    });
  });

  container.querySelectorAll('.tax-rate-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.index);
      _editorPurchaseTaxLines[idx].rate = Number(e.target.value) || 0;
      _recalcPurchaseTotals();
    });
  });
}

function _recalcPurchaseTotals() {
  let subtotal = 0;

  _editorPurchaseItems.forEach((item, idx) => {
    const amount = (Number(item.quantity) || 0) * (Number(item.cost_price) || 0);
    item.amount = amount;
    subtotal += amount;

    const amtTd = document.querySelector(`.item-amount-td[data-index="${idx}"]`);
    if (amtTd) amtTd.textContent = `₹ ${amount.toFixed(2)}`;
  });

  const subEl = document.getElementById('pur-subtotal-val');
  if (subEl) subEl.textContent = `₹ ${subtotal.toFixed(2)}`;

  // Discount
  const discType = document.getElementById('pur-discount-type')?.value || 'flat';
  const discVal  = Number(document.getElementById('pur-discount-val')?.value) || 0;
  let discountAmount = discType === 'percent' ? (subtotal * (discVal / 100)) : discVal;
  discountAmount = Math.min(subtotal, Math.max(0, discountAmount));

  const taxableAmount = Math.max(0, subtotal - discountAmount);

  // Tax Lines
  let totalTax = 0;
  _editorPurchaseTaxLines.forEach((tax, idx) => {
    const taxAmt = taxableAmount * ((Number(tax.rate) || 0) / 100);
    tax.amount = taxAmt;
    totalTax += taxAmt;

    const span = document.querySelector(`.tax-amount-span[data-index="${idx}"]`);
    if (span) span.textContent = `₹ ${taxAmt.toFixed(2)}`;
  });

  const grandTotal = taxableAmount + totalTax;

  const grandEl = document.getElementById('pur-grand-total-val');
  if (grandEl) grandEl.textContent = `₹ ${grandTotal.toLocaleString('en-IN', {minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

async function _savePurchaseOrder(status) {
  const purNum = document.getElementById('pur-number')?.value.trim();
  const vendorId = document.getElementById('pur-vendor')?.value;
  const purDate = document.getElementById('pur-date')?.value;
  const dueDate = document.getElementById('pur-due')?.value;
  const currency = document.getElementById('pur-currency')?.value || 'INR';
  const notes = document.getElementById('pur-notes')?.value.trim();

  if (!purNum) return showToast('Purchase PO # is required', 'error');

  // Recalculate
  _recalcPurchaseTotals();

  let subtotal = 0;
  _editorPurchaseItems.forEach(i => subtotal += (Number(i.amount) || 0));

  const discType = document.getElementById('pur-discount-type')?.value || 'flat';
  const discVal  = Number(document.getElementById('pur-discount-val')?.value) || 0;
  const discountAmount = discType === 'percent' ? (subtotal * (discVal / 100)) : discVal;

  let totalTax = 0;
  _editorPurchaseTaxLines.forEach(t => totalTax += (Number(t.amount) || 0));

  const grandTotal = Math.max(0, subtotal - discountAmount) + totalTax;

  const payload = {
    id: _editorPurchase?.id || null,
    purchase_number: purNum,
    vendor_id: vendorId ? Number(vendorId) : null,
    purchase_date: purDate,
    due_date: dueDate,
    currency: currency,
    subtotal: subtotal,
    discount_type: discType,
    discount_value: discVal,
    discount_amount: discountAmount,
    tax_lines: _editorPurchaseTaxLines,
    tax_amount: totalTax,
    grand_total: grandTotal,
    notes: notes,
    status: status,
    items: _editorPurchaseItems.map(i => ({
      product_id: Number(i.product_id) || 0,
      description: i.description,
      unit: i.unit || 'Pcs',
      quantity: Number(i.quantity) || 1,
      cost_price: Number(i.cost_price) || 0,
      amount: Number(i.amount) || 0
    }))
  };

  try {
    const saved = await window.api.savePurchase(payload);
    showToast(`Purchase order ${saved.purchase_number} saved successfully!`, 'success');
    renderPurchases();
  } catch (err) {
    showToast(`Failed to save purchase order: ${err.message}`, 'error');
  }
}

window.openPurchaseEditor = openPurchaseEditor;
