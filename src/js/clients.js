/**
 * clients.js — Client management page: list, add, edit, delete
 */

async function renderClients() {
  const content = document.getElementById('page-content');
  if (!content) return;
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  try {
    const clients = await window.api.getClients();
    _renderClientList(clients, '');
  } catch (err) {
    content.innerHTML = `<div class="loading-state"><p style="color:var(--danger)">Failed to load clients: ${err.message}</p></div>`;
  }
}

function _renderClientList(allClients, searchTerm) {
  const content = document.getElementById('page-content');
  if (!content) return;
  const safeClients = Array.isArray(allClients) ? allClients : [];
  const filtered = searchTerm
    ? safeClients.filter(c =>
        ((c.name || '') + ' ' + (c.company_name || '') + ' ' + (c.email || '')).toLowerCase().includes(searchTerm.toLowerCase()))
    : safeClients;

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Clients</h1>
        <p class="page-subtitle">${safeClients.length} client${safeClients.length !== 1 ? 's' : ''} on record</p>
      </div>
      <button class="btn btn-primary btn-add-client-btn">${ICONS.plus} Add Client</button>
    </div>
    <div class="filter-bar">
      <div class="search-wrap" style="max-width:380px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="search-input" id="client-search" type="text" placeholder="Search by name, company or email…" value="${_cEsc(searchTerm)}">
      </div>
    </div>
    <div class="table-wrap">
      ${filtered.length === 0 ? `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 010 7.75"/></svg>
          <h3>${searchTerm ? 'No clients match your search' : 'No clients yet'}</h3>
          <p>${searchTerm ? 'Try a different search term' : 'Add your first client to start creating invoices'}</p>
          ${!searchTerm ? `<button class="btn btn-primary btn-add-client-btn" style="margin-top:8px">${ICONS.plus} Add Client</button>` : ''}
        </div>
      ` : `
        <table id="clients-table">
          <thead><tr>
            <th>Name / Company</th>
            <th>Email</th>
            <th>Phone</th>
            <th>GSTIN</th>
            <th style="text-align:center">Actions</th>
          </tr></thead>
          <tbody>
            ${filtered.map(c => `
              <tr>
                <td class="client-name-cell" data-id="${c.id}" style="cursor:pointer" title="Click to view client profile">
                  <div style="display:flex;align-items:center;gap:10px">
                    <div class="client-avatar">${_cEsc(c.name).charAt(0).toUpperCase()}</div>
                    <div>
                      <div style="font-weight:600;color:var(--accent);display:flex;align-items:center;gap:6px">
                        ${_cEsc(c.name)}
                        <span style="font-size:10px;padding:1px 6px;border-radius:10px;background:var(--accent-light);color:var(--accent);font-weight:500">View Profile</span>
                      </div>
                      ${c.company_name ? `<div style="font-size:12px;color:var(--text-3)">${_cEsc(c.company_name)}</div>` : ''}
                    </div>
                  </div>
                </td>
                <td style="color:var(--text-2)">${_cEsc(c.email) || '—'}</td>
                <td style="color:var(--text-2)">${_cEsc(c.phone) || '—'}</td>
                <td class="td-mono">${_cEsc(c.gstin) || '—'}</td>
                <td>
                  <div class="action-bar" style="justify-content:center">
                    <button class="btn-icon btn-view-profile-btn" data-id="${c.id}" title="View Profile">${ICONS.eye}</button>
                    <button class="btn-icon btn-edit-client-btn" data-id="${c.id}" title="Edit">${ICONS.edit}</button>
                    <button class="btn-icon danger btn-delete-client-btn" data-id="${c.id}" data-name="${_cEsc(c.name)}" title="Delete">${ICONS.trash}</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;

  // Attach event listeners directly via DOM
  content.querySelectorAll('.client-name-cell, .btn-view-profile-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openClientProfile(Number(el.dataset.id));
    });
  });

  content.querySelectorAll('.btn-add-client-btn').forEach(btn => {
    btn.addEventListener('click', () => openClientModal(null));
  });

  content.querySelectorAll('.btn-edit-client-btn').forEach(btn => {
    btn.addEventListener('click', () => openClientModal(Number(btn.dataset.id)));
  });

  content.querySelectorAll('.btn-delete-client-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteClientById(Number(btn.dataset.id), btn.dataset.name));
  });

  document.getElementById('client-search')?.addEventListener('input', e => _renderClientList(allClients, e.target.value));
}

