// Shared Physical Count workflow (Admin only) — loaded on dashboard,
// every category page, and analytics for header-button parity.
let currentCountEntryRows = [];

// Reused by both the blank count sheet and the filled-in count sheet print,
// so grouping stays consistent with however the main table is currently
// grouped (mirrors the "Group by Issued To" checkbox above the table).
function buildCountSheetRowsHtml(rows, groupByIssuedTo, rowHtmlFn, totalColumns) {
  let lastIssuedTo = null;
  let html = '';
  rows.forEach((row) => {
    if (groupByIssuedTo) {
      const currentIssuedTo = row.issuedTo || 'UNASSIGNED';
      if (currentIssuedTo !== lastIssuedTo) {
        lastIssuedTo = currentIssuedTo;
        html += `<tr class="group-header-row"><td colspan="${totalColumns}">ISSUED TO: ${escapeHtml(currentIssuedTo)}</td></tr>`;
      }
    }
    html += rowHtmlFn(row);
  });
  return html;
}

async function printBlankCountSheet() {
  if (
    !activeUserSession ||
    (activeUserSession.role !== 'ADMIN' && activeUserSession.role !== 'ACCOUNTING')
  ) {
    return;
  }
  if (!supabaseClient) {
    return alert('Not connected to the database. Check the console for details.');
  }

  const allAssets = await fetchBackendDataRows();
  const scoped = allAssets.filter(
    (item) =>
      (currentCategoryFilter === 'ALL' || item.category === currentCategoryFilter) &&
      (currentBranchFilter === 'ALL' || item.branch === currentBranchFilter)
  );

  const groupByIssuedTo = document.getElementById('groupByIssuedToCheckbox').checked;
  if (groupByIssuedTo) {
    scoped.sort((a, b) => (a.issuedTo || '').localeCompare(b.issuedTo || ''));
  }

  const branchLabelText =
    currentBranchFilter === 'ALL' ? 'All Branches' : `${currentBranchFilter} Branch`;
  document.getElementById('countSheetMeta').innerText =
    `Branch: ${branchLabelText} — Blank Count Sheet (fill in by hand) — Printed: ${new Date().toLocaleString()}`;

  const tbody = document.getElementById('countSheetTableBody');
  tbody.innerHTML = buildCountSheetRowsHtml(
    scoped,
    groupByIssuedTo,
    (item) => `
      <tr>
        <td>${escapeHtml(item.id)}</td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.brand || '---')}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.branch || 'NAGA')}</td>
        <td>${escapeHtml(item.issuedTo || '---')}</td>
        <td>${escapeHtml(item.qty || 1)}</td>
        <td style="min-width:50px;">&nbsp;</td>
        <td style="min-width:50px;">&nbsp;</td>
        <td style="min-width:80px;">&nbsp;</td>
      </tr>
    `,
    10
  );

  document.body.classList.add('print-mode-count');
  window.print();
}

