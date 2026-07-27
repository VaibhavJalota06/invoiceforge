/**
 * reports.js — Financial Reports, Balance Sheet & Monthly Stock Valuation for InvoiceForge
 */

let _currentReportFilters = {
  period: 'month',
  year: new Date().getFullYear(),
  month: String(new Date().getMonth() + 1).padStart(2, '0'),
  date_from: '',
  date_to: ''
};

let _currentReportTab = 'overview'; // 'overview', 'balancesheet', 'stock'

async function renderReports(filtersOverride = null, activeTabOverride = null) {
  const content = document.getElementById('page-content');
  if (!content) return;
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  if (filtersOverride) {
    Object.assign(_currentReportFilters, filtersOverride);
  }
  if (activeTabOverride) {
    _currentReportTab = activeTabOverride;
  }

  try {
    const report = await window.api.getFinancialReportData(_currentReportFilters);
    const balanceSheet = await window.api.getBalanceSheet();
    const stockReport = await window.api.getMonthlyStockReport(_currentReportFilters);
    const agingReport = await window.api.getAgingReport();
    const settings = await window.api.getSettings();

    const curr = getCurrency(settings?.default_currency || 'INR');
    const fmt = n => `${curr.symbol} ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const currentYear = new Date().getFullYear();

    const { metrics, taxBreakdown, clients, invoices } = report;

    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Financial Reports &amp; Analytics</h1>
          <p class="page-subtitle">Balance sheet statements, monthly stock valuations, aging schedules &amp; GST liabilities</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary" id="btn-export-month-pkg">${ICONS.plus || ''} Export Selected Month Package (.zip)</button>
          <button class="btn btn-secondary" id="btn-import-month-pkg">${ICONS.check || ''} Import Package (.zip)</button>
          <button class="btn btn-primary" id="btn-export-tax-csv">${ICONS.check || ''} Export Tax Report (CSV)</button>
        </div>
      </div>

      <!-- Report View Tabs -->
      <div style="display:flex;gap:10px;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:12px;flex-wrap:wrap">
        <button class="btn ${_currentReportTab === 'overview' ? 'btn-primary' : 'btn-secondary'}" id="tab-btn-overview" style="font-weight:600">
          📊 Revenue &amp; Financial Overview
        </button>
        <button class="btn ${_currentReportTab === 'gst' ? 'btn-primary' : 'btn-secondary'}" id="tab-btn-gst" style="font-weight:600">
          🏛️ GST Liabilities &amp; Tax Audit
        </button>
        <button class="btn ${_currentReportTab === 'balancesheet' ? 'btn-primary' : 'btn-secondary'}" id="tab-btn-balancesheet" style="font-weight:600">
          ⚖️ Enterprise Balance Sheet
        </button>
        <button class="btn ${_currentReportTab === 'stock' ? 'btn-primary' : 'btn-secondary'}" id="tab-btn-stock" style="font-weight:600">
          📦 Stock &amp; Inventory Valuation
        </button>
        <button class="btn ${_currentReportTab === 'aging' ? 'btn-primary' : 'btn-secondary'}" id="tab-btn-aging" style="font-weight:600">
          ⏳ AR/AP Aging Analysis
        </button>
      </div>

      ${_currentReportTab === 'overview' ? renderOverviewSection(report, fmt, currentYear) : ''}
      ${_currentReportTab === 'gst' ? renderGstSection(report, fmt, currentYear) : ''}
      ${_currentReportTab === 'balancesheet' ? renderBalanceSheetSection(balanceSheet, fmt) : ''}
      ${_currentReportTab === 'stock' ? renderMonthlyStockSection(stockReport, fmt) : ''}
      ${_currentReportTab === 'aging' ? renderAgingSection(agingReport, fmt) : ''}
    `;

    // Bind Tab Click Handlers
    document.getElementById('tab-btn-overview')?.addEventListener('click', () => renderReports(null, 'overview'));
    document.getElementById('tab-btn-gst')?.addEventListener('click', () => renderReports(null, 'gst'));
    document.getElementById('tab-btn-balancesheet')?.addEventListener('click', () => renderReports(null, 'balancesheet'));
    document.getElementById('tab-btn-stock')?.addEventListener('click', () => renderReports(null, 'stock'));
    document.getElementById('tab-btn-aging')?.addEventListener('click', () => renderReports(null, 'aging'));

    // Bind Controls depending on active view
    if (_currentReportTab === 'overview' || _currentReportTab === 'gst') {
      bindOverviewEvents();
    } else if (_currentReportTab === 'balancesheet') {
      bindBalanceSheetEvents();
    } else if (_currentReportTab === 'stock') {
      bindStockEvents();
    } else if (_currentReportTab === 'aging') {
      bindAgingEvents();
    }

    // Global Package Export/Import
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

    document.getElementById('btn-export-tax-csv')?.addEventListener('click', async () => {
      const res = await window.api.exportFinancialCsv(_currentReportFilters, 'tax');
      if (res?.success) showToast('Tax liability report exported to CSV!', 'success');
      else if (res?.reason !== 'canceled') showToast('Export failed: ' + res.reason, 'error');
    });

  } catch (err) {
    console.error('Reports render error:', err);
    content.innerHTML = `<div class="loading-state"><p style="color:var(--danger)">Failed to render financial reports: ${err.message}</p></div>`;
  }
}

