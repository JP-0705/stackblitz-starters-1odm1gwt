// Shared data layer — backed by the Supabase "assets" table.
// NOTE: the "assets" table needs "condition", "note", "useful_life",
// "is_deleted" (boolean, default false), "deleted_at" (timestamptz),
// "item_category" (text — free-form sub-type like "LAPTOP", "CHAIR"),
// and "image_url" (text — public URL of an uploaded reference photo)
// columns for these fields / soft-delete to work.
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

// Every normal view (dashboard, category pages, analytics, count sheets)
// excludes soft-deleted assets by filtering is_deleted = false here.
async function fetchBackendDataRows() {
  if (!supabaseClient) {
    console.error('Supabase client not initialized — cannot load assets.');
    return [];
  }
  const { data, error } = await supabaseClient
    .from('assets')
    .select('*')
    .eq('is_deleted', false)
    .order('id', { ascending: true });

  if (error) {
    console.error('Supabase fetch error:', error);
    alert('Could not load assets from the database:\n\n' + error.message);
    return [];
  }
  return data.map(mapRowFromDb);
}

// Used only by the Deleted Items screen (in the Settings menu).
async function fetchDeletedAssetRows() {
  if (!supabaseClient) {
    console.error('Supabase client not initialized — cannot load deleted assets.');
    return [];
  }
  const { data, error } = await supabaseClient
    .from('assets')
    .select('*')
    .eq('is_deleted', true)
    .order('deleted_at', { ascending: false });

  if (error) {
    console.error('Supabase fetch error (deleted items):', error);
    alert('Could not load deleted assets from the database:\n\n' + error.message);
    return [];
  }
  return data.map(mapRowFromDb);
}
