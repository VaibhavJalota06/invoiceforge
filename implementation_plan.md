# InvoiceForge — Electron Desktop Invoice App

A fully offline, installable Windows desktop invoice application built with Electron + plain HTML/CSS/JS and a local SQLite database. No cloud, no login, no internet dependency required to run.

---

## Overview

The app will be a single-window Electron application with a sidebar navigation. All data is stored locally in a SQLite database (via `better-sqlite3`). PDF export uses Electron's built-in `webContents.printToPDF`. The final output is a Windows NSIS installer built with `electron-builder`.

---

## Architecture Decision

| Concern | Choice | Reason |
|---|---|---|
| UI Framework | Plain HTML/CSS/JS (no React) | Simpler, smaller bundle, no build step needed for renderer |
| Database | `better-sqlite3` | Embedded, synchronous, fast, no server needed |
| PDF Export | Electron `webContents.printToPDF` | Built-in, no extra library cost, produces clean PDFs |
| Packaging | `electron-builder` NSIS | Standard Windows installer with Start Menu + Desktop shortcut |
| IPC | Electron contextBridge (preload.js) | Secure main↔renderer communication |

---

## Project Structure

```
d:\ai models\invoice\
├── package.json
├── electron-builder.yml
├── main.js                  # Electron main process
├── preload.js               # IPC bridge (contextBridge)
├── src/
│   ├── index.html           # Main app shell
│   ├── css/
│   │   └── styles.css       # All styles (dark-neutral, clean business UI)
│   ├── js/
│   │   ├── app.js           # Router / nav logic
│   │   ├── db.js            # DB helper called via IPC (renderer side wrapper)
│   │   ├── dashboard.js
│   │   ├── invoices.js
│   │   ├── clients.js
│   │   ├── settings.js
│   │   ├── invoice-editor.js
│   │   └── currencies.js    # Full ISO 4217 currency list
│   └── templates/
│       └── invoice-print.html  # Print/PDF layout template
├── db/
│   └── database.js          # SQLite schema + all DB operations (main process)
└── dist/                    # electron-builder output (created at build time)
```

---

## Database Schema

### `settings` table (single row)
```sql
company_name, company_address, company_phone, company_email,
tax_number, bank_details, default_payment_terms,
default_currency, default_tax_rate, invoice_prefix,
invoice_counter, invoice_footer
```

### `clients` table
```sql
id, name, company_name, billing_address, email, phone, gstin, created_at
```

### `invoices` table
```sql
id, invoice_number, client_id, invoice_date, due_date,
currency, subtotal, discount_type, discount_value, discount_amount,
tax_lines (JSON), tax_amount, grand_total,
notes, status, created_at, updated_at
```

### `invoice_items` table
```sql
id, invoice_id, description, quantity, rate, amount, sort_order
```

---

## Proposed Changes

### Phase 1 — Scaffold & Dependencies

#### [NEW] package.json
- `electron` (latest stable)
- `better-sqlite3`
- `electron-builder` (devDependency)
- Scripts: `start`, `build`

#### [NEW] main.js
- Creates BrowserWindow
- Handles all IPC channels for DB operations (settings, clients, invoices, PDF export)
- Registers `pdf-export` IPC handler using `webContents.printToPDF`

#### [NEW] preload.js
- Exposes `window.api` with methods: `getSettings`, `saveSettings`, `getClients`, `saveClient`, `deleteClient`, `getInvoices`, `saveInvoice`, `deleteInvoice`, `exportPdf`

#### [NEW] db/database.js
- Schema creation + migrations on app start
- All CRUD operations as synchronous better-sqlite3 calls

---

### Phase 2 — UI Shell & Styles

#### [NEW] src/index.html
- Sidebar with nav links (Dashboard, Invoices, Clients, Settings)
- Main content `<div id="content">` swapped by JS router

#### [NEW] src/css/styles.css
- Dark-neutral palette: deep charcoal `#1a1d23` background, white cards, indigo accent `#5c6bc0`
- Sidebar with smooth active state animations
- Card components, table styles, form styles, badge styles for status
- Google Font: Inter

---

### Phase 3 — Settings

#### [NEW] src/js/settings.js
- Form: company name, address, phone, email, tax number, bank details, default terms
- Invoice prefix field (e.g. `INV-2026-`) and counter
- Default currency dropdown (from currencies.js)
- Default tax rate
- Invoice footer/terms text
- Save button persists to SQLite via IPC

---

### Phase 4 — Client Management

#### [NEW] src/js/clients.js
- List view: searchable table of all clients
- Add/Edit modal: name, company, address, email, phone, GSTIN
- Delete with confirmation
- All operations via IPC → SQLite

---

### Phase 5 — Invoice Creation & Editor

