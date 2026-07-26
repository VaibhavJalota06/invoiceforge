/**
 * stock.js — Enterprise Inventory & Stock Management Module
 * Supports stock tracking, low-stock alerts, purchase restocking, and audit logs.
 */

async function renderStock() {
  const content = document.getElementById('page-content');
  if (!content) return;

  content.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading Inventory &amp; Stock Ledger…</p>
    </div>
  `;

  try {
    const products = (await window.api.getProducts()) || [];
    const settings = (await window.api.getSettings()) || {};
    const curr = (typeof getCurrency === 'function' ? getCurrency(settings.default_currency || 'INR') : null) || { symbol: '₹' };

    let totalAssetValue = 0;
    let lowStockCount = 0;

    products.forEach(p => {
      totalAssetValue += (Number(p.current_stock) || 0) * (Number(p.selling_rate) || 0);
      if ((Number(p.current_stock) || 0) <= (Number(p.reorder_level) || 5)) {
        lowStockCount++;
      }
    });

    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Inventory &amp; Stock Ledger</h1>
          <p class="page-subtitle">Real-time stock levels, low-stock alerts, and restocking logs</p>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-secondary" id="btn-view-stock-logs">${ICONS.eye || ''} Audit Log</button>
          <button class="btn btn-primary" id="btn-add-product">${ICONS.plus || ''} Add Inventory Item</button>
        </div>
      </div>

      <!-- Inventory Stat Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Inventory Items</div>
          <div class="stat-value">${products.length}</div>
          <div class="stat-sub">Active product SKUs</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Total Stock Asset Value</div>
          <div class="stat-value">${curr.symbol} ${totalAssetValue.toLocaleString('en-IN', {minimumFractionDigits:2,maximumFractionDigits:2})}</div>
          <div class="stat-sub">Based on selling rate</div>
        </div>
        <div class="stat-card ${lowStockCount > 0 ? 'danger' : 'info'}">
          <div class="stat-label">Low Stock Alerts</div>
          <div class="stat-value">${lowStockCount}</div>
          <div class="stat-sub">${lowStockCount > 0 ? 'Requires restocking' : 'All stock healthy'}</div>
        </div>
      </div>

      <!-- Search & Filters -->
      <div class="card" style="margin-bottom:20px;padding:14px 20px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="flex:1;position:relative">
            <input type="text" id="stock-search-input" class="form-input" placeholder="Search inventory by name or SKU code…" style="padding-left:14px">
          </div>
        </div>
      </div>

      <!-- Inventory Table -->
      <div class="card" style="padding:0;overflow:hidden">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Item / SKU</th>
                <th>Selling Rate</th>
                <th>Current Stock</th>
                <th>Stock Status</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody id="stock-table-body">
              ${_renderStockRows(products, curr)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Attach Search Filter
    const searchInput = document.getElementById('stock-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
        const body = document.getElementById('stock-table-body');
        if (body) body.innerHTML = _renderStockRows(filtered, curr);
      });
    }

    document.getElementById('btn-add-product')?.addEventListener('click', () => openProductModal(null));
    document.getElementById('btn-view-stock-logs')?.addEventListener('click', () => openStockLogsModal());

  } catch (err) {
    console.error('Render stock error:', err);
    const fullMsg = `renderStock error:\nMessage: ${err.message}\nStack: ${err.stack || 'no stack'}`;
    if (window.api && window.api.logError) window.api.logError(fullMsg).catch(() => {});
    content.innerHTML = `<div class="card danger"><p>Error loading stock data: ${err.message}</p><pre style="font-size:11px;margin-top:8px;white-space:pre-wrap;color:var(--text-3)">${err.stack || ''}</pre></div>`;
  }
}

function _renderStockRows(products, curr) {
  if (!products.length) {
    return `
      <tr>
        <td colspan="5" style="text-align:center;padding:40px;color:var(--text-3)">
          No inventory items found. Click <strong>+ Add Inventory Item</strong> to register products.
        </td>
      </tr>
    `;
  }

  return products.map(p => {
    const stock = Number(p.current_stock) || 0;
    const alertLvl = Number(p.reorder_level) || 5;

    let badge = `<span class="badge badge-success">In Stock</span>`;
    if (stock <= 0) {
      badge = `<span class="badge badge-danger">Out of Stock</span>`;
    } else if (stock <= alertLvl) {
      badge = `<span class="badge badge-warning">Low Stock (${stock})</span>`;
    }

    return `
      <tr>
        <td>
          <div style="font-weight:600;color:var(--text);font-size:14px">${_escStock(p.name)}</div>
          <div style="font-size:11.5px;color:var(--text-3);margin-top:2px">SKU: ${p.sku ? _escStock(p.sku) : 'N/A'} · Unit: ${_escStock(p.unit || 'Pcs')}</div>
        </td>
        <td>
          <div style="font-weight:600;color:var(--text)">${curr.symbol} ${Number(p.selling_rate || 0).toLocaleString('en-IN', {minimumFractionDigits:2,maximumFractionDigits:2})}</div>
          <div style="font-size:11px;color:var(--text-3)">Cost: ${curr.symbol} ${Number(p.cost_price || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
        </td>
        <td>
          <div style="font-size:16px;font-weight:700;color:${stock <= alertLvl ? 'var(--warning)' : 'var(--text)'}">${stock} <span style="font-size:12px;color:var(--text-3);font-weight:400">${_escStock(p.unit || 'Pcs')}</span></div>
        </td>
        <td>${badge}</td>
        <td style="text-align:right">
          <div style="display:flex;justify-content:flex-end;gap:6px">
            <button class="btn btn-secondary btn-sm" onclick="openRestockModal(${p.id}, 'IN')" title="Add Purchased Stock">+ Restock</button>
            <button class="btn btn-ghost btn-sm" onclick="openProductModal(${p.id})">${ICONS.edit || ''}</button>
            <button class="btn btn-ghost btn-sm danger" onclick="_deleteProduct(${p.id})">${ICONS.trash || ''}</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function openProductModal(productId = null) {
  let p = { name: '', sku: '', unit: 'Pcs', cost_price: 0, selling_rate: 0, current_stock: 0, reorder_level: 5 };
  if (productId) {
    p = (await window.api.getProduct(productId)) || p;
  }

  showModal(productId ? 'Edit Inventory Item' : 'Add New Inventory Item', `
    <form id="product-form" style="display:flex;flex-direction:column;gap:14px">
      <input type="hidden" id="p-id" value="${p.id || ''}">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="p-name">Item Name *</label>
          <input class="form-input" id="p-name" type="text" placeholder="e.g. Apple Crisp / Wireless Mouse" value="${_escStock(p.name)}" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="p-sku">SKU / Item Code</label>
          <input class="form-input" id="p-sku" type="text" placeholder="e.g. SK-1002" value="${_escStock(p.sku || '')}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="p-unit">Unit of Measure</label>
          <select class="form-select" id="p-unit">
            <option value="Pcs" ${p.unit==='Pcs'?'selected':''}>Pcs (Pieces)</option>
            <option value="Kg" ${p.unit==='Kg'?'selected':''}>Kg (Kilograms)</option>
            <option value="Box" ${p.unit==='Box'?'selected':''}>Box</option>
            <option value="Litre" ${p.unit==='Litre'?'selected':''}>Litre</option>
            <option value="Unit" ${p.unit==='Unit'?'selected':''}>Unit</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="p-reorder">Low Stock Alert Level</label>
          <input class="form-input" id="p-reorder" type="number" min="0" value="${p.reorder_level || 5}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="p-cost">Cost Price (Purchase Rate)</label>
          <input class="form-input" id="p-cost" type="number" min="0" step="0.01" value="${p.cost_price || 0}">
        </div>
        <div class="form-group">
          <label class="form-label" for="p-selling">Selling Rate (Billed Price) *</label>
          <input class="form-input" id="p-selling" type="number" min="0" step="0.01" value="${p.selling_rate || 0}" required>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="p-stock">Current Stock Quantity</label>
        <input class="form-input" id="p-stock" type="number" min="0" step="0.01" value="${p.current_stock || 0}">
      </div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${ICONS.check || ''} Save Product &amp; Close</button>
      </div>
    </form>
  `);

  const productForm = document.getElementById('product-form');
  productForm?.addEventListener('keydown', (e) => {
    // Enter is often used while typing inventory data. Do not let it
    // accidentally submit and close the dialog; use the explicit save button.
    if (e.key === 'Enter' && e.target.type !== 'submit') e.preventDefault();
  });

  productForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      id: document.getElementById('p-id').value ? Number(document.getElementById('p-id').value) : null,
      name: document.getElementById('p-name').value.trim(),
      sku: document.getElementById('p-sku').value.trim(),
      unit: document.getElementById('p-unit').value,
      reorder_level: Number(document.getElementById('p-reorder').value) || 5,
      cost_price: Number(document.getElementById('p-cost').value) || 0,
      selling_rate: Number(document.getElementById('p-selling').value) || 0,
      current_stock: Number(document.getElementById('p-stock').value) || 0
    };

    if (!data.name) return showToast('Product name is required', 'error');

    try {
      await window.api.saveProduct(data);
      closeModal();
      showToast('Inventory item saved successfully!', 'success');
      renderStock();
    } catch (err) {
      showToast(`Failed to save inventory item: ${err.message}`, 'error');
    }
  });
}

