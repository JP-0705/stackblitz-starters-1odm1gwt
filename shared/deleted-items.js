// Shared soft-delete + Deleted Items modal — loaded on every app page.
// "Deleting" never removes a row; it flags is_deleted = true. There is
// no permanent-delete action anywhere in the app — only the Supabase
// project owner can truly erase a row, directly in the database.
async function deleteAssetRecord(assetId) {
  if (!supabaseClient)
    return alert('Not connected to the database. Check the console for details.');
  if (!confirm(`Move asset ${assetId} to Deleted Items?\n\nIt will be hidden from the dashboard but can be restored later from Settings.`))
    return;

  const { error } = await supabaseClient
    .from('assets')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
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
  if (!confirm(`Restore asset ${assetId} back to the active list?`)) return;

  const { error } = await supabaseClient
    .from('assets')
    .update({ is_deleted: false, deleted_at: null })
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
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">Loading…</td></tr>';

  const deletedRows = await fetchDeletedAssetRows();

  if (deletedRows.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No deleted items.</td></tr>';
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
      <td style="font-size:12px;">${deletedAtDisplay}</td>
      <td>
        <button onclick="restoreAssetRecord('${item.id}')" class="btn-table btn-edit-rem">♻️ Restore</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
