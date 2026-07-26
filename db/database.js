'use strict';

const path = require('path');
const { app } = require('electron');
const Database = require('better-sqlite3');

let db;

function getDbPath() {
  const userData = (app && typeof app.getPath === 'function') ? app.getPath('userData') : process.cwd();
  return path.join(userData, 'invoiceforge.db');
}

function initDatabase() {
  const fs = require('fs');
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createSchema();
  return db;
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      company_name TEXT DEFAULT '',
      company_address TEXT DEFAULT '',
      company_phone TEXT DEFAULT '',
      company_email TEXT DEFAULT '',
      tax_number TEXT DEFAULT '',
      bank_details TEXT DEFAULT '',
      default_payment_terms INTEGER DEFAULT 30,
      default_currency TEXT DEFAULT 'INR',
      default_tax_rate REAL DEFAULT 0,
      invoice_prefix TEXT DEFAULT 'INV-2026-',
      invoice_counter INTEGER DEFAULT 1,
      invoice_footer TEXT DEFAULT 'Thank you for your business.',
      logo_path TEXT DEFAULT '',
      app_lock_enabled INTEGER DEFAULT 0,
      admin_name TEXT DEFAULT 'Admin',
      admin_pin TEXT DEFAULT '',
      machine_guid TEXT DEFAULT ''
    );

    INSERT OR IGNORE INTO settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company_name TEXT DEFAULT '',
      billing_address TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      gstin TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      client_snapshot TEXT DEFAULT '{}',
      invoice_date TEXT NOT NULL,
      due_date TEXT DEFAULT '',
      currency TEXT DEFAULT 'INR',
      subtotal REAL DEFAULT 0,
      discount_type TEXT DEFAULT 'flat',
      discount_value REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      tax_lines TEXT DEFAULT '[]',
      tax_amount REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT DEFAULT '',
      quantity REAL DEFAULT 1,
      rate REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );
  `);

  // Idempotent column migrations for settings & invoices
  try { db.exec(`ALTER TABLE settings ADD COLUMN app_lock_enabled INTEGER DEFAULT 0`); } catch(e){}
  try { db.exec(`ALTER TABLE settings ADD COLUMN admin_name TEXT DEFAULT 'Admin'`); } catch(e){}
  try { db.exec(`ALTER TABLE settings ADD COLUMN admin_pin TEXT DEFAULT ''`); } catch(e){}
  try { db.exec(`ALTER TABLE settings ADD COLUMN machine_guid TEXT DEFAULT ''`); } catch(e){}
  try { db.exec(`ALTER TABLE settings ADD COLUMN last_installed_version TEXT DEFAULT ''`); } catch(e){}

  const invCols = db.prepare('PRAGMA table_info(invoices)').all();
  if (!invCols.some(c => c.name === 'client_snapshot')) db.exec("ALTER TABLE invoices ADD COLUMN client_snapshot TEXT DEFAULT '{}'");

  // Generate machine_guid if missing
  const currentSettings = db.prepare('SELECT machine_guid FROM settings WHERE id = 1').get();
  if (!currentSettings || !currentSettings.machine_guid) {
    const crypto = require('crypto');
    const newGuid = 'MAC-' + crypto.randomBytes(8).toString('hex').toUpperCase();
    db.prepare('UPDATE settings SET machine_guid = ? WHERE id = 1').run(newGuid);
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────
function getSettings() {
  return db.prepare('SELECT * FROM settings WHERE id = 1').get();
}

function saveSettings(data) {
  const allowed = [
    'company_name','company_address','company_phone','company_email',
    'tax_number','bank_details','default_payment_terms','default_currency',
    'default_tax_rate','invoice_prefix','invoice_counter','invoice_footer','logo_path',
    'app_lock_enabled','admin_name','admin_pin','machine_guid'
  ];
  const fields = allowed.filter(c => c in data).map(c => `${c} = @${c}`).join(', ');
  if (!fields) return true;
  db.prepare(`UPDATE settings SET ${fields} WHERE id = 1`).run(data);
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return true;
}

function verifyAdminPin(inputPin) {
  const s = getSettings();
  if (!s || !s.app_lock_enabled || !s.admin_pin) {
    return { success: true, message: 'No lock configured' };
  }
  const cleanInput = String(inputPin || '').trim();
  if (cleanInput === String(s.admin_pin).trim()) {
    return { success: true };
  }
  return { success: false, message: 'Incorrect PIN / Password' };
}

function saveSecuritySettings(data) {
  const enabled = data.enabled ? 1 : 0;
  const adminName = String(data.adminName || 'Admin').trim();
  const newPin = String(data.pin || '').trim();

  db.prepare(`
    UPDATE settings SET app_lock_enabled = ?, admin_name = ?, admin_pin = ? WHERE id = 1
  `).run(enabled, adminName, newPin);
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return getSettings();
}

// ── Clients ───────────────────────────────────────────────────────────────────
function getAllClients() {
  const rows = db.prepare('SELECT * FROM clients ORDER BY name COLLATE NOCASE').all();
  return rows.map(r => ({ ...r, id: Number(r.id) }));
}

function getClient(id) {
  if (!id) return null;
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(Number(id));
  return row ? { ...row, id: Number(row.id) } : null;
}

function saveClient(data) {
  const row = {
    name: String(data.name || '').trim(),
    company_name: String(data.company_name || '').trim(),
    billing_address: String(data.billing_address || '').trim(),
    email: String(data.email || '').trim(),
    phone: String(data.phone || '').trim(),
    gstin: String(data.gstin || '').trim()
  };
  let savedClient;
  if (data.id) {
    const id = Number(data.id);
    db.prepare(`
      UPDATE clients SET name=@name, company_name=@company_name,
        billing_address=@billing_address, email=@email, phone=@phone, gstin=@gstin
      WHERE id=@id
    `).run({ ...row, id });
    savedClient = getClient(id);
  } else {
    const result = db.prepare(`
      INSERT INTO clients (name, company_name, billing_address, email, phone, gstin)
      VALUES (@name, @company_name, @billing_address, @email, @phone, @gstin)
    `).run(row);
    const newId = Number(result.lastInsertRowid);
    savedClient = getClient(newId);
  }
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return savedClient;
}

function deleteClient(id) {
  const numId = Number(id);
  if (!numId) return false;
  db.prepare('DELETE FROM clients WHERE id = ?').run(numId);
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return true;
}

// ── Invoices ──────────────────────────────────────────────────────────────────
function getAllInvoices(filters) {
  // Auto-mark overdue first
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(`
    UPDATE invoices SET status = 'overdue', updated_at = ?
    WHERE status = 'unpaid' AND due_date < ? AND due_date IS NOT NULL AND due_date != ''
  `).run(new Date().toISOString(), today);

  let query = `
    SELECT i.*, c.name AS client_name, c.company_name AS client_company
    FROM invoices i LEFT JOIN clients c ON i.client_id = c.id
  `;
  const params = [];
  const where = [];

  if (filters) {
    if (filters.status) { where.push("i.status = ?"); params.push(filters.status); }
    if (filters.client_id) { where.push("i.client_id = ?"); params.push(filters.client_id); }
    if (filters.date_from) { where.push("i.invoice_date >= ?"); params.push(filters.date_from); }
    if (filters.date_to) { where.push("i.invoice_date <= ?"); params.push(filters.date_to); }
    if (filters.currency) { where.push("i.currency = ?"); params.push(filters.currency); }
  }
  if (where.length) query += ' WHERE ' + where.join(' AND ');
  query += ' ORDER BY i.created_at DESC';

  return db.prepare(query).all(...params);
}

function getInvoice(id) {
  const inv = db.prepare(`
    SELECT i.*, c.name AS client_name, c.company_name AS client_company,
           c.billing_address AS client_address, c.email AS client_email,
           c.phone AS client_phone, c.gstin AS client_gstin
    FROM invoices i LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.id = ?
  `).get(Number(id));
  if (inv) {
    inv.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order').all(Number(id));
    try { inv.tax_lines = JSON.parse(inv.tax_lines || '[]'); } catch { inv.tax_lines = []; }
    try { inv.client_snapshot = JSON.parse(inv.client_snapshot || '{}'); } catch { inv.client_snapshot = {}; }
  }
  return inv;
}

function getNextInvoiceNumber() {
  const s = getSettings();
  const num = String(s.invoice_counter).padStart(3, '0');
  return `${s.invoice_prefix}${num}`;
}

// Returns the object format expected by the pre-existing invoice-editor.js renderer
function getNextInvoiceNumberObj() {
  const s = getSettings();
  const counter = s.invoice_counter || 1;
  const num = String(counter).padStart(3, '0');
  const invoiceNumber = `${s.invoice_prefix}${num}`;
  return { invoiceNumber, nextCounter: counter };
}

function saveInvoice(data) {
  const items = data.items || [];
  const inv = {
    id:              data.id ? Number(data.id) : null,
    invoice_number:  String(data.invoice_number || '').trim(),
    client_id:       data.client_id ? Number(data.client_id) : null,
    invoice_date:    data.invoice_date || new Date().toISOString().slice(0, 10),
    due_date:        data.due_date || '',
    currency:        data.currency || 'INR',
    subtotal:        Number(data.subtotal) || 0,
    discount_type:   data.discount_type || 'flat',
    discount_value:  Number(data.discount_value) || 0,
    discount_amount: Number(data.discount_amount) || 0,
    tax_lines:       typeof data.tax_lines === 'string' ? data.tax_lines : JSON.stringify(data.tax_lines || []),
    tax_amount:      Number(data.tax_amount) || 0,
    grand_total:     Number(data.grand_total) || 0,
    notes:           String(data.notes || '').trim(),
    status:          data.status || 'draft'
  };

  const client = inv.client_id ? getClient(inv.client_id) : null;
  if (client) {
    inv.client_snapshot = JSON.stringify({
      name: client.name,
      company_name: client.company_name,
      billing_address: client.billing_address,
      email: client.email,
      phone: client.phone,
      gstin: client.gstin
    });
  } else if (inv.id) {
    inv.client_snapshot = db.prepare('SELECT client_snapshot FROM invoices WHERE id = ?').get(inv.id)?.client_snapshot || '{}';
  } else {
    inv.client_snapshot = '{}';
  }

  const saveItems = db.transaction((invoiceId, rows) => {
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);
    const stmt = db.prepare(`
      INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    rows.forEach((item, i) => stmt.run(invoiceId, item.description || '', item.quantity || 1, item.rate || 0, item.amount || 0, i));
  });

  let savedId;
  if (inv.id) {
    inv.updated_at = new Date().toISOString();
    db.prepare(`
      UPDATE invoices SET invoice_number=@invoice_number, client_id=@client_id, client_snapshot=@client_snapshot,
        invoice_date=@invoice_date, due_date=@due_date, currency=@currency,
        subtotal=@subtotal, discount_type=@discount_type, discount_value=@discount_value,
        discount_amount=@discount_amount, tax_lines=@tax_lines, tax_amount=@tax_amount,
        grand_total=@grand_total, notes=@notes, status=@status, updated_at=@updated_at
      WHERE id=@id
    `).run(inv);
    saveItems(inv.id, items);
    savedId = inv.id;
  } else {
    delete inv.id;
    const result = db.prepare(`
      INSERT INTO invoices (invoice_number, client_id, client_snapshot, invoice_date, due_date, currency,
        subtotal, discount_type, discount_value, discount_amount, tax_lines, tax_amount,
        grand_total, notes, status)
      VALUES (@invoice_number, @client_id, @client_snapshot, @invoice_date, @due_date, @currency,
        @subtotal, @discount_type, @discount_value, @discount_amount, @tax_lines,
        @tax_amount, @grand_total, @notes, @status)
    `).run(inv);
    savedId = Number(result.lastInsertRowid);
    saveItems(savedId, items);
    db.prepare('UPDATE settings SET invoice_counter = invoice_counter + 1 WHERE id = 1').run();
  }
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return savedId;
}

