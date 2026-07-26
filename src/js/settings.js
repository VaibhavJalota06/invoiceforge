/**
 * settings.js — Settings page: company profile, invoice defaults
 */

async function renderSettings() {
  const content = document.getElementById('page-content');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  const settings = await window.api.getSettings();

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Settings</h1>
        <p class="page-subtitle">Company profile, invoice defaults, and numbering</p>
      </div>
      <button class="btn btn-primary" id="btn-save-settings">${ICONS.check} Save Changes</button>
    </div>

    <form id="settings-form">
      <!-- Software Lifecycle & Version Status (Top Card) -->
      <div class="card" style="margin-bottom:18px;background:linear-gradient(135deg, var(--bg-2) 0%, var(--bg-3) 100%);border:1px solid var(--border-light)">
        <div class="form-section-title" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
          <span>Software Version &amp; Lifecycle Management</span>
          <span class="badge badge-success" id="settings-version-badge" style="font-size:12px;padding:4px 10px;background:var(--success-bg);color:var(--success);border-radius:20px;font-weight:600">Checking version…</span>
        </div>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:14px;line-height:1.6">
          InvoiceForge Enterprise Edition is running. Updates check automatically on application launch.
        </p>
        <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-4);padding:12px 16px;border-radius:8px;border:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="width:10px;height:10px;border-radius:50%;background:var(--success);box-shadow:0 0 10px var(--success)"></span>
            <span id="update-status-label" style="font-size:13px;color:var(--text);font-weight:600">Checking installed version…</span>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-check-updates">Check for Updates</button>
        </div>
      </div>

      <!-- Corporate Profile -->
      <div class="card" style="margin-bottom:18px">
        <div class="form-section-title">Corporate Profile &amp; Business Metadata</div>

        <!-- Corporate Emblem Upload -->
        <div class="form-group" style="margin-bottom:20px">
          <label class="form-label">Corporate Emblem / Brand Identity (Renders on printed &amp; PDF invoices)</label>
          <div style="display:flex;align-items:center;gap:18px;background:var(--bg-3);padding:14px;border-radius:8px;border:1px dashed var(--border)">
            <div id="logo-preview-container" style="width:120px;height:60px;background:var(--bg-4);border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid var(--border)">
              ${settings.logo_path
                ? `<img src="${settings.logo_path}" id="logo-img-preview" style="max-width:100%;max-height:100%;object-fit:contain" />`
                : `<span style="font-size:12px;color:var(--text-3)">No Emblem</span>`
              }
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <input type="file" id="logo-file-input" accept="image/*" style="display:none" />
              <input type="hidden" id="s-logo-path" value="${_esc(settings.logo_path || '')}" />
              <div style="display:flex;gap:8px">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-upload-logo">${ICONS.plus || ''} Upload Corporate Emblem</button>
                <button type="button" class="btn btn-ghost btn-sm danger" id="btn-remove-logo" style="${settings.logo_path ? '' : 'display:none'}">Remove</button>
              </div>
              <small style="color:var(--text-3);font-size:11.5px">Recommended: High-resolution PNG or JPG logo mark</small>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="s-company-name">Company Legal Name *</label>
            <input class="form-input" id="s-company-name" type="text" placeholder="Your Company Ltd." value="${_esc(settings.company_name)}">
          </div>
          <div class="form-group">
            <label class="form-label" for="s-tax-number">GSTIN / Corporate Tax ID</label>
            <input class="form-input" id="s-tax-number" type="text" placeholder="22AAAAA0000A1Z5" value="${_esc(settings.tax_number)}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="s-address">Registered Business Address</label>
          <textarea class="form-textarea" id="s-address" rows="3" placeholder="123 Main Street, Mumbai, Maharashtra 400001">${_esc(settings.company_address)}</textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="s-phone">Contact Telephone</label>
            <input class="form-input" id="s-phone" type="text" placeholder="+91 98765 43210" value="${_esc(settings.company_phone)}">
          </div>
          <div class="form-group">
            <label class="form-label" for="s-email">Corporate Email Address</label>
            <input class="form-input" id="s-email" type="email" placeholder="billing@company.com" value="${_esc(settings.company_email)}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="s-bank">Banking &amp; Wire Transfer Details</label>
          <textarea class="form-textarea" id="s-bank" rows="3" placeholder="Bank Name: HDFC Bank&#10;A/C No: 1234567890&#10;IFSC: HDFC0001234">${_esc(settings.bank_details)}</textarea>
        </div>
      </div>

      <!-- Default Invoice Configuration -->
      <div class="card" style="margin-bottom:18px">
        <div class="form-section-title">Default Invoicing &amp; Tax Configuration</div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="s-currency">Base Functional Currency</label>
            <select class="form-select" id="s-currency"></select>
          </div>
          <div class="form-group">
            <label class="form-label" for="s-payment-terms">Default Settlement Due Window (Days)</label>
            <input class="form-input" id="s-payment-terms" type="number" min="0" placeholder="30" value="${settings.default_payment_terms}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="s-tax-rate">Default Standard Tax Rate (%)</label>
            <input class="form-input" id="s-tax-rate" type="number" min="0" max="100" step="0.1" placeholder="18" value="${settings.default_tax_rate}">
          </div>
          <div class="form-group">
            <label class="form-label" for="s-prefix">Transaction Prefix Code</label>
            <input class="form-input" id="s-prefix" type="text" placeholder="INV" value="${_esc((settings.invoice_prefix || 'INV').replace(/-?\d{4}-?$/, '').replace(/-+$/, '') || 'INV')}">
            <small style="color:var(--text-3);font-size:11.5px;margin-top:3px;display:block">Preview: ${(_esc((settings.invoice_prefix || 'INV').replace(/-?\d{4}-?$/, '').replace(/-+$/, '') || 'INV'))}-${new Date().getFullYear()}-001</small>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="s-counter">Next Transaction Counter Index</label>
            <input class="form-input" id="s-counter" type="number" min="0" placeholder="0" value="${settings.invoice_counter}">
          </div>
          <div class="form-group">
            <label class="form-label" for="s-footer">Default Commercial Terms / Footer Statement</label>
            <input class="form-input" id="s-footer" type="text" placeholder="Thank you for your business." value="${_esc(settings.invoice_footer)}">
          </div>
        </div>
      </div>

      <!-- App Security & Passcode Protection -->
      <div class="card" style="margin-bottom:18px">
        <div class="form-section-title">Workplace Security &amp; Passcode Protection</div>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:14px;line-height:1.6">
          Set an Administrator Identity and Security PIN or Passcode to protect system records on startup or when away from your workplace.
        </p>

        <div class="form-group" style="margin-bottom:14px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600;font-size:14px;">
            <input type="checkbox" id="sec-lock-enabled" ${settings.app_lock_enabled ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--accent);" />
            <span>Enable Workplace Security Lock (Requires Passcode on Launch)</span>
          </label>
        </div>

        <div id="sec-fields-wrap" style="${settings.app_lock_enabled ? '' : 'opacity:0.6'}">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="sec-admin-name">Administrator Name *</label>
              <input class="form-input" id="sec-admin-name" type="text" placeholder="Admin" value="${_esc(settings.admin_name || 'Admin')}">
            </div>
            <div class="form-group">
              <label class="form-label" for="sec-admin-pin">Security PIN / Passcode *</label>
              <input class="form-input" id="sec-admin-pin" type="password" placeholder="Enter PIN or Passcode" value="${_esc(settings.admin_pin || '')}">
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;margin-top:12px">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-save-security">${ICONS.check} Save Security Settings</button>
        </div>
      </div>

      <!-- Personalized User Accounts & Team Management Card -->
      <div class="card" style="margin-bottom:18px">
        <div class="form-section-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>Personalized User Profiles &amp; Team Accounts</span>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-settings-open-users">Manage Users &amp; Profiles</button>
        </div>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:14px;line-height:1.6">
          Manage personalized user profiles, role-based access permissions (Admin, Manager, Staff), and security PINs for your workstation.
        </p>
        <div id="settings-users-summary-list" style="display:flex;flex-direction:column;gap:8px">
          <div style="font-size:12px;color:var(--text-3)">Loading registered user accounts…</div>
        </div>
      </div>

      <!-- Isolated Instance Storage Architecture -->
      <div class="card" style="margin-bottom:18px">
        <div class="form-section-title">Isolated Instance Storage Architecture</div>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:14px;line-height:1.6">
          Each workstation running InvoiceForge maintains an isolated, encrypted local database instance and unique Machine Identifier.
        </p>
        <div class="form-group" style="margin-bottom:10px">
          <label class="form-label">System Workstation Instance Identifier</label>
          <input class="form-input" id="storage-machine-guid" type="text" readonly style="background:var(--bg-3);color:var(--accent);font-weight:600;cursor:default" value="${_esc(settings.machine_guid || 'MAC-ISOLATED')}">
        </div>
        <div class="form-group" style="margin-bottom:10px">
          <label class="form-label">Local Data Directory Path</label>
          <input class="form-input" id="storage-data-dir" type="text" readonly style="background:var(--bg-3);color:var(--text-2);cursor:default" value="Loading…">
        </div>
        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label">SQLite Engine Database File</label>
          <input class="form-input" id="storage-db-path" type="text" readonly style="background:var(--bg-3);color:var(--text-2);cursor:default" value="Loading…">
        </div>
        <button type="button" class="btn btn-secondary" id="btn-open-data-dir">${ICONS.external || ''} Open Local Storage Directory</button>
      </div>

      <!-- Database Backup & Portability (.zip Archives) -->
      <div class="card" style="margin-bottom:18px">
        <div class="form-section-title">Database Backup, Restore &amp; PC/Laptop Portability (.zip)</div>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:14px;line-height:1.6">
          Export your entire billing database, client records, and settings into a single <strong>.zip backup archive</strong>.
          You can copy the .zip file to a USB pen drive to sync or restore data across your PC and laptop.
        </p>

        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button type="button" class="btn btn-primary" id="btn-export-backup-zip">${ICONS.pdf || ''} Export Full Backup (.zip)</button>
          <button type="button" class="btn btn-secondary" id="btn-import-backup-zip">${ICONS.plus || ''} Restore from Backup (.zip)</button>
        </div>
        <small style="color:var(--text-3);font-size:11.5px;margin-top:10px;display:block">
          💡 Tip: You can also drag and drop any InvoiceForge .zip backup file anywhere onto the app window to instantly restore data!
        </small>
      </div>

    </form>
  `;

  // Populate Storage Info
  window.api.getDataPaths?.().then(paths => {
    if (paths) {
      const dirInput = document.getElementById('storage-data-dir');
      const dbInput = document.getElementById('storage-db-path');
      if (dirInput) dirInput.value = paths.dataDir;
      if (dbInput) dbInput.value = paths.dbPath;
    }
  });

  // Populate Users List Summary
  window.api.getAllUsers?.().then(users => {
    const listEl = document.getElementById('settings-users-summary-list');
    if (listEl && users) {
      listEl.innerHTML = users.map(u => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg-3);border-radius:6px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:24px;height:24px;border-radius:50%;background:${u.avatar_color || '#6366f1'};color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center">
              ${(u.name || 'U').charAt(0).toUpperCase()}
            </div>
            <span style="font-size:13px;font-weight:600;color:var(--text)">${escHtml(u.name)}</span>
            <span class="badge badge-info" style="font-size:10px">${escHtml(u.role)}</span>
          </div>
          <span style="font-size:11px;color:var(--text-3)">${u.email ? escHtml(u.email) : 'Local Account'}</span>
        </div>
      `).join('');
    }
  });

  document.getElementById('btn-settings-open-users')?.addEventListener('click', () => {
    if (typeof openUserProfileModal === 'function') openUserProfileModal();
  });

  document.getElementById('btn-open-data-dir')?.addEventListener('click', () => {
    window.api.openDataDir?.();
  });

  document.getElementById('btn-export-backup-zip')?.addEventListener('click', async () => {
    const res = await window.api.exportBackupZip();
    if (res?.success) {
      showToast('Database backup archive (.zip) exported successfully!', 'success');
    } else if (res?.reason !== 'canceled') {
      showToast('Backup export failed: ' + (res?.reason || 'Unknown error'), 'error');
    }
  });

  document.getElementById('btn-import-backup-zip')?.addEventListener('click', async () => {
    showConfirm(
      'Restore Database Backup (.zip)',
      'Select an InvoiceForge backup archive (.zip) to restore.<br><br><span style="color:var(--danger)">Warning: This will overwrite your current active database with the backup data.</span>',
      async () => {
        showToast('Restoring database backup…', 'info');
        const res = await window.api.importBackupZip();
        if (res?.success) {
          showToast('🎉 Database restored successfully!', 'success');
          setTimeout(() => renderSettings(), 300);
        } else if (res?.reason !== 'canceled') {
          showToast('Restore failed: ' + (res?.reason || 'Invalid backup'), 'error');
        }
      },
      true
    );
  });

  // Populate currency dropdown
  const currSelect = document.getElementById('s-currency');
  populateCurrencySelect(currSelect, settings.default_currency || 'INR');

  // Live prefix preview update
  const prefixInput = document.getElementById('s-prefix');
  const counterInput = document.getElementById('s-counter');
  const updatePreview = () => {
    const preview = prefixInput.parentElement.querySelector('small');
    const prefix = prefixInput.value.replace(/[-\s]+$/, '') || 'INV';
    const counter = parseInt(counterInput.value) || 0;
    preview.textContent = `Preview: ${prefix}-${new Date().getFullYear()}-${String(counter + 1).padStart(3, '0')}`;
  };
  // Logo upload handlers
  const fileInput = document.getElementById('logo-file-input');
  const uploadBtn = document.getElementById('btn-upload-logo');
  const removeBtn = document.getElementById('btn-remove-logo');
  const logoPathInput = document.getElementById('s-logo-path');
  const previewContainer = document.getElementById('logo-preview-container');

  uploadBtn?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Logo image must be smaller than 5MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target.result;
      logoPathInput.value = dataUrl;
      previewContainer.innerHTML = `<img src="${dataUrl}" id="logo-img-preview" style="max-width:100%;max-height:100%;object-fit:contain" />`;
      removeBtn.style.display = '';
      showToast('Logo image updated (click Save Changes to apply)', 'info');
    };
    reader.readAsDataURL(file);
  });

  removeBtn?.addEventListener('click', () => {
    logoPathInput.value = '';
    previewContainer.innerHTML = `<span style="font-size:12px;color:var(--text-3)">No Logo</span>`;
    removeBtn.style.display = 'none';
    if (fileInput) fileInput.value = '';
    showToast('Logo removed (click Save Changes to apply)', 'info');
  });

  // Security Lock Toggle & Save
  const lockCheckbox = document.getElementById('sec-lock-enabled');
  const secWrap = document.getElementById('sec-fields-wrap');
  const saveSecBtn = document.getElementById('btn-save-security');

  lockCheckbox?.addEventListener('change', () => {
    if (secWrap) secWrap.style.opacity = lockCheckbox.checked ? '1' : '0.6';
  });

  saveSecBtn?.addEventListener('click', async () => {
    const enabled = lockCheckbox ? lockCheckbox.checked : false;
    const adminName = document.getElementById('sec-admin-name')?.value.trim() || 'Admin';
    const pin = document.getElementById('sec-admin-pin')?.value.trim() || '';

    if (enabled && !pin) {
      showToast('Please enter an Admin Security PIN or Password to enable App Lock', 'error');
      document.getElementById('sec-admin-pin')?.focus();
      return;
    }

    try {
      const updated = await window.api.saveSecuritySettings({ enabled, adminName, pin });
      const lockBtn = document.getElementById('btn-lock-app');
      if (lockBtn) lockBtn.style.display = enabled && pin ? 'inline-flex' : 'none';
      showToast(enabled ? 'App Security Lock enabled!' : 'App Security Lock disabled', 'success');
    } catch (err) {
      showToast('Failed to save security settings: ' + err.message, 'error');
    }
  });

  prefixInput.addEventListener('input', updatePreview);
  counterInput.addEventListener('input', updatePreview);

  // Save button
  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const data = {
      company_name:          document.getElementById('s-company-name').value.trim(),
      company_address:       document.getElementById('s-address').value.trim(),
      company_phone:         document.getElementById('s-phone').value.trim(),
      company_email:         document.getElementById('s-email').value.trim(),
      tax_number:            document.getElementById('s-tax-number').value.trim(),
      bank_details:          document.getElementById('s-bank').value.trim(),
      default_payment_terms: Math.max(0, parseInt(document.getElementById('s-payment-terms').value, 10) || 0),
      default_currency:      currSelect.value,
      default_tax_rate:      parseFloat(document.getElementById('s-tax-rate').value) || 0,
      invoice_prefix:        document.getElementById('s-prefix').value.trim() || 'INV',
      invoice_counter:       parseInt(document.getElementById('s-counter').value) || 0,
      invoice_footer:        document.getElementById('s-footer').value.trim(),
      logo_path:             logoPathInput ? logoPathInput.value : ''
    };

    await window.api.saveSettings(data);
    showToast('Settings saved successfully!', 'success');
  });

  // Check for updates button
  const checkBtn = document.getElementById('btn-check-updates');
  const statusLabel = document.getElementById('update-status-label');
  window.api.getAppVersion?.().then(version => {
    if (statusLabel) statusLabel.textContent = `Installed Version v${version}`;
    const badge = document.getElementById('settings-version-badge');
    if (badge) badge.textContent = `v${version} — Active`;
  });

  if (window.api?.onUpdateStatus) {
    window.api.onUpdateStatus((data) => {
      if (statusLabel && data?.message) {
        statusLabel.textContent = data.message;
      }
      if (checkBtn) checkBtn.disabled = false;
    });
  }

  if (checkBtn) {
    checkBtn.addEventListener('click', async () => {
      checkBtn.disabled = true;
      if (statusLabel) statusLabel.textContent = 'Checking GitHub for updates…';
      try {
        await window.api.checkForUpdates();
      } catch (err) {
        checkBtn.disabled = false;
        if (statusLabel) statusLabel.textContent = 'Check complete';
      }
    });
  }
}

function _esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
