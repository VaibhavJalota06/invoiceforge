const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Settings & Security
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  verifyAdminPin: (pin) => ipcRenderer.invoke('verify-admin-pin', pin),
  saveSecuritySettings: (data) => ipcRenderer.invoke('save-security-settings', data),

  // Clients
  getClients: () => ipcRenderer.invoke('get-clients'),
  getClient: (id) => ipcRenderer.invoke('get-client', id),
  getClientProfile: (id) => ipcRenderer.invoke('get-client-profile', id),
  getClientFullProfile: (id) => ipcRenderer.invoke('get-client-full-profile', id),
  saveClient: (client) => ipcRenderer.invoke('save-client', client),
  deleteClient: (id) => ipcRenderer.invoke('delete-client', id),

  // Products & Stock Management
  getProducts: () => ipcRenderer.invoke('get-products'),
  getProduct: (id) => ipcRenderer.invoke('get-product', id),
  saveProduct: (product) => ipcRenderer.invoke('save-product', product),
  deleteProduct: (id) => ipcRenderer.invoke('delete-product', id),
  recordStockTransaction: (tx) => ipcRenderer.invoke('record-stock-transaction', tx),
  getStockTransactions: (productId) => ipcRenderer.invoke('get-stock-transactions', productId),

  // Invoices
  getInvoices: (filters) => ipcRenderer.invoke('get-invoices', filters),
  getInvoice: (id) => ipcRenderer.invoke('get-invoice', id),
  saveInvoice: (invoice) => ipcRenderer.invoke('save-invoice', invoice),
  deleteInvoice: (id) => ipcRenderer.invoke('delete-invoice', id),
  duplicateInvoice: (id) => ipcRenderer.invoke('duplicate-invoice', id),
  updateInvoiceStatus: (id, status) => ipcRenderer.invoke('update-invoice-status', id, status),
  getNextInvoiceNumber: () => ipcRenderer.invoke('get-next-invoice-number'),
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),

  // PDF / Print
  exportPdf: (htmlContent, defaultFilename) => ipcRenderer.invoke('export-pdf', htmlContent, defaultFilename),
  printInvoice: (htmlContent) => ipcRenderer.invoke('print-invoice', htmlContent),

  // Storage & Data Paths
  getDataPaths: () => ipcRenderer.invoke('get-data-paths'),
  openDataDir: () => ipcRenderer.invoke('open-data-dir'),

  // Auto-Updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkUpdateNotification: () => ipcRenderer.invoke('check-update-notification'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, data) => callback(data)),
  logError: (msg) => ipcRenderer.invoke('renderer-log-error', msg)
});
