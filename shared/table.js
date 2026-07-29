// Shared table rendering — loaded on dashboard + every category page.
// window.PAGE_CATEGORY is set inline in each page's HTML before this
// script loads: 'ALL' for the dashboard, or e.g. 'APPLIANCES' for a
// specific category page.
let currentCategoryFilter = window.PAGE_CATEGORY || 'ALL';
let currentBranchFilter = 'ALL';

// Age is calculated live from the purchase date, the same way remaining
// useful life is — no field to update by hand, it just counts up on its
// own every year.
function calculateAssetAge(purchaseDate) {
  if (!purchaseDate) return '---';
  const purchase = new Date(purchaseDate);
  if (isNaN(purchase.getTime())) return '---';

  const ageDays = (Date.now() - purchase.getTime()) / (1000 * 60 * 60 * 24);

  if (ageDays < 1) return 'TODAY';
  if (ageDays < 7) {
    const days = Math.round(ageDays);
    return `${days} DAY${days === 1 ? '' : 'S'}`;
  }
  if (ageDays < 30) {
    const weeks = Math.round(ageDays / 7);
    return `${weeks} WEEK${weeks === 1 ? '' : 'S'}`;
  }
  if (ageDays < 365) {
    const months = Math.round(ageDays / 30.44);
    return `${months} MONTH${months === 1 ? '' : 'S'}`;
  }
  const years = Math.round(ageDays / 365.25);
  return `${years} YEAR${years === 1 ? '' : 'S'}`;
}

// "Useful Life" is entered once as the item's TOTAL lifespan (e.g. "5
// YEARS") and is never edited again — the REMAINING life shown in the
// table is calculated live from that total and the purchase date, so it
// counts down on its own every year without anyone updating it by hand.
function calculateRemainingUsefulLife(purchaseDate, totalUsefulLifeText) {
  if (!totalUsefulLifeText) return '---';
  const totalYearsMatch = String(totalUsefulLifeText).match(/\d+(\.\d+)?/);
  if (!totalYearsMatch) return totalUsefulLifeText; // not a recognizable "N years" value
  if (!purchaseDate) return totalUsefulLifeText; // no purchase date to calculate age from

  const totalYears = parseFloat(totalYearsMatch[0]);
  const purchase = new Date(purchaseDate);
  if (isNaN(purchase.getTime())) return totalUsefulLifeText;

  const ageYears = (Date.now() - purchase.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const remaining = totalYears - ageYears;

  if (remaining <= 0) return 'EXPIRED';
  const remainingRounded = Math.round(remaining);
  if (remainingRounded < 1) return '< 1 YEAR LEFT';
  return `${remainingRounded} YEAR${remainingRounded === 1 ? '' : 'S'} LEFT`;
}

function handleBranchFilterChange() {
  currentBranchFilter = document.getElementById('branchFilterSelect').value;
  const branchLabelText =
    currentBranchFilter === 'ALL' ? 'ALL BRANCH' : `${currentBranchFilter} BRANCH`;
  const titleEl = document.getElementById('printOnlyBranchTitle');
  if (titleEl) {
    titleEl.innerText = `INNOVPHIL ASSET LIST — ${branchLabelText}`;
  }
  searchAssets();
}

// Rebuilds the Asset Type dropdown from whatever distinct itemCategory
// values actually exist right now (scoped to this page's category/branch)
// — so a brand new type typed into the Add Asset form shows up here on
// its own next time the table loads, with nothing to configure by hand.
function populateAssetTypeFilterOptions(scopedItems) {
  const select = document.getElementById('assetTypeFilterSelect');
  if (!select) return;

  const currentValue = select.value;
  const distinctTypes = [...new Set(
    scopedItems.map((item) => (item.itemCategory || '').trim()).filter(Boolean)
  )].sort();

  select.innerHTML =
    '<option value="ALL">ALL TYPES</option>' +
    distinctTypes.map((type) => `<option value="${type}">${type}</option>`).join('');

  select.value = distinctTypes.includes(currentValue) ? currentValue : 'ALL';
}

async function searchAssets() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return; // guard: this page has no table (e.g. analytics)

  const searchInput = document.getElementById('globalSearch').value.toLowerCase();
  const conditionFilter = document.getElementById('conditionFilterSelect').value;
  const assetTypeSelect = document.getElementById('assetTypeFilterSelect');
  const assetTypeFilter = assetTypeSelect ? assetTypeSelect.value : 'ALL';
  const groupByIssuedTo = document.getElementById('groupByIssuedToCheckbox').checked;
  const rawDatabase = await fetchBackendDataRows();

  const categoryBranchScoped = rawDatabase.filter((item) => {
    const matchesCategory =
      currentCategoryFilter === 'ALL' || item.category === currentCategoryFilter;
    const matchesBranch =
      currentBranchFilter === 'ALL' || item.branch === currentBranchFilter;
    return matchesCategory && matchesBranch;
  });
  populateAssetTypeFilterOptions(categoryBranchScoped);

  const filtered = categoryBranchScoped.filter((item) => {
    const matchesCondition =
      conditionFilter === 'ALL' || item.condition === conditionFilter;
    const matchesAssetType =
      assetTypeFilter === 'ALL' || item.itemCategory === assetTypeFilter;
    const matchesKeyword =
      (item.id || '').toLowerCase().includes(searchInput) ||
      (item.name || '').toLowerCase().includes(searchInput) ||
      (item.brand || '').toLowerCase().includes(searchInput) ||
      (item.issuedTo || '').toLowerCase().includes(searchInput) ||
      (item.model || '').toLowerCase().includes(searchInput) ||
      (item.itemCategory || '').toLowerCase().includes(searchInput) ||
      (item.serialNumber || '').toLowerCase().includes(searchInput);
    return matchesCondition && matchesAssetType && matchesKeyword;
  });

  if (groupByIssuedTo) {
    filtered.sort((a, b) => (a.issuedTo || '').localeCompare(b.issuedTo || ''));
  }

  renderTableRows(filtered, groupByIssuedTo);
}

