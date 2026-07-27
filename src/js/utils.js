/**
 * utils.js — Global utilities, icon set, modal, toast, and shared helpers
 * Loaded before all page modules.
 */

// ── SVG Icon Library ──────────────────────────────────────────────────────────
const ICONS = {
  plus:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
  edit:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`,
  copy:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
  pdf:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>`,
  print: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
  eye:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  x:     `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  whatsapp: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>`,
  mail:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  refresh:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>`,
  rotateCcw: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
  fileText: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  dollar:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`,
  package:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`
};

// ── Date Formatting ───────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

/** Returns today as YYYY-MM-DD */
function todayStr() { return new Date().toISOString().slice(0, 10); }
/** Alias used by pre-existing invoice-editor.js */
function todayISO() { return todayStr(); }

/**
 * Add N days. Accepts two signatures:
 *  addDays(n)         → from today
 *  addDays(date, n)   → from given YYYY-MM-DD string
 */
function addDays(dateOrN, n) {
  let base, days;
  if (typeof dateOrN === 'number') { base = new Date(); days = dateOrN; }
  else { base = new Date(dateOrN + 'T00:00:00'); days = n || 0; }
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

/** Round to 2 decimal places */
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

/** Convert numeric amount into words (supports Indian Rupees & International formats) */
function numberToWords(amount, currencyCode = 'INR') {
  const num = Math.abs(parseFloat(amount)) || 0;
  if (num === 0) return 'Zero';

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertBelowThousand(n) {
    let str = '';
    if (n >= 100) {
      str += units[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + (n % 10 ? ' ' + units[n % 10] : '');
    } else if (n > 0) {
      str += units[n];
    }
    return str.trim();
  }

  let words = '';

  if (currencyCode === 'INR') {
    let n = integerPart;
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    const thousand = Math.floor(n / 1000);
    n %= 1000;

    if (crore > 0) words += convertBelowThousand(crore) + ' Crore ';
    if (lakh > 0) words += convertBelowThousand(lakh) + ' Lakh ';
    if (thousand > 0) words += convertBelowThousand(thousand) + ' Thousand ';
    if (n > 0) words += convertBelowThousand(n) + ' ';

    words = words.trim() ? words.trim() + ' Rupees' : '';
    if (decimalPart > 0) {
      words += (words ? ' and ' : '') + convertBelowThousand(decimalPart) + ' Paise';
    }
  } else {
    let n = integerPart;
    const billion = Math.floor(n / 1000000000);
    n %= 1000000000;
    const million = Math.floor(n / 1000000);
    n %= 1000000;
    const thousand = Math.floor(n / 1000);
    n %= 1000;

    if (billion > 0) words += convertBelowThousand(billion) + ' Billion ';
    if (million > 0) words += convertBelowThousand(million) + ' Million ';
    if (thousand > 0) words += convertBelowThousand(thousand) + ' Thousand ';
    if (n > 0) words += convertBelowThousand(n) + ' ';

    const currName = currencyCode || 'Units';
    words = words.trim() ? words.trim() + ' ' + currName : '';
    if (decimalPart > 0) {
      words += (words ? ' and ' : '') + convertBelowThousand(decimalPart) + ' Cents';
    }
  }

  return words ? words + ' Only' : 'Zero';
}

function generateInvoiceShareText(invoice, settings = {}, client = {}) {
  const invNo = invoice.invoice_number || 'Draft';
  const total = Number(invoice.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const curr = typeof getCurrency === 'function' ? getCurrency(invoice.currency || settings.default_currency || 'INR') : { symbol: '₹' };
  const clientName = client.name || invoice.client_name || 'Valued Customer';
  const companyName = settings.company_name || 'InvoiceForge';

  let text = `Hello *${clientName}*,\n\n`;
  text += `Here are the details of your invoice *#${invNo}* from *${companyName}*:\n`;
  text += `• *Invoice Date:* ${invoice.invoice_date || ''}\n`;
  if (invoice.due_date) text += `• *Due Date:* ${invoice.due_date}\n`;
  text += `• *Grand Total:* ${curr.symbol} ${total}\n`;
  text += `• *Status:* ${String(invoice.status || 'unpaid').toUpperCase()}\n\n`;

  if (settings.bank_details) {
    text += `*Payment / Bank Details:*\n${settings.bank_details.trim()}\n\n`;
  }

  text += `Thank you for your business!`;
  return text;
}

// ── HTML Escape ───────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function statusBadge(status) {
  const map = { draft: 'badge-draft', unpaid: 'badge-unpaid', paid: 'badge-paid', overdue: 'badge-overdue' };
  const cls = map[status] || 'badge-draft';
  return `<span class="badge ${cls}">${escHtml(status)}</span>`;
}