async function openClientModal(clientId, onSaveCallback) {
  let client = {};
  if (clientId) {
    try {
      client = (await window.api.getClient(clientId)) || {};
    } catch (e) {
      showToast('Error loading client details: ' + e.message, 'error');
      return;
    }
  }

  showModal(clientId ? 'Edit Client' : 'Add New Client', `
    <form id="client-modal-form">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Full Name *</label>
          <input class="form-input" id="c-name" type="text" placeholder="Rajesh Kumar" value="${_cEsc(client.name || '')}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Company Name</label>
          <input class="form-input" id="c-company" type="text" placeholder="Acme Corp Pvt. Ltd." value="${_cEsc(client.company_name || '')}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Billing Address</label>
        <textarea class="form-textarea" id="c-address" rows="3" placeholder="456 Business Park, Bengaluru, Karnataka 560001">${_cEsc(client.billing_address || '')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="c-email" type="email" placeholder="contact@acmecorp.com" value="${_cEsc(client.email || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input class="form-input" id="c-phone" type="tel" placeholder="+91 98765 43210" value="${_cEsc(client.phone || '')}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">GSTIN / Tax ID <span style="color:var(--text-3)">(optional)</span></label>
        <input class="form-input" id="c-gstin" type="text" placeholder="29AABCT1332L1ZN" value="${_cEsc(client.gstin || '')}">
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
        <button class="btn btn-ghost" type="button" id="btn-cancel-modal">Cancel</button>
        <button class="btn btn-primary" type="submit" id="btn-save-client">${ICONS.check} ${clientId ? 'Update' : 'Add'} Client</button>
      </div>
    </form>
  `, 'modal-lg');

  window._currentClientModalId = clientId || null;
  window._currentClientOnSave = typeof onSaveCallback === 'function' ? onSaveCallback : null;

  const form = document.getElementById('client-modal-form');
  const cancelBtn = document.getElementById('btn-cancel-modal');

  cancelBtn?.addEventListener('click', () => closeModal());

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    submitClientForm();
  });

  setTimeout(() => document.getElementById('c-name')?.focus(), 100);
}

async function submitClientForm() {
  const nameEl = document.getElementById('c-name');
  const saveBtn = document.getElementById('btn-save-client');
  const name = nameEl ? nameEl.value.trim() : '';

  if (!name) {
    if (nameEl) {
      nameEl.style.borderColor = 'var(--danger)';
      nameEl.focus();
    }
    showToast('Client name is required', 'error');
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
  }

  const isEditing = Boolean(window._currentClientModalId);
  const modalId = window._currentClientModalId;
  const onSaveCb = window._currentClientOnSave;

  window._currentClientModalId = null;
  window._currentClientOnSave = null;

  try {
    const saved = await window.api.saveClient({
      id:              modalId,
      name,
      company_name:    document.getElementById('c-company')?.value.trim() || '',
      billing_address: document.getElementById('c-address')?.value.trim() || '',
      email:           document.getElementById('c-email')?.value.trim() || '',
      phone:           document.getElementById('c-phone')?.value.trim() || '',
      gstin:           document.getElementById('c-gstin')?.value.trim() || ''
    });

    closeModal();
    showToast(isEditing ? 'Client updated!' : 'Client added!', 'success');

    if (typeof onSaveCb === 'function') {
      onSaveCb(saved);
    } else {
      renderClients();
    }
  } catch (err) {
    showToast('Failed to save client: ' + err.message, 'error');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `${ICONS.check} ${isEditing ? 'Update' : 'Add'} Client`;
    }
  }
}

