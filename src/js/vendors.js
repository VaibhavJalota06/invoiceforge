/**
 * vendors.js — Vendor & Supplier Management Module
 */

async function renderVendors() {
  const content = document.getElementById('page-content');
  if (!content) return;
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading Vendors &amp; Suppliers…</p></div>`;
  try {
    const vendors = (await window.api.getVendors()) || [];
    _renderVendorList(vendors, '');
  } catch (err) {
    content.innerHTML = `<div class="loading-state"><p style="color:var(--danger)">Failed to load vendors: ${err.message}</p></div>`;
  }
}

function _vEsc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _renderVendorList(allVendors, searchTerm) {
  const content = document.getElementById('page-content');
  if (!content) return;
  const safeVendors = Array.isArray(allVendors) ? allVendors : [];
  const filtered = searchTerm
    ? safeVendors.filter(v =>
        ((v.name || '') + ' ' + (v.company_name || '') + ' ' + (v.email || '') + ' ' + (v.phone || '')).toLowerCase().includes(searchTerm.toLowerCase()))
    : safeVendors;

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Vendors &amp; Suppliers</h1>
        <p class="page-subtitle">${safeVendors.length} supplier account${safeVendors.length !== 1 ? 's' : ''} registered</p>
      </div>
      <button class="btn btn-primary btn-add-vendor-btn">${ICONS.plus || ''} Add Vendor</button>
    </div>
    <div class="filter-bar">
      <div class="search-wrap" style="max-width:380px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="search-input" id="vendor-search" type="text" placeholder="Search supplier by name, company, email or phone…" value="${_vEsc(searchTerm)}">
      </div>
    </div>
    <div class="table-wrap">
      ${filtered.length === 0 ? `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 010 7.75"/></svg>
          <h3>${searchTerm ? 'No vendors match your search' : 'No vendors registered yet'}</h3>
          <p>${searchTerm ? 'Try a different search term' : 'Add your first supplier account to track purchases and payables'}</p>
          ${!searchTerm ? `<button class="btn btn-primary btn-add-vendor-btn" style="margin-top:8px">${ICONS.plus || ''} Add Vendor</button>` : ''}
        </div>
      ` : `
        <table id="vendors-table" class="data-table">
          <thead><tr>
            <th>Supplier / Company</th>
            <th>Email</th>
            <th>Phone</th>
            <th>GSTIN</th>
            <th style="text-align:center">Actions</th>
          </tr></thead>
          <tbody>
            ${filtered.map(v => `
              <tr>
                <td class="vendor-name-cell" data-id="${v.id}" style="cursor:pointer" title="Click to view supplier profile">
                  <div style="display:flex;align-items:center;gap:10px">
                    <div class="client-avatar" style="background:var(--accent);color:#fff">${_vEsc(v.name).charAt(0).toUpperCase()}</div>
                    <div>
                      <div style="font-weight:600;color:var(--accent);display:flex;align-items:center;gap:6px">
                        ${_vEsc(v.name)}
                        <span style="font-size:10px;padding:1px 6px;border-radius:10px;background:var(--accent-light);color:var(--accent);font-weight:500">Supplier</span>
                      </div>
                      ${v.company_name ? `<div style="font-size:12px;color:var(--text-3)">${_vEsc(v.company_name)}</div>` : ''}
                    </div>
                  </div>
                </td>
                <td style="color:var(--text-2)">${_vEsc(v.email) || '—'}</td>
                <td style="color:var(--text-2)">${_vEsc(v.phone) || '—'}</td>
                <td class="td-mono">${_vEsc(v.gstin) || '—'}</td>
                <td>
                  <div class="action-bar" style="justify-content:center">
                    <button class="btn-icon btn-view-vendor-profile-btn" data-id="${v.id}" title="View Supplier Profile">${ICONS.eye || ''}</button>
                    <button class="btn-icon btn-edit-vendor-btn" data-id="${v.id}" title="Edit">${ICONS.edit || ''}</button>
                    <button class="btn-icon danger btn-delete-vendor-btn" data-id="${v.id}" data-name="${_vEsc(v.name)}" title="Delete">${ICONS.trash || ''}</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;

  // Attach search listener
  const searchInput = document.getElementById('vendor-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      _renderVendorList(allVendors, e.target.value.trim());
    });
  }

  // Attach button event listeners
  content.querySelectorAll('.vendor-name-cell, .btn-view-vendor-profile-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openVendorProfile(Number(el.dataset.id));
    });
  });

  content.querySelectorAll('.btn-add-vendor-btn').forEach(btn => {
    btn.addEventListener('click', () => openVendorModal(null));
  });

  content.querySelectorAll('.btn-edit-vendor-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openVendorModal(Number(btn.dataset.id));
    });
  });

  content.querySelectorAll('.btn-delete-vendor-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      const name = btn.dataset.name;
      showConfirm(
        'Delete Vendor Account',
        `Are you sure you want to delete vendor "${name}"? Existing purchase records will remain intact.`,
        async () => {
          try {
            await window.api.deleteVendor(id);
            showToast('Vendor deleted successfully', 'success');
            renderVendors();
          } catch (err) {
            showToast(`Failed to delete vendor: ${err.message}`, 'error');
          }
        }
      );
    });
  });
}

async function openVendorModal(vendorId = null, onSavedCallback = null) {
  let v = { name: '', company_name: '', address: '', email: '', phone: '', gstin: '' };
  if (vendorId) {
    v = (await window.api.getVendor(vendorId)) || v;
  }

  showModal(vendorId ? 'Edit Vendor Account' : 'Add New Vendor Account', `
    <form id="vendor-form" style="display:flex;flex-direction:column;gap:14px">
      <input type="hidden" id="v-id" value="${v.id || ''}">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="v-name">Supplier Contact Name *</label>
          <input class="form-input" id="v-name" type="text" placeholder="e.g. Rahul Sharma" value="${_vEsc(v.name)}" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="v-company">Company / Business Name</label>
          <input class="form-input" id="v-company" type="text" placeholder="e.g. Apex Hardware Supplies" value="${_vEsc(v.company_name)}">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="v-address">Billing &amp; Warehouse Address</label>
        <textarea class="form-input" id="v-address" rows="2" placeholder="Full address details">${_vEsc(v.address)}</textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="v-email">Email Address</label>
          <input class="form-input" id="v-email" type="email" placeholder="vendor@supplier.com" value="${_vEsc(v.email)}">
        </div>
        <div class="form-group">
          <label class="form-label" for="v-phone">Phone Number</label>
          <input class="form-input" id="v-phone" type="text" placeholder="+91 98765 43210" value="${_vEsc(v.phone)}">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="v-gstin">GSTIN / Tax Registration Number</label>
        <input class="form-input" id="v-gstin" type="text" placeholder="e.g. 27AAAAA0000A1Z5" value="${_vEsc(v.gstin)}">
      </div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${ICONS.check || ''} Save Vendor &amp; Close</button>
      </div>
    </form>
  `);

  const vendorForm = document.getElementById('vendor-form');
  vendorForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      id: document.getElementById('v-id').value ? Number(document.getElementById('v-id').value) : null,
      name: document.getElementById('v-name').value.trim(),
      company_name: document.getElementById('v-company').value.trim(),
      address: document.getElementById('v-address').value.trim(),
      email: document.getElementById('v-email').value.trim(),
      phone: document.getElementById('v-phone').value.trim(),
      gstin: document.getElementById('v-gstin').value.trim()
    };

    if (!data.name) return showToast('Vendor name is required', 'error');

    try {
      const saved = await window.api.saveVendor(data);
      closeModal();
      showToast('Vendor saved successfully!', 'success');
      if (typeof onSavedCallback === 'function') {
        onSavedCallback(saved);
      } else {
        renderVendors();
      }
    } catch (err) {
      showToast(`Failed to save vendor: ${err.message}`, 'error');
    }
  });
}

async function openVendorProfile(vendorId) {
  const content = document.getElementById('page-content');
  if (!content) return;

  content.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading Supplier Profile…</p></div>`;

  try {
    const profile = await window.api.getVendorFullProfile(vendorId);
    if (!profile || !profile.vendor) {
      return renderVendors();
    }
    const { vendor, purchases, stats } = profile;
    const settings = (await window.api.getSettings()) || {};
    const curr = (typeof getCurrency === 'function' ? getCurrency(settings.default_currency || 'INR') : null) || { symbol: '₹' };

    content.innerHTML = `
      <div class="page-header">
        <div>
          <button class="btn btn-ghost btn-sm" id="btn-back-to-vendors" style="margin-bottom:8px">&larr; Back to Vendors</button>
          <h1 class="page-title">${_vEsc(vendor.name)}</h1>
          <p class="page-subtitle">${_vEsc(vendor.company_name || 'Individual Supplier Account')}</p>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-secondary" id="btn-edit-current-vendor">${ICONS.edit || ''} Edit Profile</button>
          <button class="btn btn-primary" id="btn-new-vendor-purchase">${ICONS.plus || ''} New Purchase Order</button>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Purchased</div>
          <div class="stat-value">${curr.symbol} ${stats.totalPurchased.toLocaleString('en-IN', {minimumFractionDigits:2,maximumFractionDigits:2})}</div>
          <div class="stat-sub">${stats.purchaseCount} purchase order${stats.purchaseCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="stat-card ${stats.outstandingPayable > 0 ? 'warning' : 'success'}">
          <div class="stat-label">Outstanding Payables</div>
          <div class="stat-value">${curr.symbol} ${stats.outstandingPayable.toLocaleString('en-IN', {minimumFractionDigits:2,maximumFractionDigits:2})}</div>
          <div class="stat-sub">${stats.outstandingPayable > 0 ? 'Pending payment' : 'All bills settled'}</div>
        </div>
      </div>

      <!-- Vendor Details -->
      <div class="card" style="margin-bottom:20px;padding:20px">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:12px;color:var(--text)">Supplier Details</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;font-size:13px">
          <div><strong style="color:var(--text-3);display:block;margin-bottom:2px">Email Address</strong>${_vEsc(vendor.email || '—')}</div>
          <div><strong style="color:var(--text-3);display:block;margin-bottom:2px">Phone Number</strong>${_vEsc(vendor.phone || '—')}</div>
          <div><strong style="color:var(--text-3);display:block;margin-bottom:2px">GSTIN / Tax ID</strong><span class="td-mono">${_vEsc(vendor.gstin || '—')}</span></div>
          <div><strong style="color:var(--text-3);display:block;margin-bottom:2px">Address</strong>${_vEsc(vendor.address || '—')}</div>
        </div>
      </div>

      <!-- Purchase History -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <h3 style="font-size:15px;font-weight:700;color:var(--text);margin:0">Purchase Orders &amp; Bills</h3>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Purchase #</th>
                <th>Date</th>
                <th>Status</th>
                <th style="text-align:right">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              ${purchases.length === 0 ? `
                <tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-3)">No purchases recorded for this supplier.</td></tr>
              ` : purchases.map(p => `
                <tr>
                  <td><strong style="color:var(--accent)">${_vEsc(p.purchase_number)}</strong></td>
                  <td>${_vEsc(p.purchase_date)}</td>
                  <td><span class="badge badge-${p.status === 'paid' ? 'success' : (p.status === 'received' ? 'info' : 'warning')}">${p.status.toUpperCase()}</span></td>
                  <td style="text-align:right;font-weight:700">${curr.symbol} ${Number(p.grand_total || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btn-back-to-vendors')?.addEventListener('click', () => renderVendors());
    document.getElementById('btn-edit-current-vendor')?.addEventListener('click', () => openVendorModal(vendorId, () => openVendorProfile(vendorId)));
    document.getElementById('btn-new-vendor-purchase')?.addEventListener('click', () => {
      if (typeof openPurchaseEditor === 'function') {
        openPurchaseEditor(null, { vendor_id: vendorId });
      }
    });

  } catch (err) {
    showToast(`Error loading profile: ${err.message}`, 'error');
    renderVendors();
  }
}

window.renderVendors = renderVendors;
window.openVendorModal = openVendorModal;
window.openVendorProfile = openVendorProfile;
