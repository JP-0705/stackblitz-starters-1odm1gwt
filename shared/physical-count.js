// Shared Physical Count workflow (Admin only) — loaded on dashboard,
// every category page, and analytics for header-button parity.
let currentCountEntryRows = [];

async function printBlankCountSheet() {
  if (!supabaseClient) {
    return alert('Not connected to the database. Check the console for details.');
  }

  const allAssets = await fetchBackendDataRows();
  const scoped = allAssets.filter(
    (item) =>
      (currentCategoryFilter === 'ALL' || item.category === currentCategoryFilter) &&
      (currentBranchFilter === 'ALL' || item.branch === currentBranchFilter)
  );

  const branchLabelText =
    currentBranchFilter === 'ALL' ? 'All Branches' : `${currentBranchFilter} Branch`;
  document.getElementById('countSheetMeta').innerText =
    `Branch: ${branchLabelText} — Blank Count Sheet (fill in by hand) — Printed: ${new Date().toLocaleString()}`;

  const tbody = document.getElementById('countSheetTableBody');
  tbody.innerHTML = '';
  scoped.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.id}</td>
      <td>${item.name}</td>
      <td>${item.brand || '---'}</td>
      <td>${item.category}</td>
      <td>${item.branch || 'NAGA'}</td>
      <td>${item.issuedTo || '---'}</td>
      <td>${item.qty || 1}</td>
      <td style="min-width:70px;">&nbsp;</td>
      <td style="min-width:70px;">&nbsp;</td>
      <td style="min-width:90px;">&nbsp;</td>
    `;
    tbody.appendChild(tr);
  });

  document.body.classList.add('print-mode-count');
  window.print();
}

async function openPhysicalCountModal() {
  if (!supabaseClient) {
    return alert('Not connected to the database. Check the console for details.');
  }

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('countEntryDate').value = today;
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

  const tbody = document.getElementById('countEntryTableBody');
  tbody.innerHTML = '';
  currentCountEntryRows.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:monospace;">${item.id}</td>
      <td>${item.name}</td>
      <td>${item.branch || 'NAGA'}</td>
      <td>${item.qty || 1}</td>
      <td>
        <input
          type="number"
          min="0"
          data-asset-id="${item.id}"
          data-system-qty="${item.qty || 1}"
          class="countedQtyInput"
          value="${item.qty || 1}"
          oninput="updateCountVarianceDisplay('${item.id}')"
        />
      </td>
      <td id="variance-${item.id}" class="variance-zero">0</td>
      <td>
        <input
          type="text"
          data-asset-id="${item.id}"
          class="countRemarksInput"
          placeholder="Optional note..."
        />
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('countEntryModal').style.display = 'flex';
}

function closeCountEntryModal() {
  document.getElementById('countEntryModal').style.display = 'none';
}

function updateCountVarianceDisplay(assetId) {
  const input = document.querySelector(`.countedQtyInput[data-asset-id="${assetId}"]`);
  const systemQty = Number(input.dataset.systemQty) || 0;
  const countedQty = Number(input.value) || 0;
  const variance = countedQty - systemQty;

  const cell = document.getElementById(`variance-${assetId}`);
  cell.innerText = variance > 0 ? `+${variance}` : `${variance}`;
  cell.className = variance === 0 ? 'variance-zero' : 'variance-mismatch';
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

  inputs.forEach((input) => {
    const assetId = input.dataset.assetId;
    const systemQty = Number(input.dataset.systemQty) || 0;
    const countedQty = Number(input.value) || 0;
    const variance = countedQty - systemQty;
    const item = currentCountEntryRows.find((i) => i.id === assetId);
    const remarksInput = document.querySelector(
      `.countRemarksInput[data-asset-id="${assetId}"]`
    );
    const remarks = remarksInput ? remarksInput.value.trim() : '';

    countRecords.push({ asset_id: assetId, count_date: countDate, counted_qty: countedQty });
    sheetRows.push({ ...item, systemQty, countedQty, variance, remarks });
  });

  const { error } = await supabaseClient
    .from('asset_counts')
    .upsert(countRecords, { onConflict: 'asset_id,count_date' });

  if (error) {
    console.error('Supabase count save error:', error);
    return alert('Failed to save physical count:\n\n' + error.message);
  }

  // The live "asset_counts" row above can still be re-saved for the same
  // date, but this snapshot is a permanent, locked record — it is only
  // ever inserted, never updated, so it becomes this count's History entry.
  await insertCountHistoryRecord(countDate, sheetRows);

  renderCountSheetPrintArea(countDate, sheetRows);
  closeCountEntryModal();

  document.body.classList.add('print-mode-count');
  window.print();
}

function renderCountSheetPrintArea(countDate, sheetRows) {
  const branchLabelText =
    currentBranchFilter === 'ALL' ? 'All Branches' : `${currentBranchFilter} Branch`;
  document.getElementById('countSheetMeta').innerText =
    `Branch: ${branchLabelText} — Count Date: ${countDate} — Printed: ${new Date().toLocaleString()}`;

  const tbody = document.getElementById('countSheetTableBody');
  tbody.innerHTML = '';
  sheetRows.forEach((row) => {
    const varianceClass = row.variance === 0 ? '' : 'style="color:#dc2626; font-weight:700;"';
    const varianceText = row.variance > 0 ? `+${row.variance}` : `${row.variance}`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.id}</td>
      <td>${row.name}</td>
      <td>${row.brand || '---'}</td>
      <td>${row.category}</td>
      <td>${row.branch || 'NAGA'}</td>
      <td>${row.issuedTo || '---'}</td>
      <td>${row.systemQty}</td>
      <td>${row.countedQty}</td>
      <td ${varianceClass}>${varianceText}</td>
      <td>${row.remarks || '---'}</td>
    `;
    tbody.appendChild(tr);
  });
}

window.addEventListener('beforeprint', () => {
  const stamp = document.getElementById('printListDateStamp');
  if (stamp) stamp.innerText = `Printed: ${new Date().toLocaleString()}`;
});
window.addEventListener('afterprint', () => {
  document.body.classList.remove('print-mode-count');
});
