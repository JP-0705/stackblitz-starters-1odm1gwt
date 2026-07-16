// Shared soft-delete + Deleted Items modal — loaded on every app page.
// "Deleting" never removes a row; it flags is_deleted = true. There is
// no permanent-delete action anywhere in the app — only the Supabase
// project owner can truly erase a row, directly in the database.
async function deleteAssetRecord(assetId) {
  if (!supabaseClient)
    return alert('Not connected to the database. Check the console for details.');
  const confirmed = await showConfirm(
    `Move asset ${assetId} to Deleted Items?\n\nIt will be hidden from the dashboard but can be restored later from Settings.`,
    { title: '🗑️ Delete Asset', confirmLabel: 'Delete', confirmColor: '#dc2626' }
  );
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from('assets')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: activeUserSession ? activeUserSession.email : null,
    })
    .eq('id', assetId);
  if (error) {
    console.error('Supabase soft-delete error:', error);
    return alert('Failed to delete asset:\n\n' + error.message);
  }
  if (typeof searchAssets === 'function') searchAssets();
}

async function restoreAssetRecord(assetId) {
  if (!supabaseClient)
    return alert('Not connected to the database. Check the console for details.');
  const confirmed = await showConfirm(`Restore asset ${assetId} back to the active list?`, {
    title: '♻️ Restore Asset',
    confirmLabel: 'Restore',
    confirmColor: '#0b1d33',
  });
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from('assets')
    .update({ is_deleted: false, deleted_at: null, deleted_by: null })
    .eq('id', assetId);
  if (error) {
    console.error('Supabase restore error:', error);
    return alert('Failed to restore asset:\n\n' + error.message);
  }
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
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8;">Loading…</td></tr>';

  const deletedRows = await fetchDeletedAssetRows();

  if (deletedRows.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center; color:#94a3b8;">No deleted items.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  deletedRows.forEach((item) => {
    const deletedAtDisplay = item.deletedAt
      ? new Date(item.deletedAt).toLocaleString()
      : '---';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:monospace;">${item.id}</td>
      <td>${item.name}</td>
      <td style="font-size:11px; color:#64748b;">${item.category}</td>
      <td>${item.branch || 'NAGA'}</td>
      <td style="font-size:12px;">${item.deletedBy || '---'}</td>
      <td style="font-size:12px;">${deletedAtDisplay}</td>
      <td>
        <button onclick="restoreAssetRecord('${item.id}')" class="btn-table btn-edit-rem">♻️ Restore</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