// ── Browser Fallback Mock (allows testing directly in web browsers) ─────────────
if (!window.api) {
  window.api = {
    getClients: async () => JSON.parse(localStorage.getItem('mock_clients') || '[]'),
    getClient: async (id) => {
      const clients = JSON.parse(localStorage.getItem('mock_clients') || '[]');
      return clients.find(c => c.id == id) || null;
    },
    saveClient: async (data) => {
      let clients = JSON.parse(localStorage.getItem('mock_clients') || '[]');
      if (data.id) {
        clients = clients.map(c => c.id == data.id ? { ...c, ...data } : c);
      } else {
        data.id = Date.now();
        clients.push(data);
      }
      localStorage.setItem('mock_clients', JSON.stringify(clients));
      return data;
    },
    deleteClient: async (id) => {
      let clients = JSON.parse(localStorage.getItem('mock_clients') || '[]');
      clients = clients.filter(c => c.id != id);
      localStorage.setItem('mock_clients', JSON.stringify(clients));
      return { success: true };
    },
    getInvoices: async () => JSON.parse(localStorage.getItem('mock_invoices') || '[]'),
    getInvoice: async (id) => {
      const invs = JSON.parse(localStorage.getItem('mock_invoices') || '[]');
      return invs.find(i => i.id == id) || null;
    },
    saveInvoice: async (data) => {
      let invs = JSON.parse(localStorage.getItem('mock_invoices') || '[]');
      if (data.id) {
        invs = invs.map(i => i.id == data.id ? { ...i, ...data } : i);
      } else {
        data.id = Date.now();
        invs.push(data);
      }
      localStorage.setItem('mock_invoices', JSON.stringify(invs));
      return data;
    },
    deleteInvoice: async (id) => {
      let invs = JSON.parse(localStorage.getItem('mock_invoices') || '[]');
      invs = invs.filter(i => i.id != id);
      localStorage.setItem('mock_invoices', JSON.stringify(invs));
      return { success: true };
    },
    getSettings: async () => JSON.parse(localStorage.getItem('mock_settings') || 'null') || {
      company_name: 'InvoiceForge Demo',
      invoice_prefix: 'INV-2026-',
      invoice_counter: 1
    },
    saveSettings: async (s) => {
      localStorage.setItem('mock_settings', JSON.stringify(s));
      return s;
    },
    verifyAdminPin: async () => ({ success: true }),
    saveSecuritySettings: async (d) => {
      const s = JSON.parse(localStorage.getItem('mock_settings') || '{}');
      Object.assign(s, { app_lock_enabled: d.enabled ? 1 : 0, admin_name: d.adminName, admin_pin: d.pin });
      localStorage.setItem('mock_settings', JSON.stringify(s));
      return s;
    },
    getProducts: async () => JSON.parse(localStorage.getItem('mock_products') || '[]'),
    getProduct: async (id) => {
      const products = JSON.parse(localStorage.getItem('mock_products') || '[]');
      return products.find(p => p.id == id) || null;
    },
    saveProduct: async (data) => {
      let products = JSON.parse(localStorage.getItem('mock_products') || '[]');
      if (data.id) {
        products = products.map(p => p.id == data.id ? { ...p, ...data } : p);
      } else {
        data.id = Date.now();
        products.push(data);
      }
      localStorage.setItem('mock_products', JSON.stringify(products));
      return data;
    },
    deleteProduct: async (id) => {
      let products = JSON.parse(localStorage.getItem('mock_products') || '[]');
      products = products.filter(p => p.id != id);
      localStorage.setItem('mock_products', JSON.stringify(products));
      return { success: true };
    },
    recordStockTransaction: async () => ({ success: true }),
    getStockTransactions: async () => [],
    getDashboardStats: async () => {
      const clients = JSON.parse(localStorage.getItem('mock_clients') || '[]');
      const invs = JSON.parse(localStorage.getItem('mock_invoices') || '[]');
      return { clientCount: clients.length, invoiceCount: invs.length, totalRevenue: 0, statusBreakdown: [{ status: 'paid', count: 0 }, { status: 'unpaid', count: 0 }] };
    },
    getNextInvoiceNumberObj: async () => ({ invoiceNumber: 'INV-2026-001', counter: 1 }),
    exportPdf: async () => window.print(),
    printInvoice: async () => window.print(),
    checkForUpdates: async () => ({ status: 'ok' }),
    getAppVersion: async () => '1.0.4',
    checkUpdateNotification: async () => ({ updated: false }),
    onUpdateStatus: () => {}
  };
}

// ── Currency helpers ──────────────────────────────────────────────────────────
function getCurrencySymbol(code) {
  if (!code || typeof CURRENCIES === 'undefined') return '₹';
  const found = CURRENCIES.find(c => c.code === code);
  return found ? found.symbol : code;
}

