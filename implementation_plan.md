# Enterprise Purchase Products & Vendor Management Module Plan

Integrate a complete **Purchases & Vendor Management** module into InvoiceForge. This will allow users to register vendors/suppliers, create & track Purchase Orders / Purchase Bills, automatically update inventory stock upon receiving purchases, and maintain a complete audit trail for cost of goods and payables.

---

## User Review Required

> [!IMPORTANT]
> - **Stock Auto-Increment**: When a Purchase Bill status is set to **`Received`** or **`Paid`**, the system will automatically increment the inventory stock (`current_stock`) for mapped products and update their `cost_price` to the latest purchase cost.
> - **Navigation Integration**: Two new items will be added to the top navigation bar: **`Purchases`** (Purchase Orders & Bills) and **`Vendors`** (Supplier Accounts).

---

## Proposed Changes

### Database & Backend

#### [MODIFY] [database.js](file:///d:/ai%20models/invoice/db/database.js)
- Add SQLite tables: `vendors`, `purchases`, `purchase_items`.
- Add CRUD helper functions:
  - **Vendors**: `getAllVendors()`, `getVendor(id)`, `saveVendor(data)`, `deleteVendor(id)`, `getVendorFullProfile(id)`.
  - **Purchases**: `getAllPurchases(filters)`, `getPurchase(id)`, `getNextPurchaseNumberObj()`, `savePurchaseAndReturn(data)`, `deletePurchase(id)`, `updatePurchaseStatus(id, status)`.
  - **Stock Integration**: `addStockForPurchase(purchaseId)` and `restoreStockForPurchase(purchaseId)`.

#### [MODIFY] [main.js](file:///d:/ai%20models/invoice/main.js)
- Register IPC handlers for vendor and purchase operations:
  - `get-vendors`, `get-vendor`, `save-vendor`, `delete-vendor`, `get-vendor-profile`
  - `get-purchases`, `get-purchase`, `get-next-purchase-number`, `save-purchase`, `delete-purchase`, `update-purchase-status`

#### [MODIFY] [preload.js](file:///d:/ai%20models/invoice/preload.js)
- Expose vendor and purchase methods on `window.api`:
  - `getVendors`, `getVendor`, `saveVendor`, `deleteVendor`, `getVendorProfile`
  - `getPurchases`, `getPurchase`, `getNextPurchaseNumber`, `savePurchase`, `deletePurchase`, `updatePurchaseStatus`

---

### UI & Navigation

#### [MODIFY] [index.html](file:///d:/ai%20models/invoice/src/index.html)
- Add nav items for **Purchases** and **Vendors** in the top navigation bar `<nav class="sidebar-nav">`.
- Add script tags loading `js/vendors.js`, `js/purchase-editor.js`, and `js/purchases.js`.

#### [MODIFY] [app.js](file:///d:/ai%20models/invoice/src/js/app.js)
- Register page routes in `PAGES`: `purchases`, `vendors`, `purchase-editor`.

#### [NEW] [vendors.js](file:///d:/ai%20models/invoice/src/js/vendors.js)
- Vendor Management view with searchable supplier list.
- Add / Edit Vendor Modal (Name, Company, Address, Email, Phone, GSTIN).
- Vendor profile overview showing purchase history and outstanding payables.

#### [NEW] [purchases.js](file:///d:/ai%20models/invoice/src/js/purchases.js)
- Purchase Orders & Bills history table with status badges (`Draft`, `Pending`, `Received`, `Paid`, `Cancelled`).
- Filter bar (Vendor filter, Date range, Status filter).
- Action buttons: View/Edit, Mark Received/Paid, Delete.

#### [NEW] [purchase-editor.js](file:///d:/ai%20models/invoice/src/js/purchase-editor.js)
- Full Purchase Bill / Order Editor:
  - Auto-generated Purchase Number (e.g. `PUR-2026-001`).
  - Vendor selector dropdown + inline "Add New Vendor".
  - Purchase Date & Due Date pickers.
  - Interactive line items table linked to inventory products (Item selector, Qty, Cost Rate, Subtotal).
  - Tax lines (CGST/SGST) & Discount.
  - Grand total calculation.
  - "Save & Update Stock" button.

---

## Verification Plan

### Automated / Manual Verification
1. **Vendor Creation**:
   - Navigate to Vendors page -> Add new vendor "Global Tech Suppliers" -> Edit details -> Verify persistence in SQLite.
2. **Purchase Creation & Auto-Stock Update**:
   - Navigate to Purchases page -> Click "+ New Purchase Order".
   - Select vendor "Global Tech Suppliers".
   - Add product line item (e.g., 20 units of "Wireless Mouse" at cost price ₹400).
   - Set status to **`Received`** and Save.
   - Open **Inventory & Stock** page and verify "Wireless Mouse" stock increased by +20 units and cost price updated to ₹400.
3. **Purchase Deletion & Stock Reversal**:
   - Delete test purchase order -> Verify stock automatically decreases by 20 units in stock audit log.
