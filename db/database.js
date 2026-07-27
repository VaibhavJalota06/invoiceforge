'use strict';

const path = require('path');
const { app } = require('electron');
const Database = require('better-sqlite3');
const crypto = require('crypto');

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
  seedDemoDataIfEmpty();
  return db;
}

function createSchema() {
  // Create each table individually so a pre-existing table never blocks others
  const tables = [
    `CREATE TABLE IF NOT EXISTS settings (
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
    )`,
    `INSERT OR IGNORE INTO settings (id) VALUES (1)`,
    `CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company_name TEXT DEFAULT '',
      billing_address TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      gstin TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS invoices (
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
    )`,
    `CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      product_id INTEGER DEFAULT 0,
      description TEXT DEFAULT '',
      quantity REAL DEFAULT 1,
      rate REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT DEFAULT '',
      unit TEXT DEFAULT 'Pcs',
      cost_price REAL DEFAULT 0,
      selling_rate REAL DEFAULT 0,
      current_stock REAL DEFAULT 0,
      reorder_level REAL DEFAULT 5,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS stock_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      reference_type TEXT DEFAULT 'MANUAL',
      reference_id INTEGER DEFAULT 0,
      client_id INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      reversed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company_name TEXT DEFAULT '',
      address TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      gstin TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_number TEXT NOT NULL UNIQUE,
      vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
      vendor_snapshot TEXT DEFAULT '{}',
      purchase_date TEXT NOT NULL,
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
      status TEXT DEFAULT 'received',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id INTEGER DEFAULT 0,
      description TEXT DEFAULT '',
      unit TEXT DEFAULT 'Pcs',
      quantity REAL DEFAULT 1,
      cost_price REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    )`
  ];

  for (const sql of tables) {
    try {
      db.exec(sql);
    } catch (e) {
      console.error('Schema create error:', e.message, '\nSQL:', sql.slice(0, 80));
    }
  }

  // Idempotent column migrations
  const migrations = [
    `ALTER TABLE settings ADD COLUMN app_lock_enabled INTEGER DEFAULT 0`,
    `ALTER TABLE settings ADD COLUMN admin_name TEXT DEFAULT 'Admin'`,
    `ALTER TABLE settings ADD COLUMN admin_pin TEXT DEFAULT ''`,
    `ALTER TABLE settings ADD COLUMN machine_guid TEXT DEFAULT ''`,
    `ALTER TABLE settings ADD COLUMN last_installed_version TEXT DEFAULT ''`,
    `ALTER TABLE settings ADD COLUMN purchase_prefix TEXT DEFAULT 'PUR-2026-'`,
    `ALTER TABLE settings ADD COLUMN purchase_counter INTEGER DEFAULT 1`,
    `ALTER TABLE settings ADD COLUMN active_user_id INTEGER DEFAULT 1`,
    `ALTER TABLE invoices ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))`,
    `ALTER TABLE invoices ADD COLUMN client_name TEXT DEFAULT ''`,
    `ALTER TABLE invoices ADD COLUMN discount_type TEXT DEFAULT 'flat'`,
    `ALTER TABLE invoices ADD COLUMN discount_value REAL DEFAULT 0`,
    `ALTER TABLE invoices ADD COLUMN discount_amount REAL DEFAULT 0`,
    `ALTER TABLE invoices ADD COLUMN tax_lines TEXT DEFAULT '[]'`,
    `ALTER TABLE invoices ADD COLUMN tax_amount REAL DEFAULT 0`,
    `ALTER TABLE purchases ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))`,
    `ALTER TABLE purchases ADD COLUMN vendor_name TEXT DEFAULT ''`,
    `ALTER TABLE clients ADD COLUMN company_name TEXT DEFAULT ''`,
    `ALTER TABLE clients ADD COLUMN address TEXT DEFAULT ''`,
    `ALTER TABLE clients ADD COLUMN billing_address TEXT DEFAULT ''`,
    `ALTER TABLE vendors ADD COLUMN company_name TEXT DEFAULT ''`,
    `ALTER TABLE vendors ADD COLUMN address TEXT DEFAULT ''`,
    `ALTER TABLE invoice_items ADD COLUMN product_id INTEGER DEFAULT 0`,
    `ALTER TABLE invoice_items ADD COLUMN unit TEXT DEFAULT 'Pcs'`,
    `ALTER TABLE invoice_items ADD COLUMN sort_order INTEGER DEFAULT 0`,
    `ALTER TABLE stock_transactions ADD COLUMN reversed INTEGER DEFAULT 0`,
    `ALTER TABLE settings ADD COLUMN return_prefix TEXT DEFAULT 'RET-2026-'`,
    `ALTER TABLE settings ADD COLUMN return_counter INTEGER DEFAULT 1`,
    `CREATE TABLE IF NOT EXISTS sales_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_number TEXT NOT NULL UNIQUE,
      invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
      invoice_number TEXT DEFAULT '',
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      client_name TEXT DEFAULT '',
      return_date TEXT NOT NULL,
      reason TEXT DEFAULT 'Customer Return',
      subtotal REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      refund_status TEXT DEFAULT 'credit_note',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS sales_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
      product_id INTEGER DEFAULT 0,
      description TEXT DEFAULT '',
      unit TEXT DEFAULT 'Pcs',
      quantity REAL DEFAULT 1,
      rate REAL DEFAULT 0,
      amount REAL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE DEFAULT '',
      role TEXT DEFAULT 'Admin',
      pin TEXT DEFAULT '',
      avatar_color TEXT DEFAULT '#6366f1',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT DEFAULT ''
    )`,
    `INSERT OR IGNORE INTO users (id, name, email, role, pin, avatar_color) VALUES (1, 'Administrator', 'admin@invoiceforge.local', 'Admin', '', '#6366f1')`,
    `ALTER TABLE settings ADD COLUMN quotation_prefix TEXT DEFAULT 'QTN-2026-'`,
    `ALTER TABLE settings ADD COLUMN quotation_counter INTEGER DEFAULT 1`,
    `CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT DEFAULT 'Cash',
      expense_date TEXT NOT NULL,
      receipt_path TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_number TEXT NOT NULL UNIQUE,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      client_snapshot TEXT DEFAULT '{}',
      quotation_date TEXT NOT NULL,
      valid_until TEXT DEFAULT '',
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
      converted_invoice_id INTEGER DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
      product_id INTEGER DEFAULT 0,
      description TEXT DEFAULT '',
      unit TEXT DEFAULT 'Pcs',
      quantity REAL DEFAULT 1,
      rate REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS payment_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      account_type TEXT DEFAULT 'Cash',
      party_type TEXT DEFAULT 'client',
      party_id INTEGER DEFAULT 0,
      invoice_id INTEGER DEFAULT 0,
      purchase_id INTEGER DEFAULT 0,
      amount REAL NOT NULL DEFAULT 0,
      payment_date TEXT NOT NULL,
      reference_no TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `INSERT OR IGNORE INTO expense_categories (id, name, description) VALUES (1, 'Office Rent', 'Monthly facility & office lease payments')`,
    `INSERT OR IGNORE INTO expense_categories (id, name, description) VALUES (2, 'Utilities & Electricity', 'Electricity, water, internet, phone bills')`,
    `INSERT OR IGNORE INTO expense_categories (id, name, description) VALUES (3, 'Staff Salaries', 'Employee compensation and payroll')`,
    `INSERT OR IGNORE INTO expense_categories (id, name, description) VALUES (4, 'Software & Subscriptions', 'SaaS, hosting, IT tools')`,
    `INSERT OR IGNORE INTO expense_categories (id, name, description) VALUES (5, 'Travel & Transport', 'Logistics, fuel, business travel')`,
    `INSERT OR IGNORE INTO expense_categories (id, name, description) VALUES (6, 'Miscellaneous', 'General operational costs')`,
    `ALTER TABLE settings ADD COLUMN invoice_theme TEXT DEFAULT 'classic'`,
    `ALTER TABLE settings ADD COLUMN primary_color TEXT DEFAULT '#4f46e5'`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT DEFAULT 'Admin',
      action TEXT NOT NULL,
      entity_type TEXT DEFAULT '',
      entity_id INTEGER DEFAULT 0,
      details TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_client_date ON invoices(client_id, invoice_date, status)`,
    `CREATE INDEX IF NOT EXISTS idx_purchases_vendor_date ON purchases(vendor_id, purchase_date, status)`,
    `CREATE INDEX IF NOT EXISTS idx_stock_tx_product ON stock_transactions(product_id)`,
    `CREATE INDEX IF NOT EXISTS idx_expenses_category_date ON expenses(category_id, expense_date)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)`
  ];
  for (const m of migrations) {
    try { db.exec(m); } catch (e) {} // expected to fail if column already exists
  }

  const invCols = db.prepare('PRAGMA table_info(invoices)').all();
  if (!invCols.some(c => c.name === 'client_snapshot')) {
    try { db.exec("ALTER TABLE invoices ADD COLUMN client_snapshot TEXT DEFAULT '{}'"); } catch(e){}
  }

  // Generate machine_guid if missing
  try {
    const currentSettings = db.prepare('SELECT machine_guid FROM settings WHERE id = 1').get();
    if (!currentSettings || !currentSettings.machine_guid) {
      const crypto = require('crypto');
      const newGuid = 'MAC-' + crypto.randomBytes(8).toString('hex').toUpperCase();
      db.prepare('UPDATE settings SET machine_guid = ? WHERE id = 1').run(newGuid);
    }
  } catch (e) {
    console.error('machine_guid init error:', e.message);
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
    'app_lock_enabled','admin_name','admin_pin','machine_guid',
    'purchase_prefix','purchase_counter','return_prefix','return_counter',
    'quotation_prefix','quotation_counter','invoice_theme','primary_color'
  ];
  const fields = allowed.filter(c => c in data).map(c => `${c} = @${c}`).join(', ');
  if (!fields) return true;
  db.prepare(`UPDATE settings SET ${fields} WHERE id = 1`).run(data);
  try { logAuditEvent('UPDATE_SETTINGS', 'settings', 1, 'Updated app settings & branding'); } catch(e){}
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return true;
}

// ── Sales Returns & Credit Notes CRUD ──────────────────────────────────────────
function getNextReturnNumberObj() {
  const settings = getSettings();
  const prefix = settings.return_prefix || 'RET-2026-';
  const counter = Number(settings.return_counter) || 1;
  const numStr = String(counter).padStart(3, '0');
  return { prefix, counter, fullNumber: `${prefix}${numStr}` };
}

function getAllSalesReturns(filters = {}) {
  try {
    let sql = `
      SELECT r.*, c.name as client_name_db
      FROM sales_returns r
      LEFT JOIN clients c ON r.client_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (filters && filters.search) {
      sql += ` AND (r.return_number LIKE ? OR r.invoice_number LIKE ? OR r.client_name LIKE ? OR c.name LIKE ?)`;
      const term = `%${filters.search}%`;
      params.push(term, term, term, term);
    }
    if (filters && filters.status) {
      sql += ` AND r.refund_status = ?`;
      params.push(filters.status);
    }

    sql += ` ORDER BY r.id DESC`;
    const rows = db.prepare(sql).all(...params);

    return rows.map(r => ({
      ...r,
      client_name: r.client_name || r.client_name_db || 'Walk-in Customer'
    }));
  } catch (e) {
    console.error('getAllSalesReturns error:', e.message);
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sales_returns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          return_number TEXT NOT NULL UNIQUE,
          invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
          invoice_number TEXT DEFAULT '',
          client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
          client_name TEXT DEFAULT '',
          return_date TEXT NOT NULL,
          reason TEXT DEFAULT 'Customer Return',
          subtotal REAL DEFAULT 0,
          tax_amount REAL DEFAULT 0,
          grand_total REAL DEFAULT 0,
          refund_status TEXT DEFAULT 'credit_note',
          notes TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS sales_return_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          return_id INTEGER NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
          product_id INTEGER DEFAULT 0,
          description TEXT DEFAULT '',
          unit TEXT DEFAULT 'Pcs',
          quantity REAL DEFAULT 1,
          rate REAL DEFAULT 0,
          amount REAL DEFAULT 0
        );
      `);
    } catch(err) {}
    return [];
  }
}