// Returns the full invoice object (not just id) — required by invoice-editor.js
function saveInvoiceAndReturn(data) {
  const id = saveInvoice(data);
  return getInvoice(id);
}

function deleteInvoice(id) {
  const numId = Number(id);
  if (!numId) return false;
  db.prepare('DELETE FROM invoices WHERE id = ?').run(numId);
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return true;
}

function duplicateInvoice(id) {
  const inv = getInvoice(Number(id));
  if (!inv) return null;
  const newNumber = getNextInvoiceNumber();
  const today = new Date().toISOString().slice(0, 10);
  const s = getSettings();
  const due = new Date();
  due.setDate(due.getDate() + (s.default_payment_terms || 30));
  const dueDate = due.toISOString().slice(0, 10);

  const newInv = {
    invoice_number: newNumber,
    client_id: inv.client_id,
    invoice_date: today,
    due_date: dueDate,
    currency: inv.currency,
    subtotal: inv.subtotal,
    discount_type: inv.discount_type,
    discount_value: inv.discount_value,
    discount_amount: inv.discount_amount,
    tax_lines: inv.tax_lines,
    tax_amount: inv.tax_amount,
    grand_total: inv.grand_total,
    notes: inv.notes,
    status: 'draft',
    items: inv.items
  };
  return saveInvoice(newInv);
}

