// Analytics page only — three charts driven by live asset data.
// NOTE: this page does not load shared/table.js (it has no row table),
// so it needs its own copies of the filter-handling functions that the
// header controls call — handleBranchFilterChange() and searchAssets().
let branchChartInstance = null;
let categoryChartInstance = null;
let conditionChartInstance = null;
let categoryTypeChartInstances = {};

// Maps the exact category string stored on each asset (and shown in the
// Category chart) to that category's dedicated page — used so clicking a
// slice can jump straight there instead of just showing a tooltip.
const CATEGORY_PAGE_ROUTES = {
  APPLIANCES: '/appliances/',
  'AHA EQUIPMENT': '/aha-equipment/',
  'VEHICLE & OTHERS': '/vehicle-others/',
  'IT EQUIPMENT': '/it-equipment/',
  'FURNITURES & FIXTURES': '/furniture-fixtures/',
  'OFFICE SUPPLIES': '/office-supplies/',
};

// Which canvas each category's "by Asset Type" pie chart renders into.
const CATEGORY_TYPE_CHART_CANVAS_IDS = {
  APPLIANCES: 'categoryPie-APPLIANCES',
  'FURNITURES & FIXTURES': 'categoryPie-FURNITURES-FIXTURES',
  'OFFICE SUPPLIES': 'categoryPie-OFFICE-SUPPLIES',
  'IT EQUIPMENT': 'categoryPie-IT-EQUIPMENT',
  'VEHICLE & OTHERS': 'categoryPie-VEHICLE-OTHERS',
  'AHA EQUIPMENT': 'categoryPie-AHA-EQUIPMENT',
};

// Shared by every chart's onClick — pulls out which bar/slice was
// actually clicked (Chart.js gives back an empty array for clicks on
// empty chart space), and ignores clicks on the catch-all "UNSPECIFIED"
// bucket since there's nothing meaningful to filter by for that.
function getClickedChartLabel(chart, elements) {
  if (!elements || !elements.length) return null;
  const label = chart.data.labels[elements[0].index];
  return label && label !== 'UNSPECIFIED' ? label : null;
}

// Shows a pointer cursor while hovering a clickable bar/slice, so it's
// obvious the charts can be clicked before someone tries it.
function chartPointerOnHover(event, elements) {
  event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
}

function getAnalyticsFilteredAssets(allAssets) {
  const searchEl = document.getElementById('globalSearch');
  const conditionEl = document.getElementById('conditionFilterSelect');
  const searchInput = (searchEl ? searchEl.value : '').toLowerCase();
  const conditionFilter = conditionEl ? conditionEl.value : 'ALL';

  return allAssets.filter((item) => {
    const matchesBranch =
      currentBranchFilter === 'ALL' || item.branch === currentBranchFilter;
    const matchesCondition =
      conditionFilter === 'ALL' || item.condition === conditionFilter;
    const matchesKeyword =
      !searchInput ||
      (item.id || '').toLowerCase().includes(searchInput) ||
      (item.name || '').toLowerCase().includes(searchInput) ||
      (item.brand || '').toLowerCase().includes(searchInput) ||
      (item.issuedTo || '').toLowerCase().includes(searchInput) ||
      (item.model || '').toLowerCase().includes(searchInput) ||
      (item.itemCategory || '').toLowerCase().includes(searchInput) ||
      (item.serialNumber || '').toLowerCase().includes(searchInput);
    return matchesBranch && matchesCondition && matchesKeyword;
  });
}

// Called by the OFFICE BRANCH dropdown's onchange.
function handleBranchFilterChange() {
  currentBranchFilter = document.getElementById('branchFilterSelect').value;
  loadAnalyticsCharts();
}

// Called by the search box, condition dropdown, and "Group by Issued To"
// checkbox. That last one has no meaning for charts (there's nothing to
// group visually), so it's intentionally a no-op beyond re-filtering.
function searchAssets() {
  loadAnalyticsCharts();
}

