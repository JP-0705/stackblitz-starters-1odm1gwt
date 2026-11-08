// MONTHLY REPORT (Admin + Accounting) — loaded on dashboard, every category
// page, and analytics. Adds "📊 Monthly Report" to the Settings menu.
//
// What it shows for the chosen month (all taken from the permanent
// asset_edit_history table, so nothing here can be edited after the fact):
//   1. New assets added
//   2. Issued / transferred  (changes to "Issued To") + branch transfers
//   3. Disposed assets (with reason) / restored
//   4. Missing (not found during a count) / found again
//   5. Every other edit (price, condition, status, remarks, ...)
// It can be printed / saved as PDF, or downloaded as an Excel-ready CSV.
//
// NOTE: only changes made while the system was logging them appear here.
// Assets added/deleted BEFORE this feature was installed have no
// "added"/"deleted" entry, but their field edits (e.g. Issued To) do.
(function () {
  const EVENT_ADDED = 'Asset Added';
  const EVENT_DISPOSED = 'Asset Disposed';
  const EVENT_DELETED_LEGACY = 'Asset Deleted'; // logged before "Dispose" existed
  const EVENT_RESTORED = 'Asset Restored';
  const EVENT_MISSING = 'Asset Marked Missing';
  const EVENT_FOUND = 'Asset Found';
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  let lastReport = null;

  function userCanUseReport() {
    return (
      typeof activeUserSession !== 'undefined' &&
      activeUserSession &&
      (activeUserSession.role === 'ADMIN' || activeUserSession.role === 'ACCOUNTING')
    );
  }

  const pad2 = (n) => String(n).padStart(2, '0');
  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '---';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function fmtTime(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  // Which section a history row belongs to.
  function classify(row) {
    switch (row.field_changed) {
      case EVENT_ADDED: return { key: 'new', label: 'NEW ASSET' };
      case EVENT_DISPOSED:
      case EVENT_DELETED_LEGACY: return { key: 'disposed', label: 'DISPOSED' };
      case EVENT_RESTORED: return { key: 'disposed', label: 'RESTORED' };
      case EVENT_MISSING: return { key: 'missing', label: 'MISSING' };
      case EVENT_FOUND: return { key: 'missing', label: 'FOUND' };
      case 'Issued To': return { key: 'moves', label: 'ISSUED / TRANSFER' };
      case 'Branch': return { key: 'moves', label: 'BRANCH TRANSFER' };
      default: return { key: 'edits', label: 'EDIT' };
    }
  }

  // ------------------------------------------------------------------ data
  async function fetchHistoryForRange(startIso, endIso) {
    const PAGE = 1000;
    let all = [];
    let useIdTieBreak = true; // keeps paging stable when rows share a timestamp
    let from = 0;
    for (;;) {
      let q = supabaseClient
        .from('asset_edit_history')
        .select('*')
        .gte('edited_at', startIso)
        .lt('edited_at', endIso)
        .order('edited_at', { ascending: true });
      if (useIdTieBreak) q = q.order('id', { ascending: true });
      const { data, error } = await q.range(from, from + PAGE - 1);
      if (error) {
        if (useIdTieBreak && /\bid\b/i.test(error.message || '')) {
          useIdTieBreak = false; // table has no "id" column — retry without it
          continue;
        }
        throw error;
      }
      all = all.concat(data || []);
      if (!data || data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  }

  async function buildReport(year, monthIndex, branch) {
    const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const end = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);

    const history = await fetchHistoryForRange(start.toISOString(), end.toISOString());

    // Current asset details (name/branch) for every asset that appears.
    const info = new Map();
    const active = await fetchBackendDataRows({ includeMissing: true });
    active.forEach((a) => info.set(a.id, { name: a.name, branch: a.branch }));
    if (activeUserSession.role === 'ADMIN') {
      const deleted = await fetchDeletedAssetRows();
      deleted.forEach((a) => info.set(a.id, { name: a.name, branch: a.branch }));
    }

    const rows = [];
    history.forEach((h) => {
      const cls = classify(h);
      const known = info.get(h.asset_id);
      // Name fallback: the add/delete/restore events carry the name themselves
      // (Accounting cannot read deleted assets, so it may not be in `info`).
      let name = known ? known.name : '';
      const nameInOld = [EVENT_DISPOSED, EVENT_DELETED_LEGACY, EVENT_MISSING];
      const nameInNew = [EVENT_ADDED, EVENT_RESTORED, EVENT_FOUND];
      if (!name && nameInOld.includes(h.field_changed)) name = h.old_value;
      if (!name && nameInNew.includes(h.field_changed)) name = h.new_value;
      if (!name || ['(none)', '(deleted)', '(disposed)', '(missing)'].includes(name)) {
        name = '(name not available)';
      }

      if (branch !== 'ALL') {
        const assetBranch = known ? known.branch : null;
        const branchMoveTouches =
          h.field_changed === 'Branch' && (h.old_value === branch || h.new_value === branch);
        if (assetBranch !== branch && !branchMoveTouches) return;
      }

      rows.push({
        iso: h.edited_at,
        date: fmtDate(h.edited_at),
        time: fmtTime(h.edited_at),
        key: cls.key,
        category: cls.label,
        assetId: h.asset_id,
        assetName: name,
        branch: known ? known.branch || '' : '',
        field: h.field_changed,
        oldValue: h.old_value,
        newValue: h.new_value,
        by: h.edited_by || '',
      });
    });

    const touched = new Set(rows.map((r) => r.assetId));
    return {
      year,
      monthIndex,
      branch,
      title: `${MONTH_NAMES[monthIndex]} ${year}`,
      generatedAt: new Date(),
      generatedBy: activeUserSession.email,
      rows,
      counts: {
        added: rows.filter((r) => r.category === 'NEW ASSET').length,
        issued: rows.filter((r) => r.category === 'ISSUED / TRANSFER').length,
        branchMoves: rows.filter((r) => r.category === 'BRANCH TRANSFER').length,
        disposed: rows.filter((r) => r.category === 'DISPOSED').length,
        restored: rows.filter((r) => r.category === 'RESTORED').length,
        missing: rows.filter((r) => r.category === 'MISSING').length,
        found: rows.filter((r) => r.category === 'FOUND').length,
        edits: rows.filter((r) => r.key === 'edits').length,
        total: rows.length,
        assets: touched.size,
      },
    };
  }

  // ------------------------------------------------------------------ html
  function sectionTable(title, rows, columns) {
    const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('');
    let body;
    if (rows.length === 0) {
      body = `<tr><td colspan="${columns.length}" style="text-align:center;color:#94a3b8;">None this month.</td></tr>`;
    } else {
      body = rows
        .map((r) => '<tr>' + columns.map((c) => `<td>${escapeHtml(c.value(r))}</td>`).join('') + '</tr>')
        .join('');
    }
    return `
      <h4 class="report-section-title">${escapeHtml(title)} (${rows.length})</h4>
      <table class="report-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function buildReportHtml(report) {
    const c = report.counts;
    const by = (k) => report.rows.filter((r) => r.key === k);
    const dt = (r) => `${r.date} ${r.time}`;
    const base = [
      { label: 'DATE / TIME', value: dt },
      { label: 'ASSET ID', value: (r) => r.assetId },
      { label: 'ASSET NAME', value: (r) => r.assetName },
    ];
    const byCol = { label: 'BY', value: (r) => r.by };
    // Disposed → the reason; missing → where/when it was not found; restored/found → nothing extra.
    const details = (r) => {
      if (r.category === 'DISPOSED') {
        return r.newValue === '(deleted)' ? '(logged as "deleted" before Dispose was added)' : r.newValue;
      }
      if (r.category === 'MISSING') return r.newValue;
      return '';
    };
    const branchLabel = report.branch === 'ALL' ? 'All Branches' : `${report.branch} Branch`;

    return `
      <div class="report-head">
        <h2>INNOVPHIL MONTHLY ASSET REPORT — ${escapeHtml(report.title.toUpperCase())}</h2>
        <p>${escapeHtml(branchLabel)} — Generated ${escapeHtml(fmtDate(report.generatedAt))} ${escapeHtml(fmtTime(report.generatedAt))}
           by ${escapeHtml(report.generatedBy)}</p>
      </div>
      <table class="report-table report-summary">
        <thead><tr>
          <th>NEW ASSETS</th><th>ISSUED / TRANSFERRED</th><th>BRANCH TRANSFERS</th><th>DISPOSED</th>
          <th>RESTORED</th><th>MARKED MISSING</th><th>FOUND</th><th>OTHER EDITS</th><th>TOTAL CHANGES</th><th>ASSETS AFFECTED</th>
        </tr></thead>
        <tbody><tr>
          <td>${c.added}</td><td>${c.issued}</td><td>${c.branchMoves}</td><td>${c.disposed}</td>
          <td>${c.restored}</td><td>${c.missing}</td><td>${c.found}</td><td>${c.edits}</td><td>${c.total}</td><td>${c.assets}</td>
        </tr></tbody>
      </table>
      ${sectionTable('1. NEW ASSETS ADDED', by('new'), [...base, byCol])}
      ${sectionTable('2. ISSUED / TRANSFERRED (movement of units)', by('moves'), [
        ...base,
        { label: 'TYPE', value: (r) => r.category },
        { label: 'FROM', value: (r) => r.oldValue },
        { label: 'TO', value: (r) => r.newValue },
        byCol,
      ])}
      ${sectionTable('3. DISPOSED / RESTORED', by('disposed'), [
        ...base,
        { label: 'ACTION', value: (r) => r.category },
        { label: 'REASON / DETAILS', value: (r) => details(r) },
        byCol,
      ])}
      ${sectionTable('4. MISSING / FOUND (physical count)', by('missing'), [
        ...base,
        { label: 'ACTION', value: (r) => r.category },
        { label: 'DETAILS', value: (r) => details(r) },
        byCol,
      ])}
      ${sectionTable('5. OTHER EDITS', by('edits'), [
        ...base,
        { label: 'FIELD', value: (r) => r.field },
        { label: 'OLD VALUE', value: (r) => r.oldValue },
        { label: 'NEW VALUE', value: (r) => r.newValue },
        byCol,
      ])}`;
  }

  // ------------------------------------------------------------------- csv
  // Cells starting with = + - @ would be run as formulas by Excel, so they
  // get a leading apostrophe. Everything is quoted, UTF-8 BOM for Excel.
  function csvCell(value) {
    let v = value === undefined || value === null ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
    return '"' + v.replace(/"/g, '""') + '"';
  }

  function buildCsv(report) {
    const header = ['Date', 'Time', 'Category', 'Asset ID', 'Asset Name', 'Branch', 'Field', 'Old Value', 'New Value', 'Changed By'];
    const lines = [header.map(csvCell).join(',')];
    report.rows.forEach((r) => {
      lines.push(
        [r.date, r.time, r.category, r.assetId, r.assetName, r.branch, r.field, r.oldValue, r.newValue, r.by]
          .map(csvCell)
          .join(',')
      );
    });
    return '﻿' + lines.join('\r\n');
  }

  function reportFileStem(report) {
    const branch = report.branch === 'ALL' ? 'ALL' : report.branch.replace(/[^A-Za-z0-9]/g, '');
    return `INNOVPHIL_Monthly_Report_${report.year}-${pad2(report.monthIndex + 1)}_${branch}`;
  }

  // ------------------------------------------------------------------- ui
  function el(id) { return document.getElementById(id); }

  function ensureModal() {
    if (el('monthlyReportModal')) return;

    const modal = document.createElement('div');
    modal.id = 'monthlyReportModal';
    modal.className = 'modal-backdrop no-print';
    modal.innerHTML = `
      <div class="modal-box modal-box-wide">
        <h3>📊 Monthly Report</h3>
        <p style="font-size:12px; color:#64748b; margin-bottom:14px;">
          New assets, issuances / transfers, deletions and every other change made during the
          chosen month. Taken from the permanent history log.
        </p>
        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; margin-bottom:12px;">
          <label style="font-size:12px; color:#475569;">Month<br>
            <select id="mrMonth" style="padding:8px; border:1px solid #cbd5e1; border-radius:8px;"></select></label>
          <label style="font-size:12px; color:#475569;">Year<br>
            <select id="mrYear" style="padding:8px; border:1px solid #cbd5e1; border-radius:8px;"></select></label>
          <label style="font-size:12px; color:#475569;">Branch<br>
            <select id="mrBranch" style="padding:8px; border:1px solid #cbd5e1; border-radius:8px;"></select></label>
          <button type="button" id="mrGenerateBtn" class="action-btn">Generate Report</button>
        </div>
        <div id="mrStatus" style="font-size:12px; color:#64748b; margin-bottom:8px;"></div>
        <div id="mrPreview" class="count-entry-scroll"></div>
        <div class="modal-actions">
          <button type="button" id="mrCloseBtn" class="action-btn" style="background:#e2e8f0; color:#334155;">Close</button>
          <button type="button" id="mrCsvBtn" class="action-btn" disabled>⬇️ Download Excel (CSV)</button>
          <button type="button" id="mrPrintBtn" class="action-btn" disabled>🖨️ Print / Save as PDF</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const printArea = document.createElement('div');
    printArea.id = 'monthlyReportPrintArea';
    printArea.className = 'print-only-report';
    document.body.appendChild(printArea);

    // Month / year / branch choices
    const now = new Date();
    el('mrMonth').innerHTML = MONTH_NAMES.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    const years = [];
    for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) years.push(y);
    el('mrYear').innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join('');
    const branchSource = document.getElementById('formAssetBranch');
    const branches = branchSource
      ? [...branchSource.options].map((o) => o.value)
      : ['NAGA', 'MAKATI'];
    el('mrBranch').innerHTML =
      '<option value="ALL">All Branches</option>' +
      branches.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');

    el('mrGenerateBtn').addEventListener('click', generateMonthlyReport);
    el('mrCloseBtn').addEventListener('click', closeMonthlyReportModal);
    el('mrCsvBtn').addEventListener('click', downloadMonthlyReportCsv);
    el('mrPrintBtn').addEventListener('click', printMonthlyReport);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeMonthlyReportModal(); });
  }

  function openMonthlyReportModal() {
    if (!userCanUseReport()) return;
    ensureModal();
    // Default to LAST month — the usual case is reporting on the month just ended.
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    el('mrMonth').value = String(prev.getMonth());
    el('mrYear').value = String(prev.getFullYear());
    el('mrBranch').value = 'ALL';
    lastReport = null;
    el('mrPreview').innerHTML = '';
    el('mrStatus').textContent = 'Choose a month, then click Generate Report.';
    el('mrCsvBtn').disabled = true;
    el('mrPrintBtn').disabled = true;
    el('monthlyReportModal').style.display = 'flex';
  }

  function closeMonthlyReportModal() {
    const modal = el('monthlyReportModal');
    if (modal) modal.style.display = 'none';
  }

  async function generateMonthlyReport() {
    if (!userCanUseReport()) return;
    if (!supabaseClient) {
      el('mrStatus').textContent = 'Not connected to the database. Check the console.';
      return;
    }
    const btn = el('mrGenerateBtn');
    btn.disabled = true;
    el('mrCsvBtn').disabled = true;
    el('mrPrintBtn').disabled = true;
    el('mrStatus').textContent = 'Loading…';
    try {
      const report = await buildReport(
        Number(el('mrYear').value),
        Number(el('mrMonth').value),
        el('mrBranch').value
      );
      lastReport = report;
      el('mrPreview').innerHTML = buildReportHtml(report);
      el('mrStatus').textContent =
        report.rows.length === 0
          ? 'No changes were recorded for that month.'
          : `${report.rows.length} change(s) across ${report.counts.assets} asset(s).`;
      el('mrCsvBtn').disabled = report.rows.length === 0;
      el('mrPrintBtn').disabled = false;
    } catch (err) {
      console.error('Monthly report error:', err);
      el('mrStatus').textContent =
        'Could not load the report: ' + (err && err.message ? err.message : 'unknown error');
    } finally {
      btn.disabled = false;
    }
  }

  function downloadMonthlyReportCsv() {
    if (!lastReport) return;
    const blob = new Blob([buildCsv(lastReport)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = reportFileStem(lastReport) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printMonthlyReport() {
    if (!lastReport) return;
    el('monthlyReportPrintArea').innerHTML = buildReportHtml(lastReport);
    const previousTitle = document.title;
    document.title = reportFileStem(lastReport); // becomes the suggested PDF file name
    document.body.classList.add('print-mode-report');
    window.print();
    document.title = previousTitle;
  }

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('print-mode-report');
  });

  // Adds the "Monthly Report" link to the Settings menu (Admin/Accounting only).
  document.addEventListener('DOMContentLoaded', () => {
    const menu = document.getElementById('settingsMenu');
    if (!menu || !userCanUseReport()) return;
    const link = document.createElement('a');
    link.href = '#';
    link.id = 'monthlyReportMenuLink';
    link.textContent = '📊 Monthly Report';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof closeSettingsMenu === 'function') closeSettingsMenu();
      openMonthlyReportModal();
    });
    const anchor = document.getElementById('countHistoryMenuLink') || menu.lastElementChild;
    menu.insertBefore(link, anchor && anchor.nextSibling ? anchor.nextSibling : null);
  });

  // exposed for tests / manual use
  window.openMonthlyReportModal = openMonthlyReportModal;
  window.__monthlyReportInternals = { classify, buildCsv, csvCell, buildReport, buildReportHtml };
})();