function updateInvoiceStatus(id, status) {
  const numId = Number(id);
  db.prepare('UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, new Date().toISOString(), numId);
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return true;
}

function getDashboardStats() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  // Auto-mark overdue
  db.prepare(`
    UPDATE invoices SET status = 'overdue', updated_at = ?
    WHERE status = 'unpaid' AND due_date < ? AND due_date IS NOT NULL AND due_date != ''
  `).run(new Date().toISOString(), today);

  const totalThisMonth = db.prepare(`
    SELECT COALESCE(SUM(grand_total), 0) AS total FROM invoices
    WHERE status != 'draft' AND invoice_date >= ? AND invoice_date <= ?
  `).get(monthStart, today).total;

  const outstanding = db.prepare(`
    SELECT COALESCE(SUM(grand_total), 0) AS total FROM invoices
    WHERE status IN ('unpaid', 'overdue')
  `).get().total;

  const clientCount = db.prepare('SELECT COUNT(*) AS cnt FROM clients').get().cnt;
  const invoiceCount = db.prepare("SELECT COUNT(*) AS cnt FROM invoices WHERE status != 'draft'").get().cnt;

  const recent = db.prepare(`
    SELECT i.*, c.name AS client_name FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    ORDER BY i.created_at DESC LIMIT 8
  `).all();

  const statusBreakdown = db.prepare(
    "SELECT status, COUNT(*) AS count FROM invoices GROUP BY status"
  ).all();

  return { totalThisMonth, outstanding, clientCount, invoiceCount, recent, statusBreakdown };
}