function renderTableRows(dataRows, groupByIssuedTo = false) {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  let lastIssuedTo = null;
  window.lastRenderedAssetRows = dataRows;

  const TOTAL_TABLE_COLUMNS = 24;

  dataRows.forEach((item) => {
    if (groupByIssuedTo) {
      const currentIssuedTo = item.issuedTo || 'UNASSIGNED';
      if (currentIssuedTo !== lastIssuedTo) {
        lastIssuedTo = currentIssuedTo;
        const groupRow = document.createElement('tr');
        groupRow.className = 'group-header-row';
        groupRow.innerHTML = `<td colspan="${TOTAL_TABLE_COLUMNS}">ISSUED TO: ${currentIssuedTo}</td>`;
        tbody.appendChild(groupRow);
      }
    }

    const row = document.createElement('tr');
    const isAdmin = activeUserSession && activeUserSession.role === 'ADMIN';
    const canComment =
      activeUserSession &&
      (activeUserSession.role === 'ACCOUNTING' || activeUserSession.role === 'VIEWER');

    const actionButtons = `
      <td style="text-align:center; white-space:nowrap;">
        ${
          isAdmin
            ? `<button onclick="event.stopPropagation(); openAssetEditModal('${item.id}')" class="btn-table btn-edit-rem">✏️ Edit</button>`
            : ''
        }
        ${
          canComment
            ? `<button onclick="event.stopPropagation(); openRemarksEditModal('${item.id}')" class="btn-table btn-edit-rem">💬 Remarks</button>`
            : ''
        }
        ${
          isAdmin
            ? `<button onclick="event.stopPropagation(); openAssetEditHistoryModal('${item.id}')" class="btn-table btn-edit-rem">🕘 History</button>`
            : ''
        }
        ${
          isAdmin
            ? `<button onclick="event.stopPropagation(); deleteAssetRecord('${item.id}')" class="btn-table" style="background:#fee2e2; color:#b91c1c;">🗑️ Del</button>`
            : ''
        }
      </td>
    `;

    const statusClassMap = {
      'IN USE': 'status-in-use',
      AVAILABLE: 'status-available',
      APPROVED: 'status-approved',
      PENDING: 'status-pending',
      REQUESTED: 'status-requested',
      REPLENISHED: 'status-replenished',
    };
    const statusClass = statusClassMap[item.status] || 'status-in-use';

    const conditionClassMap = {
      'IN CONDITION': 'condition-in',
      DEFECTIVE: 'condition-defective',
      DISPOSED: 'condition-disposed',
    };
    const conditionClass = conditionClassMap[item.condition] || 'condition-good';

    const noteClassMap = {
      ACTIVE: 'note-active',
      'FOR DISPOSAL': 'note-for-disposal',
      LOST: 'note-lost',
      ARCHIVED: 'note-archived',
    };
    const noteClass = noteClassMap[item.note] || 'note-active';

    const imageCell = item.imageUrl
      ? `<img src="${item.imageUrl}" alt="${item.name || 'asset'}" style="width:40px; height:40px; object-fit:cover; border-radius:6px; cursor:pointer;" onclick="event.stopPropagation(); showAssetImagePreview('${item.imageUrl}', '${(item.name || 'Asset').replace(/'/g, "\\'")}')" />`
      : '<span style="color:#94a3b8; font-size:11px;">No Image</span>';

    const remainingLife = calculateRemainingUsefulLife(item.purchaseDate, item.usefulLife);
    const remainingLifeStyle =
      remainingLife === 'EXPIRED' ? 'color:#dc2626; font-weight:700;' : '';

    row.innerHTML = `
      <td style="font-family:monospace; font-weight:700; color:#0f172a;">${item.id}</td>
      <td style="font-weight:600;">${item.name}</td>
      <td>${item.brand || '---'}</td>
      <td>${item.description || '---'}</td>
      <td>${item.model || '---'}</td>
      <td>${item.serialNumber || '---'}</td>
      <td>${item.itemCategory || '---'}</td>
      <td>${imageCell}</td>
      <td style="color:#64748b; font-size:11px;">${item.category || '---'}</td>
      <td>${item.branch || 'NAGA'}</td>
      <td>${item.issuedTo || '---'}</td>
      <td>${item.purchaseDate || '---'}</td>
      <td>${item.unit || 'PIECE'}</td>
      <td>₱ ${Number(item.unitPrice || 0).toLocaleString()}</td>
      <td>${item.qty || 1}</td>
      <td style="font-weight:600;">₱ ${Number(item.amount || 0).toLocaleString()}</td>
      <td style="${remainingLifeStyle}">${remainingLife}</td>
      <td>${calculateAssetAge(item.purchaseDate)}</td>
      <td><span class="status-pill ${conditionClass}">${item.condition || 'IN CONDITION'}</span></td>
      <td><span class="status-pill ${noteClass}">${item.note || 'ACTIVE'}</span></td>
      <td><span class="status-pill ${statusClass}">${item.status || 'IN USE'}</span></td>
      <td>${item.trackingDate || '---'}</td>
      <td style="font-style:italic; color:#475569;">${item.remarks || '---'}</td>
      ${actionButtons}
    `;
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => openRowDetailModal(item.id));
    tbody.appendChild(row);
  });

  const uniqueEl = document.getElementById('uniqueCounter');
  if (uniqueEl) uniqueEl.innerText = new Set(dataRows.map((i) => i.id)).size;
  const totalEl = document.getElementById('totalCounter');
  if (totalEl) {
    totalEl.innerText = dataRows.reduce((sum, item) => sum + Number(item.qty || 1), 0);
  }
}

