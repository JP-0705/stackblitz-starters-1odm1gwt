// Shared Add/Edit Asset modal + Remarks modal — loaded on dashboard,
// every category page, and analytics (so the header buttons keep working
// no matter which page an admin happens to be on).
function calculateModalAmount() {
  const price = Number(document.getElementById('formAssetUnitPrice').value) || 0;
  const qty = Number(document.getElementById('formAssetQuantity').value) || 0;
  document.getElementById('formAssetAmount').value = '₱ ' + (price * qty).toLocaleString();
}

// Remembers whatever image URL was on the asset when the modal was opened,
// so Save Changes can tell whether that file needs deleting from storage
// (removed entirely, or swapped for a newly uploaded one). Clicking Remove
// or picking a new file does NOT touch storage by itself — nothing is
// deleted unless Save Changes actually goes through, so Cancel is safe.
let originalAssetImageUrl = '';

// Snapshot of the asset as it looked when the Edit modal was opened, used
// to diff against on Save so we know exactly which fields changed (for
// the edit-history audit trail in shared/edit-history.js). Null when
// adding a brand-new asset, since there's nothing to diff against.
let originalAssetSnapshot = null;

// Deletes a previously-uploaded image from the "asset-images" storage
// bucket. Best-effort: if it fails, the asset record itself is already
// saved fine, so this only logs rather than blocking the user.
async function deleteAssetImageFromStorage(url) {
  if (!url) return;
  const marker = '/asset-images/';
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const filePath = decodeURIComponent(url.slice(idx + marker.length));
  const { error } = await supabaseClient.storage.from('asset-images').remove([filePath]);
  if (error) {
    console.error('Failed to delete old asset image from storage:', error);
  }
}

// Shows an instant local preview of a newly chosen image, before it's
// actually uploaded (upload only happens once "Save Changes" is clicked).
function previewAssetImageFile() {
  const file = document.getElementById('formAssetImageFile').files[0];
  const preview = document.getElementById('formAssetImagePreview');
  if (!file) return;
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
  document.getElementById('removeAssetImageBtn').style.display = 'inline-block';
}

// Clears the image entirely — both a newly-picked file (if any) and an
// existing saved image (if any). Save Changes will persist the asset with
// no image once this has been clicked.
function removeAssetImage() {
  document.getElementById('formAssetImageFile').value = '';
  document.getElementById('formAssetImageUrl').value = '';
  const preview = document.getElementById('formAssetImagePreview');
  preview.src = '';
  preview.style.display = 'none';
  document.getElementById('removeAssetImageBtn').style.display = 'none';
}

function openAssetInsertModal() {
  originalAssetImageUrl = '';
  originalAssetSnapshot = null;
  document.getElementById('modalBoxTitle').innerText = 'Add Operational Asset Record';
  document.getElementById('modalTargetIndexId').value = '';
  document.getElementById('formAssetId').disabled = false;
  document.getElementById('formAssetId').value = '';
  document.getElementById('formAssetName').value = '';
  document.getElementById('formAssetBrand').value = '';
  document.getElementById('formAssetModel').value = '';
  document.getElementById('formAssetDescription').value = '';
  document.getElementById('formAssetSerialNumber').value = '';
  document.getElementById('formAssetItemCategory').value = '';
  document.getElementById('formAssetImageFile').value = '';
  document.getElementById('formAssetImageUrl').value = '';
  const addPreview = document.getElementById('formAssetImagePreview');
  addPreview.src = '';
  addPreview.style.display = 'none';
  document.getElementById('removeAssetImageBtn').style.display = 'none';
  document.getElementById('formAssetBranch').value = 'NAGA';
  document.getElementById('formAssetIssuedTo').value = '';
  document.getElementById('formAssetPurchaseDate').value = '';
  document.getElementById('formAssetUnitPrice').value = 0;
  document.getElementById('formAssetQuantity').value = 1;
  document.getElementById('formAssetUsefulLife').value = '';
  document.getElementById('formAssetCondition').value = 'IN CONDITION';
  document.getElementById('formAssetNote').value = 'ACTIVE';
  document.getElementById('formAssetStatus').value = 'IN USE';
  document.getElementById('formAssetTrackingDate').value = '';
  // If this page is scoped to one category (not the dashboard), default
  // the new asset's category to match the page it was opened from.
  if (window.PAGE_CATEGORY && window.PAGE_CATEGORY !== 'ALL') {
    document.getElementById('formAssetCategory').value = window.PAGE_CATEGORY;
  }
  calculateModalAmount();
  document.getElementById('assetDataModal').style.display = 'flex';
}