function getSalesReturn(id) {
  const ret = db.prepare(`
    SELECT r.*, c.name as client_name_db
    FROM sales_returns r
    LEFT JOIN clients c ON r.client_id = c.id
    WHERE r.id = ?
  `).get(id);
  if (!ret) return null;

  const items = db.prepare(`SELECT * FROM sales_return_items WHERE return_id = ?`).all(id);
  return {
    ...ret,
    client_name: ret.client_name || ret.client_name_db || 'Walk-in Customer',
    items
  };
}

function saveSalesReturn(returnData) {
  const { id, invoice_id, invoice_number, client_id, client_name, return_date, reason, subtotal, tax_amount, grand_total, refund_status, notes, items } = returnData;

  const run = db.transaction(() => {
    let retId = id;
    let returnNo = returnData.return_number;

    if (!retId) {
      const nextObj = getNextReturnNumberObj();
      returnNo = nextObj.fullNumber;

      const res = db.prepare(`
        INSERT INTO sales_returns (return_number, invoice_id, invoice_number, client_id, client_name, return_date, reason, subtotal, tax_amount, grand_total, refund_status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        returnNo,
        invoice_id ? Number(invoice_id) : null,
        invoice_number || '',
        client_id ? Number(client_id) : null,
        client_name || '',
        return_date || new Date().toISOString().slice(0, 10),
        reason || 'Customer Return',
        Number(subtotal) || 0,
        Number(tax_amount) || 0,
        Number(grand_total) || 0,
        refund_status || 'credit_note',
        notes || ''
      );
      retId = res.lastInsertRowid;

      db.prepare(`UPDATE settings SET return_counter = return_counter + 1 WHERE id = 1`).run();
    } else {
      db.prepare(`
        UPDATE sales_returns
        SET invoice_id = ?, invoice_number = ?, client_id = ?, client_name = ?, return_date = ?, reason = ?, subtotal = ?, tax_amount = ?, grand_total = ?, refund_status = ?
        WHERE id = ?
      `).run(
        invoice_id ? Number(invoice_id) : null,
        invoice_number || '',
        client_id ? Number(client_id) : null,
        client_name || '',
        return_date || new Date().toISOString().slice(0, 10),
        reason || 'Customer Return',
        Number(subtotal) || 0,
        Number(tax_amount) || 0,
        Number(grand_total) || 0,
        refund_status || 'credit_note',
        retId
      );

      const oldItems = db.prepare(`SELECT * FROM sales_return_items WHERE return_id = ?`).all(retId);
      for (const item of oldItems) {
        if (item.product_id > 0 && item.quantity > 0) {
          db.prepare(`UPDATE products SET current_stock = current_stock - ? WHERE id = ?`).run(item.quantity, item.product_id);
        }
      }
      db.prepare(`DELETE FROM sales_return_items WHERE return_id = ?`).run(retId);
    }

    if (Array.isArray(items)) {
      const stmt = db.prepare(`
        INSERT INTO sales_return_items (return_id, product_id, description, unit, quantity, rate, amount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        const qty = Number(item.quantity) || 0;
        const pId = Number(item.product_id) || 0;
        stmt.run(retId, pId, item.description || '', item.unit || 'Pcs', qty, Number(item.rate) || 0, Number(item.amount) || 0);

        if (pId > 0 && qty > 0) {
          db.prepare(`UPDATE products SET current_stock = current_stock + ? WHERE id = ?`).run(qty, pId);
          try {
            db.prepare(`
              INSERT INTO stock_transactions (product_id, type, quantity, reference_type, reference_id, client_id, notes)
              VALUES (?, 'IN', ?, 'RETURN', ?, ?, ?)
            `).run(pId, qty, retId, client_id || 0, `Sales Return #${returnNo}`);
          } catch(e) {}
        }
      }
    }

    return retId;
  });

  const savedId = run();
  return getSalesReturn(savedId);
}

function deleteSalesReturn(id) {
  const ret = getSalesReturn(id);
  if (!ret) return { success: false, reason: 'Sales return not found' };

  db.transaction(() => {
    if (Array.isArray(ret.items)) {
      for (const item of ret.items) {
        if (item.product_id > 0 && item.quantity > 0) {
          db.prepare(`UPDATE products SET current_stock = current_stock - ? WHERE id = ?`).run(item.quantity, item.product_id);
        }
      }
    }
    db.prepare(`DELETE FROM sales_return_items WHERE return_id = ?`).run(id);
    db.prepare(`DELETE FROM sales_returns WHERE id = ?`).run(id);
  })();

  return { success: true };
}

// ── Personalized Multi-User Management Functions ────────────────────────────────
function getAllUsers() {
  try {
    return db.prepare(`SELECT id, name, email, role, pin, avatar_color, is_active, created_at, last_login FROM users ORDER BY name COLLATE NOCASE`).all();
  } catch(e) {
    return [{ id: 1, name: 'Administrator', email: 'admin@invoiceforge.local', role: 'Admin', avatar_color: '#6366f1' }];
  }
}

function getUser(id) {
  try {
    return db.prepare(`SELECT id, name, email, role, pin, avatar_color, is_active, created_at, last_login FROM users WHERE id = ?`).get(id);
  } catch(e) {
    return null;
  }
}

function getActiveUser() {
  const settings = getSettings();
  const activeId = Number(settings?.active_user_id) || 1;
  let user = getUser(activeId);
  if (!user) {
    user = db.prepare(`SELECT * FROM users ORDER BY id ASC LIMIT 1`).get();
  }
  return user || { id: 1, name: 'Administrator', email: 'admin@invoiceforge.local', role: 'Admin', avatar_color: '#6366f1' };
}

function saveUser(userData) {
  const { id, name, email, role, pin, avatar_color } = userData;
  if (!name || !name.trim()) throw new Error('User name is required.');

  if (id) {
    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, role = ?, pin = ?, avatar_color = ?
      WHERE id = ?
    `).run(name.trim(), (email || '').trim(), role || 'Staff', pin || '', avatar_color || '#6366f1', id);
    return getUser(id);
  } else {
    const res = db.prepare(`
      INSERT INTO users (name, email, role, pin, avatar_color)
      VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), (email || '').trim(), role || 'Staff', pin || '', avatar_color || '#6366f1');
    return getUser(res.lastInsertRowid);
  }
}

function deleteUser(id) {
  const target = getUser(id);
  if (!target) return { success: false, reason: 'User not found' };

  const adminCount = db.prepare(`SELECT count(*) as c FROM users WHERE role = 'Admin'`).get().c;
  if (target.role === 'Admin' && adminCount <= 1) {
    throw new Error('Cannot delete the primary Administrator account.');
  }

  db.prepare(`DELETE FROM users WHERE id = ?`).run(id);

  const activeUser = getActiveUser();
  if (activeUser.id === id) {
    const nextUser = db.prepare(`SELECT id FROM users LIMIT 1`).get();
    if (nextUser) switchActiveUser(nextUser.id);
  }
  return { success: true };
}

function switchActiveUser(userId, pinInput = null) {
  const user = getUser(userId);
  if (!user) throw new Error('User account not found.');

  if (user.pin && pinInput !== null && pinInput !== user.pin) {
    throw new Error('Incorrect Security PIN for user account.');
  }

  db.prepare(`UPDATE settings SET active_user_id = ? WHERE id = 1`).run(userId);
  try {
    db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`).run(userId);
  } catch(e) {}
  return user;
}

// ── Settings & Security Helpers ────────────────────────────────────────────────
function hashPin(pin, salt = null) {
  if (!pin) return '';
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(pin, salt, 10000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPinHash(inputPin, storedPin) {
  if (!storedPin) return true;
  if (!inputPin) return false;
  const cleanInput = String(inputPin).trim();
  const cleanStored = String(storedPin).trim();

  // Support legacy plaintext PIN auto-migration
  if (!cleanStored.includes(':')) {
    return cleanInput === cleanStored;
  }

  const parts = cleanStored.split(':');
  if (parts.length !== 2) return false;
  const [salt, storedHash] = parts;
  const hash = crypto.pbkdf2Sync(cleanInput, salt, 10000, 32, 'sha256').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch (e) {
    return false;
  }
}

let failedAttempts = 0;
let lockoutUntil = 0;

function verifyAdminPin(inputPin) {
  const s = getSettings();
  if (!s || !s.app_lock_enabled || !s.admin_pin) {
    return { success: true, message: 'No lock configured' };
  }

  const now = Date.now();
  if (now < lockoutUntil) {
    const remainingSecs = Math.ceil((lockoutUntil - now) / 1000);
    return { success: false, message: `Too many failed attempts. Security lockout active. Try again in ${remainingSecs} seconds.` };
  }

  const isValid = verifyPinHash(inputPin, s.admin_pin);
  if (isValid) {
    failedAttempts = 0;
    // Upgrade legacy plaintext PIN to salt:hash format in SQLite
    if (!String(s.admin_pin).includes(':')) {
      const hashedPin = hashPin(inputPin);
      db.prepare('UPDATE settings SET admin_pin = ? WHERE id = 1').run(hashedPin);
    }
    return { success: true };
  } else {
    failedAttempts++;
    if (failedAttempts >= 5) {
      lockoutUntil = Date.now() + 60000; // 60s security lockout
      failedAttempts = 0;
      return { success: false, message: 'Too many failed PIN attempts. Workstation locked for 60 seconds.' };
    }
    const remaining = 5 - failedAttempts;
    return { success: false, message: `Incorrect PIN / Password. (${remaining} attempt${remaining !== 1 ? 's' : ''} remaining)` };
  }
}

function saveSecuritySettings(data = {}) {
  const enabled = (data.enabled || data.app_lock_enabled) ? 1 : 0;
  const adminName = String(data.adminName || data.admin_name || 'Admin').trim();
  const rawPin = String(data.pin || data.admin_pin || '').trim();

  let finalPin = rawPin;
  if (enabled && rawPin) {
    if (!rawPin.includes(':')) {
      finalPin = hashPin(rawPin);
    }
  } else if (!enabled) {
    finalPin = '';
  }

  db.prepare(`
    UPDATE settings SET app_lock_enabled = ?, admin_name = ?, admin_pin = ? WHERE id = 1
  `).run(enabled, adminName, finalPin);
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
  if (!row.name) throw new Error('Client name is required');
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
  try {
    db.prepare(`
      UPDATE invoices SET status = 'overdue', updated_at = ?
      WHERE status = 'unpaid' AND due_date < ? AND due_date IS NOT NULL AND due_date != ''
    `).run(new Date().toISOString(), today);
  } catch (e) {
    try {
      db.prepare(`
        UPDATE invoices SET status = 'overdue'
        WHERE status = 'unpaid' AND due_date < ? AND due_date IS NOT NULL AND due_date != ''
      `).run(today);
    } catch (err) {}
  }

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
  return getNextInvoiceNumberObj().formatted;
}

function getNextInvoiceNumberObj() {
  const s = getSettings();
  let counter = s.invoice_counter || 1;
  const prefix = s.invoice_prefix || 'INV-2026-';
  let formatted = `${prefix}${String(counter).padStart(3, '0')}`;

  while (db.prepare('SELECT id FROM invoices WHERE invoice_number = ?').get(formatted)) {
    counter++;
    formatted = `${prefix}${String(counter).padStart(3, '0')}`;
  }

  return { invoiceNumber: formatted, formatted, nextCounter: counter };
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
      INSERT INTO invoice_items (invoice_id, product_id, description, quantity, unit, rate, amount, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.forEach((item, i) => stmt.run(
      invoiceId,
      Number(item.product_id) || 0,
      item.description || '',
      item.quantity || 1,
      item.unit || 'Pcs',
      item.rate || 0,
      item.amount || 0,
      i
    ));
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
  const saveWithStock = db.transaction(() => {
    const previous = data.id ? getInvoice(data.id) : null;
    if (previous && previous.status !== 'draft') restoreStockForInvoice(previous.id);
    const id = saveInvoice(data);
    const saved = getInvoice(id);
    if (saved && saved.status !== 'draft') deductStockForInvoice(id, data.items || [], data.client_id);
    return id;
  });
  const id = saveWithStock();
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
  try {
    db.prepare(`
      UPDATE invoices SET status = 'overdue', updated_at = ?
      WHERE status = 'unpaid' AND due_date < ? AND due_date IS NOT NULL AND due_date != ''
    `).run(new Date().toISOString(), today);
  } catch (e) {
    try {
      db.prepare(`
        UPDATE invoices SET status = 'overdue'
        WHERE status = 'unpaid' AND due_date < ? AND due_date IS NOT NULL AND due_date != ''
      `).run(today);
    } catch (err) {}
  }

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
    let lastVer = row ? (row.last_installed_version || '') : '';
    if (!lastVer) {
      lastVer = '1.0.3';
    }
    if (lastVer !== currentVersion) {
      db.prepare(`UPDATE settings SET last_installed_version = ? WHERE id = 1`).run(currentVersion);
      return { updated: true, previousVersion: lastVer, currentVersion: currentVersion };
    }
  } catch (err) {
    console.error('Update notification check error:', err.message);
  }
  return { updated: false, currentVersion: currentVersion };
}

// ─── Products & Stock Operations ───────────────────────────────────────────────
function getAllProducts() {
  return db.prepare(`SELECT * FROM products ORDER BY name ASC`).all();
}

function getProduct(id) {
  return db.prepare(`SELECT * FROM products WHERE id = ?`).get(id);
}

function saveProduct(product) {
  const { id, name, sku, unit, cost_price, selling_rate, current_stock, reorder_level } = product;
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Product name is required');
  if (id) {
    db.prepare(`
      UPDATE products
      SET name = ?, sku = ?, unit = ?, cost_price = ?, selling_rate = ?, current_stock = ?, reorder_level = ?
      WHERE id = ?
    `).run(cleanName, sku || '', unit || 'Pcs', Number(cost_price)||0, Number(selling_rate)||0, Number(current_stock)||0, Number(reorder_level)||5, id);
    return getProduct(id);
  } else {
    const res = db.prepare(`
      INSERT INTO products (name, sku, unit, cost_price, selling_rate, current_stock, reorder_level)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(cleanName, sku || '', unit || 'Pcs', Number(cost_price)||0, Number(selling_rate)||0, Number(current_stock)||0, Number(reorder_level)||5);
    return getProduct(res.lastInsertRowid);
  }
}

