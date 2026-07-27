/**
 * invoice-print.js — Builds the professional PDF/print HTML for an invoice
 * Called by invoice-editor.js when exporting PDF or printing
 */

function buildInvoicePrintHtml(inv, settings) {
  const curr = getCurrency(inv.currency || 'INR');
  const fmt = n => `${curr.symbol} ${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  const taxLines  = Array.isArray(inv.tax_lines) ? inv.tax_lines : [];
  const items     = Array.isArray(inv.items) ? inv.items : [];
  const snapshot  = inv.client_snapshot || {};

  const primaryColor = settings?.primary_color || '#4f46e5';
  const invoiceTheme = settings?.invoice_theme || 'classic';

  // Client info: prefer snapshot (captured at invoice time), fallback to joined columns
  const clientName    = inv.client_name    || snapshot.name    || '';
  const clientCompany = inv.client_company || snapshot.company_name || '';
  const clientAddr    = inv.client_address || snapshot.billing_address || '';
  const clientEmail   = inv.client_email   || snapshot.email   || '';
  const clientPhone   = inv.client_phone   || snapshot.phone   || '';
  const clientGstin   = inv.client_gstin   || snapshot.gstin   || '';

  const statusLabel = { draft:'Draft', unpaid:'Unpaid', paid:'Paid', overdue:'Overdue' }[inv.status] || inv.status;
  const statusColor = { draft:'#6b7491', unpaid:'#f59e0b', paid:'#22c55e', overdue:'#ef4444' }[inv.status] || '#6b7491';

  const hasHsn = items.some(i => i.hsn_code && String(i.hsn_code).trim() !== '');

  const lineItemsHtml = items.length === 0
    ? `<tr><td colspan="${hasHsn ? 5 : 4}" style="text-align:center;color:#888;padding:24px">No items</td></tr>`
    : items.map((item, idx) => `
        <tr style="background:${idx%2===0?'#fff':'#f9fafb'}">
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#111">${_pEsc(item.description)}</td>
          ${hasHsn ? `<td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center;color:#4b5563;font-weight:600">${_pEsc(item.hsn_code || '—')}</td>` : ''}
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center;color:#374151">${Number(item.quantity).toLocaleString('en-IN')} ${_pEsc(item.unit || 'Pcs')}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151">${fmt(item.rate)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#111">${fmt(item.amount)}</td>
        </tr>`
      ).join('');

  const taxRowsHtml = taxLines.map(t => `
    <tr>
      <td style="padding:5px 0;color:#6b7280">${_pEsc(t.name)} (${t.rate}%)</td>
      <td style="padding:5px 0;text-align:right;color:#374151">${fmt(t.amount)}</td>
    </tr>`
  ).join('');

  const discAmt = inv.discount_amount || 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice ${_pEsc(inv.invoice_number)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 13px;
    color: #111827;
    background: #fff;
    padding: 0;
  }
  .page {
    max-width: 800px;
    margin: 0 auto;
    padding: 48px 52px;
    min-height: 100vh;
    background: #fff;
    border-top: ${invoiceTheme === 'modern' ? `6px solid ${primaryColor}` : 'none'};
  }
  /* Header */
  .inv-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 36px;
    padding-bottom: 28px;
    border-bottom: ${invoiceTheme === 'minimal' ? '1px solid #e5e7eb' : `2px solid ${primaryColor}`};
  }
  .company-block h1 {
    font-size: 22px;
    font-weight: 800;
    color: #111;
    margin-bottom: 4px;
  }
  .company-block p {
    font-size: 12.5px;
    color: #6b7280;
    line-height: 1.7;
    white-space: pre-wrap;
  }
  .invoice-meta {
    text-align: right;
  }
  .invoice-meta .inv-title {
    font-size: 28px;
    font-weight: 900;
    color: ${primaryColor};
    letter-spacing: -1px;
    margin-bottom: 8px;
  }
  .inv-number {
    font-size: 15px;
    font-weight: 700;
    color: #374151;
    margin-bottom: 4px;
  }
  .inv-status {
    display: inline-block;
    padding: 3px 12px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: ${statusColor}22;
    color: ${statusColor};
    margin-bottom: 12px;
  }
  .meta-row {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
    font-size: 12px;
    color: #6b7280;
    margin-top: 4px;
  }
  .meta-row strong { color: #374151; }

  /* Addresses */
  .addresses {
    display: flex;
    gap: 40px;
    margin-bottom: 32px;
  }
  .address-block { flex: 1; }
  .address-block .label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #9ca3af;
    margin-bottom: 6px;
  }
  .address-block .name {
    font-size: 15px;
    font-weight: 700;
    color: #111;
    margin-bottom: 3px;
  }
  .address-block p {
    font-size: 12.5px;
    color: #6b7280;
    line-height: 1.7;
  }

  /* Items Table */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
  }
  .items-table thead th {
    background: #f3f4f6;
    padding: 11px 14px;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .items-table thead th:not(:first-child) { text-align: right; }
  .items-table thead th:nth-child(2) { text-align: center; }

  /* Totals */
  .totals-wrap {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 32px;
  }
  .totals-table {
    width: 280px;
  }
  .totals-table td {
    padding: 5px 0;
    font-size: 13px;
  }
  .totals-table .grand-row {
    border-top: 2px solid #e5e7eb;
    padding-top: 10px;
  }
  .totals-table .grand-row td {
    padding-top: 12px;
    font-size: 16px;
    font-weight: 800;
    color: ${primaryColor};
  }

  /* Footer sections */
  .inv-footer {
    border-top: 1px solid #e5e7eb;
    padding-top: 24px;
    display: flex;
    gap: 40px;
  }
  .footer-block { flex: 1; }
  .footer-block .label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #9ca3af;
    margin-bottom: 6px;
  }
  .footer-block p {
    font-size: 12px;
    color: #6b7280;
    line-height: 1.7;
    white-space: pre-wrap;
  }

  .thank-you {
    text-align: center;
    margin-top: 36px;
    font-size: 13px;
    color: #9ca3af;
    font-style: italic;
  }

  @media print {
    body { margin: 0; }
    .page { padding: 24px 32px; }
    @page { size: A4; margin: 0; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- ── Header ── -->
  <div class="inv-header">
    <div class="company-block">
      ${settings && settings.logo_path ? `<img src="${_pEsc(settings.logo_path)}" style="max-height:64px;max-width:200px;margin-bottom:12px;display:block;object-fit:contain" alt="Company Logo">` : ''}
      <h1>${_pEsc(settings.company_name || 'Your Company')}</h1>
      <p>${_pEsc([
          settings.company_address,
          settings.company_phone,
          settings.company_email
        ].filter(Boolean).join('\n'))}</p>
      ${settings.tax_number ? `<p style="margin-top:6px"><strong>GST:</strong> ${_pEsc(settings.tax_number)}</p>` : ''}
    </div>
    <div class="invoice-meta">
      ${inv.invoice_number && inv.invoice_number.toUpperCase().includes('DUPLICATE') ? `
        <div style="display:inline-block;padding:4px 12px;background:#fee2e2;color:#dc2626;border:1.5px solid #ef4444;border-radius:4px;font-weight:900;font-size:13px;letter-spacing:2px;margin-bottom:8px;text-transform:uppercase">DUPLICATE COPY</div>
        <div class="inv-title" style="color:#dc2626">DUPLICATE INVOICE</div>
      ` : `
        <div class="inv-title">INVOICE</div>
      `}
      <div class="inv-number">${_pEsc(inv.invoice_number)}</div>
      <div class="inv-status">${_pEsc(statusLabel)}</div>
      <div class="meta-row"><strong>Date:</strong> ${_formatDate(inv.invoice_date)}</div>
      ${inv.due_date ? `<div class="meta-row"><strong>Due:</strong> ${_formatDate(inv.due_date)}</div>` : ''}
      <div class="meta-row"><strong>Currency:</strong> ${_pEsc(inv.currency)} (${curr.symbol})</div>
    </div>
  </div>

  <!-- ── Addresses ── -->
  <div class="addresses">
    <div class="address-block">
      <div class="label">From</div>
      <div class="name">${_pEsc(settings.company_name || 'Your Company')}</div>
      <p>${_pEsc([settings.company_address, settings.company_phone, settings.company_email].filter(Boolean).join('\n'))}</p>
    </div>
    <div class="address-block">
      <div class="label">Bill To</div>
      <div class="name">${_pEsc(clientName || clientCompany || 'Client')}</div>
      ${clientCompany && clientName ? `<p><strong>${_pEsc(clientCompany)}</strong></p>` : ''}
      <p>${_pEsc([clientAddr, clientEmail, clientPhone].filter(Boolean).join('\n'))}</p>
      ${clientGstin ? `<p style="margin-top:4px"><strong>GSTIN:</strong> ${_pEsc(clientGstin)}</p>` : ''}
    </div>
  </div>

  <!-- ── Line Items ── -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:50%">Description</th>
        <th style="width:12%;text-align:center">Qty</th>
        <th style="width:18%;text-align:right">Rate</th>
        <th style="width:20%;text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${lineItemsHtml}</tbody>
  </table>

  <!-- ── Totals ── -->
  <div class="totals-wrap">
    <table class="totals-table">
      <tr>
        <td style="color:#6b7280">Subtotal</td>
        <td style="text-align:right">${fmt(inv.subtotal)}</td>
      </tr>
      ${discAmt > 0 ? `
      <tr>
        <td style="color:#6b7280">Discount${inv.discount_type==='percentage'?' ('+inv.discount_value+'%)':''}</td>
        <td style="text-align:right;color:#f59e0b">− ${fmt(discAmt)}</td>
      </tr>` : ''}
      ${taxRowsHtml}
      <tr class="grand-row">
        <td>Total Due</td>
        <td style="text-align:right">${fmt(inv.grand_total)}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding-top:10px;font-size:12px;color:#4b5563;border-top:1px dashed #e5e7eb">
          <strong>Amount in Words:</strong><br>
          <span style="color:#5c6bc0;font-weight:600">${_pEsc(numberToWords(inv.grand_total, inv.currency))}</span>
        </td>
      </tr>
    </table>
  </div>

  <!-- ── Footer ── -->
  <div class="inv-footer">
    ${settings.bank_details ? `
    <div class="footer-block">
      <div class="label">Payment Details</div>
      <p>${_pEsc(settings.bank_details)}</p>
    </div>` : ''}
    ${inv.notes ? `
    <div class="footer-block">
      <div class="label">Notes &amp; Terms</div>
      <p>${_pEsc(inv.notes)}</p>
    </div>` : ''}
    ${settings.invoice_footer ? `
    <div class="footer-block">
      <div class="label">Footer</div>
      <p>${_pEsc(settings.invoice_footer)}</p>
    </div>` : ''}
  </div>

  <div class="thank-you">Thank you for your business!</div>
</div>
</body>
</html>`;
}

function _pEsc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function _formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}