// ── OVERVIEW RENDERER ────────────────────────────────────────────────────────
function renderOverviewSection(report, fmt, currentYear) {
  const { metrics, taxBreakdown, clients, invoices } = report;
  return `
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
    <div class="stats-grid" style="margin-bottom:24px;grid-template-columns: repeat(4, 1fr);">
      <div class="stat-card">
        <div class="stat-info">
          <div class="stat-label">Gross Revenue</div>
          <div class="stat-value">${fmt(metrics.totalBilled)}</div>
          <div class="stat-sub">${metrics.totalInvoicesCount} finalized invoices</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-info">
          <div class="stat-label">Purchases (COGS)</div>
          <div class="stat-value" style="color:var(--warning)">-${fmt(metrics.costOfGoodsPurchased || 0)}</div>
          <div class="stat-sub">Stock purchases</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-info">
          <div class="stat-label">Operating Expenses</div>
          <div class="stat-value" style="color:var(--danger)">-${fmt(metrics.totalOperatingExpenses || 0)}</div>
          <div class="stat-sub">Rent, utilities, staff</div>
        </div>
      </div>

      <div class="stat-card" style="border-left:3px solid var(--success)">
        <div class="stat-info">
          <div class="stat-label">Net Operating Profit</div>
          <div class="stat-value" style="color:${(metrics.netOperatingProfit || 0) >= 0 ? 'var(--success)' : 'var(--danger)'}">
            ${fmt(metrics.netOperatingProfit || 0)}
          </div>
          <div class="stat-sub">Revenue - COGS - Expenses</div>
        </div>
      </div>
    </div>

    <!-- Main Overview Content -->
    <div style="display:grid;grid-template-columns:1fr 340px;gap:20px;align-items:start">
      
      <!-- Transaction Table -->
      <div class="card">
        <div class="form-section-title" style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
          <span>Period Sales Ledger (${invoices.length})</span>
          <button class="btn btn-ghost btn-sm" id="btn-export-ledger-csv">Export (.csv)</button>
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

      <!-- Right Side Column -->
      <div style="display:flex;flex-direction:column;gap:18px">
        <!-- Aging Receivables & Payables Breakdown -->
        <div class="card">
          <div class="form-section-title" style="margin-bottom:12px">Accounts Receivable Aging</div>
          <div style="font-size:12px;display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between"><span>Current (0-30 Days):</span> <strong>${fmt(report.arAging?.current || 0)}</strong></div>
            <div style="display:flex;justify-content:space-between"><span>31–60 Days Overdue:</span> <strong style="color:var(--warning)">${fmt(report.arAging?.days30 || 0)}</strong></div>
            <div style="display:flex;justify-content:space-between"><span>61–90 Days Overdue:</span> <strong style="color:var(--danger)">${fmt(report.arAging?.days60 || 0)}</strong></div>
            <div style="display:flex;justify-content:space-between"><span>90+ Days Overdue:</span> <strong style="color:var(--danger)">${fmt(report.arAging?.days90Plus || 0)}</strong></div>
          </div>
        </div>

        <div class="card">
          <div class="form-section-title" style="margin-bottom:12px">GST Tax Liabilities</div>
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
      </div>

    </div>
  `;
}

