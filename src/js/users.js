/**
 * users.js — Personalized Multi-User & Account Management Module for InvoiceForge
 */

let _activeUser = null;
const AVATAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444'];

async function initUserHeader() {
  try {
    _activeUser = await window.api.getActiveUser();
    updateHeaderUserDisplay();
  } catch (err) {
    console.error('Failed to initialize active user session:', err);
  }
}

function updateHeaderUserDisplay() {
  if (!_activeUser) return;
  const avatarEl = document.getElementById('active-user-avatar');
  const nameEl = document.getElementById('active-user-name');
  const roleEl = document.getElementById('active-user-role');

  if (avatarEl) {
    avatarEl.textContent = (_activeUser.name || 'A').charAt(0).toUpperCase();
    avatarEl.style.background = _activeUser.avatar_color || '#6366f1';
  }
  if (nameEl) nameEl.textContent = _activeUser.name || 'User';
  if (roleEl) roleEl.textContent = _activeUser.role || 'Staff';
}

async function openUserProfileModal() {
  _activeUser = await window.api.getActiveUser();
  const allUsers = await window.api.getAllUsers();

  const bodyHtml = `
    <div style="display:flex;gap:10px;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:12px">
      <button class="btn btn-primary" id="user-tab-my-profile" style="font-size:13px;font-weight:600">
        👤 My User Profile
      </button>
      <button class="btn btn-secondary" id="user-tab-switch-team" style="font-size:13px;font-weight:600">
        👥 Switch User &amp; Team Accounts (${allUsers.length})
      </button>
    </div>

    <!-- TAB 1: MY PROFILE -->
    <div id="user-pane-my-profile">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding:16px;background:var(--bg-3);border-radius:var(--radius-md);border:1px solid var(--border)">
        <div style="width:52px;height:52px;border-radius:50%;background:${_activeUser.avatar_color || '#6366f1'};color:#fff;font-size:22px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow)">
          ${(_activeUser.name || 'A').charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:2px">${escHtml(_activeUser.name)}</h3>
          <span class="badge badge-info">${escHtml(_activeUser.role || 'Admin')}</span>
          <span style="font-size:12px;color:var(--text-3);margin-left:8px">${escHtml(_activeUser.email || 'No email set')}</span>
        </div>
      </div>

      <form id="form-my-profile" style="display:flex;flex-direction:column;gap:14px">
        <input type="hidden" name="id" value="${_activeUser.id}" />
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Full Name <span style="color:var(--danger)">*</span></label>
            <input class="form-input" name="name" type="text" value="${escHtml(_activeUser.name || '')}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input class="form-input" name="email" type="email" value="${escHtml(_activeUser.email || '')}" placeholder="user@company.com" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">User Role</label>
            <select class="form-select" name="role" ${_activeUser.role === 'Admin' ? '' : 'disabled'}>
              <option value="Admin" ${_activeUser.role === 'Admin' ? 'selected' : ''}>Admin (Full System Access)</option>
              <option value="Manager" ${_activeUser.role === 'Manager' ? 'selected' : ''}>Manager (Sales &amp; Purchasing)</option>
              <option value="Staff" ${_activeUser.role === 'Staff' ? 'selected' : ''}>Staff (Billing &amp; Inventory)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Security PIN (Optional)</label>
            <input class="form-input" name="pin" type="password" value="${escHtml(_activeUser.pin || '')}" placeholder="4-digit PIN" maxlength="6" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Avatar Badge Color</label>
          <div style="display:flex;gap:10px;margin-top:6px">
            ${AVATAR_COLORS.map(c => `
              <label style="cursor:pointer">
                <input type="radio" name="avatar_color" value="${c}" ${(_activeUser.avatar_color || '#6366f1') === c ? 'checked' : ''} style="display:none" />
                <span class="color-picker-dot" style="display:inline-block;width:28px;height:28px;border-radius:50%;background:${c};border:2px solid ${(_activeUser.avatar_color || '#6366f1') === c ? '#fff' : 'transparent'}"></span>
              </label>
            `).join('')}
          </div>
        </div>
      </form>
    </div>

    <!-- TAB 2: SWITCH & TEAM ACCOUNTS -->
    <div id="user-pane-switch-team" style="display:none">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-size:13px;font-weight:600;color:var(--text)">System User Accounts</span>
        <button class="btn btn-primary btn-sm" id="btn-add-new-user">➕ Add New User</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;max-height:360px;overflow-y:auto">
        ${allUsers.map(u => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:var(--bg-3);border-radius:var(--radius-md);border:1px solid ${u.id === _activeUser.id ? 'var(--accent)' : 'var(--border)'}">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:36px;height:36px;border-radius:50%;background:${u.avatar_color || '#6366f1'};color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center">
                ${(u.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style="font-size:14px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:6px">
                  ${escHtml(u.name)}
                  ${u.id === _activeUser.id ? '<span class="badge badge-success" style="font-size:10px">ACTIVE</span>' : ''}
                </div>
                <div style="font-size:11px;color:var(--text-3)">${escHtml(u.role)} ${u.email ? '• ' + escHtml(u.email) : ''}</div>
              </div>
            </div>

            <div style="display:flex;align-items:center;gap:8px">
              ${u.id !== _activeUser.id ? `
                <button class="btn btn-secondary btn-sm btn-switch-user" data-id="${u.id}" data-has-pin="${u.pin ? '1' : '0'}">Switch</button>
              ` : ''}
              ${(_activeUser.role === 'Admin' && u.id !== _activeUser.id) ? `
                <button class="btn btn-ghost btn-sm btn-edit-user" data-id="${u.id}">Edit</button>
                <button class="btn btn-ghost btn-sm btn-delete-user" data-id="${u.id}" style="color:var(--danger)">Delete</button>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  openModal({
    title: 'Personalized User Profile & Multi-User Switcher',
    bodyHtml,
    confirmText: 'Save Profile Changes',
    cancelText: 'Close',
    onConfirm: async () => {
      const form = document.getElementById('form-my-profile');
      if (!form) return true;

      const fd = new FormData(form);
      const userData = {
        id: Number(fd.get('id')),
        name: fd.get('name'),
        email: fd.get('email'),
        role: fd.get('role') || _activeUser.role,
        pin: fd.get('pin'),
        avatar_color: fd.get('avatar_color') || _activeUser.avatar_color
      };

      try {
        _activeUser = await window.api.saveUser(userData);
        updateHeaderUserDisplay();
        showToast('User profile updated successfully!', 'success');
        return true;
      } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
        return false;
      }
    }
  });

  // Tab Switchers inside modal
  const tabMy = document.getElementById('user-tab-my-profile');
  const tabSwitch = document.getElementById('user-tab-switch-team');
  const paneMy = document.getElementById('user-pane-my-profile');
  const paneSwitch = document.getElementById('user-pane-switch-team');

  tabMy?.addEventListener('click', () => {
    tabMy.className = 'btn btn-primary';
    tabSwitch.className = 'btn btn-secondary';
    paneMy.style.display = 'block';
    paneSwitch.style.display = 'none';
  });

  tabSwitch?.addEventListener('click', () => {
    tabSwitch.className = 'btn btn-primary';
    tabMy.className = 'btn btn-secondary';
    paneSwitch.style.display = 'block';
    paneMy.style.display = 'none';
  });

  // Avatar Color Picker UI dots
  document.querySelectorAll('.color-picker-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      document.querySelectorAll('.color-picker-dot').forEach(d => d.style.borderColor = 'transparent');
      dot.style.borderColor = '#fff';
    });
  });

  // Switch User Buttons
  document.querySelectorAll('.btn-switch-user').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = Number(btn.dataset.id);
      const hasPin = btn.dataset.hasPin === '1';
      let inputPin = null;

      if (hasPin) {
        inputPin = prompt('Enter Security PIN for user account:');
        if (inputPin === null) return;
      }

      try {
        _activeUser = await window.api.switchActiveUser(userId, inputPin);
        updateHeaderUserDisplay();
        closeModal();
        showToast(`Switched active session to ${_activeUser.name} (${_activeUser.role})`, 'success');
        if (typeof renderDashboard === 'function') renderDashboard();
      } catch (err) {
        showToast('Switch user failed: ' + err.message, 'error');
      }
    });
  });

  // Add New User Button
  document.getElementById('btn-add-new-user')?.addEventListener('click', () => {
    closeModal();
    openUserEditModal(null);
  });

  // Edit / Delete User Buttons
  document.querySelectorAll('.btn-edit-user').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uId = Number(btn.dataset.id);
      closeModal();
      openUserEditModal(uId);
    });
  });

  document.querySelectorAll('.btn-delete-user').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uId = Number(btn.dataset.id);
      if (!confirm('Are you sure you want to delete this user account?')) return;
      try {
        await window.api.deleteUser(uId);
        showToast('User account deleted.', 'info');
        closeModal();
        openUserProfileModal();
      } catch (err) {
        showToast('Delete error: ' + err.message, 'error');
      }
    });
  });
}