async function deleteClientById(id, name) {
  showConfirm(
    'Delete Client',
    `Are you sure you want to delete <strong>${_cEsc(name)}</strong>? Existing invoices will retain a snapshot of the client info.`,
    async () => {
      try {
        await window.api.deleteClient(id);
        showToast('Client deleted', 'info');
        renderClients();
      } catch (err) {
        showToast('Failed to delete client: ' + err.message, 'error');
      }
    }
  );
}

async function openClientProfile(clientId) {
  try {
    const profile = await window.api.getClientFullProfile(clientId);
    if (!profile || !profile.client) {
      showToast('Client profile not found', 'error');
      return;
    }

    const { client, invoices, stats, stockHistory } = profile;
    const settings = (await window.api.getSettings()) || {};
    const curr = getCurrencyInfo(settings.default_currency || 'INR');

    const invoicesHtml = invoices.length === 0
      ? `<div class="empty-state" style="padding:24px 0">
           <p style="color:var(--text-3)">No billed invoices found for this client account.</p>
           <button class="btn btn-primary btn-sm" id="profile-new-inv-btn" style="margin-top:8px">
             ${ICONS.plus} Create First Invoice
           </button>
         </div>`
      : `<div class="table-wrap" style="max-height:220px;overflow-y:auto">
           <table class="data-table" style="width:100%">
             <thead>
               <tr>
                 <th>Invoice #</th>
                 <th>Date</th>
                 <th>Due Date</th>
                 <th style="text-align:right">Grand Total</th>
                 <th>Status</th>
                 <th style="text-align:right">Action</th>
               </tr>
             </thead>
             <tbody>
               ${invoices.map(inv => `
                 <tr>
                   <td><strong>${_cEsc(inv.invoice_number)}</strong></td>
                   <td>${formatDate(inv.invoice_date)}</td>
                   <td>${inv.due_date ? formatDate(inv.due_date) : '—'}</td>
                   <td style="text-align:right;font-variant-numeric:tabular-nums"><strong>${curr.symbol} ${Number(inv.grand_total||0).toLocaleString('en-IN', {minimumFractionDigits:2})}</strong></td>
                   <td>${statusBadge(inv.status)}</td>
                   <td style="text-align:right">
                      <div style="display:flex;justify-content:flex-end;gap:4px">
                        <button class="btn-icon btn-profile-wa-inv" data-id="${inv.id}" title="Share on WhatsApp" style="color:#25D366">${ICONS.whatsapp}</button>
                        <button class="btn-icon btn-profile-email-inv" data-id="${inv.id}" title="Share via Email" style="color:#3b82f6">${ICONS.mail}</button>
                        <button class="btn btn-secondary btn-sm btn-profile-view-inv" data-id="${inv.id}" title="Open Invoice Editor">${ICONS.eye || ''} View</button>
                      </div>
                    </td>
                 </tr>
               `).join('')}
             </tbody>
           </table>
         </div>`;

    const stockHtml = (!stockHistory || stockHistory.length === 0)
      ? `<p style="font-size:12px;color:var(--text-3);padding:14px 0">No stock purchases recorded for this client account.</p>`
      : `<div class="table-wrap" style="max-height:180px;overflow-y:auto">
           <table class="data-table" style="width:100%">
             <thead>
               <tr>
                 <th>Date</th>
                 <th>Item Name</th>
                 <th>Quantity Billed</th>
                 <th>Reference Notes</th>
               </tr>
             </thead>
             <tbody>
               ${stockHistory.map(s => `
                 <tr>
                   <td style="font-size:12px;color:var(--text-3)">${new Date(s.created_at).toLocaleDateString('en-IN')}</td>
                   <td style="font-weight:600">${_cEsc(s.product_name || 'Product')}</td>
                   <td style="font-weight:700;color:var(--accent)">${s.quantity} ${_cEsc(s.unit || 'Pcs')}</td>
                   <td style="font-size:12px;color:var(--text-2)">${_cEsc(s.notes || 'Invoice Deduction')}</td>
                 </tr>
               `).join('')}
             </tbody>
           </table>
         </div>`;

    const bodyHtml = `
      <div class="client-profile-wrap">
        <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:14px">
            <div class="client-avatar" style="width:48px;height:48px;font-size:20px;font-weight:700;border-radius:12px;background:var(--accent-gradient);color:#fff;display:flex;align-items:center;justify-content:center">${_cEsc(client.name).charAt(0).toUpperCase()}</div>
            <div>
              <h2 style="font-size:18px;font-weight:700;margin:0">${_cEsc(client.name)}</h2>
              ${client.company_name ? `<div style="color:var(--text-2);font-size:13px">${_cEsc(client.company_name)}</div>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm btn-primary" id="profile-create-inv-btn">${ICONS.plus} New Billed Invoice</button>
            <button class="btn btn-sm btn-secondary" id="profile-edit-client-btn">${ICONS.edit} Edit Details</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:12px;margin:16px 0">
          <div class="stat-card" style="padding:12px 14px">
            <div class="stat-label">Total Billed Revenue</div>
            <div class="stat-value" style="font-size:18px">${curr.symbol} ${(stats.totalBilled||0).toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
            <div class="stat-sub">${stats.invoiceCount} total transaction${stats.invoiceCount !== 1 ? 's' : ''}</div>
          </div>
          <div class="stat-card warning" style="padding:12px 14px">
            <div class="stat-label">Accounts Receivable (A/R)</div>
            <div class="stat-value" style="font-size:18px">${curr.symbol} ${(stats.outstanding||0).toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
            <div class="stat-sub">Unpaid / Overdue</div>
          </div>
          <div class="stat-card success" style="padding:12px 14px">
            <div class="stat-label">Settled Invoices</div>
            <div class="stat-value" style="font-size:18px">${stats.paidCount}</div>
            <div class="stat-sub">Completed payments</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--bg-3);padding:14px;border-radius:8px;margin-bottom:16px;font-size:13px;border:1px solid var(--border)">
          <div><strong>Corporate Email:</strong> ${_cEsc(client.email) || '—'}</div>
          <div><strong>Telephone:</strong> ${_cEsc(client.phone) || '—'}</div>
          <div><strong>GSTIN / Tax ID:</strong> ${_cEsc(client.gstin) || '—'}</div>
          <div><strong>Billing Address:</strong> ${_cEsc(client.billing_address) || '—'}</div>
        </div>

        <div style="margin-bottom:18px">
          <h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--text)">Billed Transactions &amp; Invoices</h4>
          ${invoicesHtml}
        </div>

        <div>
          <h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--text)">Product &amp; Stock Purchase History</h4>
          ${stockHtml}
        </div>
      </div>
    `;

    showModal(`Client 360° Profile — ${_cEsc(client.name)}`, bodyHtml, 'modal-lg');

    const closeAndCreateInv = () => {
      closeModal();
      navigate('invoices');
      setTimeout(() => openInvoiceEditor(null, { clientId: client.id }), 50);
    };

    document.getElementById('profile-create-inv-btn')?.addEventListener('click', closeAndCreateInv);
    document.getElementById('profile-new-inv-btn')?.addEventListener('click', closeAndCreateInv);

    document.getElementById('profile-edit-client-btn')?.addEventListener('click', () => {
      closeModal();
      openClientModal(client.id);
    });

    document.querySelectorAll('.btn-profile-view-inv').forEach(btn => {
      btn.addEventListener('click', () => {
        closeModal();
        navigate('invoices');
        setTimeout(() => openInvoiceEditor(Number(btn.dataset.id)), 50);
      });
    });

    document.querySelectorAll('.btn-profile-wa-inv').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof shareInvoiceOnWhatsApp === 'function') shareInvoiceOnWhatsApp(Number(btn.dataset.id));
      });
    });

    document.querySelectorAll('.btn-profile-email-inv').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof shareInvoiceViaEmail === 'function') shareInvoiceViaEmail(Number(btn.dataset.id));
      });
    });

  } catch (err) {
    showToast('Failed to open client profile: ' + err.message, 'error');
  }
}

function _cEsc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

window.renderClients = renderClients;
window.openClientModal = openClientModal;
window.openClientProfile = openClientProfile;
window.submitClientForm = submitClientForm;
window.deleteClientById = deleteClientById;