async function openRestockModal(productId, type = 'IN') {
  const p = await window.api.getProduct(productId);
  if (!p) return;

  const clients = (await window.api.getClients()) || [];
  const clientOptions = clients.map(c => `<option value="${c.id}">${_escStock(c.name)} (${_escStock(c.company_name || 'Individual')})</option>`).join('');

  showModal(type === 'IN' ? `Restock Inventory: ${_escStock(p.name)}` : `Stock Out: ${_escStock(p.name)}`, `
    <form id="restock-form" style="display:flex;flex-direction:column;gap:14px">
      <div style="background:var(--bg-3);padding:12px;border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:12px;color:var(--text-3)">Current Stock Level</div>
        <div style="font-size:18px;font-weight:700;color:var(--accent)">${p.current_stock} ${_escStock(p.unit || 'Pcs')}</div>
      </div>

      <div class="form-group">
        <label class="form-label" for="st-qty">Quantity to ${type === 'IN' ? 'Add (Purchase Restock)' : 'Deduct (Sale / Adjustment)'} *</label>
        <input class="form-input" id="st-qty" type="number" min="0.01" step="0.01" value="10" required>
      </div>

      <div class="form-group">
        <label class="form-label" for="st-client">Associated Client Account (Optional)</label>
        <select class="form-select" id="st-client">
          <option value="0">-- None / General Supplier --</option>
          ${clientOptions}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" for="st-notes">Audit Notes / Reference PO Number</label>
        <input class="form-input" id="st-notes" type="text" placeholder="e.g. Purchased batch from vendor / Warehouse restock">
      </div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${ICONS.check || ''} Save Stock Entry &amp; Close</button>
      </div>
    </form>
  `);

  const restockForm = document.getElementById('restock-form');
  restockForm?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.type !== 'submit') e.preventDefault();
  });

  restockForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tx = {
      product_id: productId,
      type: type,
      quantity: Number(document.getElementById('st-qty').value) || 0,
      reference_type: type === 'IN' ? 'PURCHASE' : 'MANUAL_SALE',
      client_id: Number(document.getElementById('st-client').value) || 0,
      notes: document.getElementById('st-notes').value.trim()
    };

    if (tx.quantity <= 0) return showToast('Quantity must be greater than zero', 'error');

    try {
      await window.api.recordStockTransaction(tx);
      closeModal();
      showToast('Stock updated successfully!', 'success');
      renderStock();
    } catch (err) {
      showToast(`Stock update failed: ${err.message}`, 'error');
    }
  });
}

