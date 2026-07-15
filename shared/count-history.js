// Shared Physical Count HISTORY — loaded on every app page.
// Every time a Physical Count is saved (see physical-count.js), a
// permanent snapshot is written to the "count_history" table. Rows in
// that table are NEVER updated or deleted by the app — once a count is
// saved it is locked forever and only shows up here, read-only.
let currentCountHistoryRows = [];

async function insertCountHistoryRecord(countDate, sheetRows) {
  if (!supabaseClient) return;

  const mismatchCount = sheetRows.filter((r) => r.variance !== 0).length;

  const { error } = await supabaseClient.from('count_history').insert({
    count_date: countDate,
    scope_category: currentCategoryFilter === 'ALL' ? 'ALL CATEGORIES' : currentCategoryFilter,
    scope_branch: currentBranchFilter === 'ALL' ? 'ALL BRANCHES' : currentBranchFilter,
    counted_by: activeUserSession ? activeUserSession.email : null,
    item_count: sheetRows.length,
    mismatch_count: mismatchCount,
    rows: sheetRows,
  });

  if (error) {
    // The live count itself already saved successfully at this point, so
    // don't block the print flow — just warn so it can be investigated.
    console.error('Supabase count-history insert error:', error);
    alert(
      'The count was saved, but could not be recorded to History:\n\n' +
        error.message +
        '\n\n(Make sure the "count_history" table exists — see README.)'
    );
  }
}

async function fetchCountHistoryRows() {
  if (!supabaseClient) {
    console.error('Supabase client not initialized — cannot load count history.');
    return [];
  }
  const { data, error } = await supabaseClient
    .from('count_history')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase fetch error (count history):', error);
    alert('Could not load count history from the database:\n\n' + error.message);
    return [];
  }
  return data;
}

async function openCountHistoryModal() {
  if (!activeUserSession || activeUserSession.role !== 'ADMIN') return;
  await renderCountHistoryList();
  document.getElementById('countHistoryModal').style.display = 'flex';
}

function closeCountHistoryModal() {
  document.getElementById('countHistoryModal').style.display = 'none';
}

async function renderCountHistoryList() {
  const tbody = document.getElementById('countHistoryTableBody');
  tbody.innerHTML =
    '<tr><td colspan="7" style="text-align:center; color:#94a3b8;">Loading…</td></tr>';

  currentCountHistoryRows = await fetchCountHistoryRows();

  if (currentCountHistoryRows.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center; color:#94a3b8;">No physical counts recorded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  currentCountHistoryRows.forEach((record) => {
    const savedAtDisplay = record.created_at
      ? new Date(record.created_at).toLocaleString()
      : '---';
    const mismatchClass = record.mismatch_count > 0 ? 'variance-mismatch' : 'variance-zero';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${record.count_date}</td>
      <td>${record.scope_category}</td>
      <td>${record.scope_branch}</td>
      <td style="font-size:12px;">${record.counted_by || '---'}</td>
      <td>${record.item_count}</td>
      <td class="${mismatchClass}">${record.mismatch_count}</td>
      <td style="font-size:12px;">${savedAtDisplay}</td>
      <td>
        <button onclick="viewCountHistoryDetail(${record.id})" class="btn-table btn-edit-rem">👁️ View</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function viewCountHistoryDetail(historyId) {
  const record = currentCountHistoryRows.find((r) => r.id === historyId);
  if (!record) return;

  document.getElementById('countHistoryDetailMeta').innerText =
    `Branch: ${record.scope_branch} — Scope: ${record.scope_category} — ` +
    `Count Date: ${record.count_date} — Counted By: ${record.counted_by || '---'} — ` +
    `Saved: ${new Date(record.created_at).toLocaleString()} — This record is locked and cannot be edited.`;

  const tbody = document.getElementById('countHistoryDetailTableBody');
  tbody.innerHTML = '';
  (record.rows || []).forEach((row) => {
    const varianceClass = row.variance === 0 ? 'variance-zero' : 'variance-mismatch';
    const varianceText = row.variance > 0 ? `+${row.variance}` : `${row.variance}`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:monospace;">${row.id}</td>
      <td>${row.name}</td>
      <td>${row.brand || '---'}</td>
      <td>${row.category}</td>
      <td>${row.branch || 'NAGA'}</td>
      <td>${row.issuedTo || '---'}</td>
      <td>${row.systemQty}</td>
      <td>${row.countedQty}</td>
      <td class="${varianceClass}">${varianceText}</td>
      <td>${row.remarks || '---'}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('countHistoryDetailModal').style.display = 'flex';
}

function closeCountHistoryDetailModal() {
  document.getElementById('countHistoryDetailModal').style.display = 'none';
}
