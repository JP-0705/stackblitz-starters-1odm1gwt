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
  let filePath;
  try {
    filePath = decodeURIComponent(url.slice(idx + marker.length));
  } catch (err) {
    console.error('Could not decode stored image path:', err);
    return;
  }
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

// ---------------------------------------------------------------------------
// ASSET ID FORMAT:  IPHL<BRANCH>-<5 digits>   e.g.  IPHLNAGA-00001
//                                                    IPHLMAKATI-00001
// The number counts up separately for each branch. The ID is filled in
// automatically when you open "Add Asset" or change the Branch dropdown, but
// the field is read-only (it cannot be typed over).
// ---------------------------------------------------------------------------
function buildAssetIdPrefix(branch) {
  return 'IPHL' + String(branch || '').replace(/[^A-Za-z]/g, '').toUpperCase() + '-';
}

async function suggestNextAssetId() {
  const idField = document.getElementById('formAssetId');
  const branchEl = document.getElementById('formAssetBranch');
  if (!idField || !branchEl) return;
  // Only when ADDING a new asset (when editing, the ID is locked).
  if (document.getElementById('modalTargetIndexId').value !== '') return;

  const prefix = buildAssetIdPrefix(branchEl.value);
  idField.placeholder = prefix + '00000';
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from('assets')
    .select('id')
    .like('id', prefix + '%')
    .order('id', { ascending: false })
    .limit(1);

  // The popup may have been closed / switched to edit while we were waiting.
  if (document.getElementById('modalTargetIndexId').value !== '') return;
  if (buildAssetIdPrefix(branchEl.value) !== prefix) return; // branch changed again

  if (error) {
    console.error('Could not look up the next asset ID:', error);
    idField.value = '';
    return;
  }

  let nextNumber = 1;
  if (data && data.length) {
    const match = String(data[0].id).match(/-(\d+)$/);
    if (match) nextNumber = parseInt(match[1], 10) + 1;
  }
  idField.value = prefix + String(nextNumber).padStart(5, '0');
}

document.addEventListener('DOMContentLoaded', () => {
  const branchEl = document.getElementById('formAssetBranch');
  if (branchEl) branchEl.addEventListener('change', suggestNextAssetId);
});