// Row-click "Product Details" popup — shows a clean summary of one row
// without needing to scroll the wide table sideways. Populated from
// whatever is currently in the table (no extra fetch needed).
let currentRowDetailAssetId = null;

function openRowDetailModal(assetId) {
  const item = window.lastRenderedAssetRows
    ? window.lastRenderedAssetRows.find((row) => row.id === assetId)
    : null;
  if (!item) return;

  currentRowDetailAssetId = assetId;

  const body = document.getElementById('rowDetailBody');
  body.innerHTML = `
    <p style="margin:5px 0;"><strong>Date:</strong> ${item.purchaseDate || '---'}</p>
    <p style="margin:5px 0;"><strong>Asset Name:</strong> ${item.name || '---'}</p>
    <p style="margin:5px 0;"><strong>Description:</strong> ${item.description || '---'}</p>
    <p style="margin:5px 0;"><strong>Serial:</strong> ${item.serialNumber || '---'}</p>
    <p style="margin:5px 0;"><strong>Category:</strong> ${item.category || '---'}</p>
    <p style="margin:5px 0;"><strong>Branch:</strong> ${item.branch || 'NAGA'}</p>
    <p style="margin:5px 0;"><strong>Issued To:</strong> ${item.issuedTo || '---'}</p>
    <p style="margin:5px 0;"><strong>Status:</strong> ${item.status || '---'}</p>
    <p style="margin:5px 0;"><strong>Quantity:</strong> ${item.qty || 1}</p>
    <p style="margin:5px 0;"><strong>Price:</strong> ₱ ${Number(item.unitPrice || 0).toLocaleString()}</p>
    <p style="margin:5px 0;"><strong>Useful Life:</strong> ${item.usefulLife || '---'} (${calculateRemainingUsefulLife(item.purchaseDate, item.usefulLife)} remaining)</p>
  `;

  const isAdmin = activeUserSession && activeUserSession.role === 'ADMIN';
  document.getElementById('rowDetailEditBtn').style.display = isAdmin ? 'inline-block' : 'none';

  document.getElementById('rowDetailModal').style.display = 'flex';
}