async function openAssetEditModal(assetId) {
  const db = await fetchBackendDataRows();
  const item = db.find((i) => i.id === assetId);
  if (!item) return;

  originalAssetImageUrl = item.imageUrl || '';
  originalAssetSnapshot = { ...item };
  document.getElementById('modalBoxTitle').innerText = 'Edit Master Asset Columns';
  document.getElementById('modalTargetIndexId').value = assetId;
  document.getElementById('formAssetId').value = item.id;
  document.getElementById('formAssetId').disabled = true;
  document.getElementById('formAssetName').value = item.name;
  document.getElementById('formAssetBrand').value = item.brand || '';
  document.getElementById('formAssetModel').value = item.model || '';
  document.getElementById('formAssetDescription').value = item.description || '';
  document.getElementById('formAssetSerialNumber').value = item.serialNumber || '';
  document.getElementById('formAssetItemCategory').value = item.itemCategory || '';
  document.getElementById('formAssetImageFile').value = '';
  document.getElementById('formAssetImageUrl').value = item.imageUrl || '';
  const editPreview = document.getElementById('formAssetImagePreview');
  const removeBtn = document.getElementById('removeAssetImageBtn');
  if (item.imageUrl) {
    editPreview.src = item.imageUrl;
    editPreview.style.display = 'block';
    removeBtn.style.display = 'inline-block';
  } else {
    editPreview.src = '';
    editPreview.style.display = 'none';
    removeBtn.style.display = 'none';
  }
  document.getElementById('formAssetBranch').value = item.branch || 'NAGA';
  document.getElementById('formAssetCategory').value = item.category;
  document.getElementById('formAssetIssuedTo').value = item.issuedTo || '';
  document.getElementById('formAssetPurchaseDate').value = item.purchaseDate || '';
  document.getElementById('formAssetUnitPrice').value = item.unitPrice || 0;
  document.getElementById('formAssetQuantity').value = item.qty || 1;
  document.getElementById('formAssetUsefulLife').value = item.usefulLife || '';
  document.getElementById('formAssetCondition').value = item.condition || 'IN CONDITION';
  document.getElementById('formAssetNote').value = item.note || 'ACTIVE';
  document.getElementById('formAssetStatus').value = item.status || 'IN USE';
  document.getElementById('formAssetTrackingDate').value = item.trackingDate || '';
  calculateModalAmount();
  document.getElementById('assetDataModal').style.display = 'flex';
}

function closeAssetModal() {
  document.getElementById('assetDataModal').style.display = 'none';
}