function deleteProduct(id) {
  db.prepare(`DELETE FROM stock_transactions WHERE product_id = ?`).run(id);
  return db.prepare(`DELETE FROM products WHERE id = ?`).run(id);
}

function recordStockTransaction({ product_id, type, quantity, reference_type, reference_id, client_id, notes }) {
  const qty = Math.abs(Number(quantity)) || 0;
  if (!product_id || qty <= 0) return false;

  const t = type === 'OUT' ? 'OUT' : 'IN';
  const product = getProduct(product_id);
  if (!product) throw new Error('Inventory item was not found');
  if (t === 'OUT' && Number(product.current_stock) < qty) {
    throw new Error(`Insufficient stock for ${product.name}`);
  }
  db.prepare(`
    INSERT INTO stock_transactions (product_id, type, quantity, reference_type, reference_id, client_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(product_id, t, qty, reference_type || 'MANUAL', reference_id || 0, client_id || 0, notes || '');

  if (t === 'IN') {
    db.prepare(`UPDATE products SET current_stock = current_stock + ? WHERE id = ?`).run(qty, product_id);
  } else {
    db.prepare(`UPDATE products SET current_stock = current_stock - ? WHERE id = ?`).run(qty, product_id);
  }
  return true;
}

function getStockTransactions(productId) {
  if (productId) {
    return db.prepare(`
      SELECT st.*, p.name as product_name, c.name as client_name
      FROM stock_transactions st
      LEFT JOIN products p ON st.product_id = p.id
      LEFT JOIN clients c ON st.client_id = c.id
      WHERE st.product_id = ?
      ORDER BY st.id DESC
    `).all(productId);
  }
  return db.prepare(`
    SELECT st.*, p.name as product_name, c.name as client_name
    FROM stock_transactions st
    LEFT JOIN products p ON st.product_id = p.id
    LEFT JOIN clients c ON st.client_id = c.id
    ORDER BY st.id DESC LIMIT 100
  `).all();
}

function deductStockForInvoice(invoiceId, items = null, clientId = 0) {
  if (!items || !items.length) {
    const inv = getInvoice(invoiceId);
    if (!inv) return;
    items = inv.items || [];
    clientId = clientId || inv.client_id || 0;
  }
  if (!items || !items.length) return;
  items.forEach(item => {
    let p = null;
    if (item.product_id) {
      p = getProduct(item.product_id);
    }
    if (!p && item.description && typeof item.description === 'string' && item.description.trim()) {
      p = db.prepare(`SELECT * FROM products WHERE LOWER(name) = LOWER(?)`).get(item.description.trim());
    }
    if (p) {
      recordStockTransaction({
        product_id: p.id,
        type: 'OUT',
        quantity: Math.abs(Number(item.quantity)) || 1,
        reference_type: 'INVOICE',
        reference_id: invoiceId,
        client_id: clientId || 0,
        notes: `Auto stock deduction for Invoice #${invoiceId}`
      });
    }
  });
}

function restoreStockForInvoice(invoiceId) {
  try {
    const txs = db.prepare(`SELECT * FROM stock_transactions WHERE reference_type = 'INVOICE' AND reference_id = ? AND type = 'OUT' AND (reversed = 0 OR reversed IS NULL)`).all(invoiceId);
    txs.forEach(tx => {
      recordStockTransaction({
        product_id: tx.product_id,
        type: 'IN',
        quantity: tx.quantity,
        reference_type: 'INVOICE_RESTORE',
        reference_id: invoiceId,
        client_id: tx.client_id,
        notes: `Restored stock from deleted Invoice #${invoiceId}`
      });
      try {
        db.prepare('UPDATE stock_transactions SET reversed = 1 WHERE id = ?').run(tx.id);
      } catch (e) {}
    });
  } catch (err) {
    try {
      const txs = db.prepare(`SELECT * FROM stock_transactions WHERE reference_type = 'INVOICE' AND reference_id = ? AND type = 'OUT'`).all(invoiceId);
      txs.forEach(tx => {
        recordStockTransaction({
          product_id: tx.product_id,
          type: 'IN',
          quantity: tx.quantity,
          reference_type: 'INVOICE_RESTORE',
          reference_id: invoiceId,
          client_id: tx.client_id,
          notes: `Restored stock from deleted Invoice #${invoiceId}`
        });
      });
    } catch (e) {}
  }
}

function getClientFullProfile(clientId) {
  const client = getClient(clientId);
  if (!client) return null;

  const invoices = db.prepare(`
    SELECT id, invoice_number, invoice_date, due_date, currency, grand_total, status, notes
    FROM invoices
    WHERE client_id = ?
    ORDER BY id DESC
  `).all(clientId);

  let totalBilled = 0;
  let outstanding = 0;
  let paidCount = 0;

  invoices.forEach(inv => {
    totalBilled += Number(inv.grand_total) || 0;
    if (inv.status === 'paid') paidCount++;
    else if (inv.status === 'unpaid' || inv.status === 'overdue') {
      outstanding += Number(inv.grand_total) || 0;
    }
  });

  const stockHistory = db.prepare(`
    SELECT st.*, p.name as product_name, p.unit
    FROM stock_transactions st
    LEFT JOIN products p ON st.product_id = p.id
    WHERE st.client_id = ?
    ORDER BY st.id DESC
  `).all(clientId);

  return {
    client,
    invoices,
    stats: {
      totalBilled,
      outstanding,
      invoiceCount: invoices.length,
      paidCount
    },
    stockHistory
  };
}