// Warranty expiration = Date of Purchase + Warranty months. Shown (read-only)
// in the form and saved with the asset. Blank when either value is missing.
function computeWarrantyExpiration(purchaseDate, months) {
  const m = parseInt(months, 10);
  if (!purchaseDate || isNaN(m) || m < 0) return '';
  const d = new Date(purchaseDate + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  const day = d.getDate();
  d.setMonth(d.getMonth() + m);
  if (d.getDate() !== day) d.setDate(0); // e.g. Jan 31 + 1 month -> last day of Feb
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Auto-fills the expiration when BOTH purchase date and months are filled in.
// If either is missing, the field is left alone, so an expiration date that came
// from the old Excel file is never wiped just because the purchase date is blank.
function updateWarrantyExpirationDisplay() {
  const el = document.getElementById('formAssetWarrantyExpiration');
  if (!el) return;
  const computed = computeWarrantyExpiration(
    document.getElementById('formAssetPurchaseDate').value,
    document.getElementById('formAssetWarrantyMonths').value
  );
  if (computed) el.value = computed;
}

document.addEventListener('DOMContentLoaded', () => {
  const pd = document.getElementById('formAssetPurchaseDate');
  if (pd) pd.addEventListener('change', updateWarrantyExpirationDisplay);
});

// If an older record has a department that is not in the dropdown, add it so
// it is not silently erased when the asset is saved.
function ensureDepartmentOption(value) {
  const sel = document.getElementById('formAssetDepartment');
  if (!sel || !value) return;
  if (![...sel.options].some((o) => o.value === value)) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    sel.appendChild(opt);
  }
}

function openAssetInsertModal() {
  originalAssetImageUrl = '';
  originalAssetSnapshot = null;
  document.getElementById('modalBoxTitle').innerText = 'Add Operational Asset Record';
  document.getElementById('modalTargetIndexId').value = '';
  // The ID is generated automatically and cannot be typed over (prevents duplicates).
  document.getElementById('formAssetId').disabled = false;
  document.getElementById('formAssetId').readOnly = true;
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
  document.getElementById('formAssetDepartment').value = '';
  document.getElementById('formAssetSupplier').value = '';
  document.getElementById('formAssetSupplierContact').value = '';
  document.getElementById('formAssetSupplierAddress').value = '';
  document.getElementById('formAssetWarrantyMonths').value = '';
  document.getElementById('formAssetWarrantyExpiration').value = '';
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
  suggestNextAssetId();
}

async function openAssetEditModal(assetId) {
  if (
    !activeUserSession ||
    (activeUserSession.role !== 'ADMIN' && activeUserSession.role !== 'ACCOUNTING')
  ) {
    return;
  }
  const item = await fetchAssetById(assetId);
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
    editPreview.src = safeUrl(item.imageUrl);
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
  ensureDepartmentOption(item.department);
  document.getElementById('formAssetDepartment').value = item.department || '';
  document.getElementById('formAssetSupplier').value = item.supplier || '';
  document.getElementById('formAssetSupplierContact').value = item.supplierContact || '';
  document.getElementById('formAssetSupplierAddress').value = item.supplierAddress || '';
  document.getElementById('formAssetWarrantyMonths').value =
    item.warrantyMonths === null || item.warrantyMonths === undefined ? '' : item.warrantyMonths;
  document.getElementById('formAssetWarrantyExpiration').value = item.warrantyExpiration || '';
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

  // New assets must follow IPHL<BRANCH>-00000 and match the chosen branch.
  // Checked first so we never upload a photo for an asset that won't save.
  if (targetId === '') {
    // Ask the database for the newest number again, in case someone else
    // added an asset while this popup was open.
    await suggestNextAssetId();
    const idToCheck = document.getElementById('formAssetId').value.trim().toUpperCase();
    const expectedPrefix = buildAssetIdPrefix(document.getElementById('formAssetBranch').value);
    if (!idToCheck) {
      return alert('Could not generate the next Asset ID. Check your internet connection and try again.');
    }
    if (!new RegExp('^' + expectedPrefix + '\\d{5}$').test(idToCheck)) {
      return alert(
        `Asset ID must look like ${expectedPrefix}00001 for the ${document.getElementById('formAssetBranch').value} branch ` +
          `(5 digits after the dash).`
      );
    }
  }

  // Keeps the existing image (edit mode) unless a new file was chosen;
  // stays blank on a brand-new asset with no file picked.
  let imageUrl = document.getElementById('formAssetImageUrl').value || '';
  const imageFile = document.getElementById('formAssetImageFile').files[0];
  if (imageFile) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(imageFile.type)) {
      return alert('Only JPG, PNG, or WEBP images are allowed.');
    }
    if (imageFile.size > 5 * 1024 * 1024) {
      return alert('That image is larger than 5 MB. Please choose a smaller one.');
    }
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

  const warrantyRaw = document.getElementById('formAssetWarrantyMonths').value.trim();
  if (warrantyRaw !== '' && (!/^\d+$/.test(warrantyRaw) || Number(warrantyRaw) > 600)) {
    return alert('Warranty must be a whole number of months (0 to 600), or leave it blank.');
  }
  const warrantyMonthsValue = warrantyRaw === '' ? null : Number(warrantyRaw);

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
    department: document.getElementById('formAssetDepartment').value,
    supplier: document.getElementById('formAssetSupplier').value.toUpperCase(),
    supplierContact: document.getElementById('formAssetSupplierContact').value.trim(),
    supplierAddress: document.getElementById('formAssetSupplierAddress').value.toUpperCase(),
    warrantyMonths: warrantyMonthsValue,
    warrantyExpiration: document.getElementById('formAssetWarrantyExpiration').value || '',
    condition: document.getElementById('formAssetCondition').value,
    note: document.getElementById('formAssetNote').value,
    status: document.getElementById('formAssetStatus').value,
    trackingDate: document.getElementById('formAssetTrackingDate').value,
  };

  if (targetId === '') {
    const newId = document.getElementById('formAssetId').value.trim().toUpperCase();
    if (!newId) return alert('Asset ID is required');

    const { data: existing } = await supabaseClient
      .from('assets')
      .select('id')
      .eq('id', newId)
      .maybeSingle();
    if (existing)
      return alert(
        `The ID "${newId}" is already taken.\n\n` +
          `If you don't see it in the table, it's likely sitting in Settings → Disposed Items ` +
          `(disposing doesn't free up the ID). Restore it from there, or pick a different ID.`
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
      if (imageFile) await deleteAssetImageFromStorage(imageUrl); // don't leave an orphan photo
      if (error.code === '23505') {
        alert(
          `The ID "${newId}" already exists (it may belong to a disposed asset you can't see). ` +
            `A fresh ID has been filled in — please click Save again.`
        );
        document.getElementById('formAssetId').value = '';
        suggestNextAssetId();
        return;
      }
      return alert('Failed to save asset:\n\n' + error.message);
    }
    await logAssetEvent(newId, 'Asset Added', '(none)', commonFields.name);
  } else {
    const { error } = await supabaseClient
      .from('assets')
      .update(mapRowToDb({ id: targetId, ...commonFields }))
      .eq('id', targetId);
    if (error) {
      console.error('Supabase update error:', error);
      if (imageFile) await deleteAssetImageFromStorage(imageUrl); // don't leave an orphan photo
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
  if (
    !activeUserSession ||
    (activeUserSession.role !== 'ADMIN' && activeUserSession.role !== 'ACCOUNTING')
  ) {
    return;
  }
  const item = await fetchAssetById(assetId);
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

  const { error } = await supabaseClient.rpc('update_asset_remarks', {
    p_asset_id: targetId,
    p_remarks: newRemarks,
  });

  if (error) {
    console.error('Supabase remarks update error:', error);
    alert('Failed to save remarks:\n\n' + error.message);
  } else {
    await logAssetFieldChanges(targetId, { remarks: originalRemarksValue }, { remarks: newRemarks });
  }

  closeRemarksModal();
  if (typeof searchAssets === 'function') searchAssets();
}

// ---------------------------------------------------------------------------
// ISSUED TO — searchable dropdown.
// Click the field (or the ▾) to see every name / place already used in the
// system, type to filter, then click it or use ↑ ↓ + Enter. You can still type
// a brand-new name — it is simply saved as typed.
// ---------------------------------------------------------------------------
let issuedToOptions = [];
let issuedToLoadedAt = 0;

async function refreshIssuedToOptions() {
  if (Date.now() - issuedToLoadedAt < 30000) return; // reuse for 30 seconds
  issuedToLoadedAt = Date.now();
  const rows = await fetchBackendDataRows({ includeMissing: true });
  const seen = new Map(); // lower-case name -> { label, count } (so "Pantry" and "PANTRY" merge)
  rows.forEach((r) => {
    const value = String(r.issuedTo || '').trim();
    if (!value) return;
    const key = value.toLowerCase();
    const entry = seen.get(key) || { label: value, count: 0 };
    entry.count += 1;
    seen.set(key, entry);
  });
  issuedToOptions = [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function setupIssuedToPicker() {
  const input = document.getElementById('formAssetIssuedTo');
  if (!input || input.dataset.picker === '1') return;
  input.dataset.picker = '1';
  input.autocomplete = 'off'; // hides the browser's own (unrelated) suggestions
  input.placeholder = 'Select or type a name…';

  const wrap = document.createElement('div');
  wrap.className = 'combo-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'combo-toggle';
  toggle.tabIndex = -1;
  toggle.setAttribute('aria-label', 'Show list');
  toggle.textContent = '▾';
  wrap.appendChild(toggle);

  const list = document.createElement('div');
  list.className = 'combo-list';
  list.style.display = 'none';
  wrap.appendChild(list);

  let shown = []; // [{label, count}] currently listed; label '' = "Not issued"
  let active = -1;
  // The list is filtered only while the user is TYPING. Opening it by clicking the
  // field or the ▾ always shows everything, so a name that is already filled in
  // never hides the other choices.
  let filtering = false;

  const isOpen = () => list.style.display !== 'none';
  const close = () => { list.style.display = 'none'; active = -1; };

  function choose(label) {
    input.value = label;
    close();
    input.focus();
  }

  function highlight(index) {
    const items = list.querySelectorAll('.combo-item');
    items.forEach((el, i) => el.classList.toggle('active', i === index));
    active = index;
    if (items[index]) items[index].scrollIntoView({ block: 'nearest' });
  }

  function render() {
    const query = filtering ? input.value.trim().toLowerCase() : '';
    const matches = issuedToOptions.filter((o) => !query || o.label.toLowerCase().includes(query));
    shown = query ? matches : [{ label: '', count: 0 }, ...matches]; // first row = "Not issued"
    list.textContent = '';

    shown.forEach((o) => {
      const row = document.createElement('div');
      row.className = 'combo-item';
      if (!filtering && o.label !== '' && o.label.toLowerCase() === input.value.trim().toLowerCase()) {
        row.classList.add('selected'); // the value currently in the field
      }
      const text = document.createElement('span');
      text.textContent = o.label === '' ? '— Not issued to anyone —' : o.label;
      if (o.label === '') text.style.color = '#64748b';
      row.appendChild(text);
      if (o.count) {
        const count = document.createElement('span');
        count.className = 'combo-count';
        count.textContent = `${o.count} item${o.count === 1 ? '' : 's'}`;
        row.appendChild(count);
      }
      // mousedown (not click) so the input doesn't lose focus first
      row.addEventListener('mousedown', (e) => { e.preventDefault(); choose(o.label); });
      list.appendChild(row);
    });

    const exact = issuedToOptions.some((o) => o.label.toLowerCase() === query);
    if (filtering && query && !exact) {
      const hint = document.createElement('div');
      hint.className = 'combo-empty';
      hint.textContent = `New name: “${input.value.trim()}” — it will be saved as typed.`;
      list.appendChild(hint);
    }
    active = -1;
  }

  async function open(isTyping) {
    filtering = isTyping === true;
    await refreshIssuedToOptions();
    render();
    list.style.display = 'block';
    const selected = list.querySelector('.combo-item.selected');
    if (selected) selected.scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('focus', () => open(false));
  input.addEventListener('click', () => { if (!isOpen()) open(false); });
  input.addEventListener('input', () => open(true));
  input.addEventListener('blur', close);
  toggle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (isOpen()) close();
    else { input.focus(); open(false); }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen()) return open(false);
      highlight(Math.min(active + 1, shown.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen()) highlight(Math.max(active - 1, 0));
    } else if (e.key === 'Enter' && isOpen() && active >= 0) {
      e.preventDefault();
      choose(shown[active].label);
    } else if (e.key === 'Escape' && isOpen()) {
      e.stopPropagation();
      close();
    }
  });
}

document.addEventListener('DOMContentLoaded', setupIssuedToPicker);
