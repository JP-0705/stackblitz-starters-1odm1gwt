// DASHBOARD page — summary numbers, status/condition bars, value by category,
// monthly counting progress, recent activity and quick actions, from live data.
// It is drawn with plain HTML/CSS (no chart library).
// NOTE: this page does not load shared/table.js (it has no row table),
// so it needs its own copies of the functions the count dialogs call:
// handleBranchFilterChange() and searchAssets().
const SUPPLIES_CATEGORY = 'OFFICE SUPPLIES';
const COUNT_OVERDUE_DAYS = 30;
const RING_LENGTH = 364.4; // circumference of the progress ring (r = 58)

// Category name -> its page.
const CATEGORY_PAGE_ROUTES = {
  APPLIANCES: '/appliances/',
  'AHA EQUIPMENT': '/aha-equipment/',
  'VEHICLE & OTHERS': '/vehicle-others/',
  'IT EQUIPMENT': '/it-equipment/',
  'FURNITURES & FIXTURES': '/furniture-fixtures/',
  'OFFICE SUPPLIES': '/office-supplies/',
};

const STATUS_COLORS = {
  'IN USE': '#1d4ed8',
  AVAILABLE: '#0d9488',
  APPROVED: '#16a34a',
  PENDING: '#f59e0b',
  REQUESTED: '#8b5cf6',
  REPLENISHED: '#38bdf8',
  STORED: '#facc15',
  'FOR DISPOSAL': '#f97316',
  UNAVAILABLE: '#64748b',
};
const CONDITION_COLORS = {
  'IN CONDITION': '#16a34a',
  DEFECTIVE: '#e11d48',
  DISPOSED: '#94a3b8',
};
const FALLBACK_COLORS = ['#38bdf8', '#8b5cf6', '#f59e0b', '#0d9488', '#f97316', '#64748b', '#facc15'];