function getFinancialReportData(filters = {}) {
  let dateFrom = '';
  let dateTo = '';
  const now = new Date();
  const yearStr = String(filters.year || now.getFullYear());

  if (filters.period === 'month') {
    const m = String(filters.month || (now.getMonth() + 1)).padStart(2, '0');
    dateFrom = `${yearStr}-${m}-01`;
    const lastDay = new Date(Number(yearStr), Number(m), 0).getDate();
    dateTo = `${yearStr}-${m}-${String(lastDay).padStart(2, '0')}`;
  } else if (filters.period === 'year') {
    dateFrom = `${yearStr}-01-01`;
    dateTo = `${yearStr}-12-31`;
  } else if (filters.period === 'custom') {
    dateFrom = filters.date_from || '1970-01-01';
    dateTo = filters.date_to || '2099-12-31';
  } else {
    // All time
    dateFrom = '1970-01-01';
    dateTo = '2099-12-31';
  }

  const query = `
    SELECT i.*, c.name AS client_name, c.company_name AS client_company, c.email AS client_email, c.phone AS client_phone, c.gstin AS client_gstin
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.invoice_date >= ? AND i.invoice_date <= ?
    ORDER BY i.invoice_date DESC
  `;
  const invoices = db.prepare(query).all(dateFrom, dateTo);

  let totalBilled = 0;
  let subtotalSum = 0;
  let discountSum = 0;
  let taxSum = 0;
  let paidAmount = 0;
  let outstandingAmount = 0;
  let totalInvoicesCount = 0;
  let draftInvoicesCount = 0;

  const taxBreakdownMap = {};
  const clientSummaryMap = {};

  invoices.forEach(inv => {
    if (inv.status === 'draft') {
      draftInvoicesCount++;
      return;
    }
    totalInvoicesCount++;
    const grand = Number(inv.grand_total) || 0;
    const sub = Number(inv.subtotal) || 0;
    const disc = Number(inv.discount_amount) || 0;
    const tax = Number(inv.tax_amount) || 0;

    totalBilled += grand;
    subtotalSum += sub;
    discountSum += disc;
    taxSum += tax;

    if (inv.status === 'paid') paidAmount += grand;
    else if (inv.status === 'unpaid' || inv.status === 'overdue') {
      outstandingAmount += grand;
    }

    // Parse Tax Lines
    let lines = [];
    try { lines = JSON.parse(inv.tax_lines || '[]'); } catch(e){}
    if (Array.isArray(lines)) {
      lines.forEach(t => {
        const name = String(t.name || 'Tax').trim();
        const amt = Number(t.amount) || 0;
        if (!taxBreakdownMap[name]) taxBreakdownMap[name] = 0;
        taxBreakdownMap[name] += amt;
      });
    }

    // Client Breakdown
    const cId = inv.client_id || 0;
    const cName = inv.client_name || 'Direct Customer';
    if (!clientSummaryMap[cId]) {
      clientSummaryMap[cId] = {
        id: cId,
        name: cName,
        company_name: inv.client_company || '',
        email: inv.client_email || '',
        phone: inv.client_phone || '',
        gstin: inv.client_gstin || '',
        invoiceCount: 0,
        totalBilled: 0,
        outstanding: 0
      };
    }
    clientSummaryMap[cId].invoiceCount++;
    clientSummaryMap[cId].totalBilled += grand;
    if (inv.status === 'unpaid' || inv.status === 'overdue') {
      clientSummaryMap[cId].outstanding += grand;
    }
  });

  const taxBreakdown = Object.keys(taxBreakdownMap).map(k => ({
    name: k,
    amount: taxBreakdownMap[k]
  }));

  const clientSummary = Object.values(clientSummaryMap).sort((a, b) => b.totalBilled - a.totalBilled);

  // Operating Expenses calculation for date range
  const expenseRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM expenses
    WHERE expense_date >= ? AND expense_date <= ?
  `).get(dateFrom, dateTo);
  const totalOperatingExpenses = Number(expenseRow?.total) || 0;

  const expenseCategoryBreakdown = db.prepare(`
    SELECT COALESCE(c.name, 'Uncategorized') as category_name, COALESCE(SUM(e.amount), 0) as total
    FROM expenses e
    LEFT JOIN expense_categories c ON e.category_id = c.id
    WHERE e.expense_date >= ? AND e.expense_date <= ?
    GROUP BY c.name
    ORDER BY total DESC
  `).all(dateFrom, dateTo);

  const purchasesRow = db.prepare(`
    SELECT COALESCE(SUM(grand_total), 0) AS total
    FROM purchases
    WHERE purchase_date >= ? AND purchase_date <= ? AND status IN ('received', 'paid')
  `).get(dateFrom, dateTo);
  const costOfGoodsPurchased = Number(purchasesRow?.total) || 0;

  const grossProfit = totalBilled - costOfGoodsPurchased;
  const netOperatingProfit = grossProfit - totalOperatingExpenses;

  const todayStr = new Date().toISOString().slice(0, 10);
  const unpaidInvoices = db.prepare(`
    SELECT invoice_date, grand_total
    FROM invoices
    WHERE status IN ('sent', 'overdue', 'unpaid')
  `).all();
  const arAging = { current: 0, days30: 0, days60: 0, days90Plus: 0, total: 0 };
  unpaidInvoices.forEach(inv => {
    const diffTime = Math.abs(new Date(todayStr) - new Date(inv.invoice_date));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const amt = Number(inv.grand_total) || 0;
    arAging.total += amt;
    if (diffDays <= 30) arAging.current += amt;
    else if (diffDays <= 60) arAging.days30 += amt;
    else if (diffDays <= 90) arAging.days60 += amt;
    else arAging.days90Plus += amt;
  });

  const unpaidPurchases = db.prepare(`
    SELECT purchase_date, grand_total
    FROM purchases
    WHERE status IN ('pending', 'received', 'unpaid')
  `).all();
  const apAging = { current: 0, days30: 0, days60: 0, days90Plus: 0, total: 0 };
  unpaidPurchases.forEach(pur => {
    const diffTime = Math.abs(new Date(todayStr) - new Date(pur.purchase_date));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const amt = Number(pur.grand_total) || 0;
    apAging.total += amt;
    if (diffDays <= 30) apAging.current += amt;
    else if (diffDays <= 60) apAging.days30 += amt;
    else if (diffDays <= 90) apAging.days60 += amt;
    else apAging.days90Plus += amt;
  });

  return {
    dateFrom,
    dateTo,
    metrics: {
      totalBilled,
      subtotalSum,
      discountSum,
      taxSum,
      paidAmount,
      outstandingAmount,
      totalInvoicesCount,
      draftInvoicesCount,
      costOfGoodsPurchased,
      grossProfit,
      totalOperatingExpenses,
      netOperatingProfit
    },
    taxBreakdown,
    expenseCategoryBreakdown,
    arAging,
    apAging,
    clients: clientSummary,
    invoices
  };
}

// ── Balance Sheet Financial Statement ─────────────────────────────────────────
function getBalanceSheet(asOfDate = null) {
  const dateLimit = asOfDate || new Date().toISOString().slice(0, 10);

  // 1. Accounts Receivable (Unpaid/sent/overdue sales invoices)
  const arRow = db.prepare(`
    SELECT COALESCE(SUM(grand_total), 0) AS total
    FROM invoices
    WHERE invoice_date <= ? AND status IN ('sent', 'overdue', 'unpaid', 'partially_paid')
  `).get(dateLimit);
  const accountsReceivable = Number(arRow?.total) || 0;

  // 2. Inventory Valuation (current_stock * cost_price for all products)
  const products = db.prepare(`SELECT * FROM products`).all();
  let inventoryValuation = 0;
  let retailValuation = 0;
  products.forEach(p => {
    const stock = Number(p.current_stock) || 0;
    const cost = Number(p.cost_price) || 0;
    const rate = Number(p.selling_rate) || 0;
    if (stock > 0) {
      inventoryValuation += stock * cost;
      retailValuation += stock * rate;
    }
  });

  // 3. Paid Revenue vs Paid Purchases (Cash / Bank equivalent)
  const cashInRow = db.prepare(`
    SELECT COALESCE(SUM(grand_total), 0) AS total
    FROM invoices
    WHERE invoice_date <= ? AND status = 'paid'
  `).get(dateLimit);
  const cashIn = Number(cashInRow?.total) || 0;

  const cashOutRow = db.prepare(`
    SELECT COALESCE(SUM(grand_total), 0) AS total
    FROM purchases
    WHERE purchase_date <= ? AND status = 'paid'
  `).get(dateLimit);
  const cashOut = Number(cashOutRow?.total) || 0;

  const cashAndBank = cashIn - cashOut;

  // Total Assets
  const totalAssets = accountsReceivable + inventoryValuation + (cashAndBank > 0 ? cashAndBank : 0);

  // 4. Accounts Payable (Unpaid/received/pending purchase orders)
  const apRow = db.prepare(`
    SELECT COALESCE(SUM(grand_total), 0) AS total
    FROM purchases
    WHERE purchase_date <= ? AND status IN ('received', 'pending', 'unpaid')
  `).get(dateLimit);
  const accountsPayable = Number(apRow?.total) || 0;

  // 5. Tax Payable (GST Output Tax collected minus Input Tax Credit)
  const outputTaxRow = db.prepare(`
    SELECT COALESCE(SUM(tax_amount), 0) AS total
    FROM invoices
    WHERE invoice_date <= ? AND status IN ('paid', 'sent', 'overdue')
  `).get(dateLimit);
  const outputTax = Number(outputTaxRow?.total) || 0;

  const inputTaxRow = db.prepare(`
    SELECT COALESCE(SUM(tax_amount), 0) AS total
    FROM purchases
    WHERE purchase_date <= ? AND status IN ('paid', 'received')
  `).get(dateLimit);
  const inputTax = Number(inputTaxRow?.total) || 0;

  const taxPayable = Math.max(0, outputTax - inputTax);

  // Total Liabilities
  const totalLiabilities = accountsPayable + taxPayable + (cashAndBank < 0 ? Math.abs(cashAndBank) : 0);

  // Net Equity / Owner's Funds
  const netEquity = totalAssets - totalLiabilities;

  return {
    asOfDate: dateLimit,
    assets: {
      accountsReceivable,
      inventoryValuation,
      retailValuation,
      cashAndBank,
      totalAssets
    },
    liabilities: {
      accountsPayable,
      taxPayable,
      outputTax,
      inputTax,
      totalLiabilities
    },
    equity: {
      netEquity
    }
  };
}

// ── Monthly Stock Valuation & Movements Report ────────────────────────────────
function getMonthlyStockReport(filters = {}) {
  const products = db.prepare(`SELECT * FROM products ORDER BY name COLLATE NOCASE`).all();
  let totalCostValuation = 0;
  let totalRetailValuation = 0;
  let totalPhysicalUnits = 0;

  const reportItems = products.map(p => {
    const stock = Number(p.current_stock) || 0;
    const cost = Number(p.cost_price) || 0;
    const selling = Number(p.selling_rate) || 0;
    const costValue = stock * cost;
    const retailValue = stock * selling;

    totalCostValuation += costValue;
    totalRetailValuation += retailValue;
    totalPhysicalUnits += stock;

    const txInRow = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total
      FROM stock_transactions
      WHERE product_id = ? AND type = 'IN' AND reversed = 0
    `).get(p.id);

    const txOutRow = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total
      FROM stock_transactions
      WHERE product_id = ? AND type = 'OUT' AND reversed = 0
    `).get(p.id);

    return {
      ...p,
      stock,
      cost,
      selling,
      costValue,
      retailValue,
      totalIn: Number(txInRow?.total) || 0,
      totalOut: Number(txOutRow?.total) || 0
    };
  });

  return {
    items: reportItems,
    summary: {
      totalProducts: products.length,
      totalPhysicalUnits,
      totalCostValuation,
      totalRetailValuation,
      unrealizedMargin: totalRetailValuation - totalCostValuation
    }
  };
}

function _csvEsc(str) {
  return String(str || '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
}

function generateFinancialCsv(filters = {}, type = 'invoices') {
  const reports = getFinancialReportData(filters);
  let csv = '';

  if (type === 'tax') {
    csv = 'Invoice Number,Invoice Date,Client Name,Client GSTIN,Subtotal,Tax Amount,Grand Total,Status\n';
    reports.invoices.forEach(inv => {
      csv += `"${_csvEsc(inv.invoice_number)}","${_csvEsc(inv.invoice_date)}","${_csvEsc(inv.client_name)}","${_csvEsc(inv.client_gstin)}",${inv.subtotal},${inv.tax_amount},${inv.grand_total},"${inv.status}"\n`;
    });
  } else if (type === 'clients') {
    csv = 'Client Name,Company Name,Email,Phone,GSTIN,Total Invoices,Total Billed,Outstanding Balance\n';
    reports.clients.forEach(c => {
      csv += `"${_csvEsc(c.name)}","${_csvEsc(c.company_name)}","${_csvEsc(c.email)}","${_csvEsc(c.phone)}","${_csvEsc(c.gstin)}",${c.invoiceCount},${c.totalBilled},${c.outstanding}\n`;
    });
  } else if (type === 'products') {
    csv = 'Product Name,SKU,Unit,Cost Price,Selling Rate,Current Stock,Reorder Level\n';
    const products = getAllProducts();
    products.forEach(p => {
      csv += `"${_csvEsc(p.name)}","${_csvEsc(p.sku)}","${_csvEsc(p.unit)}",${p.cost_price},${p.selling_rate},${p.current_stock},${p.reorder_level}\n`;
    });
  } else {
    // Default Invoices Ledger
    csv = 'Invoice Number,Invoice Date,Due Date,Client Name,Subtotal,Discount Amount,Tax Amount,Grand Total,Status,Notes\n';
    reports.invoices.forEach(inv => {
      csv += `"${_csvEsc(inv.invoice_number)}","${_csvEsc(inv.invoice_date)}","${_csvEsc(inv.due_date)}","${_csvEsc(inv.client_name)}",${inv.subtotal},${inv.discount_amount},${inv.tax_amount},${inv.grand_total},"${inv.status}","${_csvEsc(inv.notes)}"\n`;
    });
  }

  return csv;
}

function createDatabaseBackupZip(destinationPath) {
  const fs = require('fs');
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();

  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}

  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) throw new Error('Database file not found');

  const settings = getSettings();
  const clientCount = db.prepare('SELECT COUNT(*) AS cnt FROM clients').get().cnt;
  const invoiceCount = db.prepare('SELECT COUNT(*) AS cnt FROM invoices').get().cnt;
  const productCount = db.prepare('SELECT COUNT(*) AS cnt FROM products').get().cnt;

  const manifest = {
    appName: 'InvoiceForge',
    appVersion: (app && typeof app.getVersion === 'function') ? app.getVersion() : '1.0.6',
    backupDate: new Date().toISOString(),
    stats: { clientCount, invoiceCount, productCount },
    companyName: settings ? settings.company_name : ''
  };

  zip.addLocalFile(dbPath, '', 'invoiceforge.db');
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));

  zip.writeZip(destinationPath);
  return { success: true, filePath: destinationPath, manifest };
}

function restoreDatabaseFromZip(zipPathOrBuffer) {
  const fs = require('fs');
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(zipPathOrBuffer);

  const dbEntry = zip.getEntry('invoiceforge.db');
  if (!dbEntry) {
    throw new Error('Invalid backup file: missing invoiceforge.db inside archive');
  }

  const os = require('os');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoiceforge_restore_'));
  const tempDbPath = path.join(tempDir, 'invoiceforge.db');

  fs.writeFileSync(tempDbPath, dbEntry.getData());

  const TempDb = require('better-sqlite3');
  let testDb;
  let manifest = {};
  try {
    const manifestEntry = zip.getEntry('manifest.json');
    if (manifestEntry) {
      manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
    }
    testDb = new TempDb(tempDbPath, { readonly: true });
    const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => t.name);
    const required = ['settings', 'clients', 'invoices', 'products'];
    const missing = required.filter(r => !tableNames.includes(r));
    if (missing.length > 0) {
      throw new Error(`Backup file is missing required tables: ${missing.join(', ')}`);
    }
  } catch (err) {
    if (testDb) try { testDb.close(); } catch(e){}
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch(e){}
    throw new Error('Database validation failed: ' + err.message);
  } finally {
    if (testDb) try { testDb.close(); } catch(e){}
  }

  closeDatabase();

  const activeDbPath = getDbPath();
  const backupOriginalPath = activeDbPath + '.bak_' + Date.now();

  try {
    if (fs.existsSync(activeDbPath)) {
      fs.copyFileSync(activeDbPath, backupOriginalPath);
    }

    fs.copyFileSync(tempDbPath, activeDbPath);

    if (fs.existsSync(activeDbPath + '-wal')) fs.unlinkSync(activeDbPath + '-wal');
    if (fs.existsSync(activeDbPath + '-shm')) fs.unlinkSync(activeDbPath + '-shm');

    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch(e){}

    initDatabase();

    return {
      success: true,
      message: 'Database backup restored successfully!',
      manifest
    };
  } catch (err) {
    if (fs.existsSync(backupOriginalPath)) {
      try { fs.copyFileSync(backupOriginalPath, activeDbPath); } catch(e){}
    }
    initDatabase();
    throw new Error('Database restore failed: ' + err.message);
  }
}

function exportMonthlyDataPackage(filters = {}, destinationPath) {
  const fs = require('fs');
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();

  const report = getFinancialReportData(filters);
  const periodLabel = filters.period === 'month'
    ? `${filters.year || new Date().getFullYear()}-${filters.month || String(new Date().getMonth() + 1).padStart(2, '0')}`
    : (filters.period || 'all');

  const fullInvoices = report.invoices.map(inv => getInvoice(inv.id)).filter(Boolean);

  const clientIds = [...new Set(fullInvoices.map(i => i.client_id).filter(Boolean))];
  const fullClients = clientIds.map(id => getClient(id)).filter(Boolean);

  const stockTransactions = db.prepare(`
    SELECT * FROM stock_transactions
    WHERE created_at >= ? AND created_at <= ?
  `).all(report.dateFrom + ' 00:00:00', report.dateTo + ' 23:59:59');

  const settings = getSettings();

  const manifest = {
    appName: 'InvoiceForge',
    appVersion: (app && typeof app.getVersion === 'function') ? app.getVersion() : '1.0.6',
    packageType: 'MONTHLY_DATA_PACKAGE',
    exportDate: new Date().toISOString(),
    periodLabel,
    dateFrom: report.dateFrom,
    dateTo: report.dateTo,
    companyName: settings ? settings.company_name : '',
    stats: {
      invoicesCount: fullInvoices.length,
      clientsCount: fullClients.length,
      stockTxCount: stockTransactions.length,
      totalBilled: report.metrics.totalBilled
    }
  };

  const payload = {
    manifest,
    invoices: fullInvoices,
    clients: fullClients,
    stockTransactions
  };

  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));
  zip.addFile('data.json', Buffer.from(JSON.stringify(payload, null, 2)));

  zip.writeZip(destinationPath);
  return { success: true, filePath: destinationPath, manifest };
}

function importMonthlyDataPackage(packagePathOrBuffer) {
  const fs = require('fs');
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(packagePathOrBuffer);

  const dbEntry = zip.getEntry('invoiceforge.db');
  if (dbEntry) {
    return restoreDatabaseFromZip(packagePathOrBuffer);
  }

  const dataEntry = zip.getEntry('data.json');
  if (!dataEntry) {
    throw new Error('Invalid package file: missing data.json inside archive');
  }

  let payload;
  try {
    payload = JSON.parse(dataEntry.getData().toString('utf8'));
  } catch (e) {
    throw new Error('Corrupted data package: failed to parse JSON data');
  }

  const manifest = payload.manifest || {};
  const importedClients = Array.isArray(payload.clients) ? payload.clients : [];
  const importedInvoices = Array.isArray(payload.invoices) ? payload.invoices : [];

  const clientMap = {};

  const mergeTransaction = db.transaction(() => {
    // 1. Merge Clients
    importedClients.forEach(c => {
      let localClient = null;
      if (c.gstin && c.gstin.trim()) {
        localClient = db.prepare('SELECT * FROM clients WHERE LOWER(gstin) = LOWER(?)').get(c.gstin.trim());
      }
      if (!localClient && c.name && c.name.trim()) {
        localClient = db.prepare('SELECT * FROM clients WHERE LOWER(name) = LOWER(?)').get(c.name.trim());
      }

      if (localClient) {
        const updatedRow = {
          id: localClient.id,
          name: localClient.name,
          company_name: localClient.company_name || c.company_name || '',
          billing_address: localClient.billing_address || c.billing_address || '',
          email: localClient.email || c.email || '',
          phone: localClient.phone || c.phone || '',
          gstin: localClient.gstin || c.gstin || ''
        };
        db.prepare(`
          UPDATE clients SET company_name=@company_name, billing_address=@billing_address,
            email=@email, phone=@phone, gstin=@gstin WHERE id=@id
        `).run(updatedRow);
        clientMap[c.id] = localClient.id;
      } else {
        const res = db.prepare(`
          INSERT INTO clients (name, company_name, billing_address, email, phone, gstin)
          VALUES (@name, @company_name, @billing_address, @email, @phone, @gstin)
        `).run({
          name: String(c.name || 'Client').trim(),
          company_name: String(c.company_name || '').trim(),
          billing_address: String(c.billing_address || '').trim(),
          email: String(c.email || '').trim(),
          phone: String(c.phone || '').trim(),
          gstin: String(c.gstin || '').trim()
        });
        clientMap[c.id] = Number(res.lastInsertRowid);
      }
    });

    // 2. Merge Invoices
    let insertedInvoicesCount = 0;
    let updatedInvoicesCount = 0;

    importedInvoices.forEach(inv => {
      const targetClientId = inv.client_id ? (clientMap[inv.client_id] || inv.client_id) : null;
      const invData = {
        invoice_number:  String(inv.invoice_number || '').trim(),
        client_id:       targetClientId,
        client_snapshot: typeof inv.client_snapshot === 'string' ? inv.client_snapshot : JSON.stringify(inv.client_snapshot || {}),
        invoice_date:    inv.invoice_date || new Date().toISOString().slice(0, 10),
        due_date:        inv.due_date || '',
        currency:        inv.currency || 'INR',
        subtotal:        Number(inv.subtotal) || 0,
        discount_type:   inv.discount_type || 'flat',
        discount_value:  Number(inv.discount_value) || 0,
        discount_amount: Number(inv.discount_amount) || 0,
        tax_lines:       typeof inv.tax_lines === 'string' ? inv.tax_lines : JSON.stringify(inv.tax_lines || []),
        tax_amount:      Number(inv.tax_amount) || 0,
        grand_total:     Number(inv.grand_total) || 0,
        notes:           String(inv.notes || '').trim(),
        status:          inv.status || 'draft'
      };

      const existingInv = db.prepare('SELECT id FROM invoices WHERE invoice_number = ?').get(invData.invoice_number);
      let localInvId;

      if (existingInv) {
        localInvId = existingInv.id;
        invData.id = localInvId;
        invData.updated_at = new Date().toISOString();
        db.prepare(`
          UPDATE invoices SET client_id=@client_id, client_snapshot=@client_snapshot,
            invoice_date=@invoice_date, due_date=@due_date, currency=@currency,
            subtotal=@subtotal, discount_type=@discount_type, discount_value=@discount_value,
            discount_amount=@discount_amount, tax_lines=@tax_lines, tax_amount=@tax_amount,
            grand_total=@grand_total, notes=@notes, status=@status, updated_at=@updated_at
          WHERE id=@id
        `).run(invData);
        updatedInvoicesCount++;
      } else {
        const res = db.prepare(`
          INSERT INTO invoices (invoice_number, client_id, client_snapshot, invoice_date, due_date, currency,
            subtotal, discount_type, discount_value, discount_amount, tax_lines, tax_amount,
            grand_total, notes, status)
          VALUES (@invoice_number, @client_id, @client_snapshot, @invoice_date, @due_date, @currency,
            @subtotal, @discount_type, @discount_value, @discount_amount, @tax_lines,
            @tax_amount, @grand_total, @notes, @status)
        `).run(invData);
        localInvId = Number(res.lastInsertRowid);
        insertedInvoicesCount++;
      }

      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(localInvId);
      const itemStmt = db.prepare(`
        INSERT INTO invoice_items (invoice_id, product_id, description, quantity, rate, amount, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      (inv.items || []).forEach((item, i) => {
        itemStmt.run(
          localInvId,
          Number(item.product_id) || 0,
          String(item.description || ''),
          Number(item.quantity) || 1,
          Number(item.rate) || 0,
          Number(item.amount) || 0,
          i
        );
      });
    });

    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}

    return {
      insertedInvoicesCount,
      updatedInvoicesCount,
      totalMergedInvoices: importedInvoices.length,
      clientsMergedCount: Object.keys(clientMap).length
    };
  });

  const summary = mergeTransaction();

  return {
    success: true,
    packageType: 'MONTHLY_DATA_PACKAGE',
    message: `Successfully merged data package for ${manifest.periodLabel || 'selected period'}!`,
    summary,
    manifest
  };
}

