// Shared asset EDIT HISTORY (audit trail) — loaded on every app page.
// Every time an admin saves changes to an existing asset, one row is
// logged here per field that actually changed. Like count_history, this
// table is insert-only — nothing in the app ever updates or deletes a
// row here, so it stays a permanent record of who changed what.

const ASSET_FIELD_LABELS = {
  name: 'Asset Name',
  brand: 'Brand',
  model: 'Model',
  description: 'Description',
  serialNumber: 'Serial Number',
  itemCategory: 'Asset Type',
  imageUrl: 'Image',
  branch: 'Branch',
  category: 'Category',
  issuedTo: 'Issued To',
  purchaseDate: 'Date of Purchase',
  unitPrice: 'Unit Price',
  qty: 'Quantity',
  usefulLife: 'Useful Life',
  condition: 'Condition',
  note: 'Note',
  status: 'Asset Status',
  trackingDate: 'Tracking Date',
  remarks: 'Remarks',
};

// Compares oldSnapshot vs newFields field-by-field and inserts one audit
// row per field that actually changed. Best-effort: the asset itself is
// already saved by the time this runs, so a logging failure only warns
// in the console rather than blocking the user.
async function logAssetFieldChanges(assetId, oldSnapshot, newFields) {
  if (!oldSnapshot || !supabaseClient) return;

  const rows = [];
  for (const field of Object.keys(newFields)) {
    const label = ASSET_FIELD_LABELS[field];
    if (!label) continue; // untracked/derived field (e.g. "amount")

    let oldVal, newVal;
    if (field === 'imageUrl') {
      oldVal = oldSnapshot[field] ? '(photo attached)' : '(no photo)';
      newVal = newFields[field] ? '(photo attached)' : '(no photo)';
    } else {
      oldVal = oldSnapshot[field] === undefined || oldSnapshot[field] === null ? '' : String(oldSnapshot[field]);
      newVal = newFields[field] === undefined || newFields[field] === null ? '' : String(newFields[field]);
    }

    if (oldVal !== newVal) {
      rows.push({
        asset_id: assetId,
        edited_by: activeUserSession ? activeUserSession.email : null,
        field_changed: label,
        old_value: oldVal || '(empty)',
        new_value: newVal || '(empty)',
      });
    }
  }

  if (rows.length === 0) return;
  const { error } = await supabaseClient.from('asset_edit_history').insert(rows);
  if (error) {
    console.error('Failed to log asset edit history:', error);
  }
}

async function fetchAssetEditHistoryRows(assetId) {
  if (!supabaseClient) {
    console.error('Supabase client not initialized — cannot load edit history.');
    return [];
  }
  const { data, error } = await supabaseClient
    .from('asset_edit_history')
    .select('*')
    .eq('asset_id', assetId)
    .order('edited_at', { ascending: false });

  if (error) {
    console.error('Supabase fetch error (asset edit history):', error);
    alert('Could not load edit history from the database:\n\n' + error.message);
    return [];
  }
  return data;
}

async function openAssetEditHistoryModal(assetId) {
  document.getElementById('assetEditHistoryTitle').innerText = `🕘 Edit History — ${assetId}`;
  const tbody = document.getElementById('assetEditHistoryTableBody');
  tbody.innerHTML =
    '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Loading…</td></tr>';
  document.getElementById('assetEditHistoryModal').style.display = 'flex';

  const rows = await fetchAssetEditHistoryRows(assetId);

  if (rows.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No edits recorded for this asset yet.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  rows.forEach((row) => {
    const editedAtDisplay = row.edited_at ? new Date(row.edited_at).toLocaleString() : '---';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-size:12px;">${editedAtDisplay}</td>
      <td style="font-size:12px;">${row.edited_by || '---'}</td>
      <td style="font-weight:600;">${row.field_changed}</td>
      <td style="color:#dc2626;">${row.old_value || '---'}</td>
      <td style="color:#16a34a;">${row.new_value || '---'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function closeAssetEditHistoryModal() {
  document.getElementById('assetEditHistoryModal').style.display = 'none';
}
