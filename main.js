const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

app.disableHardwareAcceleration();

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

let db;

function createWindow() {
  // Query primary display work area resolution
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Auto-calculate optimal width & height based on host screen resolution
  const targetWidth = Math.min(1680, Math.max(1024, Math.floor(screenWidth * 0.92)));
  const targetHeight = Math.min(1024, Math.max(680, Math.floor(screenHeight * 0.90)));

  const win = new BrowserWindow({
    width: targetWidth,
    height: targetHeight,
    minWidth: 920,
    minHeight: 580,
    resizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    backgroundColor: '#0f172a',
    show: false,
    icon: path.join(__dirname, 'src', 'assets', 'icon.ico')
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
    win.focus();
  });

  win.setMenuBarVisibility(false);

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[RENDERER CONSOLE ${level}]: ${message} (${sourceId}:${line})`);
  });

  return win;
}

let mainWindow;

function hasUpdateConfig() {
  try {
    const updateConfigPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app-update.yml')
      : path.join(__dirname, 'dev-app-update.yml');
    return fs.existsSync(updateConfigPath);
  } catch (e) {
    return false;
  }
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  if (!app.isPackaged && fs.existsSync(path.join(__dirname, 'dev-app-update.yml'))) {
    autoUpdater.forceDevUpdateConfig = true;
  }

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update-status', { status: 'checking', message: 'Checking GitHub for updates…' });
  });
  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-status', { status: 'available', version: info.version, message: `Update v${info.version} is available!` });
  });
  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-status', { status: 'not-available', message: 'InvoiceForge is up to date.' });
  });
  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-status', { status: 'downloading', percent: Math.round(progress.percent), message: `Downloading update… ${Math.round(progress.percent)}%` });
  });
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-status', { status: 'downloaded', version: info.version, message: `Update v${info.version} ready! Click to restart.` });
  });
  autoUpdater.on('error', (err) => {
    console.log('Auto-updater notice:', err.message);
    if (err.code === 'ENOENT' || (err.message && err.message.includes('app-update.yml'))) {
      mainWindow?.webContents.send('update-status', { status: 'offline', message: 'InvoiceForge is running in offline standalone mode.' });
      return;
    }
    mainWindow?.webContents.send('update-status', { status: 'error', message: `Update check failed: ${err.message}` });
  });

  if (app.isPackaged && hasUpdateConfig()) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(e => console.log('Auto-update check:', e.message));
    }, 4000);
  }
}

function configureCustomDataPath() {
  try {
    let baseDir;
    if (process.env.INVOICEFORGE_DATA_DIR) {
      baseDir = path.resolve(process.env.INVOICEFORGE_DATA_DIR);
    } else if (process.env.PORTABLE_EXECUTABLE_DIR) {
      baseDir = process.env.PORTABLE_EXECUTABLE_DIR;
    } else if (app.isPackaged) {
      // Standard installed app uses system AppData directory for robust multi-user permissions
      baseDir = app.getPath('userData');
      console.log('Running packaged build using standard userData path:', baseDir);
      return;
    } else {
      baseDir = __dirname;
    }

    const dataDir = path.join(baseDir, 'data');

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const testFile = path.join(dataDir, `.write_test_${Date.now()}`);
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);

    const defaultUserData = app.getPath('userData');
    if (defaultUserData !== dataDir) {
      const oldDbPath = path.join(defaultUserData, 'invoiceforge.db');
      const newDbPath = path.join(dataDir, 'invoiceforge.db');
      if (fs.existsSync(oldDbPath) && !fs.existsSync(newDbPath)) {
        try {
          fs.copyFileSync(oldDbPath, newDbPath);
          if (fs.existsSync(oldDbPath + '-wal')) fs.copyFileSync(oldDbPath + '-wal', newDbPath + '-wal');
          if (fs.existsSync(oldDbPath + '-shm')) fs.copyFileSync(oldDbPath + '-shm', newDbPath + '-shm');
          console.log(`Migrated database from ${oldDbPath} to ${newDbPath}`);
        } catch (e) {
          console.log('Database migration note:', e.message);
        }
      }
    }

    app.setPath('userData', dataDir);
    console.log('App user data directory set to:', dataDir);
  } catch (err) {
    console.log('Could not set custom data directory, using default:', err.message);
  }
}

let isAppLocked = false;

function initAppLockState() {
  try {
    const s = db.getSettings();
    isAppLocked = Boolean(s && s.app_lock_enabled && s.admin_pin);
  } catch (e) {
    isAppLocked = false;
  }
}

function assertUnlocked() {
  if (isAppLocked) {
    throw new Error('Access denied: Workstation is locked. Verification required.');
  }
}

app.whenReady().then(() => {
  configureCustomDataPath();

  db = require('./db/database');
  db.initDatabase();
  initAppLockState();

  mainWindow = createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

const handleQuit = () => {
  if (db && typeof db.closeDatabase === 'function') {
    db.closeDatabase();
  }
};
app.on('before-quit', handleQuit);
app.on('will-quit', handleQuit);

// ─── Window Controls ──────────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow && mainWindow.close());

app.on('window-all-closed', () => {
  handleQuit();
  if (process.platform !== 'darwin') app.quit();
});

// ─── Debug Logger ───────────────────────────────────────────────────────────
ipcMain.handle('renderer-log-error', (_e, msg) => {
  const cleanMsg = String(msg || '').slice(0, 2000).replace(/[\r\n]+/g, ' ');
  const logPath = path.join(app.getPath('userData'), 'renderer-errors.log');
  const line = `[${new Date().toISOString()}] ${cleanMsg}\n`;
  try { fs.appendFileSync(logPath, line); } catch (e) {}
  console.error('[RENDERER ERROR]', cleanMsg);
});

// ─── Settings & Security ────────────────────────────────────────────────────────
ipcMain.handle('is-app-locked', () => isAppLocked);
ipcMain.handle('lock-app', () => {
  const s = db.getSettings();
  if (s && s.app_lock_enabled && s.admin_pin) {
    isAppLocked = true;
  }
  return isAppLocked;
});

ipcMain.handle('get-settings', () => {
  assertUnlocked();
  try { return db.getSettings(); } catch (e) { console.error('get-settings error:', e); throw e; }
});
ipcMain.handle('save-settings', (_e, data) => {
  assertUnlocked();
  try { return db.saveSettings(data); } catch (e) { console.error('save-settings error:', e); throw e; }
});
ipcMain.handle('verify-admin-pin', (_e, pin) => {
  const res = db.verifyAdminPin(pin);
  if (res && res.success) {
    isAppLocked = false;
  }
  return res;
});
ipcMain.handle('save-security-settings', (_e, data) => {
  assertUnlocked();
  return db.saveSecuritySettings(data);
});

// ─── Clients ───────────────────────────────────────────────────────────────────
ipcMain.handle('get-clients', () => { assertUnlocked(); return db.getAllClients(); });
ipcMain.handle('get-client', (_e, id) => { assertUnlocked(); return db.getClient(id); });
ipcMain.handle('get-client-profile', (_e, id) => { assertUnlocked(); return db.getClientProfile(id); });
ipcMain.handle('get-client-full-profile', (_e, id) => { assertUnlocked(); return db.getClientFullProfile(id); });
ipcMain.handle('save-client', (_e, data) => { assertUnlocked(); return db.saveClient(data); });
ipcMain.handle('delete-client', (_e, id) => { assertUnlocked(); return db.deleteClient(id); });

// ─── Vendors ───────────────────────────────────────────────────────────────────
ipcMain.handle('get-vendors', () => { assertUnlocked(); return db.getAllVendors(); });
ipcMain.handle('get-vendor', (_e, id) => { assertUnlocked(); return db.getVendor(id); });
ipcMain.handle('get-vendor-full-profile', (_e, id) => { assertUnlocked(); return db.getVendorFullProfile(id); });
ipcMain.handle('save-vendor', (_e, data) => { assertUnlocked(); return db.saveVendor(data); });
ipcMain.handle('delete-vendor', (_e, id) => { assertUnlocked(); return db.deleteVendor(id); });

// ─── Products & Stock Management ───────────────────────────────────────────────
ipcMain.handle('get-products', () => {
  assertUnlocked();
  try { return db.getAllProducts(); } catch (e) { console.error('get-products error:', e); throw e; }
});
ipcMain.handle('get-product', (_e, id) => { assertUnlocked(); return db.getProduct(id); });
ipcMain.handle('save-product', (_e, data) => { assertUnlocked(); return db.saveProduct(data); });
ipcMain.handle('delete-product', (_e, id) => { assertUnlocked(); return db.deleteProduct(id); });
ipcMain.handle('record-stock-transaction', (_e, tx) => { assertUnlocked(); return db.recordStockTransaction(tx); });
ipcMain.handle('get-stock-transactions', (_e, productId) => { assertUnlocked(); return db.getStockTransactions(productId); });

// ─── Invoices ──────────────────────────────────────────────────────────────────
ipcMain.handle('get-invoices', (_e, filters) => { assertUnlocked(); return db.getAllInvoices(filters); });
ipcMain.handle('get-invoice', (_e, id) => { assertUnlocked(); return db.getInvoice(id); });
ipcMain.handle('delete-invoice', (_e, id) => {
  assertUnlocked();
  db.restoreStockForInvoice(id);
  return db.deleteInvoice(id);
});
ipcMain.handle('duplicate-invoice', (_e, id) => { assertUnlocked(); return db.duplicateInvoice(id); });
ipcMain.handle('update-invoice-status', (_e, id, status) => { assertUnlocked(); return db.updateInvoiceStatus(id, status); });
ipcMain.handle('get-next-invoice-number', () => { assertUnlocked(); return db.getNextInvoiceNumberObj(); });
ipcMain.handle('save-invoice', (_e, data) => {
  assertUnlocked();
  return db.saveInvoiceAndReturn(data);
});
ipcMain.handle('get-dashboard-stats', () => { assertUnlocked(); return db.getDashboardStats(); });

// ─── Purchases & Purchase Orders ──────────────────────────────────────────────
ipcMain.handle('get-purchases', (_e, filters) => { assertUnlocked(); return db.getAllPurchases(filters); });
ipcMain.handle('get-purchase', (_e, id) => { assertUnlocked(); return db.getPurchase(id); });
ipcMain.handle('get-next-purchase-number', () => { assertUnlocked(); return db.getNextPurchaseNumberObj(); });
ipcMain.handle('save-purchase', (_e, data) => { assertUnlocked(); return db.savePurchase(data); });
ipcMain.handle('delete-purchase', (_e, id) => { assertUnlocked(); return db.deletePurchase(id); });
ipcMain.handle('update-purchase-status', (_e, id, status) => { assertUnlocked(); return db.updatePurchaseStatus(id, status); });

// ─── PDF Export ────────────────────────────────────────────────────────────────
ipcMain.handle('export-pdf', async (_e, htmlContent, defaultFilename) => {
  assertUnlocked();
  let printWin = null;
  try {
    const exportsDir = path.join(app.getPath('userData'), 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    const defaultSavePath = path.join(exportsDir, defaultFilename || 'invoice.pdf');

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Invoice as PDF',
      defaultPath: defaultSavePath,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) return { success: false, reason: 'canceled' };

    printWin = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    });

    await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

    const pdfBuffer = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 }
    });

    fs.writeFileSync(filePath, pdfBuffer);
    shell.showItemInFolder(filePath);
    return { success: true, filePath };

  } catch (err) {
    console.error('PDF export error:', err);
    return { success: false, reason: err.message };
  } finally {
    if (printWin && !printWin.isDestroyed()) {
      printWin.close();
    }
  }
});

ipcMain.handle('print-invoice', async (_e, htmlContent) => {
  assertUnlocked();
  let printWin = null;
  try {
    printWin = new BrowserWindow({
      show: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    });

    await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
    await new Promise(resolve => setTimeout(resolve, 500));

    printWin.webContents.print({ silent: false, printBackground: true }, () => {
      if (printWin && !printWin.isDestroyed()) printWin.close();
    });

    return { success: true };
  } catch (err) {
    if (printWin && !printWin.isDestroyed()) printWin.close();
    return { success: false, reason: err.message };
  }
});

// ─── Auto-Updater IPC ─────────────────────────────────────────────────────────
ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged && fs.existsSync(path.join(__dirname, 'dev-app-update.yml'))) {
    autoUpdater.forceDevUpdateConfig = true;
  }
  if (!hasUpdateConfig()) {
    return { status: 'offline', message: 'Updates are not configured for this installation.' };
  }
  try {
    autoUpdater.checkForUpdates().catch(e => {
      console.log('Update check error:', e.message);
      mainWindow?.webContents.send('update-status', { status: 'error', message: `Could not check for updates: ${e.message}` });
    });
    return { status: 'checking', message: 'Checking GitHub for updates…' };
  } catch (e) {
    return { status: 'error', message: `Could not check for updates: ${e.message}` };
  }
});

ipcMain.handle('download-update', async () => {
  if (!app.isPackaged) {
    return { status: 'dev-mode', message: 'Update downloads run in production builds.' };
  }
  try {
    await autoUpdater.downloadUpdate();
    return { status: 'downloading', message: 'Downloading update…' };
  } catch (e) {
    return { status: 'error', message: `Could not download the update: ${e.message}` };
  }
});

ipcMain.handle('quit-and-install', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('check-update-notification', () => {
  return db.checkPostUpdateNotification(app.getVersion());
});

// ─── Storage & Backup IPC ──────────────────────────────────────────────────────
ipcMain.handle('get-data-paths', () => {
  assertUnlocked();
  const dataDir = app.getPath('userData');
  const dbPath = db ? db.getDbPath() : path.join(dataDir, 'invoiceforge.db');
  return { dataDir, dbPath };
});

ipcMain.handle('open-data-dir', () => {
  assertUnlocked();
  const dataDir = app.getPath('userData');
  shell.openPath(dataDir);
});

ipcMain.handle('export-backup-zip', async () => {
  assertUnlocked();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const defaultFilename = `InvoiceForge_Backup_${today}.zip`;
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Full Database Backup Archive (.zip)',
      defaultPath: path.join(app.getPath('downloads') || app.getPath('userData'), defaultFilename),
      filters: [{ name: 'Zip Backup Archive', extensions: ['zip'] }]
    });

    if (canceled || !filePath) return { success: false, reason: 'canceled' };
    const res = db.createDatabaseBackupZip(filePath);
    shell.showItemInFolder(filePath);
    return res;
  } catch (err) {
    console.error('Backup export error:', err);
    return { success: false, reason: err.message };
  }
});

ipcMain.handle('import-backup-zip', async () => {
  assertUnlocked();
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select InvoiceForge Backup Archive (.zip)',
      properties: ['openFile'],
      filters: [{ name: 'Zip Backup Archive', extensions: ['zip'] }]
    });

    if (canceled || !filePaths || !filePaths[0]) return { success: false, reason: 'canceled' };
    return db.restoreDatabaseFromZip(filePaths[0]);
  } catch (err) {
    console.error('Backup restore error:', err);
    return { success: false, reason: err.message };
  }
});

ipcMain.handle('restore-backup-file', async (_e, filePath) => {
  assertUnlocked();
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, reason: 'Backup file path does not exist' };
    }
    return db.restoreDatabaseFromZip(filePath);
  } catch (err) {
    console.error('Drag drop restore error:', err);
    return { success: false, reason: err.message };
  }
});

// ─── Financial Reports IPC ─────────────────────────────────────────────────────
ipcMain.handle('get-financial-report', (_e, filters) => { assertUnlocked(); return db.getFinancialReportData(filters); });
ipcMain.handle('get-financial-report-data', (_e, filters) => { assertUnlocked(); return db.getFinancialReportData(filters); });
ipcMain.handle('get-balance-sheet', (_e, asOfDate) => { assertUnlocked(); return db.getBalanceSheet(asOfDate); });
ipcMain.handle('get-monthly-stock-report', (_e, filters) => { assertUnlocked(); return db.getMonthlyStockReport(filters); });

// ─── Personalized User Profiles & Multi-User IPC ──────────────────────────────
ipcMain.handle('get-all-users', () => { assertUnlocked(); return db.getAllUsers(); });
ipcMain.handle('get-user', (_e, id) => { assertUnlocked(); return db.getUser(id); });
ipcMain.handle('get-active-user', () => { assertUnlocked(); return db.getActiveUser(); });
ipcMain.handle('save-user', (_e, userData) => { assertUnlocked(); return db.saveUser(userData); });
ipcMain.handle('delete-user', (_e, id) => { assertUnlocked(); return db.deleteUser(id); });
ipcMain.handle('switch-active-user', (_e, userId, pinInput) => { assertUnlocked(); return db.switchActiveUser(userId, pinInput); });

// ─── Sales Returns & Credit Notes IPC ──────────────────────────────────────────
ipcMain.handle('get-all-sales-returns', (_e, filters) => { assertUnlocked(); return db.getAllSalesReturns(filters); });
ipcMain.handle('get-sales-return', (_e, id) => { assertUnlocked(); return db.getSalesReturn(id); });
ipcMain.handle('get-next-return-number', () => { assertUnlocked(); return db.getNextReturnNumberObj(); });
ipcMain.handle('save-sales-return', (_e, returnData) => { assertUnlocked(); return db.saveSalesReturn(returnData); });
ipcMain.handle('delete-sales-return', (_e, id) => { assertUnlocked(); return db.deleteSalesReturn(id); });

ipcMain.handle('export-financial-csv', async (_e, filters, type) => {
  assertUnlocked();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const reportType = type || 'invoices';
    const defaultFilename = `InvoiceForge_${reportType.toUpperCase()}_Report_${today}.csv`;

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: `Export ${reportType.toUpperCase()} Financial Ledger (.csv)`,
      defaultPath: path.join(app.getPath('downloads') || app.getPath('userData'), defaultFilename),
      filters: [{ name: 'CSV Spreadsheet', extensions: ['csv'] }]
    });

    if (canceled || !filePath) return { success: false, reason: 'canceled' };

    const csvContent = db.generateFinancialCsv(filters, reportType);
    fs.writeFileSync(filePath, csvContent, 'utf8');
    shell.showItemInFolder(filePath);
    return { success: true, filePath };
  } catch (err) {
    console.error('CSV Export error:', err);
    return { success: false, reason: err.message };
  }
});

ipcMain.handle('export-monthly-data-package', async (_e, filters) => {
  assertUnlocked();
  try {
    const periodStr = filters?.period === 'month'
      ? `${filters.year || new Date().getFullYear()}-${filters.month || String(new Date().getMonth() + 1).padStart(2, '0')}`
      : (filters?.period || 'all');
    const defaultFilename = `InvoiceForge_Data_${periodStr}.zip`;

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: `Export ${periodStr} Data Package (.zip)`,
      defaultPath: path.join(app.getPath('downloads') || app.getPath('userData'), defaultFilename),
      filters: [{ name: 'InvoiceForge Data Package', extensions: ['zip'] }]
    });

    if (canceled || !filePath) return { success: false, reason: 'canceled' };

    const res = db.exportMonthlyDataPackage(filters, filePath);
    shell.showItemInFolder(filePath);
    return res;
  } catch (err) {
    console.error('Monthly export error:', err);
    return { success: false, reason: err.message };
  }
});

ipcMain.handle('import-monthly-data-package', async () => {
  assertUnlocked();
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select InvoiceForge Data Package (.zip)',
      properties: ['openFile'],
      filters: [{ name: 'InvoiceForge Data Package or Backup', extensions: ['zip'] }]
    });

    if (canceled || !filePaths || !filePaths[0]) return { success: false, reason: 'canceled' };
    return db.importMonthlyDataPackage(filePaths[0]);
  } catch (err) {
    console.error('Monthly import error:', err);
    return { success: false, reason: err.message };
  }
});

// ─── WhatsApp & Email Sharing IPC ──────────────────────────────────────────────
ipcMain.handle('share-invoice-whatsapp', async (_e, { phone, text }) => {
  assertUnlocked();
  try {
    const cleanPhone = String(phone || '').replace(/[^\d]/g, '');
    const encodedText = encodeURIComponent(text || '');
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;
    
    await shell.openExternal(url);
    return { success: true, url };
  } catch (err) {
    console.error('WhatsApp share error:', err);
    return { success: false, reason: err.message };
  }
});

ipcMain.handle('share-invoice-email', async (_e, { email, subject, body }) => {
  assertUnlocked();
  try {
    const cleanEmail = String(email || '').trim();
    const encodedSubject = encodeURIComponent(subject || 'Invoice');
    const encodedBody = encodeURIComponent(body || '');
    const mailtoUrl = `mailto:${cleanEmail}?subject=${encodedSubject}&body=${encodedBody}`;

    await shell.openExternal(mailtoUrl);
    return { success: true, url: mailtoUrl };
  } catch (err) {
    console.error('Email share error:', err);
    return { success: false, reason: err.message };
  }
});

ipcMain.handle('copy-to-clipboard', (_e, text) => {
  assertUnlocked();
  const { clipboard } = require('electron');
  clipboard.writeText(String(text || ''));
  return { success: true };
});

// ─── Expenses IPC ─────────────────────────────────────────────────────────────
ipcMain.handle('get-expenses', (_e, filters) => { assertUnlocked(); return db.getAllExpenses(filters); });
ipcMain.handle('get-expense', (_e, id) => { assertUnlocked(); return db.getExpense(id); });
ipcMain.handle('save-expense', (_e, data) => { assertUnlocked(); return db.saveExpense(data); });
ipcMain.handle('delete-expense', (_e, id) => { assertUnlocked(); return db.deleteExpense(id); });
ipcMain.handle('get-expense-categories', () => { assertUnlocked(); return db.getAllExpenseCategories(); });
ipcMain.handle('save-expense-category', (_e, data) => { assertUnlocked(); return db.saveExpenseCategory(data); });
ipcMain.handle('delete-expense-category', (_e, id) => { assertUnlocked(); return db.deleteExpenseCategory(id); });

// ─── Quotations IPC ───────────────────────────────────────────────────────────
ipcMain.handle('get-quotations', (_e, filters) => { assertUnlocked(); return db.getAllQuotations(filters); });
ipcMain.handle('get-quotation', (_e, id) => { assertUnlocked(); return db.getQuotation(id); });
ipcMain.handle('get-next-quotation-number', () => { assertUnlocked(); return db.getNextQuotationNumberObj(); });
ipcMain.handle('save-quotation', (_e, data) => { assertUnlocked(); return db.saveQuotationAndReturn(data); });
ipcMain.handle('delete-quotation', (_e, id) => { assertUnlocked(); return db.deleteQuotation(id); });
ipcMain.handle('convert-quotation-to-invoice', (_e, id) => { assertUnlocked(); return db.convertQuotationToInvoice(id); });

// ─── Payments IPC ─────────────────────────────────────────────────────────────
ipcMain.handle('get-payments', (_e, filters) => { assertUnlocked(); return db.getPaymentRecords(filters); });
ipcMain.handle('save-payment', (_e, data) => { assertUnlocked(); return db.savePaymentRecord(data); });
ipcMain.handle('delete-payment', (_e, id) => { assertUnlocked(); return db.deletePaymentRecord(id); });
ipcMain.handle('get-account-balances', () => { assertUnlocked(); return db.getAccountBalances(); });


