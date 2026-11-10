// ISSUANCE REPORT (Admin + Accounting) — replaces the "ISS" sheet of the old Excel file.
//
// Lists the items held by each PERSON (or each DEPARTMENT) for accountability.
// Each person has a signature line for the receiver.
// Uses current data (Disposed and Missing items are not included).
// Can be printed / saved as PDF, or downloaded as Excel (CSV).
(function () {
  const UNASSIGNED = 'UNASSIGNED';
  let lastIssuance = null;

  function userCanUse() {
    return (
      typeof activeUserSession !== 'undefined' &&
      activeUserSession &&
      (activeUserSession.role === 'ADMIN' || activeUserSession.role === 'ACCOUNTING')
    );
  }
  function el(id) { return document.getElementById(id); }
  const esc = (v) => escapeHtml(v === undefined || v === null ? '' : v);

  function csvCell(value) {
    let v = value === undefined || value === null ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; // protect against Excel formula injection
    return '"' + v.replace(/"/g, '""') + '"';
  }

  // Pure function (also used by tests): rows -> groups.
  //   groupBy: 'PERSON' | 'DEPARTMENT'
  //   branch:  'ALL' or a branch name (NAGA / MAKATI)
  //   only:    '' (everyone) or one group name to show alone
  function buildGroups(items, groupBy, branch, only) {
    const wanted = (branch || 'ALL').toUpperCase();
    const map = new Map();
    (items || []).forEach((it) => {
      if (wanted !== 'ALL' && String(it.branch || 'NAGA').toUpperCase() !== wanted) return;
      const key =
        groupBy === 'DEPARTMENT'
          ? (it.department || '').trim() || 'NO DEPARTMENT'
          : (it.issuedTo || '').trim() || UNASSIGNED;
      if (only && key !== only) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    });
    return [...map.entries()]
      .sort((a, b) => {
        // UNASSIGNED / NO DEPARTMENT go last
        const la = a[0] === UNASSIGNED || a[0] === 'NO DEPARTMENT';
        const lb = b[0] === UNASSIGNED || b[0] === 'NO DEPARTMENT';
        if (la !== lb) return la ? 1 : -1;
        return a[0].localeCompare(b[0]);
      })
      .map(([name, rows]) => ({
        name,
        rows: rows
          .slice()
          .sort((x, y) => String(x.id).localeCompare(String(y.id))),
        totalQty: rows.reduce((n, r) => n + (Number(r.qty) || 0), 0),
      }));
  }

  function buildHtml(rep) {
    const byDept = rep.groupBy === 'DEPARTMENT';
    const who = (typeof activeUserSession !== 'undefined' && activeUserSession && activeUserSession.email) || '';
    const branchText = rep.branch === 'ALL' ? 'All Branches' : rep.branch + ' Branch';
    let html =
      `<div class="report-head"><h2>INNOVPHIL ISSUANCE REPORT — BY ${byDept ? 'DEPARTMENT' : 'PERSON'}</h2>` +
      `<p>${esc(branchText)} — As of ${esc(rep.generatedAt)} — Prepared by: ${esc(rep.preparedBy || who)}</p></div>`;

    if (rep.groups.length === 0) {
      return html + '<p style="color:#94a3b8;">No items match the selection.</p>';
    }

    rep.groups.forEach((g) => {
      html +=
        `<div class="issuance-block"><h4 class="report-section-title">${esc(g.name)} ` +
        `— ${g.rows.length} item(s), qty ${esc(g.totalQty)}</h4>` +
        '<table class="report-table"><thead><tr>' +
        '<th>INNOV-ID</th><th>ITEM</th><th>BRAND</th><th>MODEL</th><th>SERIAL NO.</th>' +
        '<th>CATEGORY</th><th>BRANCH</th>' +
        (byDept ? '<th>ISSUED TO</th>' : '<th>DEPARTMENT</th>') +
        '<th>QTY</th><th>CONDITION</th></tr></thead><tbody>';
      g.rows.forEach((r) => {
        html +=
          '<tr>' +
          `<td>${esc(r.id)}</td><td>${esc(r.name)}</td><td>${esc(r.brand || '---')}</td>` +
          `<td>${esc(r.model || '---')}</td><td>${esc(r.serialNumber || '---')}</td>` +
          `<td>${esc(r.itemCategory || r.category || '---')}</td><td>${esc(r.branch || 'NAGA')}</td>` +
          `<td>${esc((byDept ? r.issuedTo : r.department) || '---')}</td>` +
          `<td>${esc(r.qty || 1)}</td><td>${esc(r.condition || '---')}</td></tr>`;
      });
      html += '</tbody></table>';
      if (!byDept && g.name !== UNASSIGNED) {
        html +=
          '<p class="issuance-sign">I received the items listed above in good condition.<br>' +
          'Signature: ______________________ &nbsp;&nbsp; Date: ______________ &nbsp;&nbsp; ' +
          `Printed name: ${esc(g.name)}</p>`;
      }
      html += '</div>';
    });
    return html;
  }

  function buildCsv(rep) {
    const header = [
      'Group', 'Asset ID', 'Asset Name', 'Brand', 'Model', 'Serial No.', 'Category',
      'Branch', 'Issued To', 'Department', 'Qty', 'Condition', 'Status',
    ];
    const lines = [header.map(csvCell).join(',')];
    rep.groups.forEach((g) => {
      g.rows.forEach((r) => {
        lines.push(
          [
            g.name, r.id, r.name, r.brand, r.model, r.serialNumber, r.itemCategory || r.category,
            r.branch, r.issuedTo, r.department, r.qty, r.condition, r.status,
          ].map(csvCell).join(',')
        );
      });
    });
    return '﻿' + lines.join('\r\n'); // BOM so Excel shows UTF-8 (ñ, ₱) correctly
  }

  function stem(rep) {
    return (
      'Issuance-Report-' +
      (rep.groupBy === 'DEPARTMENT' ? 'by-Department' : 'by-Person') +
      '-' + rep.generatedAt.slice(0, 10)
    );
  }

  function ensureModal() {
    if (el('issuanceReportModal')) return;
    const modal = document.createElement('div');
    modal.id = 'issuanceReportModal';
    modal.className = 'modal-backdrop no-print';
    modal.innerHTML = `
      <div class="modal-box modal-box-wide">
        <h3>🧾 Issuance Report</h3>
        <p style="font-size:12px; color:#64748b; margin-bottom:14px;">
          Items held by each person or department, with a signature line.
          Uses current data (Disposed and Missing items are not included).
        </p>
        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; margin-bottom:12px;">
          <label style="font-size:12px; color:#475569;">Group by<br>
            <select id="irGroupBy" style="padding:8px; border:1px solid #cbd5e1; border-radius:8px;">
              <option value="PERSON">Person (Issued To)</option>
              <option value="DEPARTMENT">Department</option>
            </select></label>
          <label style="font-size:12px; color:#475569;">Branch<br>
            <select id="irBranch" style="padding:8px; border:1px solid #cbd5e1; border-radius:8px;"></select></label>
          <label style="font-size:12px; color:#475569;">Single group (optional)<br>
            <select id="irOnly" style="padding:8px; border:1px solid #cbd5e1; border-radius:8px; max-width:220px;">
              <option value="">All</option></select></label>
          <label style="font-size:12px; color:#475569;">Prepared by<br>
            <input id="irPreparedBy" type="text" style="padding:8px; border:1px solid #cbd5e1; border-radius:8px;" /></label>
          <button type="button" id="irGenerateBtn" class="action-btn">Generate</button>
        </div>
        <div id="irStatus" style="font-size:12px; color:#64748b; margin-bottom:8px;"></div>
        <div id="irPreview" class="count-entry-scroll"></div>
        <div class="modal-actions">
          <button type="button" id="irCloseBtn" class="action-btn" style="background:#e2e8f0; color:#334155;">Close</button>
          <button type="button" id="irCsvBtn" class="action-btn" disabled>⬇️ Download Excel (CSV)</button>
          <button type="button" id="irPrintBtn" class="action-btn" disabled>🖨️ Print / Save as PDF</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const printArea = document.createElement('div');
    printArea.id = 'issuanceReportPrintArea';
    printArea.className = 'print-only-report';
    document.body.appendChild(printArea);

    const branchSource = document.getElementById('formAssetBranch');
    const branches = branchSource ? [...branchSource.options].map((o) => o.value) : ['NAGA', 'MAKATI'];
    el('irBranch').innerHTML =
      '<option value="ALL">All Branches</option>' +
      branches.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join('');

    el('irGenerateBtn').addEventListener('click', generate);
    el('irCloseBtn').addEventListener('click', close);
    el('irCsvBtn').addEventListener('click', downloadCsv);
    el('irPrintBtn').addEventListener('click', printIt);
    // The "single group" list follows the chosen grouping + branch.
    el('irGroupBy').addEventListener('change', refreshOnlyList);
    el('irBranch').addEventListener('change', refreshOnlyList);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  }

  let allItems = [];

  async function refreshOnlyList() {
    const groups = buildGroups(allItems, el('irGroupBy').value, el('irBranch').value, '');
    el('irOnly').innerHTML =
      '<option value="">All</option>' +
      groups.map((g) => `<option value="${esc(g.name)}">${esc(g.name)} (${g.rows.length})</option>`).join('');
  }

  async function open() {
    if (!userCanUse()) return;
    ensureModal();
    el('irPreparedBy').value = (activeUserSession && activeUserSession.email) || '';
    el('irStatus').textContent = 'Loading…';
    el('irPreview').innerHTML = '';
    el('irCsvBtn').disabled = true;
    el('irPrintBtn').disabled = true;
    lastIssuance = null;
    el('issuanceReportModal').style.display = 'flex';
    try {
      allItems = await fetchBackendDataRows();
      el('irStatus').textContent = `${allItems.length} asset(s) loaded. Choose your options, then click Generate.`;
      refreshOnlyList();
    } catch (err) {
      console.error('Issuance report load error:', err);
      el('irStatus').textContent = 'Could not load the assets: ' + (err && err.message ? err.message : 'unknown error');
    }
  }

  function close() {
    const m = el('issuanceReportModal');
    if (m) m.style.display = 'none';
  }

  function generate() {
    const groupBy = el('irGroupBy').value;
    const branch = el('irBranch').value;
    const groups = buildGroups(allItems, groupBy, branch, el('irOnly').value);
    lastIssuance = {
      groupBy,
      branch,
      groups,
      preparedBy: el('irPreparedBy').value.trim(),
      generatedAt: typeof todayLocalISO === 'function' ? todayLocalISO() : new Date().toISOString().slice(0, 10),
    };
    el('irPreview').innerHTML = buildHtml(lastIssuance);
    const itemCount = groups.reduce((n, g) => n + g.rows.length, 0);
    el('irStatus').textContent = `${groups.length} group(s), ${itemCount} item(s).`;
    el('irCsvBtn').disabled = itemCount === 0;
    el('irPrintBtn').disabled = itemCount === 0;
  }

  function downloadCsv() {
    if (!lastIssuance) return;
    const blob = new Blob([buildCsv(lastIssuance)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = stem(lastIssuance) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printIt() {
    if (!lastIssuance) return;
    // Only ONE print area may have content, otherwise both would print.
    const monthly = el('monthlyReportPrintArea');
    if (monthly) monthly.innerHTML = '';
    el('issuanceReportPrintArea').innerHTML = buildHtml(lastIssuance);
    const previousTitle = document.title;
    document.title = stem(lastIssuance);
    document.body.classList.add('print-mode-report');
    window.print();
    document.title = previousTitle;
  }

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('print-mode-report');
  });

  document.addEventListener('DOMContentLoaded', () => {
    const menu = document.getElementById('settingsMenu');
    if (!menu || !userCanUse()) return;
    const link = document.createElement('a');
    link.href = '#';
    link.id = 'issuanceReportMenuLink';
    link.textContent = '🧾 Issuance Report';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof closeSettingsMenu === 'function') closeSettingsMenu();
      open();
    });
    const anchor = document.getElementById('monthlyReportMenuLink') || menu.lastElementChild;
    menu.insertBefore(link, anchor && anchor.nextSibling ? anchor.nextSibling : null);
  });

  window.openIssuanceReportModal = open;
  window.__issuanceInternals = { buildGroups, buildHtml, buildCsv, csvCell };
})();
