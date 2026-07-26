const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Some Windows systems fail to initialize Electron's GPU process, leaving the
// window visible but unresponsive. The invoice UI does not require GPU rendering.
app.disableHardwareAcceleration();

// Auto-updater options
// Updates are downloaded only after the user explicitly chooses "Update now".
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

// Initialize database (must happen after app is ready for getPath to work)
let db;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    backgroundColor: '#1a1d23',
    show: true,
    icon: path.join(__dirname, 'src', 'assets', 'icon.ico')
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.show();
  win.focus();
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
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

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
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
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

app.whenReady().then(() => {
  configureCustomDataPath();

  db = require('./db/database');
  db.initDatabase();

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

// ─── Settings & Security ────────────────────────────────────────────────────────
ipcMain.handle('get-settings', () => db.getSettings());
ipcMain.handle('save-settings', (_e, data) => db.saveSettings(data));
ipcMain.handle('verify-admin-pin', (_e, pin) => db.verifyAdminPin(pin));
ipcMain.handle('save-security-settings', (_e, data) => db.saveSecuritySettings(data));

// ─── Clients ───────────────────────────────────────────────────────────────────
ipcMain.handle('get-clients', () => db.getAllClients());
ipcMain.handle('get-client', (_e, id) => db.getClient(id));
ipcMain.handle('get-client-profile', (_e, id) => db.getClientProfile(id));
ipcMain.handle('save-client', (_e, data) => db.saveClient(data));
ipcMain.handle('delete-client', (_e, id) => db.deleteClient(id));

// ─── Invoices ──────────────────────────────────────────────────────────────────
ipcMain.handle('get-invoices', (_e, filters) => db.getAllInvoices(filters));
ipcMain.handle('get-invoice', (_e, id) => db.getInvoice(id));
// save-invoice is now handled above (saveInvoiceAndReturn)
ipcMain.handle('delete-invoice', (_e, id) => db.deleteInvoice(id));
ipcMain.handle('duplicate-invoice', (_e, id) => db.duplicateInvoice(id));
ipcMain.handle('update-invoice-status', (_e, id, status) => db.updateInvoiceStatus(id, status));
ipcMain.handle('get-next-invoice-number', () => db.getNextInvoiceNumberObj());
ipcMain.handle('save-invoice', (_e, data) => db.saveInvoiceAndReturn(data));
ipcMain.handle('get-dashboard-stats', () => db.getDashboardStats());

// ─── PDF Export ────────────────────────────────────────────────────────────────
ipcMain.handle('export-pdf', async (_e, htmlContent, defaultFilename) => {
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
      webPreferences: { contextIsolation: true, nodeIntegration: false }
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
  let printWin = null;
  try {
    printWin = new BrowserWindow({
      show: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false }
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

// ─── Storage Info IPC ──────────────────────────────────────────────────────────
ipcMain.handle('get-data-paths', () => {
  const dataDir = app.getPath('userData');
  const dbPath = db ? db.getDbPath() : path.join(dataDir, 'invoiceforge.db');
  return { dataDir, dbPath };
});

ipcMain.handle('open-data-dir', () => {
  const dataDir = app.getPath('userData');
  shell.openPath(dataDir);
});