async function commitAssetStorageChange() {
  if (!supabaseClient)
    return alert('Not connected to the database. Check the console for details.');
  const targetId = document.getElementById('modalTargetIndexId').value;
  const price = Number(document.getElementById('formAssetUnitPrice').value) || 0;
  const qty = Number(document.getElementById('formAssetQuantity').value) || 0;

  // Keeps the existing image (edit mode) unless a new file was chosen;
  // stays blank on a brand-new asset with no file picked.
  let imageUrl = document.getElementById('formAssetImageUrl').value || '';
  const imageFile = document.getElementById('formAssetImageFile').files[0];
  if (imageFile) {
    const safeName = imageFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filePath = `${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabaseClient.storage
      .from('asset-images')
      .upload(filePath, imageFile, { upsert: true });
    if (uploadError) {
      console.error('Supabase image upload error:', uploadError);
      return alert(
        'Failed to upload image:\n\n' +
          uploadError.message +
          '\n\n(Make sure the "asset-images" storage bucket exists — see README.)'
      );
    }
    const { data: publicUrlData } = supabaseClient.storage
      .from('asset-images')
      .getPublicUrl(filePath);
    imageUrl = publicUrlData.publicUrl;
  }

  const commonFields = {
    name: document.getElementById('formAssetName').value.toUpperCase(),
    brand: document.getElementById('formAssetBrand').value.toUpperCase(),
    model: document.getElementById('formAssetModel').value.toUpperCase(),
    description: document.getElementById('formAssetDescription').value.toUpperCase(),
    serialNumber: document.getElementById('formAssetSerialNumber').value.toUpperCase(),
    itemCategory: document.getElementById('formAssetItemCategory').value.toUpperCase(),
    imageUrl: imageUrl,
    branch: document.getElementById('formAssetBranch').value.toUpperCase(),
    category: document.getElementById('formAssetCategory').value,
    issuedTo: document.getElementById('formAssetIssuedTo').value.toUpperCase(),
    purchaseDate: document.getElementById('formAssetPurchaseDate').value,
    unitPrice: price,
    qty: qty,
    amount: price * qty,
    usefulLife: document.getElementById('formAssetUsefulLife').value.toUpperCase(),
    condition: document.getElementById('formAssetCondition').value,
    note: document.getElementById('formAssetNote').value,
    status: document.getElementById('formAssetStatus').value,
    trackingDate: document.getElementById('formAssetTrackingDate').value,
  };

  if (targetId === '') {
    const newId = document.getElementById('formAssetId').value.trim();
    if (!newId) return alert('Asset ID is required');

    const { data: existing } = await supabaseClient
      .from('assets')
      .select('id')
      .eq('id', newId)
      .maybeSingle();
    if (existing)
      return alert(
        `The ID "${newId}" is already taken.\n\n` +
          `If you don't see it in the table, it's likely sitting in Settings → Deleted Items ` +
          `(deleting doesn't free up the ID). Restore it from there, or pick a different ID.`
      );

    const newItem = {
      id: newId,
      unit: document.getElementById('formAssetUnit').value,
      remarks: '',
      ...commonFields,
    };

    const { error } = await supabaseClient.from('assets').insert(mapRowToDb(newItem));
    if (error) {
      console.error('Supabase insert error:', error);
      return alert('Failed to save asset:\n\n' + error.message);
    }
  } else {
    const { error } = await supabaseClient
      .from('assets')
      .update(mapRowToDb({ id: targetId, ...commonFields }))
      .eq('id', targetId);
    if (error) {
      console.error('Supabase update error:', error);
      return alert('Failed to update asset:\n\n' + error.message);
    }
    await logAssetFieldChanges(targetId, originalAssetSnapshot, commonFields);
  }

  // Now that the asset record itself is safely saved, clean up the old
  // photo in storage if it was removed or replaced by a new one.
  if (originalAssetImageUrl && originalAssetImageUrl !== imageUrl) {
    await deleteAssetImageFromStorage(originalAssetImageUrl);
  }

  closeAssetModal();
  if (typeof searchAssets === 'function') searchAssets();
}

// ---------------------------------------------------------------------------
// ACCOUNTING REMARKS MODAL
// ---------------------------------------------------------------------------
let originalRemarksValue = '';

async function openRemarksEditModal(assetId) {
  const db = await fetchBackendDataRows();
  const item = db.find((i) => i.id === assetId);
  if (!item) return;

  originalRemarksValue = item.remarks || '';
  document.getElementById('modalRemarksTargetId').value = assetId;
  document.getElementById('formRemarksFieldText').value = item.remarks || '';
  document.getElementById('remarksDataModal').style.display = 'flex';
}

function closeRemarksModal() {
  document.getElementById('remarksDataModal').style.display = 'none';
}

async function commitAccountingRemarksChange() {
  if (!supabaseClient)
    return alert('Not connected to the database. Check the console for details.');
  const targetId = document.getElementById('modalRemarksTargetId').value;
  const newRemarks = document.getElementById('formRemarksFieldText').value.toUpperCase();

  const { error } = await supabaseClient
    .from('assets')
    .update({ remarks: newRemarks })
    .eq('id', targetId);

  if (error) {
    console.error('Supabase remarks update error:', error);
    alert('Failed to save remarks:\n\n' + error.message);
  } else {
    await logAssetFieldChanges(targetId, { remarks: originalRemarksValue }, { remarks: newRemarks });
  }

  closeRemarksModal();
  if (typeof searchAssets === 'function') searchAssets();
}