// ── Vendors ───────────────────────────────────────────────────────────────────
function getAllVendors() {
  const rows = db.prepare('SELECT * FROM vendors ORDER BY name COLLATE NOCASE').all();
  return rows.map(r => ({ ...r, id: Number(r.id) }));
}

function getVendor(id) {
  if (!id) return null;
  const row = db.prepare('SELECT * FROM vendors WHERE id = ?').get(Number(id));
  return row ? { ...row, id: Number(row.id) } : null;
}

function saveVendor(data) {
  const row = {
    name: String(data.name || '').trim(),
    company_name: String(data.company_name || '').trim(),
    address: String(data.address || data.billing_address || '').trim(),
    email: String(data.email || '').trim(),
    phone: String(data.phone || '').trim(),
    gstin: String(data.gstin || '').trim()
  };
  if (!row.name) throw new Error('Vendor name is required');
  let savedVendor;
  if (data.id) {
    const id = Number(data.id);
    db.prepare(`
      UPDATE vendors SET name=@name, company_name=@company_name,
        address=@address, email=@email, phone=@phone, gstin=@gstin
      WHERE id=@id
    `).run({ ...row, id });
    savedVendor = getVendor(id);
  } else {
    const result = db.prepare(`
      INSERT INTO vendors (name, company_name, address, email, phone, gstin)
      VALUES (@name, @company_name, @address, @email, @phone, @gstin)
    `).run(row);
    const newId = Number(result.lastInsertRowid);
    savedVendor = getVendor(newId);
  }
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return savedVendor;
}

