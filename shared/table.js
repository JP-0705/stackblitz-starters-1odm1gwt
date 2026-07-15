// Shared table rendering — loaded on dashboard + every category page.
// window.PAGE_CATEGORY is set inline in each page's HTML before this
// script loads: 'ALL' for the dashboard, or e.g. 'APPLIANCES' for a
// specific category page.
let currentCategoryFilter = window.PAGE_CATEGORY || 'ALL';
let currentBranchFilter = 'NAGA';

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

async function searchAssets() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return; // guard: this page has no table (e.g. analytics)

  const searchInput = document.getElementById('globalSearch').value.toLowerCase();
  const conditionFilter = document.getElementById('conditionFilterSelect').value;
  const groupByIssuedTo = document.getElementById('groupByIssuedToCheckbox').checked;
  const rawDatabase = await fetchBackendDataRows();
  const filtered = rawDatabase.filter((item) => {
    const matchesCategory =
      currentCategoryFilter === 'ALL' || item.category === currentCategoryFilter;
    const matchesBranch =
      currentBranchFilter === 'ALL' || item.branch === currentBranchFilter;
    const matchesCondition =
      conditionFilter === 'ALL' || item.condition === conditionFilter;
    const matchesKeyword =
      (item.id || '').toLowerCase().includes(searchInput) ||
      (item.name || '').toLowerCase().includes(searchInput) ||
      (item.brand || '').toLowerCase().includes(searchInput) ||
      (item.issuedTo || '').toLowerCase().includes(searchInput) ||
      (item.model || '').toLowerCase().includes(searchInput) ||
      (item.itemCategory || '').toLowerCase().includes(searchInput) ||
      (item.serialNumber || '').toLowerCase().includes(searchInput);
    return matchesCategory && matchesBranch && matchesCondition && matchesKeyword;
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

  const TOTAL_TABLE_COLUMNS = 23;

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
            ? `<button onclick="openAssetEditModal('${item.id}')" class="btn-table btn-edit-rem">✏️ Edit</button>`
            : ''
        }
        ${
          canComment
            ? `<button onclick="openRemarksEditModal('${item.id}')" class="btn-table btn-edit-rem">💬 Remarks</button>`
            : ''
        }
        ${
          isAdmin
            ? `<button onclick="deleteAssetRecord('${item.id}')" class="btn-table" style="background:#fee2e2; color:#b91c1c;">🗑️ Del</button>`
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
      ? `<img src="${item.imageUrl}" alt="${item.name || 'asset'}" style="width:40px; height:40px; object-fit:cover; border-radius:6px; cursor:pointer;" onclick="showAssetImagePreview('${item.imageUrl}', '${(item.name || 'Asset').replace(/'/g, "\\'")}')" />`
      : '<span style="color:#94a3b8; font-size:11px;">No Image</span>';

    row.innerHTML = `
      <td style="font-family:monospace; font-weight:700; color:#0f172a;">${item.id}</td>
      <td style="font-weight:600;">${item.name}</td>
      <td>${item.brand || '---'}</td>
      <td>${item.description || '---'}</td>
      <td>${item.model || '---'}</td>
      <td>${item.serialNumber || '---'}</td>
      <td>${item.itemCategory || '---'}</td>
      <td>${imageCell}</td>
      <td style="color:#64748b; font-size:11px;">${item.category}</td>
      <td>${item.branch || 'NAGA'}</td>
      <td>${item.issuedTo || '---'}</td>
      <td>${item.purchaseDate || '---'}</td>
      <td>${item.unit || 'PIECE'}</td>
      <td>₱ ${Number(item.unitPrice || 0).toLocaleString()}</td>
      <td>${item.qty || 1}</td>
      <td style="font-weight:600;">₱ ${Number(item.amount || 0).toLocaleString()}</td>
      <td>${item.usefulLife || '---'}</td>
      <td><span class="status-pill ${conditionClass}">${item.condition || 'IN CONDITION'}</span></td>
      <td><span class="status-pill ${noteClass}">${item.note || 'ACTIVE'}</span></td>
      <td><span class="status-pill ${statusClass}">${item.status || 'IN USE'}</span></td>
      <td>${item.trackingDate || '---'}</td>
      <td style="font-style:italic; color:#475569;">${item.remarks || '---'}</td>
      ${actionButtons}
    `;
    tbody.appendChild(row);
  });

  const uniqueEl = document.getElementById('uniqueCounter');
  if (uniqueEl) uniqueEl.innerText = new Set(dataRows.map((i) => i.id)).size;
  const totalEl = document.getElementById('totalCounter');
  if (totalEl) {
    totalEl.innerText = dataRows.reduce((sum, item) => sum + Number(item.qty || 1), 0);
  }
}

// Called once on DOMContentLoaded by each dashboard/category page.
function initTablePage() {
  searchAssets();
}
