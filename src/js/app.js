/**
 * app.js — Client-side router: wires sidebar nav to page modules
 * Uses the pre-existing renderXxx() function pattern.
 */

const PAGES = {
  dashboard: () => renderDashboard(),
  invoices:  () => renderInvoices(),
  clients:   () => renderClients(),
  stock:     () => renderStock(),
  settings:  () => renderSettings()
};

let currentPage = null;

function navigate(page, params = {}) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  currentPage = page;
  const content = document.getElementById('page-content');
  content.innerHTML = '';

  if (PAGES[page]) {
    PAGES[page](params);
  } else if (page === 'invoice-editor') {
    openInvoiceEditor(params.id || null);
  } else {
    content.innerHTML = '<p style="color:var(--text-3)">Page not found.</p>';
  }
}

// ── Nav click handlers ────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    navigate(el.dataset.page);
  });
});

const newInvoiceBtn = document.getElementById('btn-new-invoice');
if (newInvoiceBtn) {
  newInvoiceBtn.addEventListener('click', () => {
    navigate('invoices');
    setTimeout(() => openInvoiceEditor(null), 50);
  });
}

// ── Also expose as window.appNavigate for my new invoices.js ─────────────────
window.appNavigate = navigate;

// ── Auto-Updater Listener ──────────────────────────────────────────────────────
if (window.api?.onUpdateStatus) {
  window.api.onUpdateStatus((data) => {
    if (data.status === 'downloaded') {
      showToast(data.message || 'Update ready! Click to restart.', 'success');
      showConfirm(
        'Update Ready',
        `InvoiceForge v${data.version || ''} has been downloaded and is ready to install. Restart now?`,
        () => window.api.quitAndInstall(),
        false
      );
    } else if (data.status === 'available') {
      showConfirm(
        'Update Available',
        `InvoiceForge v${data.version || ''} is ready to download. Download it now?`,
        async () => {
          const result = await window.api.downloadUpdate();
          if (result?.status === 'error') showToast(result.message, 'error');
          else showToast(result?.message || 'Downloading update…', 'info');
        },
        false
      );
    } else if (data.status === 'error') {
      console.log('Update error:', data.message);
      if (data.message && (data.message.includes('ENOENT') || data.message.includes('app-update.yml'))) {
        return;
      }
      showToast(data.message || 'Update check failed.', 'error');
    }
  });
}

// ── App Lock & Security ────────────────────────────────────────────────────────
let _isLocked = false;

async function checkAppLockOnLaunch() {
  try {
    const settings = await window.api.getSettings();
    const lockBtn = document.getElementById('btn-lock-app');
    
    if (settings && settings.app_lock_enabled && settings.admin_pin) {
      if (lockBtn) lockBtn.style.display = 'inline-flex';
      lockAppScreen(settings.admin_name || 'Admin');
    } else {
      if (lockBtn) lockBtn.style.display = 'none';
    }
  } catch (err) {
    console.error('App Lock check error:', err);
  }
}

function lockAppScreen(adminName = 'Admin') {
  _isLocked = true;
  const overlay = document.getElementById('lock-screen-overlay');
  const nameEl = document.getElementById('lock-admin-name');
  const avatarEl = document.getElementById('lock-admin-avatar');
  const inputEl = document.getElementById('lock-pin-input');
  const errorEl = document.getElementById('lock-error-msg');

  if (nameEl) nameEl.textContent = adminName;
  if (avatarEl) avatarEl.textContent = adminName.charAt(0).toUpperCase();
  if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }
  if (inputEl) { inputEl.value = ''; }

  if (overlay) {
    overlay.style.display = 'flex';
    overlay.classList.remove('hidden');
  }

  setTimeout(() => inputEl?.focus(), 100);
}

async function unlockAppScreen() {
  const inputEl = document.getElementById('lock-pin-input');
  const errorEl = document.getElementById('lock-error-msg');
  const overlay = document.getElementById('lock-screen-overlay');
  const pin = inputEl ? inputEl.value.trim() : '';

  if (!pin) {
    if (errorEl) { errorEl.textContent = 'Please enter your PIN or Password'; errorEl.style.display = 'block'; }
    return;
  }

  try {
    const res = await window.api.verifyAdminPin(pin);
    if (res?.success) {
      _isLocked = false;
      if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.add('hidden');
      }
      if (inputEl) inputEl.value = '';
      if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }
      showToast('App unlocked successfully!', 'success');
    } else {
      if (errorEl) { errorEl.textContent = res?.message || 'Incorrect PIN / Password'; errorEl.style.display = 'block'; }
      if (inputEl) { inputEl.style.borderColor = 'var(--danger)'; inputEl.focus(); }
    }
  } catch (err) {
    if (errorEl) { errorEl.textContent = 'Verification error: ' + err.message; errorEl.style.display = 'block'; }
  }
}

// Attach Lock form & button handlers
document.getElementById('lock-screen-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  unlockAppScreen();
});

document.getElementById('btn-toggle-pin-visibility')?.addEventListener('click', () => {
  const input = document.getElementById('lock-pin-input');
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
});

document.getElementById('btn-lock-app')?.addEventListener('click', async () => {
  const settings = await window.api.getSettings();
  lockAppScreen(settings?.admin_name || 'Admin');
});

window.lockAppScreen = lockAppScreen;

async function checkPostUpdateNotificationOnLaunch() {
  try {
    const res = await window.api.checkUpdateNotification?.();
    if (res?.updated) {
      const msg = `🎉 Software Updated! InvoiceForge upgraded to Version ${res.currentVersion || ''}. All database records are intact.`;
      showToast(msg, 'success');
      if (typeof showModal === 'function') {
        showModal('🎉 Software Updated Successfully!', `
          <div style="text-align:center;padding:10px 0">
            <div style="font-size:42px;margin-bottom:12px">🚀</div>
            <h2 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:10px">Welcome to InvoiceForge v${res.currentVersion || '1.0.4'}</h2>
            <p style="font-size:14px;color:var(--text-2);line-height:1.6;margin-bottom:20px">
              Your software has been updated to <strong>Version ${res.currentVersion || '1.0.4'}</strong>.<br/>
              All your client accounts, billed invoices, corporate settings, and database records have been <strong>safely preserved</strong>.
            </p>
            <button class="btn btn-primary" style="padding:10px 24px;font-size:14px" onclick="closeModal()">Continue to Dashboard</button>
          </div>
        `);
      }
    }
  } catch (err) {
    console.error('Update notification check error:', err);
  }
}

// ── Start on Dashboard with Lock & Update Checks ─────────────────────────────
checkAppLockOnLaunch();
checkPostUpdateNotificationOnLaunch();
navigate('dashboard');