function deleteVendor(id) {
  const numId = Number(id);
  if (!numId) return false;
  db.prepare('DELETE FROM vendors WHERE id = ?').run(numId);
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return true;
}

function getVendorFullProfile(vendorId) {
  const vendor = getVendor(vendorId);
  if (!vendor) return null;

  const purchases = db.prepare(`
    SELECT id, purchase_number, purchase_date, due_date, currency, grand_total, status, notes
    FROM purchases
    WHERE vendor_id = ?
    ORDER BY id DESC
  `).all(vendorId);

  let totalPurchased = 0;
  let outstandingPayable = 0;
  let paidCount = 0;

  purchases.forEach(p => {
    const total = Number(p.grand_total) || 0;
    totalPurchased += total;
    if (p.status === 'paid') paidCount++;
    else if (p.status === 'received' || p.status === 'pending') {
      outstandingPayable += total;
    }
  });

  return {
    vendor,
    purchases,
    stats: {
      totalPurchased,
      outstandingPayable,
      purchaseCount: purchases.length,
      paidCount
    }
  };
}

// ── Purchases & Purchase Orders ──────────────────────────────────────────────
function getAllPurchases(filters) {
  let query = `
    SELECT p.*, v.name AS vendor_name, v.company_name AS vendor_company
    FROM purchases p LEFT JOIN vendors v ON p.vendor_id = v.id
  `;
  const params = [];
  const where = [];

  if (filters) {
    if (filters.status) { where.push("p.status = ?"); params.push(filters.status); }
    if (filters.vendor_id) { where.push("p.vendor_id = ?"); params.push(filters.vendor_id); }
    if (filters.date_from) { where.push("p.purchase_date >= ?"); params.push(filters.date_from); }
    if (filters.date_to) { where.push("p.purchase_date <= ?"); params.push(filters.date_to); }
    if (filters.currency) { where.push("p.currency = ?"); params.push(filters.currency); }
  }
  if (where.length) query += ' WHERE ' + where.join(' AND ');
  query += ' ORDER BY p.created_at DESC';

  return db.prepare(query).all(...params);
}

function getPurchase(id) {
  const p = db.prepare(`
    SELECT p.*, v.name AS vendor_name, v.company_name AS vendor_company,
           v.address AS vendor_address, v.email AS vendor_email,
           v.phone AS vendor_phone, v.gstin AS vendor_gstin
    FROM purchases p LEFT JOIN vendors v ON p.vendor_id = v.id
    WHERE p.id = ?
  `).get(Number(id));
  if (p) {
    p.items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY sort_order').all(Number(id));
    try { p.tax_lines = JSON.parse(p.tax_lines || '[]'); } catch { p.tax_lines = []; }
    try { p.vendor_snapshot = JSON.parse(p.vendor_snapshot || '{}'); } catch { p.vendor_snapshot = {}; }
  }
  return p;
}

function getNextPurchaseNumberObj() {
  const s = getSettings();
  const counter = s.purchase_counter || 1;
  const num = String(counter).padStart(3, '0');
  const prefix = s.purchase_prefix || 'PUR-2026-';
  const purchaseNumber = `${prefix}${num}`;
  return { purchaseNumber, nextCounter: counter };
}

function addStockForPurchase(purchaseId, items = null, vendorId = 0) {
  if (!items || !items.length) {
    const p = getPurchase(purchaseId);
    if (!p) return;
    items = p.items || [];
    vendorId = vendorId || p.vendor_id || 0;
  }
  if (!items || !items.length) return;

  items.forEach(item => {
    let p = null;
    if (item.product_id) {
      p = getProduct(item.product_id);
    }
    if (!p && item.description && typeof item.description === 'string' && item.description.trim()) {
      p = db.prepare(`SELECT * FROM products WHERE LOWER(name) = LOWER(?)`).get(item.description.trim());
    }
    if (p) {
      const qty = Math.abs(Number(item.quantity)) || 1;
      const cost = Number(item.cost_price) || 0;

      recordStockTransaction({
        product_id: p.id,
        type: 'IN',
        quantity: qty,
        reference_type: 'PURCHASE',
        reference_id: purchaseId,
        client_id: 0,
        notes: `Purchase Restock for Order #${purchaseId}`
      });

      if (cost > 0) {
        db.prepare('UPDATE products SET cost_price = ? WHERE id = ?').run(cost, p.id);
      }
    }
  });
}

function restoreStockForPurchase(purchaseId) {
  try {
    const txs = db.prepare(`SELECT * FROM stock_transactions WHERE reference_type = 'PURCHASE' AND reference_id = ? AND type = 'IN' AND (reversed = 0 OR reversed IS NULL)`).all(purchaseId);
    txs.forEach(tx => {
      recordStockTransaction({
        product_id: tx.product_id,
        type: 'OUT',
        quantity: tx.quantity,
        reference_type: 'PURCHASE_CANCEL',
        reference_id: purchaseId,
        client_id: 0,
        notes: `Reverted stock from cancelled/deleted Purchase #${purchaseId}`
      });
      try {
        db.prepare('UPDATE stock_transactions SET reversed = 1 WHERE id = ?').run(tx.id);
      } catch (e) {}
    });
  } catch (err) {
    try {
      const txs = db.prepare(`SELECT * FROM stock_transactions WHERE reference_type = 'PURCHASE' AND reference_id = ? AND type = 'IN'`).all(purchaseId);
      txs.forEach(tx => {
        recordStockTransaction({
          product_id: tx.product_id,
          type: 'OUT',
          quantity: tx.quantity,
          reference_type: 'PURCHASE_CANCEL',
          reference_id: purchaseId,
          client_id: 0,
          notes: `Reverted stock from cancelled/deleted Purchase #${purchaseId}`
        });
      });
    } catch (e) {}
  }
}