#### [NEW] src/js/invoice-editor.js
- Auto-generated invoice number (prefix + zero-padded counter from settings)
- Invoice date + due date pickers
- Client selector dropdown (populated from DB) + "Add New Client" inline option
- Line items table: description, qty, rate, amount (auto-calc)
- Add/Remove row buttons
- Subtotal (auto)
- Discount: toggle flat/percentage, input value
- Tax lines: support 2 named tax rows (e.g. CGST 9% + SGST 9%), each auto-calculates amount
- Grand total (auto)
- Notes/terms textarea (pre-filled from settings)
- Status dropdown: Draft / Unpaid / Paid / Overdue
- Save Draft / Save & Finalize buttons

#### [NEW] src/js/currencies.js
- ~170 ISO 4217 currencies with code, symbol, name
- Exported as array; used in Settings and Invoice editor

---

### Phase 6 — Invoice History

#### [NEW] src/js/invoices.js
- Table: invoice #, client, date, due date, currency, amount, status badge
- Filter bar: client dropdown, date range, status, currency
- Sortable columns
- Row actions: View/Edit, Duplicate, Mark Paid/Unpaid, Delete (with confirmation)
- Overdue auto-detection on load

---

### Phase 7 — Dashboard

#### [NEW] src/js/dashboard.js
- Stat cards: Total Invoiced This Month, Total Outstanding, Number of Clients
- Recent invoices list (last 10)
- All data fetched from SQLite via IPC on every navigation

---

### Phase 8 — PDF Export & Print

#### [NEW] src/templates/invoice-print.html
- Standalone clean invoice layout injected with data
- Company details (top-left), logo placeholder (top-right commented block)
- Client block, invoice meta (number, dates)
- Line items table with amounts
- Totals section (subtotal, discount, each tax line, grand total)
- Notes/terms footer
- Professional print CSS (hide UI chrome)

- `Export PDF` button calls IPC → main.js → `webContents.printToPDF` → saves to user-chosen folder via `dialog.showSaveDialog`
- `Print` button calls `window.print()` on the print template

---

### Phase 9 — Packaging

#### [NEW] electron-builder.yml
```yaml
appId: com.invoiceforge.app
productName: InvoiceForge
directories:
  output: dist
win:
  target:
    - target: nsis
    - target: portable
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
```

---

## Currency Support Detail

The `currencies.js` file will include all major ISO 4217 currencies (~170 entries), covering:
- All G20 currencies
- All common Asia-Pacific, Middle East, African, Latin American currencies
- Each entry: `{ code: "INR", symbol: "₹", name: "Indian Rupee" }`
- Default: INR (₹)
- Amounts formatted with correct locale (`toLocaleString` with currency code)

---

## Status & Overdue Logic
- Statuses: `draft`, `unpaid`, `paid`, `overdue`
- On invoice list load: any invoice with `status = 'unpaid'` and `due_date < today` is displayed as **Overdue** (visual flag, DB status auto-updated)
- "Mark as Paid" action sets status → `paid`

---

## Verification Plan

### Dev-Mode Testing (Step-by-Step)
1. `npm start` — verify app launches, sidebar works
2. Go to Settings → fill company profile → save → reload → verify persisted
3. Go to Clients → add test client → edit → delete
4. Go to Invoices → create invoice for test client in INR → add 3 line items → add CGST+SGST → export PDF → verify PDF looks correct
5. Go to Dashboard → verify stats reflect created invoice

### Build Verification
- Run `npm run build`
- Confirm `dist/InvoiceForge Setup X.X.X.exe` and `dist/InvoiceForge X.X.X.exe` (portable) exist
- Report exact paths to user

---

## Open Questions

> [!NOTE]
> These have sensible defaults — no clarification needed unless you want to override:
> - **Accent color**: Defaulting to Indigo (`#5c6bc0`). Easy to change in one CSS variable.
> - **Invoice number format**: Default `INV-2026-001` (prefix editable in Settings).
> - **Default currency**: INR (₹ Indian Rupee) as specified.
> - **Tax rows**: Two named rows (CGST + SGST) but labels are editable per invoice.
> - **Logo**: Placeholder comment in HTML, no upload UI yet (as requested).
> - **Company name in app**: "InvoiceForge" — you can change this in Settings after install.

---

## Build Timeline (Execution Order)

1. Scaffold project, install deps
2. `db/database.js` — schema + all CRUD
3. `main.js` + `preload.js` — IPC setup
4. `index.html` + `styles.css` — shell + design system
5. `settings.js` — Settings page
6. `clients.js` — Client management
7. `invoice-editor.js` + `currencies.js` — Invoice creation
8. `invoices.js` — Invoice history
9. `dashboard.js` — Dashboard
10. `invoice-print.html` — PDF/print template + export logic
11. `electron-builder.yml` — packaging config → run build → report installer path