async function openPhysicalCountModal() {
  if (
    !activeUserSession ||
    (activeUserSession.role !== 'ADMIN' && activeUserSession.role !== 'ACCOUNTING')
  ) {
    return;
  }
  if (!supabaseClient) {
    return alert('Not connected to the database. Check the console for details.');
  }

  document.getElementById('countEntryDate').value = todayLocalISO();
  const scopeCategoryText =
    currentCategoryFilter === 'ALL' ? 'All Categories' : currentCategoryFilter;
  const scopeBranchText =
    currentBranchFilter === 'ALL' ? 'All Branches' : `${currentBranchFilter} Branch`;
  document.getElementById('countEntryScopeLabel').value =
    `${scopeCategoryText} — ${scopeBranchText}`;

  const allAssets = await fetchBackendDataRows();
  currentCountEntryRows = allAssets.filter(
    (item) =>
      (currentCategoryFilter === 'ALL' || item.category === currentCategoryFilter) &&
      (currentBranchFilter === 'ALL' || item.branch === currentBranchFilter)
  );

  const groupByIssuedTo = document.getElementById('groupByIssuedToCheckbox').checked;
  if (groupByIssuedTo) {
    currentCountEntryRows.sort((a, b) => (a.issuedTo || '').localeCompare(b.issuedTo || ''));
  }

  // Extra column: tick "Missing" for an item that could NOT be found.
  const headRow = document.querySelector('#countEntryModal thead tr');
  if (headRow && !headRow.querySelector('.th-missing')) {
    headRow.insertAdjacentHTML('beforeend', '<th class="th-missing">NOT FOUND?</th>');
  }

  const tbody = document.getElementById('countEntryTableBody');
  tbody.innerHTML = buildCountSheetRowsHtml(
    currentCountEntryRows,
    groupByIssuedTo,
    (item) => `
      <tr data-row-asset-id="${escapeHtml(item.id)}">
        <td style="font-family:monospace;">${escapeHtml(item.id)}</td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.branch || 'NAGA')}</td>
        <td>${escapeHtml(item.qty || 1)}</td>
        <td>
          <input
            type="number"
            min="0"
            data-asset-id="${escapeHtml(item.id)}"
            data-system-qty="${escapeHtml(item.qty || 1)}"
            class="countedQtyInput"
            value="${escapeHtml(item.qty || 1)}"
          />
        </td>
        <td class="variance-zero variance-cell">0</td>
        <td>
          <input
            type="text"
            data-asset-id="${escapeHtml(item.id)}"
            class="countRemarksInput"
            placeholder="Optional note..."
          />
        </td>
        <td style="white-space:nowrap;">
          <label style="font-size:12px; cursor:pointer;">
            <input type="checkbox" class="countMissingCheck" /> Missing
          </label>
        </td>
      </tr>
    `,
    8
  );

  // Live variance display — attached here instead of inline oninput so an
  // unusual asset ID can never break (or inject into) the page.
  tbody.querySelectorAll('.countedQtyInput').forEach((input) => {
    input.addEventListener('input', () => updateCountVarianceDisplay(input));
  });
  // Ticking "Missing" sets the counted qty to 0 and locks it; unticking restores it.
  tbody.querySelectorAll('.countMissingCheck').forEach((box) => {
    box.addEventListener('change', () => {
      const input = box.closest('tr').querySelector('.countedQtyInput');
      if (box.checked) {
        input.value = 0;
        input.disabled = true;
      } else {
        input.disabled = false;
        input.value = input.dataset.systemQty;
      }
      updateCountVarianceDisplay(input);
    });
  });

  document.getElementById('countEntryModal').style.display = 'flex';
}

function closeCountEntryModal() {
  document.getElementById('countEntryModal').style.display = 'none';
}

function updateCountVarianceDisplay(input) {
  const systemQty = Number(input.dataset.systemQty) || 0;
  const countedQty = Number(input.value) || 0;
  const variance = countedQty - systemQty;

  const cell = input.closest('tr').querySelector('.variance-cell');
  if (!cell) return;
  cell.innerText = variance > 0 ? `+${variance}` : `${variance}`;
  cell.className = (variance === 0 ? 'variance-zero' : 'variance-mismatch') + ' variance-cell';
}

