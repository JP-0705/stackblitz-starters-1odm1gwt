// Shared data layer — backed by the Supabase "assets" table.
// NOTE: the "assets" table needs "condition", "note", "useful_life",
// "is_deleted" (boolean, default false), "deleted_at" (timestamptz),
// "deleted_by" (text — email of whoever deleted it), "item_category"
// (text — free-form sub-type like "LAPTOP", "CHAIR"), and "image_url"
// (text — public URL of an uploaded reference photo) columns for these
// fields / soft-delete to work.
function mapRowFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    description: row.description,
    model: row.model,
    serialNumber: row.serial_number,
    category: row.category,
    itemCategory: row.item_category,
    imageUrl: row.image_url,
    branch: row.branch,
    issuedTo: row.issued_to,
    purchaseDate: row.purchase_date,
    unit: row.unit,
    unitPrice: row.unit_price,
    qty: row.qty,
    amount: row.amount,
    usefulLife: row.useful_life,
    condition: row.condition,
    note: row.note,
    remarks: row.remarks,
    status: row.status,
    trackingDate: row.tracking_date,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    disposalReason: row.disposal_reason,
    disposalDate: row.disposal_date,
    disposalRemarks: row.disposal_remarks,
    isMissing: row.is_missing === true,
    missingDate: row.missing_date,
    missingLastHolder: row.missing_last_holder,
    missingRemarks: row.missing_remarks,
    missingMarkedBy: row.missing_marked_by,
    missingMarkedAt: row.missing_marked_at,
  };
}

function mapRowToDb(item) {
  return {
    id: item.id,
    name: item.name,
    brand: item.brand,
    description: item.description,
    model: item.model,
    serial_number: item.serialNumber,
    category: item.category,
    item_category: item.itemCategory,
    image_url: item.imageUrl,
    branch: item.branch || 'NAGA',
    issued_to: item.issuedTo,
    purchase_date: item.purchaseDate || null,
    unit: item.unit,
    unit_price: item.unitPrice,
    qty: item.qty,
    amount: item.amount,
    useful_life: item.usefulLife,
    condition: item.condition,
    note: item.note,
    remarks: item.remarks,
    status: item.status,
    tracking_date: item.trackingDate || null,
  };
}

// Supabase returns at most 1,000 rows per request. Without this loop, an
// inventory with more than 1,000 assets would be silently cut off (missing
// items on the dashboard, count sheets, and reports). This keeps asking for
// the next 1,000 until everything has been loaded.
async function fetchAllPages(makeQuery) {
  const PAGE_SIZE = 1000;
  let all = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makeQuery().range(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    all = all.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { data: all, error: null };
}

// Every normal view (dashboard, category pages, analytics, count sheets)
// excludes disposed assets (is_deleted = true) AND missing assets
// (is_missing = true — they are no longer counted). The Monthly Report passes
// { includeMissing: true } because it still needs their names.
// (Missing items are filtered here, in code, so the app keeps working even
// before the is_missing column has been added to the database.)
async function fetchBackendDataRows(options) {
  const includeMissing = !!(options && options.includeMissing);
  if (!supabaseClient) {
    console.error('Supabase client not initialized — cannot load assets.');
    return [];
  }
  const { data, error } = await fetchAllPages(() =>
    supabaseClient
      .from('assets')
      .select('*')
      .eq('is_deleted', false)
      .order('id', { ascending: true })
  );

  if (error) {
    console.error('Supabase fetch error:', error);
    alert('Could not load assets from the database:\n\n' + error.message);
    return [];
  }
  return (data || [])
    .filter((row) => includeMissing || row.is_missing !== true)
    .map(mapRowFromDb);
}

// Loads ONE asset by id (used by the Edit / Remarks popups so they don't
// have to download the whole table just to open a single row).
async function fetchAssetById(assetId) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from('assets')
    .select('*')
    .eq('id', assetId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (error) {
    console.error('Supabase fetch error (single asset):', error);
    alert('Could not load the asset from the database:\n\n' + error.message);
    return null;
  }
  return data ? mapRowFromDb(data) : null;
}

// Used only by the Missing Items screen (in the Settings menu).
async function fetchMissingAssetRows() {
  if (!supabaseClient) return [];
  const { data, error } = await fetchAllPages(() =>
    supabaseClient
      .from('assets')
      .select('*')
      .eq('is_missing', true)
      .eq('is_deleted', false)
      .order('missing_date', { ascending: false })
      .order('id', { ascending: true })
  );
  if (error) {
    console.error('Supabase fetch error (missing items):', error);
    alert('Could not load missing items from the database:\n\n' + error.message);
    return [];
  }
  return (data || []).map(mapRowFromDb);
}

// Used only by the Disposed Items screen (in the Settings menu).
async function fetchDeletedAssetRows() {
  if (!supabaseClient) {
    console.error('Supabase client not initialized — cannot load deleted assets.');
    return [];
  }
  const { data, error } = await fetchAllPages(() =>
    supabaseClient
      .from('assets')
      .select('*')
      .eq('is_deleted', true)
      .order('deleted_at', { ascending: false })
      .order('id', { ascending: true })
  );

  if (error) {
    console.error('Supabase fetch error (deleted items):', error);
    alert('Could not load deleted assets from the database:\n\n' + error.message);
    return [];
  }
  return (data || []).map(mapRowFromDb);
}
