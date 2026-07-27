# Enterprise Accounting Upgrade Plan (v2.0)

Upgrade InvoiceForge into a complete end-to-end accounting & ERP desktop app by adding **Operational Expense Management**, **Quotations & Estimates with 1-Click Invoice Conversion**, **Cash & Bank Payment Ledger**, and **Customer/Vendor Aging Statements**.

---

## User Review Required

> [!IMPORTANT]
> - **Operational Expenses**: Expenses (Rent, Utilities, Salaries, Maintenance) will be deducted from Gross Profit (Sales - Cost of Goods Sold) in the **Profit & Loss Report** to calculate true **Net Operating Profit**.
> - **Quotations to Invoices**: Converting a quotation creates an Invoice draft without modifying stock until the Invoice status becomes `Paid` or `Sent`.
> - **Navigation Integration**: Three new top navigation items will be introduced: **Expenses**, **Quotations**, and **Payment Ledger**.

---

## Proposed Changes

### Database & Main Process Architecture

#### [MODIFY] [database.js](file:///d:/ai%20models/invoice/db/database.js)
- Create SQLite tables:
  - `expense_categories` (`id`, `name`, `description`, `created_at`)
  - `expenses` (`id`, `category_id`, `title`, `amount`, `payment_method`, `expense_date`, `receipt_path`, `notes`, `created_at`)
  - `quotations` (`id`, `quotation_number`, `client_id`, `client_snapshot`, `quotation_date`, `valid_until`, `currency`, `subtotal`, `discount_type`, `discount_value`, `discount_amount`, `tax_lines`, `tax_amount`, `grand_total`, `notes`, `status`, `converted_invoice_id`, `created_at`)
  - `quotation_items` (`id`, `quotation_id`, `product_id`, `product_name`, `description`, `hsn_code`, `quantity`, `unit_price`, `tax_rate`, `subtotal`)
  - `payment_records` (`id`, `type`, `account_type`, `party_type`, `party_id`, `invoice_id`, `purchase_id`, `amount`, `payment_date`, `reference_no`, `notes`, `created_at`)
- Default expense category seeds: `Office Rent`, `Utilities & Electricity`, `Staff Salaries`, `Software & Subscriptions`, `Travel & Transport`, `Miscellaneous`.
- Helper methods for Expense CRUD, Category management, Quotation CRUD, Quotation-to-Invoice conversion, and Payment ledger entries.
- Update `getFinancialReportData()` to calculate **Net Operating Profit** incorporating total expenses.

#### [MODIFY] [main.js](file:///d:/ai%20models/invoice/main.js)
- Register IPC handlers for:
  - Expenses: `get-expenses`, `save-expense`, `delete-expense`, `get-expense-categories`, `save-expense-category`
  - Quotations: `get-quotations`, `get-quotation`, `get-next-quotation-number`, `save-quotation`, `delete-quotation`, `convert-quotation-to-invoice`
  - Payments: `get-payments`, `save-payment`, `delete-payment`, `get-account-balances`

#### [MODIFY] [preload.js](file:///d:/ai%20models/invoice/preload.js)
- Expose new API functions on `window.api`:
  - `getExpenses`, `saveExpense`, `deleteExpense`, `getExpenseCategories`, `saveExpenseCategory`
  - `getQuotations`, `getQuotation`, `getNextQuotationNumber`, `saveQuotation`, `deleteQuotation`, `convertQuotationToInvoice`
  - `getPayments`, `savePayment`, `deletePayment`, `getAccountBalances`

---

### UI & Renderer Modules

#### [MODIFY] [index.html](file:///d:/ai%20models/invoice/src/index.html)
- Add navigation items for **Quotations**, **Expenses**, and **Payments** in sidebar/top nav.
- Add `<script>` tags for new JS modules: `quotations.js`, `quotation-editor.js`, `expenses.js`, and `payments.js`.

#### [MODIFY] [app.js](file:///d:/ai%20models/invoice/src/js/app.js)
- Register page routes: `quotations`, `quotation-editor`, `expenses`, `payments`.

#### [NEW] [expenses.js](file:///d:/ai%20models/invoice/src/js/expenses.js)
- View displaying list of recorded operational expenses with date filters, category badges, total expenses summary cards.
- Modal dialog for logging expenses and creating custom expense categories.

#### [NEW] [quotations.js](file:///d:/ai%20models/invoice/src/js/quotations.js)
- Quotation management table with status badges (`Draft`, `Sent`, `Accepted`, `Declined`, `Converted`).
- Action button: **"Convert to Invoice"** triggering automated quotation-to-invoice cloning.

#### [NEW] [quotation-editor.js](file:///d:/ai%20models/invoice/src/js/quotation-editor.js)
- Complete quotation creation and editing interface (similar to invoice editor with quotation terms & valid until date).

#### [NEW] [payments.js](file:///d:/ai%20models/invoice/src/js/payments.js)
- Payment Register showing incoming receipts & outgoing payments, Cash vs Bank account breakdown, reference numbers.

#### [MODIFY] [reports.js](file:///d:/ai%20models/invoice/src/js/reports.js)
- Enhance P&L report tab to display:
  - Revenue (Total Invoices)
  - Cost of Goods Sold (Purchases / Stock Cost)
  - **Gross Profit**
  - **Operating Expenses** (Breakdown by Category)
  - **Net Operating Profit**
- Add Accounts Receivable (AR) & Accounts Payable (AP) Aging breakdown table (0-30, 31-60, 61-90, 90+ days).

---

## Verification Plan

### Automated & Manual Verification
1. **Expense Recording & P&L Calculation**:
   - Create custom category "Office Rent".
   - Log expense ₹15,000 paid via Bank Transfer.
   - Open Reports -> Verify P&L reflects ₹15,000 under Operating Expenses and Net Profit is updated accurately.
2. **Quotation Creation & Conversion**:
   - Create Quotation `QTN-2026-001` for a client with 2 items.
   - Click "Convert to Invoice".
   - Verify a new invoice draft `INV-2026-xxx` is generated with identical client, items, discounts, and tax lines, and quotation status updates to `Converted`.
3. **Payment Receipt Logging & Balance Tracking**:
   - Record ₹5,000 payment received for an invoice via UPI.
   - Verify payment register logs transaction and updates client outstanding balance.