function getClientProfile(id) {
  const clientId = Number(id);
  const client = getClient(clientId);
  if (!client) return null;

  const invoices = db.prepare(`
    SELECT i.*, c.name AS client_name
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.client_id = ?
    ORDER BY i.created_at DESC
  `).all(clientId);

  const totalInvoiced = db.prepare(`
    SELECT COALESCE(SUM(grand_total), 0) AS total
    FROM invoices WHERE client_id = ? AND status != 'draft'
  `).get(clientId).total;

  const outstanding = db.prepare(`
    SELECT COALESCE(SUM(grand_total), 0) AS total
    FROM invoices WHERE client_id = ? AND status IN ('unpaid', 'overdue')
  `).get(clientId).total;

  const paidCount = db.prepare(`
    SELECT COUNT(*) AS cnt FROM invoices WHERE client_id = ? AND status = 'paid'
  `).get(clientId).cnt;

  return {
    client,
    invoices,
    stats: {
      totalInvoiced,
      outstanding,
      invoiceCount: invoices.length,
      paidCount
    }
  };
}

function checkPostUpdateNotification(currentVersion) {
  if (!db) return { updated: false };
  try {
    const row = db.prepare(`SELECT last_installed_version FROM settings WHERE id = 1`).get();
    const lastVer = row ? (row.last_installed_version || '') : '';
    if (lastVer && lastVer !== currentVersion) {
      db.prepare(`UPDATE settings SET last_installed_version = ? WHERE id = 1`).run(currentVersion);
      return { updated: true, previousVersion: lastVer, currentVersion: currentVersion };
    } else if (!lastVer) {
      db.prepare(`UPDATE settings SET last_installed_version = ? WHERE id = 1`).run(currentVersion);
    }
  } catch (err) {
    console.error('Update notification check error:', err.message);
  }
  return { updated: false, currentVersion: currentVersion };
}

function closeDatabase() {
  if (db) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
      console.log('Database closed cleanly.');
    } catch (err) {
      console.error('Error closing database:', err.message);
    }
  }
}

module.exports = {
  initDatabase, getDbPath, closeDatabase,
  getSettings, saveSettings, verifyAdminPin, saveSecuritySettings, checkPostUpdateNotification,
  getAllClients, getClient, saveClient, deleteClient, getClientProfile,
  getAllInvoices, getInvoice, getNextInvoiceNumber, getNextInvoiceNumberObj,
  saveInvoice, saveInvoiceAndReturn, deleteInvoice, duplicateInvoice,
  updateInvoiceStatus, getDashboardStats
};