// ── GST LIABILITIES & TAX AUDIT SECTION ─────────────────────────────────────
function renderGstSection(report, fmt, currentYear) {
  const { metrics, taxBreakdown, invoices } = report;

  const totalOutputTax = taxBreakdown.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  return `
    <!-- Filter Controls Bar -->
    <div class="card" style="margin-bottom:20px;padding:16px 20px">
      <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:600;color:var(--text)">Tax Assessment Period:</span>
          
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

        <button class="btn btn-primary btn-sm" id="btn-export-tax-csv">Export Tax Audit Report (CSV)</button>
      </div>
    </div>

    <!-- GST KPI Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-bottom:20px">
      <div class="card card-body" style="border-top:4px solid var(--accent)">
        <div style="font-size:12px;color:var(--text-2);text-transform:uppercase;font-weight:600">Total Taxable Turnover</div>
        <div style="font-size:24px;font-weight:800;color:var(--accent);margin-top:6px">${fmt(metrics.totalBilled)}</div>
        <div style="font-size:12px;color:var(--text-3);margin-top:4px">${metrics.totalInvoicesCount} invoices assessed</div>
      </div>

      <div class="card card-body" style="border-top:4px solid var(--warning)">
        <div style="font-size:12px;color:var(--text-2);text-transform:uppercase;font-weight:600">GST Output Tax (Sales)</div>
        <div style="font-size:24px;font-weight:800;color:var(--warning);margin-top:6px">${fmt(totalOutputTax)}</div>
        <div style="font-size:12px;color:var(--text-3);margin-top:4px">Collected from clients</div>
      </div>

      <div class="card card-body" style="border-top:4px solid var(--success)">
        <div style="font-size:12px;color:var(--text-2);text-transform:uppercase;font-weight:600">Input Tax Credit (ITC)</div>
        <div style="font-size:24px;font-weight:800;color:var(--success);margin-top:6px">${fmt(metrics.inputTaxCredit || 0)}</div>
        <div style="font-size:12px;color:var(--text-3);margin-top:4px">Claimable from purchases</div>
      </div>

      <div class="card card-body" style="border-top:4px solid var(--danger)">
        <div style="font-size:12px;color:var(--text-2);text-transform:uppercase;font-weight:600">Net Tax Payable</div>
        <div style="font-size:24px;font-weight:800;color:var(--danger);margin-top:6px">${fmt(Math.max(0, totalOutputTax - (metrics.inputTaxCredit || 0)))}</div>
        <div style="font-size:12px;color:var(--text-3);margin-top:4px">Output Tax minus ITC</div>
      </div>
    </div>

    <!-- Tax Rates Breakdown & Invoices Table -->
    <div style="display:grid;grid-template-columns:1fr 340px;gap:20px;align-items:start">
      <div class="card card-body" style="padding:20px">
        <h4 style="margin:0 0 16px;font-size:15px;font-weight:700">Tax Audit Ledger (${invoices.length} transactions)</h4>
        ${invoices.length === 0 ? `
          <div style="text-align:center;padding:30px;color:var(--text-2)">No tax liabilities found in selected window.</div>
        ` : `
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Client / GSTIN</th>
                  <th style="text-align:right">Taxable Amount</th>
                  <th style="text-align:right">Tax Collected</th>
                  <th style="text-align:right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(inv => `
                  <tr>
                    <td class="td-mono" style="font-weight:600;color:var(--accent)">${escHtml(inv.invoice_number)}</td>
                    <td style="color:var(--text-2)">${formatDate(inv.invoice_date)}</td>
                    <td style="font-weight:600;color:var(--text)">
                      ${escHtml(inv.client_name || 'Direct Client')}
                      ${inv.client_gstin ? `<br><small style="color:var(--text-2)">GSTIN: ${escHtml(inv.client_gstin)}</small>` : ''}
                    </td>
                    <td style="text-align:right">${fmt(inv.subtotal)}</td>
                    <td style="text-align:right;font-weight:700;color:var(--warning)">${fmt(inv.tax_amount)}</td>
                    <td style="text-align:right;font-weight:800;color:var(--text)">${fmt(inv.grand_total)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <div class="card card-body" style="padding:20px">
        <h4 style="margin:0 0 14px;font-size:15px;font-weight:700">Tax Rate Slabs</h4>
        ${taxBreakdown.length === 0 ? `
          <div style="font-size:13px;color:var(--text-3);padding:10px 0">No tax breakdown available.</div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:12px">
            ${taxBreakdown.map(t => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg-3);border-radius:6px;border:1px solid var(--border)">
                <div>
                  <div style="font-weight:700;font-size:13px;color:var(--text)">${escHtml(t.name)}</div>
                  <div style="font-size:11px;color:var(--text-3)">Rate: ${t.rate}%</div>
                </div>
                <div style="font-weight:800;font-size:15px;color:var(--warning)">${fmt(t.amount)}</div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

// ── BALANCE SHEET RENDERER ───────────────────────────────────────────────────
function renderBalanceSheetSection(bs, fmt) {
  const { assets, liabilities, equity, asOfDate } = bs;
  const isBalanced = Math.abs(assets.totalAssets - (liabilities.totalLiabilities + equity.netEquity)) < 1;

  return `
    <div class="card" style="margin-bottom:20px;padding:16px 20px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
          <h2 style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:2px">Statement of Financial Position (Balance Sheet)</h2>
          <span style="font-size:13px;color:var(--text-3)">Financial Standing as of ${formatDate(asOfDate)}</span>
        </div>
        <div>
          <span class="badge ${isBalanced ? 'badge-success' : 'badge-warning'}" style="font-size:13px;padding:6px 14px">
            ${isBalanced ? '✓ Balanced: Assets = Liabilities + Equity' : '⚠️ Pending Balance Reconciliation'}
          </span>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">
      
      <!-- ASSETS COLUMN -->
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;margin-bottom:16px;border-bottom:2px solid var(--accent)">
          <h3 style="font-size:16px;font-weight:700;color:var(--accent)">1. TOTAL ASSETS</h3>
          <span style="font-size:18px;font-weight:800;color:var(--accent)">${fmt(assets.totalAssets)}</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px">
          
          <div style="padding:14px;background:var(--bg-3);border-radius:8px;border:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-weight:600;color:var(--text)">Accounts Receivable (Debtors)</span>
              <span style="font-weight:700;color:var(--text)">${fmt(assets.accountsReceivable)}</span>
            </div>
            <p style="font-size:12px;color:var(--text-3);margin:0">Unpaid &amp; outstanding sales invoices owed by clients.</p>
          </div>

          <div style="padding:14px;background:var(--bg-3);border-radius:8px;border:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-weight:600;color:var(--text)">Physical Inventory Valuation (At Cost)</span>
              <span style="font-weight:700;color:var(--text)">${fmt(assets.inventoryValuation)}</span>
            </div>
            <p style="font-size:12px;color:var(--text-3);margin:0">Current warehouse stock evaluated at purchase cost rate (Retail: ${fmt(assets.retailValuation)}).</p>
          </div>

          <div style="padding:14px;background:var(--bg-3);border-radius:8px;border:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-weight:600;color:var(--text)">Cash &amp; Liquid Reserves</span>
              <span style="font-weight:700;color:${assets.cashAndBank >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmt(assets.cashAndBank)}</span>
            </div>
            <p style="font-size:12px;color:var(--text-3);margin:0">Collected sales revenues minus paid supplier purchases.</p>
          </div>

        </div>
      </div>

      <!-- LIABILITIES & EQUITY COLUMN -->
      <div style="display:flex;flex-direction:column;gap:20px">
        
        <!-- LIABILITIES CARD -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;margin-bottom:16px;border-bottom:2px solid var(--danger)">
            <h3 style="font-size:16px;font-weight:700;color:var(--danger)">2. TOTAL LIABILITIES</h3>
            <span style="font-size:18px;font-weight:800;color:var(--danger)">${fmt(liabilities.totalLiabilities)}</span>
          </div>

          <div style="display:flex;flex-direction:column;gap:12px">
            
            <div style="padding:12px;background:var(--bg-3);border-radius:8px;border:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <span style="font-weight:600;color:var(--text)">Accounts Payable (Creditors)</span>
                <span style="font-weight:700;color:var(--text)">${fmt(liabilities.accountsPayable)}</span>
              </div>
              <p style="font-size:12px;color:var(--text-3);margin:0">Outstanding purchase orders &amp; vendor bills.</p>
            </div>

            <div style="padding:12px;background:var(--bg-3);border-radius:8px;border:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <span style="font-weight:600;color:var(--text)">Net GST Tax Liability</span>
                <span style="font-weight:700;color:var(--warning)">${fmt(liabilities.taxPayable)}</span>
              </div>
              <p style="font-size:12px;color:var(--text-3);margin:0">Output GST collected (${fmt(liabilities.outputTax)}) minus Input Tax Credit (${fmt(liabilities.inputTax)}).</p>
            </div>

          </div>
        </div>

        <!-- EQUITY CARD -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;margin-bottom:16px;border-bottom:2px solid var(--success)">
            <h3 style="font-size:16px;font-weight:700;color:var(--success)">3. NET EQUITY &amp; RETAINED EARNINGS</h3>
            <span style="font-size:18px;font-weight:800;color:var(--success)">${fmt(equity.netEquity)}</span>
          </div>

          <div style="padding:12px;background:var(--bg-3);border-radius:8px;border:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-weight:600;color:var(--text)">Net Business Equity Value</span>
              <span style="font-weight:700;color:var(--success)">${fmt(equity.netEquity)}</span>
            </div>
            <p style="font-size:12px;color:var(--text-3);margin:0">Calculated Net Retained Value = Total Assets (${fmt(assets.totalAssets)}) - Total Liabilities (${fmt(liabilities.totalLiabilities)}).</p>
          </div>
        </div>

      </div>

    </div>
  `;
}

// ── MONTHLY STOCK RENDERER ───────────────────────────────────────────────────
function renderMonthlyStockSection(stockReport, fmt) {
  const { items, summary } = stockReport;

  return `
    <div class="card" style="margin-bottom:20px;padding:16px 20px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
          <h2 style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:2px">Monthly Inventory Stock &amp; Valuation Report</h2>
          <span style="font-size:13px;color:var(--text-3)">Detailed physical stock count, cost valuation, and retail margin potential</span>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-export-products-csv">
          Export Stock Report (.csv)
        </button>
      </div>
    </div>

    <!-- Stock KPI Grid -->
    <div class="stats-grid" style="margin-bottom:24px">
      <div class="stat-card">
        <div class="stat-icon purple">${ICONS.check || ''}</div>
        <div class="stat-info">
          <div class="stat-label">Total Product Lines</div>
          <div class="stat-value">${summary.totalProducts}</div>
          <div class="stat-sub">${summary.totalPhysicalUnits} physical unit${summary.totalPhysicalUnits !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon green">${ICONS.pdf || ''}</div>
        <div class="stat-info">
          <div class="stat-label">Stock Valuation (Cost)</div>
          <div class="stat-value" style="color:var(--accent)">${fmt(summary.totalCostValuation)}</div>
          <div class="stat-sub">Based on purchase cost rate</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon yellow">${ICONS.edit || ''}</div>
        <div class="stat-info">
          <div class="stat-label">Stock Valuation (Retail)</div>
          <div class="stat-value" style="color:var(--success)">${fmt(summary.totalRetailValuation)}</div>
          <div class="stat-sub">Based on selling price rate</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon purple">${ICONS.plus || ''}</div>
        <div class="stat-info">
          <div class="stat-label">Unrealized Gross Margin</div>
          <div class="stat-value" style="color:var(--warning)">${fmt(summary.unrealizedMargin)}</div>
          <div class="stat-sub">Potential gross profit</div>
        </div>
      </div>
    </div>

    <!-- Stock Valuation Table -->
    <div class="card">
      <div class="table-wrap" style="max-height:500px;overflow-y:auto">
        ${items.length === 0 ? `
          <div class="empty-state" style="padding:40px">
            <p>No inventory items registered in system database.</p>
          </div>
        ` : `
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>SKU</th>
                <th style="text-align:right">Cost Price</th>
                <th style="text-align:right">Selling Rate</th>
                <th style="text-align:center">Purchased (IN)</th>
                <th style="text-align:center">Sold (OUT)</th>
                <th style="text-align:center">Current Stock</th>
                <th style="text-align:right">Cost Valuation</th>
                <th style="text-align:right">Retail Valuation</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(p => `
                <tr>
                  <td style="font-weight:600;color:var(--text)">${escHtml(p.name)}</td>
                  <td class="td-mono" style="font-size:12px;color:var(--text-2)">${escHtml(p.sku || '-')}</td>
                  <td style="text-align:right">${fmt(p.cost)}</td>
                  <td style="text-align:right">${fmt(p.selling)}</td>
                  <td style="text-align:center;color:var(--success);font-weight:600">+${p.totalIn}</td>
                  <td style="text-align:center;color:var(--danger);font-weight:600">-${p.totalOut}</td>
                  <td style="text-align:center;font-weight:700;color:${p.stock <= 5 ? 'var(--danger)' : 'var(--text)'}">${p.stock} ${escHtml(p.unit || 'pcs')}</td>
                  <td style="text-align:right;font-weight:600">${fmt(p.costValue)}</td>
                  <td style="text-align:right;font-weight:700;color:var(--accent)">${fmt(p.retailValue)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>
  `;
}

// ── EVENT BINDINGS ────────────────────────────────────────────────────────────
function bindOverviewEvents() {
  const periodSelect = document.getElementById('report-period-select');
  const monthSelect = document.getElementById('report-month-select');
  const yearSelect = document.getElementById('report-year-select');
  const dateFromInput = document.getElementById('report-date-from');
  const dateToInput = document.getElementById('report-date-to');

  periodSelect?.addEventListener('change', () => {
    const period = periodSelect.value;
    renderReports({ period }, 'overview');
  });

  monthSelect?.addEventListener('change', () => renderReports({ month: monthSelect.value }, 'overview'));
  yearSelect?.addEventListener('change', () => renderReports({ year: yearSelect.value }, 'overview'));

  const handleCustomDateChange = () => {
    if (dateFromInput?.value && dateToInput?.value) {
      renderReports({ period: 'custom', date_from: dateFromInput.value, date_to: dateToInput.value }, 'overview');
    }
  };
  dateFromInput?.addEventListener('change', handleCustomDateChange);
  dateToInput?.addEventListener('change', handleCustomDateChange);

  document.getElementById('btn-export-ledger-csv')?.addEventListener('click', async () => {
    const res = await window.api.exportFinancialCsv(_currentReportFilters, 'invoices');
    if (res?.success) showToast('Sales ledger exported to CSV!', 'success');
  });

  document.getElementById('btn-export-clients-csv')?.addEventListener('click', async () => {
    const res = await window.api.exportFinancialCsv(_currentReportFilters, 'clients');
    if (res?.success) showToast('Client summary exported to CSV!', 'success');
  });
}

function bindBalanceSheetEvents() {
  // Balance Sheet interactions
}

function bindStockEvents() {
  document.getElementById('btn-export-products-csv')?.addEventListener('click', async () => {
    const res = await window.api.exportFinancialCsv(_currentReportFilters, 'products');
    if (res?.success) showToast('Product stock report exported to CSV!', 'success');
  });
}

// ── AR/AP AGING ANALYSIS SECTION ─────────────────────────────────────────────
function renderAgingSection(aging, fmt) {
  const { asOfDate, arSummary, apSummary, clientAging, vendorAging } = aging || {};

  return `
    <div style="display:flex;flex-direction:column;gap:20px">
      <!-- As Of Date Header Banner -->
      <div class="card card-body" style="background:var(--surface);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding:16px 24px">
        <div>
          <h3 style="margin:0;font-size:18px;font-weight:700">Accounts Receivable &amp; Payable Aging Schedule</h3>
          <p style="margin:4px 0 0;font-size:13px;color:var(--text-2)">Evaluated as of <strong>${asOfDate}</strong></p>
        </div>
      </div>

      <!-- AR Metric Cards -->
      <div>
        <h4 style="margin:0 0 12px;font-size:15px;color:var(--text);font-weight:700">📥 Accounts Receivable (Client Overdue Balances)</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:14px">
          <div class="card card-body" style="border-top:4px solid var(--accent)">
            <div style="font-size:12px;color:var(--text-2);text-transform:uppercase;font-weight:600">Total Receivables</div>
            <div style="font-size:22px;font-weight:800;color:var(--accent);margin-top:6px">${fmt(arSummary?.total)}</div>
          </div>
          <div class="card card-body" style="border-top:4px solid var(--success)">
            <div style="font-size:12px;color:var(--text-2);text-transform:uppercase;font-weight:600">Current (0–30 Days)</div>
            <div style="font-size:20px;font-weight:700;color:var(--success);margin-top:6px">${fmt(arSummary?.current)}</div>
          </div>
          <div class="card card-body" style="border-top:4px solid var(--warning)">
            <div style="font-size:12px;color:var(--text-2);text-transform:uppercase;font-weight:600">31–60 Days Overdue</div>
            <div style="font-size:20px;font-weight:700;color:var(--warning);margin-top:6px">${fmt(arSummary?.days31_60)}</div>
          </div>
          <div class="card card-body" style="border-top:4px solid #f97316">
            <div style="font-size:12px;color:var(--text-2);text-transform:uppercase;font-weight:600">61–90 Days Overdue</div>
            <div style="font-size:20px;font-weight:700;color:#f97316;margin-top:6px">${fmt(arSummary?.days61_90)}</div>
          </div>
          <div class="card card-body" style="border-top:4px solid var(--danger)">
            <div style="font-size:12px;color:var(--text-2);text-transform:uppercase;font-weight:600">90+ Days Overdue</div>
            <div style="font-size:20px;font-weight:700;color:var(--danger);margin-top:6px">${fmt(arSummary?.days90Plus)}</div>
          </div>
        </div>
      </div>

      <!-- Client Aging Breakdown Table -->
      <div class="card card-body" style="padding:20px">
        <h4 style="margin:0 0 16px;font-size:15px;font-weight:700">Client Outstanding Breakdown</h4>
        ${(!clientAging || clientAging.length === 0) ? `
          <div style="text-align:center;padding:30px;color:var(--text-2)">🎉 Excellent! No outstanding client balances or overdue invoices.</div>
        ` : `
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Client / Company</th>
                  <th style="text-align:center">Invoices</th>
                  <th style="text-align:right">Current (0-30d)</th>
                  <th style="text-align:right">31–60 Days</th>
                  <th style="text-align:right">61–90 Days</th>
                  <th style="text-align:right">90+ Days</th>
                  <th style="text-align:right">Total Outstanding</th>
                </tr>
              </thead>
              <tbody>
                ${clientAging.map(c => `
                  <tr>
                    <td style="font-weight:600;color:var(--text)">
                      ${escHtml(c.clientName)}
                      ${c.companyName ? `<br><small style="color:var(--text-2)">${escHtml(c.companyName)}</small>` : ''}
                    </td>
                    <td style="text-align:center">${c.invoiceCount}</td>
                    <td style="text-align:right;color:${c.current > 0 ? 'var(--text)' : 'var(--text-2)'}">${fmt(c.current)}</td>
                    <td style="text-align:right;color:${c.days31_60 > 0 ? 'var(--warning)' : 'var(--text-2)'}">${fmt(c.days31_60)}</td>
                    <td style="text-align:right;color:${c.days61_90 > 0 ? '#f97316' : 'var(--text-2)'}">${fmt(c.days61_90)}</td>
                    <td style="text-align:right;font-weight:700;color:${c.days90Plus > 0 ? 'var(--danger)' : 'var(--text-2)'}">${fmt(c.days90Plus)}</td>
                    <td style="text-align:right;font-weight:800;color:var(--accent)">${fmt(c.total)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <!-- AP Metric Cards -->
      <div style="margin-top:10px">
        <h4 style="margin:0 0 12px;font-size:15px;color:var(--text);font-weight:700">📤 Accounts Payable (Vendor Pending Liabilities)</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:14px">
          <div class="card card-body" style="border-top:4px solid #8b5cf6">
            <div style="font-size:12px;color:var(--text-2);text-transform:uppercase;font-weight:600">Total Payables</div>
            <div style="font-size:22px;font-weight:800;color:#8b5cf6;margin-top:6px">${fmt(apSummary?.total)}</div>
          </div>
          <div class="card card-body" style="border-top:4px solid var(--success)">
            <div style="font-size:12px;color:var(--text-2);text-transform:uppercase;font-weight:600">Current (0–30 Days)</div>
            <div style="font-size:20px;font-weight:700;color:var(--success);margin-top:6px">${fmt(apSummary?.current)}</div>
          </div>
          <div class="card card-body" style="border-top:4px solid var(--warning)">
            <div style="font-size:12px;color:var(--text-2);text-transform:uppercase;font-weight:600">31–60 Days Pending</div>
            <div style="font-size:20px;font-weight:700;color:var(--warning);margin-top:6px">${fmt(apSummary?.days31_60)}</div>
          </div>
          <div class="card card-body" style="border-top:4px solid #f97316">
            <div style="font-size:12px;color:var(--text-2);text-transform:uppercase;font-weight:600">61–90 Days Pending</div>
            <div style="font-size:20px;font-weight:700;color:#f97316;margin-top:6px">${fmt(apSummary?.days61_90)}</div>
          </div>
          <div class="card card-body" style="border-top:4px solid var(--danger)">
            <div style="font-size:12px;color:var(--text-2);text-transform:uppercase;font-weight:600">90+ Days Pending</div>
            <div style="font-size:20px;font-weight:700;color:var(--danger);margin-top:6px">${fmt(apSummary?.days90Plus)}</div>
          </div>
        </div>
      </div>

      <!-- Vendor Aging Breakdown Table -->
      <div class="card card-body" style="padding:20px">
        <h4 style="margin:0 0 16px;font-size:15px;font-weight:700">Vendor Outstanding Payable Breakdown</h4>
        ${(!vendorAging || vendorAging.length === 0) ? `
          <div style="text-align:center;padding:30px;color:var(--text-2)">🎉 Great! No pending purchase bills or vendor payables.</div>
        ` : `
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Vendor / Company</th>
                  <th style="text-align:center">Purchases</th>
                  <th style="text-align:right">Current (0-30d)</th>
                  <th style="text-align:right">31–60 Days</th>
                  <th style="text-align:right">61–90 Days</th>
                  <th style="text-align:right">90+ Days</th>
                  <th style="text-align:right">Total Payable</th>
                </tr>
              </thead>
              <tbody>
                ${vendorAging.map(v => `
                  <tr>
                    <td style="font-weight:600;color:var(--text)">
                      ${escHtml(v.vendorName)}
                      ${v.companyName ? `<br><small style="color:var(--text-2)">${escHtml(v.companyName)}</small>` : ''}
                    </td>
                    <td style="text-align:center">${v.purchaseCount}</td>
                    <td style="text-align:right;color:${v.current > 0 ? 'var(--text)' : 'var(--text-2)'}">${fmt(v.current)}</td>
                    <td style="text-align:right;color:${v.days31_60 > 0 ? 'var(--warning)' : 'var(--text-2)'}">${fmt(v.days31_60)}</td>
                    <td style="text-align:right;color:${v.days61_90 > 0 ? '#f97316' : 'var(--text-2)'}">${fmt(v.days61_90)}</td>
                    <td style="text-align:right;font-weight:700;color:${v.days90Plus > 0 ? 'var(--danger)' : 'var(--text-2)'}">${fmt(v.days90Plus)}</td>
                    <td style="text-align:right;font-weight:800;color:#8b5cf6">${fmt(v.total)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;
}

function bindAgingEvents() {
  // Aging view controls
}

window.renderReports = renderReports;
