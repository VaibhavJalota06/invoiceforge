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

      <!-- Company Profile -->
      <div class="card" style="margin-bottom:18px">
        <div class="form-section-title">Company Profile</div>

        <!-- Company Logo Upload -->
        <div class="form-group" style="margin-bottom:20px">
          <label class="form-label">Company Logo (Displays on printed & PDF invoices)</label>
          <div style="display:flex;align-items:center;gap:18px;background:var(--bg-3);padding:14px;border-radius:8px;border:1px dashed var(--border)">
            <div id="logo-preview-container" style="width:120px;height:60px;background:var(--bg-4);border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid var(--border)">
              ${settings.logo_path
                ? `<img src="${settings.logo_path}" id="logo-img-preview" style="max-width:100%;max-height:100%;object-fit:contain" />`
                : `<span style="font-size:12px;color:var(--text-3)">No Logo</span>`
              }
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <input type="file" id="logo-file-input" accept="image/*" style="display:none" />
              <input type="hidden" id="s-logo-path" value="${_esc(settings.logo_path || '')}" />
              <div style="display:flex;gap:8px">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-upload-logo">${ICONS.plus || ''} Select Logo Image</button>
                <button type="button" class="btn btn-ghost btn-sm danger" id="btn-remove-logo" style="${settings.logo_path ? '' : 'display:none'}">Remove</button>
              </div>
              <small style="color:var(--text-3);font-size:11.5px">Recommended: PNG or JPG image with transparent or light background</small>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="s-company-name">Company Name *</label>
            <input class="form-input" id="s-company-name" type="text" placeholder="Your Company Ltd." value="${_esc(settings.company_name)}">
          </div>
          <div class="form-group">
            <label class="form-label" for="s-tax-number">GST / Tax Number</label>
            <input class="form-input" id="s-tax-number" type="text" placeholder="22AAAAA0000A1Z5" value="${_esc(settings.tax_number)}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="s-address">Business Address</label>
          <textarea class="form-textarea" id="s-address" rows="3" placeholder="123 Main Street, Mumbai, Maharashtra 400001">${_esc(settings.company_address)}</textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="s-phone">Phone</label>
            <input class="form-input" id="s-phone" type="tel" placeholder="+91 98765 43210" value="${_esc(settings.company_phone)}">
          </div>
          <div class="form-group">
            <label class="form-label" for="s-email">Email</label>
            <input class="form-input" id="s-email" type="email" placeholder="billing@yourcompany.com" value="${_esc(settings.company_email)}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="s-bank">Bank / Payment Details</label>
          <textarea class="form-textarea" id="s-bank" rows="3" placeholder="Bank: HDFC Bank&#10;A/C No: 12345678901234&#10;IFSC: HDFC0001234&#10;UPI: yourname@upi">${_esc(settings.bank_details)}</textarea>
        </div>
      </div>

      <!-- Invoice Defaults -->
      <div class="card" style="margin-bottom:18px">
        <div class="form-section-title">Invoice Defaults</div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="s-prefix">Invoice Number Prefix</label>
            <input class="form-input" id="s-prefix" type="text" placeholder="INV" value="${_esc(settings.invoice_prefix || 'INV')}" maxlength="20">
            <small style="color:var(--text-3);font-size:12px;margin-top:4px;display:block">
              Preview: ${_esc(settings.invoice_prefix || 'INV')}-${new Date().getFullYear()}-${String((settings.invoice_counter||0)+1).padStart(3,'0')}
            </small>
          </div>
          <div class="form-group">
            <label class="form-label" for="s-counter">Next Invoice Counter</label>
            <input class="form-input" id="s-counter" type="number" min="0" value="${settings.invoice_counter || 0}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="s-currency">Default Currency</label>
            <select class="form-select" id="s-currency"></select>
          </div>
          <div class="form-group">
            <label class="form-label" for="s-tax-rate">Default Tax Rate (%)</label>
            <input class="form-input" id="s-tax-rate" type="number" min="0" max="100" step="0.01" placeholder="18" value="${settings.default_tax_rate || 18}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="s-payment-terms">Default Payment Terms (days)</label>
          <input class="form-input" id="s-payment-terms" type="number" min="0" step="1" placeholder="30" value="${Math.max(0, Number(settings.default_payment_terms) || 30)}">
        </div>

        <div class="form-group">
          <label class="form-label" for="s-footer">Invoice Footer / Terms &amp; Conditions</label>
          <textarea class="form-textarea" id="s-footer" rows="3" placeholder="Thank you for your business!">${_esc(settings.invoice_footer)}</textarea>
        </div>
      </div>

      <!-- App Security & Lock Screen -->
      <div class="card" style="margin-bottom:18px">
        <div class="form-section-title">App Security &amp; Passcode Protection</div>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:14px;line-height:1.6">
          Set an Admin Name and Security PIN or Password to lock the app on startup or when away from your desk.
        </p>

        <div class="form-group" style="margin-bottom:14px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600;font-size:14px;">
            <input type="checkbox" id="sec-lock-enabled" ${settings.app_lock_enabled ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--accent);" />
            <span>Enable App Security Lock (Requires PIN on startup)</span>
          </label>
        </div>

        <div id="sec-fields-wrap" style="${settings.app_lock_enabled ? '' : 'opacity:0.6'}">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="sec-admin-name">Admin Name *</label>
              <input class="form-input" id="sec-admin-name" type="text" placeholder="Admin" value="${_esc(settings.admin_name || 'Admin')}">
            </div>
            <div class="form-group">
              <label class="form-label" for="sec-admin-pin">Admin Security PIN / Password *</label>
              <input class="form-input" id="sec-admin-pin" type="password" placeholder="Enter PIN or Password" value="${_esc(settings.admin_pin || '')}">
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;margin-top:12px">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-save-security">${ICONS.check} Save Security Settings</button>
        </div>
      </div>

      <!-- Data & Storage Location (Machine-Isolated) -->
      <div class="card" style="margin-bottom:18px">
        <div class="form-section-title">Data &amp; Storage Location (Isolated Machine Instance)</div>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:14px;line-height:1.6">
          Each computer running InvoiceForge has its own isolated database setup and unique System Machine ID.
        </p>
        <div class="form-group" style="margin-bottom:10px">
          <label class="form-label">System Machine Instance ID</label>
          <input class="form-input" id="storage-machine-guid" type="text" readonly style="background:var(--bg-3);color:var(--accent);font-weight:600;cursor:default" value="${_esc(settings.machine_guid || 'MAC-ISOLATED')}">
        </div>
        <div class="form-group" style="margin-bottom:10px">
          <label class="form-label">Data Directory (Local System Drive)</label>
          <input class="form-input" id="storage-data-dir" type="text" readonly style="background:var(--bg-3);color:var(--text-2);cursor:default" value="Loading…">
        </div>
        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label">Database File</label>
          <input class="form-input" id="storage-db-path" type="text" readonly style="background:var(--bg-3);color:var(--text-2);cursor:default" value="Loading…">
        </div>
        <button type="button" class="btn btn-secondary" id="btn-open-data-dir">${ICONS.external || ''} Open Data Folder</button>
      </div>

      <!-- Application Updates -->
      <div class="card" style="margin-bottom:18px">
        <div class="form-section-title">Application Updates</div>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:14px;line-height:1.6">
          Updates are checked on launch. When a new version is available, you can choose when to download and install it.
        </p>
        <div style="display:flex;align-items:center;gap:12px">
          <button type="button" class="btn btn-secondary" id="btn-check-updates">Check for Updates</button>
          <span id="update-status-label" style="font-size:12.5px;color:var(--text-3)">Checking installed version…</span>
        </div>
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

  document.getElementById('btn-open-data-dir')?.addEventListener('click', () => {
    window.api.openDataDir?.();
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