function savePurchase(data) {
  const items = data.items || [];
  const pur = {
    id:              data.id ? Number(data.id) : null,
    purchase_number: String(data.purchase_number || '').trim(),
    vendor_id:       data.vendor_id ? Number(data.vendor_id) : null,
    purchase_date:   data.purchase_date || new Date().toISOString().slice(0, 10),
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
    status:          data.status || 'received'
  };

  const vendor = pur.vendor_id ? getVendor(pur.vendor_id) : null;
  if (vendor) {
    pur.vendor_snapshot = JSON.stringify({
      name: vendor.name,
      company_name: vendor.company_name,
      address: vendor.address,
      email: vendor.email,
      phone: vendor.phone,
      gstin: vendor.gstin
    });
  } else if (pur.id) {
    pur.vendor_snapshot = db.prepare('SELECT vendor_snapshot FROM purchases WHERE id = ?').get(pur.id)?.vendor_snapshot || '{}';
  } else {
    pur.vendor_snapshot = '{}';
  }

  const saveItems = db.transaction((purchaseId, rows) => {
    db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(purchaseId);
    const stmt = db.prepare(`
      INSERT INTO purchase_items (purchase_id, product_id, description, unit, quantity, cost_price, amount, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.forEach((item, i) => stmt.run(
      purchaseId,
      Number(item.product_id) || 0,
      item.description || '',
      item.unit || 'Pcs',
      item.quantity || 1,
      item.cost_price || item.rate || 0,
      item.amount || 0,
      i
    ));
  });

  let savedId;
  let oldStatus = null;
  if (pur.id) {
    oldStatus = db.prepare('SELECT status FROM purchases WHERE id = ?').get(pur.id)?.status;
    pur.updated_at = new Date().toISOString();
    db.prepare(`
      UPDATE purchases SET purchase_number=@purchase_number, vendor_id=@vendor_id, vendor_snapshot=@vendor_snapshot,
        purchase_date=@purchase_date, due_date=@due_date, currency=@currency,
        subtotal=@subtotal, discount_type=@discount_type, discount_value=@discount_value,
        discount_amount=@discount_amount, tax_lines=@tax_lines, tax_amount=@tax_amount,
        grand_total=@grand_total, notes=@notes, status=@status, updated_at=@updated_at
      WHERE id=@id
    `).run(pur);
    saveItems(pur.id, items);
    savedId = pur.id;

    const isNowReceived = pur.status === 'received' || pur.status === 'paid';
    const wasReceived = oldStatus === 'received' || oldStatus === 'paid';
    if (isNowReceived && !wasReceived) {
      addStockForPurchase(savedId, items, pur.vendor_id);
    } else if (!isNowReceived && wasReceived) {
      restoreStockForPurchase(savedId);
    }
  } else {
    delete pur.id;
    const result = db.prepare(`
      INSERT INTO purchases (purchase_number, vendor_id, vendor_snapshot, purchase_date, due_date, currency,
        subtotal, discount_type, discount_value, discount_amount, tax_lines, tax_amount,
        grand_total, notes, status)
      VALUES (@purchase_number, @vendor_id, @vendor_snapshot, @purchase_date, @due_date, @currency,
        @subtotal, @discount_type, @discount_value, @discount_amount, @tax_lines,
        @tax_amount, @grand_total, @notes, @status)
    `).run(pur);
    savedId = Number(result.lastInsertRowid);
    saveItems(savedId, items);

    const s = getSettings();
    const currCounter = s.purchase_counter || 1;
    db.prepare('UPDATE settings SET purchase_counter = ? WHERE id = 1').run(currCounter + 1);

    if (pur.status === 'received' || pur.status === 'paid') {
      addStockForPurchase(savedId, items, pur.vendor_id);
    }
  }

  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return getPurchase(savedId);
}

function deletePurchase(id) {
  const pId = Number(id);
  if (!pId) return false;
  restoreStockForPurchase(pId);
  db.prepare('DELETE FROM purchases WHERE id = ?').run(pId);
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return true;
}

function updatePurchaseStatus(id, newStatus) {
  const pId = Number(id);
  const p = getPurchase(pId);
  if (!p) return false;

  const oldStatus = p.status;
  db.prepare('UPDATE purchases SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, new Date().toISOString(), pId);

  const isNowReceived = newStatus === 'received' || newStatus === 'paid';
  const wasReceived = oldStatus === 'received' || oldStatus === 'paid';

  if (isNowReceived && !wasReceived) {
    addStockForPurchase(pId, p.items, p.vendor_id);
  } else if (!isNowReceived && wasReceived) {
    restoreStockForPurchase(pId);
  }

  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return true;
}

// ── Expense Management CRUD ───────────────────────────────────────────────────
function getAllExpenseCategories() {
  return db.prepare('SELECT * FROM expense_categories ORDER BY name ASC').all();
}

function saveExpenseCategory(data) {
  const name = String(data.name || '').trim();
  if (!name) throw new Error('Category name required');
  const desc = String(data.description || '').trim();
  if (data.id) {
    db.prepare('UPDATE expense_categories SET name = ?, description = ? WHERE id = ?').run(name, desc, Number(data.id));
  } else {
    db.prepare('INSERT OR IGNORE INTO expense_categories (name, description) VALUES (?, ?)').run(name, desc);
  }
  return getAllExpenseCategories();
}

function deleteExpenseCategory(id) {
  const catId = Number(id);
  if (!catId) return false;
  db.prepare('DELETE FROM expense_categories WHERE id = ?').run(catId);
  return true;
}

function getAllExpenses(filters = {}) {
  let sql = `
    SELECT e.*, c.name as category_name
    FROM expenses e
    LEFT JOIN expense_categories c ON e.category_id = c.id
    WHERE 1=1
  `;
  const params = [];
  if (filters.search) {
    sql += ` AND (e.title LIKE ? OR e.notes LIKE ? OR c.name LIKE ?)`;
    const s = `%${filters.search}%`;
    params.push(s, s, s);
  }
  if (filters.category_id) {
    sql += ` AND e.category_id = ?`;
    params.push(Number(filters.category_id));
  }
  if (filters.dateFrom) {
    sql += ` AND e.expense_date >= ?`;
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    sql += ` AND e.expense_date <= ?`;
    params.push(filters.dateTo);
  }
  sql += ` ORDER BY e.expense_date DESC, e.id DESC`;
  return db.prepare(sql).all(...params);
}

function getExpense(id) {
  const eId = Number(id);
  if (!eId) return null;
  return db.prepare(`
    SELECT e.*, c.name as category_name
    FROM expenses e
    LEFT JOIN expense_categories c ON e.category_id = c.id
    WHERE e.id = ?
  `).get(eId);
}

function saveExpense(data) {
  const title = String(data.title || '').trim();
  if (!title) throw new Error('Expense title is required');
  const amount = Number(data.amount) || 0;
  const category_id = Number(data.category_id) || null;
  const payment_method = String(data.payment_method || 'Cash').trim();
  const expense_date = data.expense_date || new Date().toISOString().slice(0, 10);
  const notes = String(data.notes || '').trim();
  const receipt_path = String(data.receipt_path || '').trim();

  let savedId;
  if (data.id) {
    savedId = Number(data.id);
    db.prepare(`
      UPDATE expenses
      SET category_id = ?, title = ?, amount = ?, payment_method = ?, expense_date = ?, receipt_path = ?, notes = ?
      WHERE id = ?
    `).run(category_id, title, amount, payment_method, expense_date, receipt_path, notes, savedId);
  } else {
    const res = db.prepare(`
      INSERT INTO expenses (category_id, title, amount, payment_method, expense_date, receipt_path, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(category_id, title, amount, payment_method, expense_date, receipt_path, notes);
    savedId = Number(res.lastInsertRowid);
  }
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return getExpense(savedId);
}

function deleteExpense(id) {
  const eId = Number(id);
  if (!eId) return false;
  db.prepare('DELETE FROM expenses WHERE id = ?').run(eId);
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return true;
}

// ── Quotation Management CRUD ─────────────────────────────────────────────────
function getNextQuotationNumberObj() {
  const s = getSettings();
  const prefix = s.quotation_prefix || 'QTN-2026-';
  const counter = s.quotation_counter || 1;
  const numStr = String(counter).padStart(3, '0');
  return { prefix, counter, formatted: `${prefix}${numStr}` };
}

function getAllQuotations(filters = {}) {
  let sql = `
    SELECT q.*, c.name as client_name, c.company_name as client_company
    FROM quotations q
    LEFT JOIN clients c ON q.client_id = c.id
    WHERE 1=1
  `;
  const params = [];
  if (filters.search) {
    sql += ` AND (q.quotation_number LIKE ? OR c.name LIKE ? OR q.notes LIKE ?)`;
    const s = `%${filters.search}%`;
    params.push(s, s, s);
  }
  if (filters.status) {
    sql += ` AND q.status = ?`;
    params.push(filters.status);
  }
  if (filters.client_id) {
    sql += ` AND q.client_id = ?`;
    params.push(Number(filters.client_id));
  }
  sql += ` ORDER BY q.id DESC`;
  return db.prepare(sql).all(...params);
}

function getQuotation(id) {
  const qId = Number(id);
  if (!qId) return null;
  const q = db.prepare(`
    SELECT q.*, c.name as client_name, c.company_name as client_company, c.email as client_email, c.phone as client_phone, c.gstin as client_gstin
    FROM quotations q
    LEFT JOIN clients c ON q.client_id = c.id
    WHERE q.id = ?
  `).get(qId);
  if (!q) return null;

  const items = db.prepare(`SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order ASC, id ASC`).all(qId);
  q.items = items;
  return q;
}

function saveQuotationAndReturn(data) {
  const items = Array.isArray(data.items) ? data.items : [];
  let validClientId = null;
  if (data.client_id) {
    const c = getClient(Number(data.client_id));
    if (c) validClientId = c.id;
  }

  const qData = {
    id: data.id ? Number(data.id) : undefined,
    quotation_number: String(data.quotation_number || '').trim(),
    client_id: validClientId,
    client_snapshot: typeof data.client_snapshot === 'string' ? data.client_snapshot : JSON.stringify(data.client_snapshot || {}),
    quotation_date: data.quotation_date || new Date().toISOString().slice(0, 10),
    valid_until: data.valid_until || '',
    currency: data.currency || 'INR',
    subtotal: Number(data.subtotal) || 0,
    discount_type: data.discount_type || 'flat',
    discount_value: Number(data.discount_value) || 0,
    discount_amount: Number(data.discount_amount) || 0,
    tax_lines: typeof data.tax_lines === 'string' ? data.tax_lines : JSON.stringify(data.tax_lines || []),
    tax_amount: Number(data.tax_amount) || 0,
    grand_total: Number(data.grand_total) || 0,
    notes: String(data.notes || '').trim(),
    status: data.status || 'draft'
  };

  let savedId;
  const saveItems = (quotationId, itemsList) => {
    db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(quotationId);
    const stmt = db.prepare(`
      INSERT INTO quotation_items (quotation_id, product_id, description, unit, quantity, rate, amount, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    itemsList.forEach((item, index) => {
      stmt.run(
        quotationId,
        Number(item.product_id) || 0,
        String(item.description || ''),
        String(item.unit || 'Pcs'),
        Number(item.quantity) || 1,
        Number(item.rate) || 0,
        Number(item.amount) || 0,
        index
      );
    });
  };

  if (qData.id) {
    savedId = qData.id;
    qData.updated_at = new Date().toISOString();
    db.prepare(`
      UPDATE quotations SET
        quotation_number=@quotation_number, client_id=@client_id, client_snapshot=@client_snapshot,
        quotation_date=@quotation_date, valid_until=@valid_until, currency=@currency,
        subtotal=@subtotal, discount_type=@discount_type, discount_value=@discount_value,
        discount_amount=@discount_amount, tax_lines=@tax_lines, tax_amount=@tax_amount,
        grand_total=@grand_total, notes=@notes, status=@status, updated_at=@updated_at
      WHERE id=@id
    `).run(qData);
    saveItems(savedId, items);
  } else {
    delete qData.id;
    const result = db.prepare(`
      INSERT INTO quotations (quotation_number, client_id, client_snapshot, quotation_date, valid_until, currency,
        subtotal, discount_type, discount_value, discount_amount, tax_lines, tax_amount, grand_total, notes, status)
      VALUES (@quotation_number, @client_id, @client_snapshot, @quotation_date, @valid_until, @currency,
        @subtotal, @discount_type, @discount_value, @discount_amount, @tax_lines, @tax_amount, @grand_total, @notes, @status)
    `).run(qData);
    savedId = Number(result.lastInsertRowid);
    saveItems(savedId, items);

    const s = getSettings();
    const currCounter = s.quotation_counter || 1;
    db.prepare('UPDATE settings SET quotation_counter = ? WHERE id = 1').run(currCounter + 1);
  }

  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return getQuotation(savedId);
}

function deleteQuotation(id) {
  const qId = Number(id);
  if (!qId) return false;
  db.prepare('DELETE FROM quotations WHERE id = ?').run(qId);
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return true;
}

function convertQuotationToInvoice(quotationId) {
  const q = getQuotation(quotationId);
  if (!q) throw new Error('Quotation not found');

  const nextInv = getNextInvoiceNumberObj();
  const invoiceData = {
    invoice_number: nextInv.formatted,
    client_id: q.client_id,
    client_snapshot: q.client_snapshot,
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: q.valid_until || '',
    currency: q.currency,
    subtotal: q.subtotal,
    discount_type: q.discount_type,
    discount_value: q.discount_value,
    discount_amount: q.discount_amount,
    tax_lines: q.tax_lines,
    tax_amount: q.tax_amount,
    grand_total: q.grand_total,
    notes: q.notes ? `Converted from Quote #${q.quotation_number}. ${q.notes}` : `Converted from Quote #${q.quotation_number}`,
    status: 'draft',
    items: (q.items || []).map(i => ({
      product_id: i.product_id,
      description: i.description,
      unit: i.unit,
      quantity: i.quantity,
      rate: i.rate,
      amount: i.amount
    }))
  };

  const newInvoice = saveInvoiceAndReturn(invoiceData);
  db.prepare("UPDATE quotations SET status = 'converted', converted_invoice_id = ? WHERE id = ?").run(newInvoice.id, q.id);
  return newInvoice;
}

// ── Payment Register CRUD ─────────────────────────────────────────────────────
function getPaymentRecords(filters = {}) {
  let sql = `
    SELECT p.*,
           c.name as client_name,
           v.name as vendor_name
    FROM payment_records p
    LEFT JOIN clients c ON p.party_id = c.id AND p.party_type = 'client'
    LEFT JOIN vendors v ON p.party_id = v.id AND p.party_type = 'vendor'
    WHERE 1=1
  `;
  const params = [];
  if (filters.search) {
    sql += ` AND (p.reference_no LIKE ? OR p.notes LIKE ? OR c.name LIKE ? OR v.name LIKE ?)`;
    const s = `%${filters.search}%`;
    params.push(s, s, s, s);
  }
  if (filters.type) {
    sql += ` AND p.type = ?`;
    params.push(filters.type);
  }
  if (filters.account_type) {
    sql += ` AND p.account_type = ?`;
    params.push(filters.account_type);
  }
  sql += ` ORDER BY p.payment_date DESC, p.id DESC`;
  return db.prepare(sql).all(...params);
}

function savePaymentRecord(data) {
  const type = String(data.type || 'receipt').trim();
  const account_type = String(data.account_type || 'Cash').trim();
  const party_type = String(data.party_type || 'client').trim();
  const party_id = Number(data.party_id) || 0;
  const invoice_id = Number(data.invoice_id) || 0;
  const purchase_id = Number(data.purchase_id) || 0;
  const amount = Number(data.amount) || 0;
  const payment_date = data.payment_date || new Date().toISOString().slice(0, 10);
  const reference_no = String(data.reference_no || '').trim();
  const notes = String(data.notes || '').trim();

  let savedId;
  if (data.id) {
    savedId = Number(data.id);
    db.prepare(`
      UPDATE payment_records
      SET type=?, account_type=?, party_type=?, party_id=?, invoice_id=?, purchase_id=?, amount=?, payment_date=?, reference_no=?, notes=?
      WHERE id=?
    `).run(type, account_type, party_type, party_id, invoice_id, purchase_id, amount, payment_date, reference_no, notes, savedId);
  } else {
    const res = db.prepare(`
      INSERT INTO payment_records (type, account_type, party_type, party_id, invoice_id, purchase_id, amount, payment_date, reference_no, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(type, account_type, party_type, party_id, invoice_id, purchase_id, amount, payment_date, reference_no, notes);
    savedId = Number(res.lastInsertRowid);
  }

  if (invoice_id && type === 'receipt') {
    const totalPaidRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payment_records WHERE invoice_id = ? AND type = 'receipt'").get(invoice_id);
    const invoice = getInvoice(invoice_id);
    if (invoice && totalPaidRow && totalPaidRow.total >= invoice.grand_total) {
      db.prepare("UPDATE invoices SET status = 'paid' WHERE id = ?").run(invoice_id);
    }
  }

  if (purchase_id && type === 'payment') {
    const totalPaidRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payment_records WHERE purchase_id = ? AND type = 'payment'").get(purchase_id);
    const purchase = getPurchase(purchase_id);
    if (purchase && totalPaidRow && totalPaidRow.total >= purchase.grand_total) {
      db.prepare("UPDATE purchases SET status = 'paid' WHERE id = ?").run(purchase_id);
    }
  }

  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return db.prepare('SELECT * FROM payment_records WHERE id = ?').get(savedId);
}

function deletePaymentRecord(id) {
  const pId = Number(id);
  if (!pId) return false;
  db.prepare('DELETE FROM payment_records WHERE id = ?').run(pId);
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  return true;
}

function getAccountBalances() {
  const cashIn = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payment_records WHERE type = 'receipt' AND account_type = 'Cash'`).get().total;
  const cashOut = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payment_records WHERE type = 'payment' AND account_type = 'Cash'`).get().total;
  const cashExpenses = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE payment_method = 'Cash'`).get().total;

  const bankIn = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payment_records WHERE type = 'receipt' AND account_type = 'Bank'`).get().total;
  const bankOut = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payment_records WHERE type = 'payment' AND account_type = 'Bank'`).get().total;
  const bankExpenses = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE payment_method = 'Bank'`).get().total;

  const upiIn = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payment_records WHERE type = 'receipt' AND account_type = 'UPI'`).get().total;
  const upiOut = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payment_records WHERE type = 'payment' AND account_type = 'UPI'`).get().total;
  const upiExpenses = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE payment_method = 'UPI'`).get().total;

  return {
    cashBalance: cashIn - cashOut - cashExpenses,
    bankBalance: bankIn - bankOut - bankExpenses,
    upiBalance: upiIn - upiOut - upiExpenses,
    totalBalance: (cashIn + bankIn + upiIn) - (cashOut + bankOut + upiOut) - (cashExpenses + bankExpenses + upiExpenses)
  };
}

function seedDemoDataIfEmpty() {
  try {
    const catCount = db.prepare('SELECT COUNT(*) as cnt FROM expense_categories').get().cnt;
    if (catCount === 0) {
      const defaultCategories = [
        ['Office Rent & Maintenance', 'Premises rental, electricity, water, internet & security'],
        ['Utilities & Bills', 'Electricity, broadband, telephone & water bills'],
        ['Staff Salaries & Payroll', 'Employee monthly salaries, bonuses, and allowances'],
        ['Travel & Conveyance', 'Business travel, cab fares, fuel & lodging costs'],
        ['Software & Subscriptions', 'SaaS software licenses, cloud servers & tools'],
        ['Marketing & Advertising', 'Online campaigns, printing, branding & promotional material'],
        ['General & Miscellaneous', 'Office supplies, tea/coffee, snacks & sundry operational costs']
      ];
      for (const [name, description] of defaultCategories) {
        db.prepare('INSERT OR IGNORE INTO expense_categories (name, description) VALUES (?, ?)').run(name, description);
      }
    }
  } catch (err) {
    console.error('Error seeding initial expense categories:', err);
  }
}

function createDatabaseBackupZip(targetPath) {
  const fs = require('fs');
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) throw new Error('Database file not found');
  try { if (db) db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
  fs.copyFileSync(dbPath, targetPath);
  return { success: true, path: targetPath };
}

function restoreDatabaseFromZip(sourcePath) {
  const fs = require('fs');
  const dbPath = getDbPath();
  if (!fs.existsSync(sourcePath)) throw new Error('Source backup file not found');
  try {
    if (db) db.close();
  } catch (e) {}
  fs.copyFileSync(sourcePath, dbPath);
  initDatabase();
  return { success: true };
}

function closeDatabase() {
  if (db) {
    try {
      db.close();
      db = null;
    } catch (err) {
      console.error('Error closing database:', err.message);
    }
  }
}

// ── Audit Logs & Security Logging ──────────────────────────────────────────────
function logAuditEvent(action, entityType = '', entityId = 0, details = '') {
  try {
    const activeUser = getActiveUser();
    const userName = activeUser ? activeUser.name : 'Admin';
    db.prepare(`
      INSERT INTO audit_logs (user_name, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?)
    `).run(userName, action, entityType, Number(entityId) || 0, typeof details === 'object' ? JSON.stringify(details) : String(details));
  } catch (e) {
    console.error('logAuditEvent error:', e.message);
  }
}

function getAuditLogs(limit = 100, offset = 0) {
  try {
    const rows = db.prepare(`
      SELECT * FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?
    `).all(limit, offset);
    const countRow = db.prepare(`SELECT COUNT(*) as total FROM audit_logs`).get();
    return { logs: rows, total: countRow ? countRow.total : rows.length };
  } catch (e) {
    console.error('getAuditLogs error:', e.message);
    return { logs: [], total: 0 };
  }
}

// ── Accounts Receivable & Accounts Payable (AR/AP) Aging Report ───────────────
function getAgingReport(asOfDate = null) {
  const targetDate = asOfDate ? new Date(asOfDate) : new Date();

  // 1. Accounts Receivable (Invoices)
  const unpaidInvoices = db.prepare(`
    SELECT i.*, c.name as client_name_db, c.company_name as client_company
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.status IN ('sent', 'overdue', 'unpaid', 'partially_paid', 'draft')
  `).all();

  const clientMap = {};
  const arSummary = { current: 0, days31_60: 0, days61_90: 0, days90Plus: 0, total: 0 };

  unpaidInvoices.forEach(inv => {
    const refDate = new Date(inv.due_date || inv.invoice_date || inv.created_at);
    const diffTime = targetDate - refDate;
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    const amount = Number(inv.grand_total) || 0;

    let bucket = 'current';
    if (diffDays > 90) bucket = 'days90Plus';
    else if (diffDays > 60) bucket = 'days61_90';
    else if (diffDays > 30) bucket = 'days31_60';

    arSummary[bucket] += amount;
    arSummary.total += amount;

    const clientId = inv.client_id || 0;
    const clientName = inv.client_name || inv.client_name_db || 'Walk-in Customer';

    if (!clientMap[clientId]) {
      clientMap[clientId] = {
        clientId,
        clientName,
        companyName: inv.client_company || '',
        current: 0,
        days31_60: 0,
        days61_90: 0,
        days90Plus: 0,
        total: 0,
        invoiceCount: 0
      };
    }
    clientMap[clientId][bucket] += amount;
    clientMap[clientId].total += amount;
    clientMap[clientId].invoiceCount += 1;
  });

  // 2. Accounts Payable (Purchases)
  const unpaidPurchases = db.prepare(`
    SELECT p.*, v.name as vendor_name_db, v.company_name as vendor_company
    FROM purchases p
    LEFT JOIN vendors v ON p.vendor_id = v.id
    WHERE p.status IN ('received', 'pending', 'unpaid', 'partially_paid')
  `).all();

  const vendorMap = {};
  const apSummary = { current: 0, days31_60: 0, days61_90: 0, days90Plus: 0, total: 0 };

  unpaidPurchases.forEach(pur => {
    const refDate = new Date(pur.due_date || pur.purchase_date || pur.created_at);
    const diffTime = targetDate - refDate;
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    const amount = Number(pur.grand_total) || 0;

    let bucket = 'current';
    if (diffDays > 90) bucket = 'days90Plus';
    else if (diffDays > 60) bucket = 'days61_90';
    else if (diffDays > 30) bucket = 'days31_60';

    apSummary[bucket] += amount;
    apSummary.total += amount;

    const vendorId = pur.vendor_id || 0;
    const vendorName = pur.vendor_name || pur.vendor_name_db || 'Unknown Vendor';

    if (!vendorMap[vendorId]) {
      vendorMap[vendorId] = {
        vendorId,
        vendorName,
        companyName: pur.vendor_company || '',
        current: 0,
        days31_60: 0,
        days61_90: 0,
        days90Plus: 0,
        total: 0,
        purchaseCount: 0
      };
    }
    vendorMap[vendorId][bucket] += amount;
    vendorMap[vendorId].total += amount;
    vendorMap[vendorId].purchaseCount += 1;
  });

  return {
    asOfDate: targetDate.toISOString().slice(0, 10),
    arSummary,
    apSummary,
    clientAging: Object.values(clientMap).sort((a, b) => b.total - a.total),
    vendorAging: Object.values(vendorMap).sort((a, b) => b.total - a.total)
  };
}

module.exports = {
  initDatabase, getDbPath, closeDatabase,
  getSettings, saveSettings, verifyAdminPin, saveSecuritySettings, checkPostUpdateNotification,
  getAllClients, getClients: getAllClients, getClient, saveClient, deleteClient, getClientProfile, getClientFullProfile,
  getAllVendors, getVendors: getAllVendors, getVendor, saveVendor, deleteVendor, getVendorFullProfile,
  getAllInvoices, getInvoices: getAllInvoices, getInvoice, getNextInvoiceNumber, getNextInvoiceNumberObj,
  saveInvoice, saveInvoiceAndReturn, deleteInvoice, duplicateInvoice,
  updateInvoiceStatus, getDashboardStats,
  getAllPurchases, getPurchases: getAllPurchases, getPurchase, getNextPurchaseNumberObj, savePurchase, deletePurchase, updatePurchaseStatus,
  getAllProducts, getProducts: getAllProducts, getProduct, saveProduct, deleteProduct, recordStockTransaction, getStockTransactions,
  deductStockForInvoice, restoreStockForInvoice, addStockForPurchase, restoreStockForPurchase,
  getFinancialReportData, getBalanceSheet, getMonthlyStockReport, generateFinancialCsv, createDatabaseBackupZip, restoreDatabaseFromZip,
  exportMonthlyDataPackage, importMonthlyDataPackage,
  getAllUsers, getUser, getActiveUser, saveUser, deleteUser, switchActiveUser,
  getAllSalesReturns, getSalesReturns: getAllSalesReturns, getSalesReturn, getNextReturnNumberObj, saveSalesReturn, deleteSalesReturn,
  getAllExpenses, getExpense, saveExpense, deleteExpense, getAllExpenseCategories, saveExpenseCategory, deleteExpenseCategory,
  getAllQuotations, getQuotations: getAllQuotations, getQuotation, getNextQuotationNumberObj, saveQuotationAndReturn, deleteQuotation, convertQuotationToInvoice,
  getPaymentRecords, savePaymentRecord, deletePaymentRecord, getAccountBalances,
  logAuditEvent, getAuditLogs, getAgingReport
};