async function loadAnalyticsCharts() {
  if (!supabaseClient) {
    return alert('Not connected to the database. Check the console for details.');
  }

  const rawAssets = await fetchBackendDataRows();
  const allAssets = getAnalyticsFilteredAssets(rawAssets);

  const branchTotals = {};
  allAssets.forEach((item) => {
    const key = item.branch || 'UNSPECIFIED';
    branchTotals[key] = (branchTotals[key] || 0) + Number(item.qty || 1);
  });

  const categoryTotals = {};
  allAssets.forEach((item) => {
    const key = item.category || 'UNSPECIFIED';
    categoryTotals[key] = (categoryTotals[key] || 0) + Number(item.qty || 1);
  });

  const conditionTotals = {};
  allAssets.forEach((item) => {
    const key = item.condition || 'UNSPECIFIED';
    conditionTotals[key] = (conditionTotals[key] || 0) + Number(item.qty || 1);
  });

  // Bonus: keep the header stat cards meaningful on the analytics page too.
  const uniqueEl = document.getElementById('uniqueCounter');
  if (uniqueEl) uniqueEl.innerText = new Set(allAssets.map((i) => i.id)).size;
  const totalEl = document.getElementById('totalCounter');
  if (totalEl) totalEl.innerText = allAssets.reduce((sum, i) => sum + Number(i.qty || 1), 0);

  renderBranchChart(branchTotals);
  renderCategoryChart(categoryTotals);
  renderConditionChart(conditionTotals);
  renderCategoryTypeBreakdownCharts(allAssets);
}

function renderBranchChart(branchTotals) {
  const ctx = document.getElementById('branchChart');
  if (branchChartInstance) branchChartInstance.destroy();
  branchChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(branchTotals),
      datasets: [{ label: 'Total Quantity', data: Object.values(branchTotals), backgroundColor: '#0b1d33' }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } },
      onHover: chartPointerOnHover,
      onClick: (event, elements) => {
        const label = getClickedChartLabel(branchChartInstance, elements);
        if (label) window.location.href = `/dashboard/?branch=${encodeURIComponent(label)}`;
      },
    },
  });
}

function renderCategoryChart(categoryTotals) {
  const ctx = document.getElementById('categoryChart');
  const palette = ['#0b1d33', '#f97316', '#e11d48', '#0d9488', '#8b5cf6', '#38bdf8', '#facc15'];
  if (categoryChartInstance) categoryChartInstance.destroy();
  categoryChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(categoryTotals),
      datasets: [{ label: 'Total Quantity', data: Object.values(categoryTotals), backgroundColor: palette }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      onHover: chartPointerOnHover,
      onClick: (event, elements) => {
        const label = getClickedChartLabel(categoryChartInstance, elements);
        const route = label && CATEGORY_PAGE_ROUTES[label];
        if (route) window.location.href = route;
      },
    },
  });
}

function renderConditionChart(conditionTotals) {
  const ctx = document.getElementById('conditionChart');
  const palette = {
    'IN CONDITION': '#0d9488',
    DEFECTIVE: '#fa5555',
    DISPOSED: '#c2c2c2',
  };
  const labels = Object.keys(conditionTotals);
  if (conditionChartInstance) conditionChartInstance.destroy();
  conditionChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ label: 'Total Quantity', data: Object.values(conditionTotals), backgroundColor: labels.map((l) => palette[l] || '#94a3b8') }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } },
      onHover: chartPointerOnHover,
      onClick: (event, elements) => {
        const label = getClickedChartLabel(conditionChartInstance, elements);
        if (label) window.location.href = `/dashboard/?condition=${encodeURIComponent(label)}`;
      },
    },
  });
}
// One small pie chart per category, each showing that category's own
// items broken down by Asset Type. Uses the same already-filtered
// allAssets as the other charts, so branch/condition/search still apply.
function renderCategoryTypeBreakdownCharts(allAssets) {
  const palette = ['#0b1d33', '#f97316', '#e11d48', '#0d9488', '#8b5cf6', '#38bdf8', '#facc15', '#22c55e', '#eab308', '#64748b'];

  Object.entries(CATEGORY_TYPE_CHART_CANVAS_IDS).forEach(([categoryValue, canvasId]) => {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const totals = {};
    allAssets
      .filter((item) => item.category === categoryValue)
      .forEach((item) => {
        const key = (item.itemCategory || '').trim() || 'UNSPECIFIED';
        totals[key] = (totals[key] || 0) + Number(item.qty || 1);
      });

    if (categoryTypeChartInstances[canvasId]) categoryTypeChartInstances[canvasId].destroy();
    categoryTypeChartInstances[canvasId] = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: Object.keys(totals),
        datasets: [{ data: Object.values(totals), backgroundColor: palette }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
        onHover: chartPointerOnHover,
        onClick: (event, elements) => {
          const label = getClickedChartLabel(categoryTypeChartInstances[canvasId], elements);
          const route = CATEGORY_PAGE_ROUTES[categoryValue];
          if (label && route) {
            window.location.href = `${route}?assetType=${encodeURIComponent(label)}`;
          }
        },
      },
    });
  });
}