function buildCurrencyOptions(selected) {
  if (typeof CURRENCIES === 'undefined') return '';
  return CURRENCIES.map(c =>
    `<option value="${c.code}" ${c.code === selected ? 'selected' : ''}>${c.code} — ${escHtml(c.name)} (${escHtml(c.symbol)})</option>`
  ).join('');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastTimer;
function showToast(message, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.className = `toast ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = 'toast hidden'; }, 3200);
}

// ── Modal ─────────────────────────────────────────────────────────────────────
/**
 * Show the global modal.
 * @param {string} title
 * @param {string} bodyHtml
 * @param {string} [sizeClass] - 'modal-lg', 'modal-xl', or ''
 * @returns {{ close: Function }} — object with a close method
 */
function showModal(title, bodyHtml, sizeClass = '') {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const footerEl = document.getElementById('modal-footer');
  const closeBtn = document.getElementById('modal-close');

  if (!overlay || !box) return { close: () => {} };

  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = bodyHtml;
  // Some packaged builds omit the legacy footer container. Dialog actions are
  // rendered in bodyHtml, so the footer is optional.
  if (footerEl) {
    footerEl.innerHTML = '';
    footerEl.style.display = 'none';
  }
  box.className = 'modal-box' + (sizeClass ? ' ' + sizeClass : '');
  overlay.style.display = 'flex';
  overlay.classList.remove('hidden');

  const close = () => {
    overlay.style.display = 'none';
    overlay.classList.add('hidden');
  };
  if (closeBtn) closeBtn.onclick = close;
  overlay.onclick = e => { if (e.target === overlay) close(); };

  return { close };
}

/** Alias used by some modules */
function openModal(opts) {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const footerEl = document.getElementById('modal-footer');
  const closeBtn = document.getElementById('modal-close');

  if (!overlay || !box) return { close: () => {} };

  const close = () => {
    overlay.style.display = 'none';
    overlay.classList.add('hidden');
  };

  if (titleEl) titleEl.textContent = opts.title || '';
  if (bodyEl) bodyEl.innerHTML = opts.bodyHtml || opts.body || '';

  if (footerEl) {
    if (opts.footerHTML) {
      footerEl.innerHTML = opts.footerHTML;
      footerEl.style.display = 'flex';
    } else if (opts.confirmText || opts.cancelText) {
      footerEl.innerHTML = `
        <button type="button" class="btn btn-secondary" id="modal-cancel-btn">${opts.cancelText || 'Cancel'}</button>
        <button type="button" class="btn btn-primary" id="modal-confirm-btn">${opts.confirmText || 'Save'}</button>
      `;
      footerEl.style.display = 'flex';

      document.getElementById('modal-cancel-btn')?.addEventListener('click', close);
      document.getElementById('modal-confirm-btn')?.addEventListener('click', async () => {
        if (opts.onConfirm) {
          const res = await opts.onConfirm();
          if (res !== false) close();
        } else {
          close();
        }
      });
    } else {
      footerEl.innerHTML = '';
      footerEl.style.display = 'none';
    }
  }

  box.className = 'modal-box' + (opts.wide ? ' modal-lg' : '') + (opts.full ? ' modal-xl' : '');
  overlay.style.display = 'flex';
  overlay.classList.remove('hidden');

  if (closeBtn) closeBtn.onclick = close;
  overlay.onclick = e => { if (e.target === overlay) close(); };

  if (opts.onOpen) opts.onOpen(bodyEl);
  window.closeModal = close;
  return { close };
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.style.display = 'none';
    overlay.classList.add('hidden');
  }
}

/**
 * Show a destructive confirmation dialog.
 */
function showConfirm(title, message, onConfirm, danger = true) {
  showModal(title, `
    <p style="color:var(--text-2);font-size:14px;line-height:1.7">${message}</p>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-action-btn">${danger ? ICONS.trash : ICONS.check} Confirm</button>
    </div>
  `);
  document.getElementById('confirm-action-btn').onclick = () => {
    closeModal();
    onConfirm();
  };
}

/** Alias */
function confirmDialog(message, onYes, danger = false) {
  showConfirm('Confirm', message, onYes, danger);
}

function debounce(fn, delay = 300) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ── Global Exports for inline HTML handlers ───────────────────────────────────
window.showToast = showToast;
window.showModal = showModal;
window.closeModal = closeModal;
window.showConfirm = showConfirm;
window.confirmDialog = confirmDialog;
window.formatDate = formatDate;
window.formatCurrency = formatCurrency;
window.escHtml = escHtml;
window.escapeHtml = escHtml;
window.debounce = debounce;