function qtyOf(item) {
  const n = Number(item.qty);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function formatPeso(value) {
  return '₱' + Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sumBy(items, keyFn) {
  const totals = {};
  items.forEach((item) => {
    const key = keyFn(item) || 'UNSPECIFIED';
    totals[key] = (totals[key] || 0) + qtyOf(item);
  });
  return totals;
}

function localIsoDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseIsoDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// Report dialogs live in the Settings menu — the Quick Actions buttons simply
// open the same dialog (the menu link only exists for allowed roles).
function clickMenuLink(id) {
  const link = document.getElementById(id);
  if (link) link.click();
}

// Called by the Branch dropdown's onchange.
function handleBranchFilterChange() {
  currentBranchFilter = document.getElementById('branchFilterSelect').value;
  loadAnalyticsCharts();
}

// The Physical Count dialog calls this after it saves — here it just refreshes.
function searchAssets() {
  loadAnalyticsCharts();
}

// One segmented bar + legend (used for Asset status and Condition).
function renderSegments(barId, legendId, totals, colorMap, linkFn) {
  const labels = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
  const total = labels.reduce((s, l) => s + totals[l], 0);
  let fb = 0;
  const colors = {};
  labels.forEach((l) => {
    colors[l] = colorMap[l] || FALLBACK_COLORS[fb++ % FALLBACK_COLORS.length];
  });
  const bar = document.getElementById(barId);
  const legend = document.getElementById(legendId);
  if (!total) {
    bar.innerHTML = '';
    legend.innerHTML = '<span class="d2-muted">No data</span>';
    return;
  }
  bar.innerHTML = labels
    .map((l) => {
      const pct = (totals[l] / total) * 100;
      return `<div style="width:${pct}%; background:${colors[l]}" title="${escapeHtml(l)}: ${totals[l].toLocaleString('en-PH')}"></div>`;
    })
    .join('');
  legend.innerHTML = labels
    .map((l) => {
      const pct = Math.round((totals[l] / total) * 100);
      const inner = `<i style="background:${colors[l]}"></i>${escapeHtml(l)} <strong>${totals[l].toLocaleString('en-PH')}</strong> (${pct}%)`;
      const href = linkFn ? linkFn(l) : null;
      return href ? `<a href="${escapeHtml(href)}">${inner}</a>` : `<span>${inner}</span>`;
    })
    .join('');
}

function renderValueList(valueByCategory) {
  const host = document.getElementById('valueList');
  const entries = Object.keys(CATEGORY_PAGE_ROUTES)
    .map((cat) => [cat, valueByCategory[cat] || 0])
    .sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map((e) => e[1]));
  host.innerHTML = entries
    .map(
      ([cat, value]) => `<a class="d2-vrow" href="${escapeHtml(CATEGORY_PAGE_ROUTES[cat])}">
        <span class="d2-vname">${escapeHtml(cat)}</span>
        <span class="d2-vtrack"><span class="d2-vfill" style="display:block; width:${Math.round((value / max) * 100)}%"></span></span>
        <span class="d2-vamt">${escapeHtml(formatPeso(value))}</span>
      </a>`
    )
    .join('');
}

// ---- Recent activity (last 8 entries of the asset history) ----
async function renderRecentActivity(assetNames) {
  const host = document.getElementById('timeline');
  if (!host) return;
  const { data, error } = await supabaseClient
    .from('asset_edit_history')
    .select('asset_id, field_changed, old_value, new_value, edited_by, edited_at')
    .order('edited_at', { ascending: false })
    .limit(8);
  if (error) {
    console.error('Recent activity load error:', error);
    host.innerHTML = '<li class="d2-muted">Recent activity is not available for your account.</li>';
    return;
  }
  if (!data || data.length === 0) {
    host.innerHTML = '<li class="d2-muted">No activity yet.</li>';
    return;
  }
  const short = (v) => {
    const t = String(v == null ? '' : v);
    return t.length > 26 ? t.slice(0, 25) + '…' : t;
  };
  host.innerHTML = data
    .map((row) => {
      const when = row.edited_at ? new Date(row.edited_at) : null;
      const dateText = when && !isNaN(when) ? when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '---';
      const name = assetNames[row.asset_id];
      const who = (row.edited_by || '---').split('@')[0];
      return `<li>
        <div class="d2-tl-title">${escapeHtml(row.field_changed || '---')}</div>
        <div>${escapeHtml(row.asset_id || '---')}${name ? ' · ' + escapeHtml(short(name)) : ''}</div>
        <div>${escapeHtml(short(row.old_value))} → ${escapeHtml(short(row.new_value))}</div>
        <div class="d2-tl-meta">${escapeHtml(dateText)} · ${escapeHtml(who)}</div>
      </li>`;
    })
    .join('');
}

// ---- Counting progress for the current month ----
async function renderCountingStatus(activeRows) {
  const now = new Date();
  const monthStart = localIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthName = now.toLocaleDateString('en-US', { month: 'long' });
  setText('countMonthTitle', `${monthName} counting progress`);

  const [monthRes, lastRes] = await Promise.all([
    fetchAllPages(() =>
      supabaseClient.from('asset_counts').select('asset_id, count_date').gte('count_date', monthStart).order('asset_id', { ascending: true })
    ),
    supabaseClient.from('asset_counts').select('count_date').order('count_date', { ascending: false }).limit(1),
  ]);

  const badge = document.getElementById('countOverdueBadge');
  if (monthRes.error) {
    console.error('Count status load error:', monthRes.error);
    setText('countMonthNote', 'Count data is not available for your account.');
    document.getElementById('countTiles').innerHTML = '';
    if (badge) badge.style.display = 'none';
    return;
  }

  // Badge: days since the most recent physical count.
  if (badge && !lastRes.error) {
    const last = lastRes.data && lastRes.data[0] ? parseIsoDate(lastRes.data[0].count_date) : null;
    badge.style.display = 'inline-block';
    if (!last) {
      badge.className = 'd2-badge d2-badge-bad';
      badge.textContent = 'NO PHYSICAL COUNT YET';
    } else {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const days = Math.max(0, Math.round((today - last) / 86400000));
      if (days > COUNT_OVERDUE_DAYS) {
        badge.className = 'd2-badge d2-badge-bad';
        badge.textContent = `COUNT OVERDUE — ${days} DAYS`;
      } else {
        badge.className = 'd2-badge d2-badge-ok';
        badge.textContent = days === 0 ? 'LAST COUNT: TODAY' : `LAST COUNT: ${days} DAY${days === 1 ? '' : 'S'} AGO`;
      }
    }
  }

  const countedIds = new Set((monthRes.data || []).map((r) => r.asset_id));
  const total = activeRows.length;
  const counted = activeRows.filter((r) => countedIds.has(r.id)).length;
  const pct = total ? Math.round((counted / total) * 100) : 0;

  setText('ringPct', pct + '%');
  setText('ringNote', `${counted.toLocaleString('en-PH')} of ${total.toLocaleString('en-PH')} items`);
  const ring = document.getElementById('ringFg');
  if (ring) ring.style.strokeDashoffset = String(RING_LENGTH * (1 - Math.min(100, pct) / 100));
  setText('countMonthNote', `Counted since ${monthName} 1 · ${(total - counted).toLocaleString('en-PH')} still pending`);

  const perCat = {};
  activeRows.forEach((r) => {
    const key = r.category || 'UNSPECIFIED';
    if (!perCat[key]) perCat[key] = { total: 0, counted: 0 };
    perCat[key].total += 1;
    if (countedIds.has(r.id)) perCat[key].counted += 1;
  });
  document.getElementById('countTiles').innerHTML = Object.keys(perCat)
    .sort()
    .map((cat) => {
      const c = perCat[cat];
      const p = c.total ? Math.round((c.counted / c.total) * 100) : 0;
      const href = CATEGORY_PAGE_ROUTES[cat] || '/dashboard/';
      return `<a class="d2-tile ${p === 100 ? 'd2-tile-done' : ''}" href="${escapeHtml(href)}">
        <div class="d2-tile-name">${escapeHtml(cat)}</div>
        <div class="d2-tile-pct">${p}%</div>
        <div class="d2-tile-bar"><div style="width:${p}%"></div></div>
        <div class="d2-tile-sub">${c.counted.toLocaleString('en-PH')} of ${c.total.toLocaleString('en-PH')} counted</div>
      </a>`;
    })
    .join('');
}

async function loadAnalyticsCharts() {
  if (!supabaseClient) {
    return alert('Not connected to the database. Check the console for details.');
  }

  setText('d2Date', new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));

  const rawAssets = await fetchBackendDataRows();
  const rows = rawAssets.filter((i) => currentBranchFilter === 'ALL' || i.branch === currentBranchFilter);
  const assets = rows.filter((i) => i.category !== SUPPLIES_CATEGORY);
  const supplies = rows.filter((i) => i.category === SUPPLIES_CATEGORY);

  const sumQty = (list) => list.reduce((s, i) => s + qtyOf(i), 0);
  setText('kpiAssets', sumQty(assets).toLocaleString('en-PH'));
  setText('kpiSupplies', sumQty(supplies).toLocaleString('en-PH'));
  setText('kpiValue', formatPeso(rows.reduce((s, i) => s + (Number(i.amount) || 0), 0)));
  setText('kpiDefective', sumQty(rows.filter((i) => i.condition === 'DEFECTIVE')).toLocaleString('en-PH'));

  renderSegments('statusBar', 'statusLegend', sumBy(assets, (i) => (i.status || '').trim().toUpperCase()), STATUS_COLORS, null);
  renderSegments('conditionBar', 'conditionLegend', sumBy(rows, (i) => i.condition), CONDITION_COLORS, (label) =>
    label === 'UNSPECIFIED' ? null : `/dashboard/?condition=${encodeURIComponent(label)}`
  );

  const valueByCategory = {};
  rows.forEach((i) => {
    valueByCategory[i.category] = (valueByCategory[i.category] || 0) + (Number(i.amount) || 0);
  });
  renderValueList(valueByCategory);

  // Report buttons depend on role (their menu link only exists for allowed roles).
  const mr = document.getElementById('qaMonthlyReport');
  if (mr) mr.style.display = document.getElementById('monthlyReportMenuLink') ? '' : 'none';
  const ir = document.getElementById('qaIssuanceReport');
  if (ir) ir.style.display = document.getElementById('issuanceReportMenuLink') ? '' : 'none';

  const names = {};
  rawAssets.forEach((i) => {
    names[i.id] = i.name;
  });
  await Promise.all([renderRecentActivity(names), renderCountingStatus(rows), renderBorrowersBadge()]);
}


// Borrowers tracker button: shows how many units are out and how many are late.
// Only for Admin/Accounting; fails quietly if the forms table is not set up yet.
async function renderBorrowersBadge() {
  const badge = document.getElementById('borrowersBadge');
  const quick = document.getElementById('formsQuickBtn');
  const role = activeUserSession ? activeUserSession.role : '';
  if (quick) quick.style.display = role === 'ADMIN' || role === 'ACCOUNTING' ? '' : 'none';
  if (!badge || !(role === 'ADMIN' || role === 'ACCOUNTING')) return;
  try {
    const { data, error } = await supabaseClient
      .from('asset_forms')
      .select('expected_return_date, date_returned')
      .eq('form_type', 'BORROWER')
      .eq('status', 'BORROWED')
      .limit(1000);
    if (error) throw error;
    const today = localIsoDate(new Date());
    const out = (data || []).filter((r) => !r.date_returned);
    const late = out.filter((r) => r.expected_return_date && r.expected_return_date < today).length;
    badge.textContent = out.length ? `${out.length} out${late ? ' · ' + late + ' overdue' : ''}` : '';
    badge.classList.toggle('d2-borrow-late', late > 0);
  } catch (err) {
    badge.textContent = '';
  }
}
