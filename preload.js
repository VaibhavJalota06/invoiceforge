const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Settings & Security
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  verifyAdminPin: (pin) => ipcRenderer.invoke('verify-admin-pin', pin),
  saveSecuritySettings: (data) => ipcRenderer.invoke('save-security-settings', data),
  isAppLocked: () => ipcRenderer.invoke('is-app-locked'),
  lockApp: () => ipcRenderer.invoke('lock-app'),

  // Clients
  getClients: () => ipcRenderer.invoke('get-clients'),
  getClient: (id) => ipcRenderer.invoke('get-client', id),
  getClientProfile: (id) => ipcRenderer.invoke('get-client-profile', id),
  getClientFullProfile: (id) => ipcRenderer.invoke('get-client-full-profile', id),
  saveClient: (client) => ipcRenderer.invoke('save-client', client),
  deleteClient: (id) => ipcRenderer.invoke('delete-client', id),

  // Vendors
  getVendors: () => ipcRenderer.invoke('get-vendors'),
  getVendor: (id) => ipcRenderer.invoke('get-vendor', id),
  getVendorFullProfile: (id) => ipcRenderer.invoke('get-vendor-full-profile', id),
  saveVendor: (vendor) => ipcRenderer.invoke('save-vendor', vendor),
  deleteVendor: (id) => ipcRenderer.invoke('delete-vendor', id),

  // Products & Stock Management
  getProducts: () => ipcRenderer.invoke('get-products'),
  getProduct: (id) => ipcRenderer.invoke('get-product', id),
  saveProduct: (product) => ipcRenderer.invoke('save-product', product),
  deleteProduct: (id) => ipcRenderer.invoke('delete-product', id),
  recordStockTransaction: (tx) => ipcRenderer.invoke('record-stock-transaction', tx),
  getStockTransactions: (productId) => ipcRenderer.invoke('get-stock-transactions', productId),

  // Invoices
  getInvoices: (filters) => ipcRenderer.invoke('get-invoices', filters),
  getAllInvoices: (filters) => ipcRenderer.invoke('get-invoices', filters),
  getInvoice: (id) => ipcRenderer.invoke('get-invoice', id),
  saveInvoice: (invoice) => ipcRenderer.invoke('save-invoice', invoice),
  deleteInvoice: (id) => ipcRenderer.invoke('delete-invoice', id),
  duplicateInvoice: (id) => ipcRenderer.invoke('duplicate-invoice', id),
  updateInvoiceStatus: (id, status) => ipcRenderer.invoke('update-invoice-status', id, status),
  getNextInvoiceNumber: () => ipcRenderer.invoke('get-next-invoice-number'),
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),

  // Purchases & Purchase Orders
  getPurchases: (filters) => ipcRenderer.invoke('get-purchases', filters),
  getPurchase: (id) => ipcRenderer.invoke('get-purchase', id),
  getNextPurchaseNumber: () => ipcRenderer.invoke('get-next-purchase-number'),
  savePurchase: (purchase) => ipcRenderer.invoke('save-purchase', purchase),
  deletePurchase: (id) => ipcRenderer.invoke('delete-purchase', id),
  updatePurchaseStatus: (id, status) => ipcRenderer.invoke('update-purchase-status', id, status),

  // PDF / Print
  exportPdf: (htmlContent, defaultFilename) => ipcRenderer.invoke('export-pdf', htmlContent, defaultFilename),
  printInvoice: (htmlContent) => ipcRenderer.invoke('print-invoice', htmlContent),

  // Storage & Backup
  getDataPaths: () => ipcRenderer.invoke('get-data-paths'),
  openDataDir: () => ipcRenderer.invoke('open-data-dir'),
  exportBackupZip: () => ipcRenderer.invoke('export-backup-zip'),
  importBackupZip: () => ipcRenderer.invoke('import-backup-zip'),
  restoreBackupFile: (filePath) => ipcRenderer.invoke('restore-backup-file', filePath),

  // Financial Reports & Selective Data Transfers
  getFinancialReportData: (filters) => ipcRenderer.invoke('get-financial-report-data', filters),
  getBalanceSheet: (asOfDate) => ipcRenderer.invoke('get-balance-sheet', asOfDate),
  getMonthlyStockReport: (filters) => ipcRenderer.invoke('get-monthly-stock-report', filters),
  getAgingReport: (asOfDate) => ipcRenderer.invoke('get-aging-report', asOfDate),
  getAuditLogs: (limit, offset) => ipcRenderer.invoke('get-audit-logs', limit, offset),
  exportFinancialCsv: (filters, type) => ipcRenderer.invoke('export-financial-csv', filters, type),
  exportMonthlyDataPackage: (filters) => ipcRenderer.invoke('export-monthly-data-package', filters),
  importMonthlyDataPackage: () => ipcRenderer.invoke('import-monthly-data-package'),

  // Personalized User Profiles & Multi-User Management
  getAllUsers: () => ipcRenderer.invoke('get-all-users'),
  getUser: (id) => ipcRenderer.invoke('get-user', id),
  getActiveUser: () => ipcRenderer.invoke('get-active-user'),
  saveUser: (userData) => ipcRenderer.invoke('save-user', userData),
  deleteUser: (id) => ipcRenderer.invoke('delete-user', id),
  switchActiveUser: (userId, pinInput) => ipcRenderer.invoke('switch-active-user', userId, pinInput),

  // Sales Returns & Credit Notes
  getAllSalesReturns: (filters) => ipcRenderer.invoke('get-all-sales-returns', filters),
  getSalesReturn: (id) => ipcRenderer.invoke('get-sales-return', id),
  getNextReturnNumber: () => ipcRenderer.invoke('get-next-return-number'),
  saveSalesReturn: (returnData) => ipcRenderer.invoke('save-sales-return', returnData),
  deleteSalesReturn: (id) => ipcRenderer.invoke('delete-sales-return', id),

  // Sharing & Deep Links
  shareInvoiceWhatsApp: (payload) => ipcRenderer.invoke('share-invoice-whatsapp', payload),
  shareInvoiceEmail: (payload) => ipcRenderer.invoke('share-invoice-email', payload),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),

  // Operational Expenses
  getExpenses: (filters) => ipcRenderer.invoke('get-expenses', filters),
  getExpense: (id) => ipcRenderer.invoke('get-expense', id),
  saveExpense: (data) => ipcRenderer.invoke('save-expense', data),
  deleteExpense: (id) => ipcRenderer.invoke('delete-expense', id),
  getExpenseCategories: () => ipcRenderer.invoke('get-expense-categories'),
  saveExpenseCategory: (data) => ipcRenderer.invoke('save-expense-category', data),
  deleteExpenseCategory: (id) => ipcRenderer.invoke('delete-expense-category', id),

  // Quotations & Estimates
  getQuotations: (filters) => ipcRenderer.invoke('get-quotations', filters),
  getQuotation: (id) => ipcRenderer.invoke('get-quotation', id),
  getNextQuotationNumber: () => ipcRenderer.invoke('get-next-quotation-number'),
  saveQuotation: (data) => ipcRenderer.invoke('save-quotation', data),
  deleteQuotation: (id) => ipcRenderer.invoke('delete-quotation', id),
  convertQuotationToInvoice: (id) => ipcRenderer.invoke('convert-quotation-to-invoice', id),

  // Payments & Cash/Bank Register
  getPayments: (filters) => ipcRenderer.invoke('get-payments', filters),
  savePayment: (data) => ipcRenderer.invoke('save-payment', data),
  deletePayment: (id) => ipcRenderer.invoke('delete-payment', id),
  getAccountBalances: () => ipcRenderer.invoke('get-account-balances'),

  // Auto-Updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkUpdateNotification: () => ipcRenderer.invoke('check-update-notification'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, data) => callback(data)),
  logError: (msg) => ipcRenderer.invoke('renderer-log-error', msg)
});
