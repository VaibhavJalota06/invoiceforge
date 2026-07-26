/**
 * invoice-editor.js — Full invoice creation and editing
 * Handles: line items, multi-tax, discount, currency, status, PDF/print export
 */

let _editorInvoice = null;
let _editorClients = [];
let _editorItems   = [];
let _editorTaxLines = [];

async function openInvoiceEditor(invoiceId, options = {}) {
  const content = document.getElementById('page-content');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  const [settings, clients, products] = await Promise.all([
    window.api.getSettings(),
    window.api.getClients(),
    window.api.getProducts()
  ]);

  _editorClients = clients || [];
  window._editorProducts = products || [];
  _editorInvoice = null;

  let invoice = null;
  if (invoiceId) invoice = await window.api.getInvoice(invoiceId);
  _editorInvoice = invoice;

  const targetClientId = invoice?.client_id || options?.clientId || null;

  const defaultCurrency = invoice?.currency || settings.default_currency || 'INR';
  const today = todayISO();
  const paymentTerms = Math.max(0, Number(settings.default_payment_terms) || 30);
  const due   = addDays(today, paymentTerms);

  let invoiceNumber = invoice?.invoice_number || '';
  let nextCounter   = null;
  if (!invoiceNumber) {
    const result = await window.api.getNextInvoiceNumber();
    invoiceNumber = result.invoiceNumber;
    nextCounter   = result.nextCounter;
  }

  _editorItems = invoice?.items?.length
    ? invoice.items.map(i => ({ ...i }))
    : [{ description: '', quantity: 1, rate: 0, amount: 0 }];

  _editorTaxLines = invoice?.tax_lines?.length
    ? invoice.tax_lines.map(t => ({ ...t }))
    : [
        { name: 'CGST', rate: settings.default_tax_rate ? settings.default_tax_rate / 2 : 9, amount: 0 },
        { name: 'SGST', rate: settings.default_tax_rate ? settings.default_tax_rate / 2 : 9, amount: 0 }
      ];

  const isNew = !invoice;
  const isFinalized = invoice && invoice.status !== 'draft';

  content.innerHTML = `
    <div class="page-header">
      <div>
        <button class="btn btn-ghost btn-sm" onclick="renderInvoices()" style="margin-bottom:6px">← Back to Invoices</button>
        <h1 class="page-title">${invoice ? 'Edit Invoice' : 'New Invoice'}</h1>
        <p class="page-subtitle" style="color:var(--text-3)">${invoiceNumber}</p>
      </div>
      <div class="invoice-view-actions">
        ${isFinalized ? `
          <button class="btn btn-ghost" id="btn-print">${ICONS.print} Print</button>
          <button class="btn btn-secondary" id="btn-pdf">${ICONS.pdf} Export PDF</button>
        ` : ''}
        <button class="btn btn-ghost" id="btn-save-draft">Save Draft</button>
        <button class="btn btn-primary" id="btn-save-finalize">${invoice ? 'Update' : 'Save &amp; Finalize'}</button>
      </div>
    </div>

    <div class="invoice-editor">
      <!-- Meta row -->
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Invoice Number</label>
            <input class="form-input" id="inv-number" type="text" value="${_iEsc(invoiceNumber)}">
          </div>
          <div class="form-group">
            <label class="form-label">Invoice Date</label>
            <input class="form-input" id="inv-date" type="date" value="${invoice?.invoice_date || today}">
          </div>
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input class="form-input" id="inv-due" type="date" value="${invoice?.due_date || due}">
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="inv-status">
              <option value="draft"  ${(!invoice || invoice.status==='draft')  ?'selected':''}>Draft</option>
              <option value="unpaid" ${invoice?.status==='unpaid'?'selected':''}>Unpaid</option>
              <option value="paid"   ${invoice?.status==='paid'  ?'selected':''}>Paid</option>
              <option value="overdue"${invoice?.status==='overdue'?'selected':''}>Overdue</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Client + Currency -->
      <div class="card">
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label class="form-label">Bill To (Client)</label>
            <select class="form-select" id="inv-client">
              <option value="">— Select a client —</option>
              ${clients.map(c =>
                `<option value="${c.id}" ${targetClientId==c.id?'selected':''}>${_iEsc(c.name)}${c.company_name?' — '+_iEsc(c.company_name):''}</option>`
              ).join('')}
            </select>
            <span class="inline-add-client" id="btn-add-inline-client">${ICONS.plus} Add new client</span>
          </div>
          <div class="form-group">
            <label class="form-label">Currency</label>
            <select class="form-select" id="inv-currency"></select>
          </div>
        </div>
        <div id="client-preview" style="margin-top:4px;padding:10px;background:var(--bg-3);border-radius:var(--radius-sm);font-size:12.5px;color:var(--text-2);display:none;line-height:1.7"></div>
      </div>

      <!-- Line Items -->
      <div class="card">
        <div class="form-section-title" style="margin-bottom:12px">Line Items</div>
        <table class="line-items-table">
          <thead><tr>
            <th class="col-desc">Description</th>
            <th class="col-qty">Qty</th>
            <th class="col-rate">Rate</th>
            <th class="col-amt">Amount</th>
            <th class="col-del"></th>
          </tr></thead>
          <tbody id="line-items-body"></tbody>
        </table>
        <button class="btn btn-ghost btn-sm" id="btn-add-line" style="margin-top:10px">${ICONS.plus} Add Line Item</button>
      </div>

      <!-- Totals + Notes -->
      <div class="card totals-card">
        <div class="form-row" style="align-items:flex-start;gap:28px">
          <div style="flex:1">
            <div class="form-group">
              <label class="form-label">Commercial Terms &amp; Settlement Instructions</label>
              <textarea class="form-textarea" id="inv-notes" rows="6" placeholder="Settlement due terms, bank wire instructions, or special commercial notes…">${_iEsc(invoice?.notes || settings.invoice_footer || settings.bank_details || '')}</textarea>
            </div>
          </div>
          <div style="min-width:300px">
            <!-- Commercial Concession / Adjustment -->
            <div style="margin-bottom:14px">
              <label class="form-label">Commercial Concession / Adjustment</label>
              <div style="display:flex;gap:8px;align-items:center">
                <div class="toggle-group" style="flex-shrink:0;width:120px">
                  <button class="toggle-btn ${(!invoice||invoice.discount_type!=='flat')?'active':''}" id="disc-pct-btn" onclick="_setDiscType('percentage')">%</button>
                  <button class="toggle-btn ${invoice?.discount_type==='flat'?'active':''}" id="disc-flat-btn" onclick="_setDiscType('flat')">Flat</button>
                </div>
                <input class="form-input" id="inv-discount" type="number" min="0" step="0.01" placeholder="0"
                  value="${invoice?.discount_value||0}" oninput="_recalcTotals()">
              </div>
            </div>
            <!-- Tax Lines -->
            <div style="margin-bottom:14px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <label class="form-label" style="margin:0">Tax Lines</label>
                <button class="btn btn-ghost btn-sm" id="btn-add-tax">${ICONS.plus} Add Tax</button>
              </div>
              <div id="tax-lines-container"></div>
            </div>
            <!-- Totals Summary -->
            <div class="totals-section">
              <div class="total-row"><span class="total-label">Subtotal</span><span class="total-value" id="total-subtotal">—</span></div>
              <div class="total-row" id="discount-row"><span class="total-label">Discount</span><span class="total-value" id="total-discount" style="color:var(--warning)">—</span></div>
              <div id="tax-totals-rows"></div>
              <div class="total-row divider grand-total">
                <span class="total-label">Grand Total</span>
                <span class="total-value" id="total-grand">—</span>
              </div>
              <div style="margin-top:10px;padding-top:8px;border-top:1px dashed var(--border);font-size:12px;color:var(--text-3)">
                <strong style="color:var(--text-2)">Amount in Words:</strong>
                <div id="total-words" style="color:var(--accent);font-weight:600;margin-top:2px">—</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Currency
  const currSel = document.getElementById('inv-currency');
  populateCurrencySelect(currSel, defaultCurrency);
  currSel.addEventListener('change', _recalcTotals);

  // Client preview
  _updateClientPreview(invoice?.client_id);
  document.getElementById('inv-client')?.addEventListener('change', e => _updateClientPreview(e.target.value));

  // Inline add client listener
  document.getElementById('btn-add-inline-client')?.addEventListener('click', () => {
    openClientModal(null, _onInlineClientSaved);
  });

  // Line items
  _renderLineItems();
  document.getElementById('btn-add-line').addEventListener('click', () => {
    _editorItems.push({ description:'', quantity:1, rate:0, amount:0 });
    _renderLineItems();
  });

  // Tax lines
  _renderTaxLines();
  document.getElementById('btn-add-tax').addEventListener('click', () => {
    _editorTaxLines.push({ name:'Tax', rate:0, amount:0 });
    _renderTaxLines();
    _recalcTotals();
  });

  // Discount state
  window._currentDiscType = invoice?.discount_type || 'percentage';

  _recalcTotals();

  // Save buttons
  document.getElementById('btn-save-draft').addEventListener('click', () => _saveInvoice('draft', nextCounter));
  document.getElementById('btn-save-finalize').addEventListener('click', () => {
    const st = document.getElementById('inv-status').value;
    _saveInvoice(st === 'draft' ? 'unpaid' : st, nextCounter);
  });

  if (isFinalized) {
    document.getElementById('btn-pdf')?.addEventListener('click', _exportPdf);
    document.getElementById('btn-print')?.addEventListener('click', _printInvoice);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _setDiscType(type) {
  window._currentDiscType = type;
  document.getElementById('disc-pct-btn')?.classList.toggle('active', type==='percentage');
  document.getElementById('disc-flat-btn')?.classList.toggle('active', type==='flat');
  _recalcTotals();
}

function _updateClientPreview(clientId) {
  const preview = document.getElementById('client-preview');
  if (!preview) return;
  const client = _editorClients.find(c => c.id == clientId);
  if (!client) { preview.style.display='none'; return; }
  const lines = [
    client.company_name && `<strong>${_iEsc(client.company_name)}</strong>`,
    client.billing_address && _iEsc(client.billing_address).replace(/\n/g,'<br>'),
    client.email && _iEsc(client.email),
    client.phone && _iEsc(client.phone),
    client.gstin && `GSTIN: ${_iEsc(client.gstin)}`
  ].filter(Boolean);
  if (lines.length) { preview.innerHTML = lines.join('<br>'); preview.style.display='block'; }
  else preview.style.display='none';
}

function _renderLineItems() {
  const tbody = document.getElementById('line-items-body');
  if (!tbody) return;
  const products = window._editorProducts || [];
  tbody.innerHTML = _editorItems.map((item, idx) => `
    <tr>
      <td class="col-desc">
        <div style="display:flex;flex-direction:column;gap:4px">
          ${products.length > 0 ? `
            <select class="form-select" style="font-size:11.5px;padding:3px 8px;margin-bottom:2px" onchange="_onSelectInventoryProduct(${idx}, this.value)">
              <option value="0">-- Select from Inventory / Stock --</option>
              ${products.map(p => `<option value="${p.id}" ${item.product_id == p.id ? 'selected' : ''}>${_iEsc(p.name)} (${p.current_stock} ${_iEsc(p.unit||'Pcs')} in stock)</option>`).join('')}
            </select>
          ` : ''}
          <input class="form-input" type="text" placeholder="Description of product or service"
            value="${_iEsc(item.description)}"
            oninput="_editorItems[${idx}].description=this.value">
        </div>
      </td>
      <td class="col-qty">
        <input class="form-input" type="number" min="0" step="0.01" value="${item.quantity}"
          oninput="_editorItems[${idx}].quantity=parseFloat(this.value)||0;_recalcTotals()">
      </td>
      <td class="col-rate">
        <input class="form-input" type="number" min="0" step="0.01" value="${item.rate}"
          oninput="_editorItems[${idx}].rate=parseFloat(this.value)||0;_recalcTotals()">
      </td>
      <td class="col-amt"><span class="amount-display" id="item-amount-${idx}">—</span></td>
      <td class="col-del">${_editorItems.length>1
        ?`<button class="btn-icon danger" onclick="_removeLineItem(${idx})" title="Remove">${ICONS.trash}</button>`
        :''}</td>
    </tr>
  `).join('');
  _recalcTotals();
}

function _onSelectInventoryProduct(idx, productId) {
  const p = (window._editorProducts || []).find(x => x.id == productId);
  if (p) {
    _editorItems[idx].product_id = p.id;
    _editorItems[idx].description = p.name;
    _editorItems[idx].rate = p.selling_rate || 0;
    _renderLineItems();
  }
}

function _removeLineItem(idx) {
  _editorItems.splice(idx,1);
  _renderLineItems();
}

function _renderTaxLines() {
  const c = document.getElementById('tax-lines-container');
  if (!c) return;
  c.innerHTML = _editorTaxLines.map((tax, idx) => `
    <div class="tax-line-row">
      <input class="form-input" type="text" placeholder="Name (e.g. CGST)"
        value="${_iEsc(tax.name)}"
        oninput="_editorTaxLines[${idx}].name=this.value;_recalcTotals()"
        style="flex:1;min-width:90px">
      <input class="form-input" type="number" min="0" max="100" step="0.01" placeholder="%"
        value="${tax.rate}"
        oninput="_editorTaxLines[${idx}].rate=parseFloat(this.value)||0;_recalcTotals()"
        style="width:70px">
      <span style="width:100px;text-align:right;font-weight:600;color:var(--text-2);font-size:13px;flex-shrink:0" id="tax-amt-${idx}">—</span>
      <button class="btn-icon danger" onclick="_removeTaxLine(${idx})">${ICONS.trash}</button>
    </div>
  `).join('');
}

function _removeTaxLine(idx) {
  _editorTaxLines.splice(idx,1);
  _renderTaxLines();
  _recalcTotals();
}

function _recalcTotals() {
  const currCode = document.getElementById('inv-currency')?.value || 'INR';
  const curr = getCurrency(currCode);
  const fmt = n => `${curr.symbol} ${Number(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  let subtotal = 0;
  _editorItems.forEach((item, idx) => {
    item.amount = round2(item.quantity * item.rate);
    subtotal += item.amount;
    const el = document.getElementById(`item-amount-${idx}`);
    if (el) el.textContent = fmt(item.amount);
  });

  const discVal  = parseFloat(document.getElementById('inv-discount')?.value) || 0;
  const discType = window._currentDiscType || 'percentage';
  const discAmt  = Math.min(subtotal, discType==='percentage' ? round2(subtotal*discVal/100) : round2(discVal));
  const afterDisc = round2(subtotal - discAmt);

  let taxTotal = 0;
  _editorTaxLines.forEach((tax, idx) => {
    tax.amount = round2(afterDisc * tax.rate / 100);
    taxTotal += tax.amount;
    const el = document.getElementById(`tax-amt-${idx}`);
    if (el) el.textContent = fmt(tax.amount);
  });

  const grand = round2(afterDisc + taxTotal);

  const sub = document.getElementById('total-subtotal');
  const disc = document.getElementById('total-discount');
  const discRow = document.getElementById('discount-row');
  const grandEl = document.getElementById('total-grand');
  const wordsEl = document.getElementById('total-words');
  const taxRows = document.getElementById('tax-totals-rows');

  if (sub) sub.textContent  = fmt(subtotal);
  if (disc) disc.textContent = discAmt>0 ? `− ${fmt(discAmt)}` : '—';
  if (discRow) discRow.style.opacity = discAmt>0 ? '1' : '0.4';
  if (grandEl) grandEl.textContent = fmt(grand);
  if (wordsEl) wordsEl.textContent = numberToWords(grand, currCode);
  if (taxRows) taxRows.innerHTML = _editorTaxLines.map(t =>
    `<div class="total-row"><span class="total-label">${_iEsc(t.name)} (${t.rate}%)</span><span class="total-value" style="color:var(--text-2)">${fmt(t.amount)}</span></div>`
  ).join('');
}

async function _saveInvoice(status, nextCounter) {
  const invoiceNumber = document.getElementById('inv-number')?.value.trim();
  const clientId  = document.getElementById('inv-client')?.value;
  const invDate   = document.getElementById('inv-date')?.value;
  const dueDate   = document.getElementById('inv-due')?.value;
  const currency  = document.getElementById('inv-currency')?.value || 'INR';
  const notes     = document.getElementById('inv-notes')?.value.trim();
  const discVal   = parseFloat(document.getElementById('inv-discount')?.value) || 0;
  const discType  = window._currentDiscType || 'percentage';

  if (!invoiceNumber) { showToast('Invoice number is required','error'); return; }
  if (!invDate)       { showToast('Invoice date is required','error'); return; }

  let subtotal = 0;
  _editorItems.forEach(item => { item.amount=round2(item.quantity*item.rate); subtotal+=item.amount; });

  const discAmt  = Math.min(subtotal, discType==='percentage' ? round2(subtotal*discVal/100) : round2(discVal));
  const afterDisc = round2(subtotal - discAmt);
  let taxAmt = 0;
  _editorTaxLines.forEach(t => { t.amount=round2(afterDisc*t.rate/100); taxAmt+=t.amount; });

  const grandTotal = round2(afterDisc + taxAmt);

  try {
    const saved = await window.api.saveInvoice({
    id:             _editorInvoice?.id || null,
    invoice_number: invoiceNumber,
    client_id:      clientId ? parseInt(clientId) : null,
    invoice_date:   invDate,
    due_date:       dueDate,
    currency,
    subtotal:       round2(subtotal),
    discount_type:  discType,
    discount_value: discVal,
    discount_amount: discAmt,
    tax_lines:      _editorTaxLines,
    tax_amount:     round2(taxAmt),
    grand_total:    grandTotal,
    notes,
    status,
    items: _editorItems
    });

    showToast(status==='draft' ? 'Draft saved!' : 'Invoice saved!', 'success');
    _editorInvoice = saved;
    openInvoiceEditor(saved.id);
  } catch (err) {
    showToast(`Failed to save invoice: ${err.message}`, 'error');
  }
}

async function _exportPdf() {
  if (!_editorInvoice?.id) { showToast('Save the invoice first','error'); return; }
  const inv = await window.api.getInvoice(_editorInvoice.id);
  const settings = await window.api.getSettings();
  const html = buildInvoicePrintHtml(inv, settings);
  const res = await window.api.exportPdf(html, `${inv.invoice_number}.pdf`);
  if (res.success) showToast('PDF exported!','success');
  else if (res.reason!=='canceled') showToast('Export failed: '+res.reason,'error');
}

async function _printInvoice() {
  if (!_editorInvoice?.id) { showToast('Save the invoice first','error'); return; }
  const inv = await window.api.getInvoice(_editorInvoice.id);
  const settings = await window.api.getSettings();
  const html = buildInvoicePrintHtml(inv, settings);
  await window.api.printInvoice(html);
}

function _iEsc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function _onInlineClientSaved(saved) {
  if (!saved) return;
  _editorClients = await window.api.getClients();
  const sel = document.getElementById('inv-client');
  if (sel) {
    const name = saved.name || '';
    const company = saved.company_name ? ' — ' + saved.company_name : '';
    const opt = new Option(`${name}${company}`, saved.id, true, true);
    sel.add(opt);
    _updateClientPreview(saved.id);
  }
}
window._onInlineClientSaved = _onInlineClientSaved;