async function openStockLogsModal() {
  const logs = (await window.api.getStockTransactions()) || [];

  const logRows = logs.map(l => {
    const isAdd = l.type === 'IN';
    return `
      <tr>
        <td style="font-size:12px;color:var(--text-3)">${new Date(l.created_at).toLocaleString('en-IN')}</td>
        <td style="font-weight:600">${_escStock(l.product_name || 'Product')}</td>
        <td>
          <span class="badge ${isAdd ? 'badge-success' : 'badge-warning'}">
            ${isAdd ? '+ Restock (IN)' : '- Deducted (OUT)'}
          </span>
        </td>
        <td style="font-weight:700;color:${isAdd ? 'var(--success)' : 'var(--warning)'}">${isAdd ? '+' : '-'}${l.quantity}</td>
        <td style="font-size:12px">${l.client_name ? _escStock(l.client_name) : '—'}</td>
        <td style="font-size:12px;color:var(--text-2)">${_escStock(l.notes || l.reference_type || '')}</td>
      </tr>
    `;
  }).join('');

  showModal('Inventory Audit & Stock Logs', `
    <div style="max-height:450px;overflow-y:auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date &amp; Time</th>
            <th>Item</th>
            <th>Movement</th>
            <th>Qty</th>
            <th>Client</th>
            <th>Audit Reference</th>
          </tr>
        </thead>
        <tbody>
          ${logRows || '<tr><td colspan="6" style="text-align:center;padding:20px">No stock logs recorded yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  `, 'modal-lg');
}

async function _deleteProduct(id) {
  const product = await window.api.getProduct(id);
  const name = product?.name || 'this product';
  showConfirm(
    'Delete Product',
    `Are you sure you want to delete product "${name}"? This will also remove its stock audit logs.`,
    async () => {
      try {
        await window.api.deleteProduct(id);
        showToast('Product deleted', 'info');
        renderStock();
      } catch (err) {
        showToast(`Failed to delete product: ${err.message}`, 'error');
      }
    }
  );
}

function _escStock(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.renderStock = renderStock;
window.openProductModal = openProductModal;
window.openRestockModal = openRestockModal;
