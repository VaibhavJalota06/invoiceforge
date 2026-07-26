/**
 * reports.js — Financial Reports & CSV Export module for InvoiceForge
 */

let _currentReportFilters = {
  period: 'month',
  year: new Date().getFullYear(),
  month: String(new Date().getMonth() + 1).padStart(2, '0'),
  date_from: '',
  date_to: ''
};

async function renderReports(filtersOverride = null) {
  const content = document.getElementById('page-content');
  if (!content) return;
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  if (filtersOverride) {
    Object.assign(_currentReportFilters, filtersOverride);
  }

  try {
    const report = await window.api.getFinancialReportData(_currentReportFilters);
    const settings = await window.api.getSettings();
    const curr = getCurrency(settings?.default_currency || 'INR');
    const fmt = n => `${curr.symbol} ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const { metrics, taxBreakdown, clients, invoices } = report;
    const currentYear = new Date().getFullYear();

    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Financial Reports &amp; Analytics</h1>
          <p class="page-subtitle">Revenue ledgers, GST tax liability, client statements, and data exports</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary" id="btn-export-month-pkg">${ICONS.plus || ''} Export Selected Month Package (.zip)</button>
          <button class="btn btn-secondary" id="btn-import-month-pkg">${ICONS.check || ''} Import &amp; Merge Package (.zip)</button>
          <button class="btn btn-secondary" id="btn-export-reports-csv">${ICONS.pdf || ''} Export Sales Ledger (CSV)</button>
          <button class="btn btn-primary" id="btn-export-tax-csv">${ICONS.check || ''} Export Tax Report (CSV)</button>
        </div>
      </div>

      <!-- Filter Controls Bar -->
      <div class="card" style="margin-bottom:20px;padding:16px 20px">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <span style="font-size:13px;font-weight:600;color:var(--text)">Report Period:</span>
            
            <select class="form-select" id="report-period-select" style="width:auto;min-width:140px">
              <option value="month" ${!_currentReportFilters.period || _currentReportFilters.period === 'month' ? 'selected' : ''}>Monthly</option>
              <option value="year" ${_currentReportFilters.period === 'year' ? 'selected' : ''}>Yearly</option>
              <option value="custom" ${_currentReportFilters.period === 'custom' ? 'selected' : ''}>Custom Range</option>
              <option value="all" ${_currentReportFilters.period === 'all' ? 'selected' : ''}>All Time</option>
            </select>

            <div id="wrap-month-select" style="display:${!_currentReportFilters.period || _currentReportFilters.period === 'month' ? 'flex' : 'none'};gap:8px">
              <select class="form-select" id="report-month-select" style="width:auto">
                <option value="01" ${_currentReportFilters.month === '01' ? 'selected' : ''}>January</option>
                <option value="02" ${_currentReportFilters.month === '02' ? 'selected' : ''}>February</option>
                <option value="03" ${_currentReportFilters.month === '03' ? 'selected' : ''}>March</option>
                <option value="04" ${_currentReportFilters.month === '04' ? 'selected' : ''}>April</option>
                <option value="05" ${_currentReportFilters.month === '05' ? 'selected' : ''}>May</option>
                <option value="06" ${_currentReportFilters.month === '06' ? 'selected' : ''}>June</option>
                <option value="07" ${_currentReportFilters.month === '07' ? 'selected' : ''}>July</option>
                <option value="08" ${_currentReportFilters.month === '08' ? 'selected' : ''}>August</option>
                <option value="09" ${_currentReportFilters.month === '09' ? 'selected' : ''}>September</option>
                <option value="10" ${_currentReportFilters.month === '10' ? 'selected' : ''}>October</option>
                <option value="11" ${_currentReportFilters.month === '11' ? 'selected' : ''}>November</option>
                <option value="12" ${_currentReportFilters.month === '12' ? 'selected' : ''}>December</option>
              </select>
            </div>

            <div id="wrap-year-select" style="display:${!_currentReportFilters.period || _currentReportFilters.period === 'month' || _currentReportFilters.period === 'year' ? 'flex' : 'none'};gap:8px">
              <select class="form-select" id="report-year-select" style="width:auto">
                <option value="${currentYear}" ${_currentReportFilters.year == currentYear ? 'selected' : ''}>${currentYear}</option>
                <option value="${currentYear - 1}" ${_currentReportFilters.year == currentYear - 1 ? 'selected' : ''}>${currentYear - 1}</option>
                <option value="${currentYear - 2}" ${_currentReportFilters.year == currentYear - 2 ? 'selected' : ''}>${currentYear - 2}</option>
              </select>
            </div>

            <div id="wrap-custom-date" style="display:${_currentReportFilters.period === 'custom' ? 'flex' : 'none'};align-items:center;gap:8px">
              <input class="form-input" id="report-date-from" type="date" value="${_currentReportFilters.date_from || ''}" style="width:auto" />
              <span style="font-size:12px;color:var(--text-3)">to</span>
              <input class="form-input" id="report-date-to" type="date" value="${_currentReportFilters.date_to || ''}" style="width:auto" />
            </div>
          </div>

          <span class="badge badge-info" style="font-size:12px;padding:5px 12px">
            Window: ${formatDate(report.dateFrom)} — ${formatDate(report.dateTo)}
          </span>
        </div>
      </div>

      <!-- KPI Financial Summary Cards Grid -->
      <div class="stats-grid" style="margin-bottom:24px">
        <div class="stat-card">
          <div class="stat-icon purple">${ICONS.pdf || ''}</div>
          <div class="stat-info">
            <div class="stat-label">Gross Billed Revenue</div>
            <div class="stat-value">${fmt(metrics.totalBilled)}</div>
            <div class="stat-sub">${metrics.totalInvoicesCount} finalized invoice${metrics.totalInvoicesCount !== 1 ? 's' : ''}</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon green">${ICONS.check || ''}</div>
          <div class="stat-info">
            <div class="stat-label">Collected Payments</div>
            <div class="stat-value" style="color:var(--success)">${fmt(metrics.paidAmount)}</div>
            <div class="stat-sub">Received in full</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon yellow">${ICONS.edit || ''}</div>
          <div class="stat-info">
            <div class="stat-label">Total Tax Collected</div>
            <div class="stat-value" style="color:var(--warning)">${fmt(metrics.taxSum)}</div>
            <div class="stat-sub">${taxBreakdown.length} tax category line${taxBreakdown.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon red">${ICONS.trash || ''}</div>
          <div class="stat-info">
            <div class="stat-label">Outstanding Receivables</div>
            <div class="stat-value" style="color:var(--danger)">${fmt(metrics.outstandingAmount)}</div>
            <div class="stat-sub">Unpaid &amp; Overdue balance</div>
          </div>
        </div>
      </div>

      <!-- Report Content Section -->
      <div style="display:grid;grid-template-columns:1fr 340px;gap:20px;align-items:start">
        
        <!-- Detailed Invoice Ledger Table -->
        <div class="card">
          <div class="form-section-title" style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
            <span>Period Transaction Ledger (${invoices.length})</span>
            <button class="btn btn-ghost btn-sm" id="btn-export-ledger-csv">Export Table (.csv)</button>
          </div>
          
          <div class="table-wrap" style="max-height:480px;overflow-y:auto">
            ${invoices.length === 0 ? `
              <div class="empty-state" style="padding:32px">
                <p>No billing transactions found in selected period.</p>
              </div>
            ` : `
              <table>
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Client Name</th>
                    <th style="text-align:right">Subtotal</th>
                    <th style="text-align:right">Tax</th>
                    <th style="text-align:right">Grand Total</th>
                    <th style="text-align:center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${invoices.map(inv => `
                    <tr>
                      <td class="td-mono" style="font-weight:600;color:var(--accent)">${escHtml(inv.invoice_number)}</td>
                      <td style="color:var(--text-2)">${formatDate(inv.invoice_date)}</td>
                      <td>${escHtml(inv.client_name || inv.client_company || 'Direct Client')}</td>
                      <td style="text-align:right">${fmt(inv.subtotal)}</td>
                      <td style="text-align:right">${fmt(inv.tax_amount)}</td>
                      <td style="text-align:right;font-weight:700">${fmt(inv.grand_total)}</td>
                      <td style="text-align:center">${statusBadge(inv.status)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>

        <!-- Right Column: Tax Liabilities & Top Client Statements -->
        <div style="display:flex;flex-direction:column;gap:18px">
          
          <!-- Tax Breakdown Card -->
          <div class="card">
            <div class="form-section-title" style="margin-bottom:12px">Tax Liability Summary</div>
            ${taxBreakdown.length === 0 ? `
              <p style="font-size:13px;color:var(--text-3);padding:10px 0">No tax charges recorded in this window.</p>
            ` : `
              <div style="display:flex;flex-direction:column;gap:10px">
                ${taxBreakdown.map(t => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg-3);border-radius:6px;border:1px solid var(--border)">
                    <span style="font-weight:600;font-size:13px;color:var(--text)">${escHtml(t.name)}</span>
                    <span style="font-weight:700;font-size:14px;color:var(--warning)">${fmt(t.amount)}</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Top Client Breakdown -->
          <div class="card">
            <div class="form-section-title" style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
              <span>Client Revenue Ranking</span>
              <button class="btn btn-ghost btn-sm" id="btn-export-clients-csv" style="font-size:11px">CSV</button>
            </div>
            ${clients.length === 0 ? `
              <p style="font-size:13px;color:var(--text-3);padding:10px 0">No client transactions.</p>
            ` : `
              <div style="display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto">
                ${clients.slice(0, 10).map(c => `
                  <div style="padding:8px 10px;background:var(--bg-3);border-radius:6px;display:flex;justify-content:space-between;align-items:center">
                    <div>
                      <div style="font-size:13px;font-weight:600;color:var(--text)">${escHtml(c.name)}</div>
                      <div style="font-size:11px;color:var(--text-3)">${c.invoiceCount} invoice${c.invoiceCount !== 1 ? 's' : ''}</div>
                    </div>
                    <div style="text-align:right">
                      <div style="font-size:13px;font-weight:700;color:var(--accent)">${fmt(c.totalBilled)}</div>
                      ${c.outstanding > 0 ? `<div style="font-size:11px;color:var(--danger)">Bal: ${fmt(c.outstanding)}</div>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Product Stock Export Helper -->
          <div class="card">
            <div class="form-section-title" style="margin-bottom:8px">Inventory Data Export</div>
            <p style="font-size:12px;color:var(--text-2);margin-bottom:10px">Download complete stock inventory with SKU, rates, and current stock count.</p>
            <button class="btn btn-secondary btn-sm" id="btn-export-products-csv" style="width:100%">Export Stock Inventory (.csv)</button>
          </div>

        </div>
      </div>
    `;

    // Event Handlers for Period Selectors
    const periodSelect = document.getElementById('report-period-select');
    const monthSelect = document.getElementById('report-month-select');
    const yearSelect = document.getElementById('report-year-select');
    const dateFromInput = document.getElementById('report-date-from');
    const dateToInput = document.getElementById('report-date-to');

    periodSelect?.addEventListener('change', () => {
      const period = periodSelect.value;
      const monthWrap = document.getElementById('wrap-month-select');
      const yearWrap = document.getElementById('wrap-year-select');
      const customWrap = document.getElementById('wrap-custom-date');

      if (monthWrap) monthWrap.style.display = period === 'month' ? 'flex' : 'none';
      if (yearWrap) yearWrap.style.display = (period === 'month' || period === 'year') ? 'flex' : 'none';
      if (customWrap) customWrap.style.display = period === 'custom' ? 'flex' : 'none';

      renderReports({ period });
    });

    monthSelect?.addEventListener('change', () => renderReports({ month: monthSelect.value }));
    yearSelect?.addEventListener('change', () => renderReports({ year: yearSelect.value }));

    const handleCustomDateChange = () => {
      if (dateFromInput?.value && dateToInput?.value) {
        renderReports({ period: 'custom', date_from: dateFromInput.value, date_to: dateToInput.value });
      }
    };
    dateFromInput?.addEventListener('change', handleCustomDateChange);
    dateToInput?.addEventListener('change', handleCustomDateChange);

    // CSV Export Triggers
    document.getElementById('btn-export-reports-csv')?.addEventListener('click', async () => {
      const res = await window.api.exportFinancialCsv(_currentReportFilters, 'invoices');
      if (res?.success) showToast('Sales ledger exported successfully!', 'success');
      else if (res?.reason !== 'canceled') showToast('Export failed: ' + res.reason, 'error');
    });

    document.getElementById('btn-export-tax-csv')?.addEventListener('click', async () => {
      const res = await window.api.exportFinancialCsv(_currentReportFilters, 'tax');
      if (res?.success) showToast('Tax liability report exported to CSV!', 'success');
      else if (res?.reason !== 'canceled') showToast('Export failed: ' + res.reason, 'error');
    });

    document.getElementById('btn-export-ledger-csv')?.addEventListener('click', async () => {
      const res = await window.api.exportFinancialCsv(_currentReportFilters, 'invoices');
      if (res?.success) showToast('Transaction ledger exported to CSV!', 'success');
    });

    document.getElementById('btn-export-clients-csv')?.addEventListener('click', async () => {
      const res = await window.api.exportFinancialCsv(_currentReportFilters, 'clients');
      if (res?.success) showToast('Client revenue summary exported to CSV!', 'success');
    });

    document.getElementById('btn-export-products-csv')?.addEventListener('click', async () => {
      const res = await window.api.exportFinancialCsv(_currentReportFilters, 'products');
      if (res?.success) showToast('Product stock inventory exported to CSV!', 'success');
    });

    document.getElementById('btn-export-month-pkg')?.addEventListener('click', async () => {
      const res = await window.api.exportMonthlyDataPackage(_currentReportFilters);
      if (res?.success) showToast('Selective month data package (.zip) exported!', 'success');
      else if (res?.reason !== 'canceled') showToast('Export failed: ' + res.reason, 'error');
    });

    document.getElementById('btn-import-month-pkg')?.addEventListener('click', async () => {
      showToast('Opening data package importer…', 'info');
      try {
        const res = await window.api.importMonthlyDataPackage();
        if (res?.success) {
          const msg = res.summary
            ? `🎉 Data merged: ${res.summary.insertedInvoicesCount} new, ${res.summary.updatedInvoicesCount} updated invoices!`
            : '🎉 Data merged successfully!';
          showToast(msg, 'success');
          setTimeout(() => renderReports(), 300);
        } else if (res?.reason !== 'canceled') {
          showToast('Import failed: ' + (res?.reason || 'Invalid data package'), 'error');
        }
      } catch (err) {
        showToast('Import error: ' + err.message, 'error');
      }
    });

  } catch (err) {
    console.error('Reports render error:', err);
    content.innerHTML = `<div class="loading-state"><p style="color:var(--danger)">Failed to render financial reports: ${err.message}</p></div>`;
  }
}

window.renderReports = renderReports;