function closeRowDetailModal() {
  document.getElementById('rowDetailModal').style.display = 'none';
  currentRowDetailAssetId = null;
}

function handleRowDetailEditClick() {
  const assetId = currentRowDetailAssetId;
  closeRowDetailModal();
  if (assetId) openAssetEditModal(assetId);
}

// A second, synced horizontal scrollbar placed above the table — so
// scrolling left/right doesn't require reaching all the way down to the
// bottom of a tall table to find the real one.
function initTableScrollSync() {
  let wrapper = document.querySelector('.data-container .table-scroll-wrapper');
  if (!wrapper) return; // pages without this table (e.g. analytics)

  // Wrap the real scrolling element in a clipping box so its native
  // horizontal scrollbar renders just past the visible bottom edge and
  // is hidden in every browser (not just Chrome) — see styles.css.
  let outer = wrapper.parentElement;
  if (!outer.classList.contains('table-scroll-outer')) {
    outer = document.createElement('div');
    outer.className = 'table-scroll-outer';
    wrapper.parentNode.insertBefore(outer, wrapper);
    outer.appendChild(wrapper);
  }

  let topBar = document.getElementById('tableScrollTop');
  let inner;
  if (!topBar) {
    topBar = document.createElement('div');
    topBar.id = 'tableScrollTop';
    topBar.className = 'table-scroll-top no-print';
    inner = document.createElement('div');
    inner.className = 'table-scroll-top-inner';
    topBar.appendChild(inner);
    outer.parentNode.insertBefore(topBar, outer);
  } else {
    inner = topBar.querySelector('.table-scroll-top-inner');
  }

  function syncWidth() {
    const table = wrapper.querySelector('table');
    if (table) inner.style.width = table.scrollWidth + 'px';
  }
  syncWidth();
  window.addEventListener('resize', syncWidth);

  let syncing = false;
  topBar.addEventListener('scroll', () => {
    if (syncing) return;
    syncing = true;
    wrapper.scrollLeft = topBar.scrollLeft;
    syncing = false;
  });
  wrapper.addEventListener('scroll', () => {
    if (syncing) return;
    syncing = true;
    topBar.scrollLeft = wrapper.scrollLeft;
    syncing = false;
  });
}

// Called once on DOMContentLoaded by each dashboard/category page. Also
// picks up ?branch=, ?condition=, and ?assetType= from the URL — these
// are set when someone clicks a bar/slice on the Analytics charts, so
// landing here immediately shows the filtered list they clicked for.
async function initTablePage() {
  const params = new URLSearchParams(window.location.search);
  const branchParam = params.get('branch');
  const conditionParam = params.get('condition');
  const assetTypeParam = params.get('assetType');

  function applyParamToSelect(selectId, paramValue) {
    if (!paramValue) return false;
    const select = document.getElementById(selectId);
    if (!select) return false;
    const matched = [...select.options].some((opt) => opt.value === paramValue);
    if (matched) select.value = paramValue;
    return matched;
  }

  applyParamToSelect('branchFilterSelect', branchParam);
  applyParamToSelect('conditionFilterSelect', conditionParam);

  await searchAssets(); // also populates the Asset Type dropdown's options

  // Asset Type can only be selected after searchAssets() has populated
  // its <option> list above, so it needs a second pass.
  if (applyParamToSelect('assetTypeFilterSelect', assetTypeParam)) {
    await searchAssets();
  }

  initTableScrollSync();
}
