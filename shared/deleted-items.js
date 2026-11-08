// Disposed Items modal + Restore — loaded on every app page.
// (Disposing an asset is in lifecycle.js.) "Disposing" never removes a row;
// it flags is_deleted = true and records the reason. There is no
// permanent-delete action anywhere in the app — only the Supabase project
// owner can truly erase a row, directly in the database.
let currentDeletedRows = [];

async function restoreAssetRecord(assetId) {
  if (!supabaseClient)
    return alert('Not connected to the database. Check the console for details.');
  const confirmed = await showConfirm(`Restore asset ${assetId} back to the active list?\n\nIts disposal record will be cleared (the history log keeps it).`, {
    title: '♻️ Restore Asset',
    confirmLabel: 'Restore',
    confirmColor: '#0b1d33',
  });
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from('assets')
    .update({
      is_deleted: false,
      deleted_at: null,
      deleted_by: null,
      disposal_reason: null,
      disposal_date: null,
      disposal_remarks: null,
    })
    .eq('id', assetId);
  if (error) {
    console.error('Supabase restore error:', error);
    return alert('Failed to restore asset:\n\n' + error.message);
  }
  const restoredRow = currentDeletedRows.find((r) => r.id === assetId);
  await logAssetEvent(assetId, 'Asset Restored', '(disposed)', restoredRow ? restoredRow.name : '');
  renderDeletedItemsTable();
  if (typeof searchAssets === 'function') searchAssets();
}

async function openDeletedItemsModal() {
  if (!activeUserSession || activeUserSession.role !== 'ADMIN') return;
  await renderDeletedItemsTable();
  document.getElementById('deletedItemsModal').style.display = 'flex';
}

function closeDeletedItemsModal() {
  document.getElementById('deletedItemsModal').style.display = 'none';
}

async function renderDeletedItemsTable() {
  const tbody = document.getElementById('deletedItemsTableBody');
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8;">Loading…</td></tr>';

  const deletedRows = await fetchDeletedAssetRows();
  currentDeletedRows = deletedRows;

  if (deletedRows.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="9" style="text-align:center; color:#94a3b8;">No disposed items.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  deletedRows.forEach((item) => {
    const disposedOn = item.disposalDate || (item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : '---');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:monospace;">${escapeHtml(item.id)}</td>
      <td>${escapeHtml(item.name)}</td>
      <td style="font-size:11px; color:#64748b;">${escapeHtml(item.category)}</td>
      <td>${escapeHtml(item.branch || 'NAGA')}</td>
      <td style="font-size:12px; font-weight:600;">${escapeHtml(item.disposalReason || '---')}</td>
      <td style="font-size:12px;">${escapeHtml(disposedOn)}</td>
      <td style="font-size:12px;">${escapeHtml(item.deletedBy || '---')}</td>
      <td style="font-size:12px;">${escapeHtml(item.disposalRemarks || '---')}</td>
      <td>
        <button data-restore-id="${escapeHtml(item.id)}" class="btn-table btn-edit-rem">♻️ Restore</button>
      </td>
    `;
    const restoreBtn = tr.querySelector('button[data-restore-id]');
    if (restoreBtn) restoreBtn.addEventListener('click', () => restoreAssetRecord(restoreBtn.dataset.restoreId));
    tbody.appendChild(tr);
  });
}