async function saveAndPrintCount() {
  if (!supabaseClient) {
    return alert('Not connected to the database. Check the console for details.');
  }

  const countDate = document.getElementById('countEntryDate').value;
  if (!countDate) return alert('Please choose a count date.');

  const inputs = document.querySelectorAll('.countedQtyInput');
  const countRecords = [];
  const sheetRows = [];

  const missingEntries = [];

  inputs.forEach((input) => {
    const assetId = input.dataset.assetId;
    const systemQty = Number(input.dataset.systemQty) || 0;
    const isMissing = !!input.closest('tr').querySelector('.countMissingCheck:checked');
    const countedQty = isMissing ? 0 : Number(input.value) || 0;
    const variance = countedQty - systemQty;
    const item = currentCountEntryRows.find((i) => i.id === assetId);
    if (!item) return; // row no longer exists — skip instead of saving junk
    const remarksInput = input.closest('tr').querySelector('.countRemarksInput');
    const typedRemarks = remarksInput ? remarksInput.value.trim() : '';
    // Missing items show "MISSING" on the printed sheet and in Count History.
    const remarks = isMissing ? (typedRemarks ? `MISSING — ${typedRemarks}` : 'MISSING') : typedRemarks;

    countRecords.push({ asset_id: assetId, count_date: countDate, counted_qty: countedQty });
    sheetRows.push({ ...item, systemQty, countedQty, variance, remarks });
    if (isMissing) missingEntries.push({ item, remarks: typedRemarks });
  });

  if (missingEntries.length > 0) {
    const confirmed = await showConfirm(
      `${missingEntries.length} item(s) are marked MISSING.\n\n` +
        `They will be removed from the dashboard and from future physical counts, ` +
        `and listed under Settings → Missing Items (where they can be marked Found later).\n\nContinue?`,
      { title: '🔍 Mark Items as Missing', confirmLabel: 'Save Count', confirmColor: '#b45309' }
    );
    if (!confirmed) return;
  }

  const { error } = await supabaseClient
    .from('asset_counts')
    .upsert(countRecords, { onConflict: 'asset_id,count_date' });

  if (error) {
    console.error('Supabase count save error:', error);
    return alert('Failed to save physical count:\n\n' + error.message);
  }

  if (missingEntries.length > 0) {
    const result = await markAssetsMissingFromCount(missingEntries, countDate);
    if (result.failed.length > 0) {
      alert(
        `The count was saved, but ${result.failed.length} item(s) could NOT be marked missing:\n\n` +
          result.failed.slice(0, 8).map((f) => `${f.id}: ${f.message}`).join('\n') +
          `\n\nTip: make sure the latest SQL update (Missing/Dispose columns) was run in Supabase.`
      );
    }
    if (typeof searchAssets === 'function') searchAssets();
  }

  const groupByIssuedTo = document.getElementById('groupByIssuedToCheckbox').checked;
  if (groupByIssuedTo) {
    sheetRows.sort((a, b) => (a.issuedTo || '').localeCompare(b.issuedTo || ''));
  }

  // The live "asset_counts" row above can still be re-saved for the same
  // date, but this snapshot is a permanent, locked record — it is only
  // ever inserted, never updated, so it becomes this count's History entry.
  await insertCountHistoryRecord(countDate, sheetRows);

  renderCountSheetPrintArea(countDate, sheetRows, groupByIssuedTo);
  closeCountEntryModal();

  document.body.classList.add('print-mode-count');
  window.print();
}

function renderCountSheetPrintArea(countDate, sheetRows, groupByIssuedTo = false) {
  const branchLabelText =
    currentBranchFilter === 'ALL' ? 'All Branches' : `${currentBranchFilter} Branch`;
  document.getElementById('countSheetMeta').innerText =
    `Branch: ${branchLabelText} — Count Date: ${countDate} — Printed: ${new Date().toLocaleString()}`;

  const rowsForPrint = groupByIssuedTo
    ? [...sheetRows].sort((a, b) => (a.issuedTo || '').localeCompare(b.issuedTo || ''))
    : sheetRows;

  const tbody = document.getElementById('countSheetTableBody');
  tbody.innerHTML = buildCountSheetRowsHtml(
    rowsForPrint,
    groupByIssuedTo,
    (row) => {
      const varianceClass = row.variance === 0 ? '' : 'style="color:#dc2626; font-weight:700;"';
      const varianceText = row.variance > 0 ? `+${row.variance}` : `${row.variance}`;
      return `
        <tr>
          <td>${escapeHtml(row.id)}</td>
          <td>${escapeHtml(row.name)}</td>
          <td>${escapeHtml(row.brand || '---')}</td>
          <td>${escapeHtml(row.category)}</td>
          <td>${escapeHtml(row.branch || 'NAGA')}</td>
          <td>${escapeHtml(row.issuedTo || '---')}</td>
          <td>${escapeHtml(row.systemQty)}</td>
          <td>${escapeHtml(row.countedQty)}</td>
          <td ${varianceClass}>${escapeHtml(varianceText)}</td>
          <td>${escapeHtml(row.remarks || '---')}</td>
        </tr>
      `;
    },
    10
  );
}

window.addEventListener('beforeprint', () => {
  const stamp = document.getElementById('printListDateStamp');
  if (stamp) stamp.innerText = `Printed: ${new Date().toLocaleString()}`;
});
window.addEventListener('afterprint', () => {
  document.body.classList.remove('print-mode-count');
});