async function openUserEditModal(userId = null) {
  let user = { name: '', email: '', role: 'Staff', pin: '', avatar_color: '#10b981' };
  if (userId) {
    user = await window.api.getUser(userId);
  }

  const bodyHtml = `
    <form id="form-user-edit" style="display:flex;flex-direction:column;gap:14px">
      <input type="hidden" name="id" value="${user.id || ''}" />
      <div class="form-group">
        <label class="form-label">Full Name <span style="color:var(--danger)">*</span></label>
        <input class="form-input" name="name" type="text" value="${escHtml(user.name || '')}" required placeholder="e.g. Rahul Sharma" />
      </div>

      <div class="form-group">
        <label class="form-label">Email Address</label>
        <input class="form-input" name="email" type="email" value="${escHtml(user.email || '')}" placeholder="user@company.com" />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">User Role</label>
          <select class="form-select" name="role">
            <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin (Full Access)</option>
            <option value="Manager" ${user.role === 'Manager' ? 'selected' : ''}>Manager (Sales &amp; Purchasing)</option>
            <option value="Staff" ${user.role === 'Staff' ? 'selected' : ''}>Staff (Billing &amp; Stock)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Security PIN (Optional)</label>
          <input class="form-input" name="pin" type="password" value="${escHtml(user.pin || '')}" placeholder="4-digit PIN" maxlength="6" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Avatar Badge Color</label>
        <div style="display:flex;gap:10px;margin-top:6px">
          ${AVATAR_COLORS.map(c => `
            <label style="cursor:pointer">
              <input type="radio" name="avatar_color" value="${c}" ${(user.avatar_color || '#10b981') === c ? 'checked' : ''} style="display:none" />
              <span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:${c}"></span>
            </label>
          `).join('')}
        </div>
      </div>
    </form>
  `;

  openModal({
    title: userId ? 'Edit User Account' : '➕ Create New User Account',
    bodyHtml,
    confirmText: userId ? 'Save User' : 'Create User',
    cancelText: 'Cancel',
    onConfirm: async () => {
      const form = document.getElementById('form-user-edit');
      if (!form) return true;
      const fd = new FormData(form);

      const userData = {
        id: fd.get('id') ? Number(fd.get('id')) : null,
        name: fd.get('name'),
        email: fd.get('email'),
        role: fd.get('role'),
        pin: fd.get('pin'),
        avatar_color: fd.get('avatar_color') || '#10b981'
      };

      try {
        await window.api.saveUser(userData);
        showToast(userId ? 'User updated!' : 'New user account created!', 'success');
        openUserProfileModal();
        return true;
      } catch (err) {
        showToast('User save failed: ' + err.message, 'error');
        return false;
      }
    }
  });
}

// Bind header button trigger
document.addEventListener('DOMContentLoaded', () => {
  initUserHeader();
  const btn = document.getElementById('btn-user-profile');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openUserProfileModal();
    });
  }
});

window.initUserHeader = initUserHeader;
window.openUserProfileModal = openUserProfileModal;
