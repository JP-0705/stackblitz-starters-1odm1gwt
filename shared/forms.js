// FORMS page — Asset Issuance Form, Asset Turnover Form, Borrower's Form and the
// Borrowers Tracker. Admin and Accounting only (the database enforces this too).
// Forms are saved and printed only; they do NOT change any asset record.
//
// To change the printed names (signatories), form codes or reasons, edit the
// settings right below. Nothing else needs to change.

const FORM_LOGO_URL = 'https://i.ibb.co/mVgtpqGB/INNOVPHIL-LOGO-Blue.png';

const FORM_SIGNATORIES = {
  prepared: { name: '', title: 'MIS REPRESENTATIVE' },
  checked: [
    { name: 'ROWENA SANCHEZ', title: 'PROPERTY CUSTODIAN' },
    { name: 'TERESA ELIZABETH PALOMARES', title: 'ACCTG. REPRESENTATIVE' },
    { name: 'MA. CLARA LLADONES', title: 'PMD REPRESENTATIVE' },
  ],
  approved: { name: 'CYNTHIA P. ARCE', title: 'CHIEF FINANCIAL OFFICER' },
};

const FORM_TYPES = {
  ISSUANCE: {
    tab: 'Asset Issuance',
    title: 'ASSET ISSUANCE FORM',
    code: '2026-MIS-FORM-002',
    rev: 'REV NO.01 | EFF DATE 08-06-2026',
    ctrlHint: '2026004-IPHLNAGA-00001',
    dateLabel: 'Issuance Date',
    byLabel: 'Issued by',
    reasonTitle: 'Reason for Issuance',
    maxLines: 13,
    reasons: [
      'New Asset Request', 'Equipment Upgrade', 'Replacement of Defective Equipment', 'Employee Transfer/Role Change',
      'Additional Equipment Requirement', 'Temporary Assignment', 'Project Requirement', 'Shared Resource Allocation',
      'Equipment Loss Replacement', 'Equipment Theft Replacement', 'Warranty Replacement', 'Business Continuity Req.',
      'Remote Work Requirement', 'Dept. Allocation',
    ],
  },
  TURNOVER: {
    tab: 'Asset Turnover',
    title: 'ASSET TURNOVER FORM',
    code: '2026-MIS-FORM',
    rev: 'REV NO.00 | EFF DATE 00-00-00',
    ctrlHint: '2026003-IPHLNAGA-00001',
    dateLabel: 'Return Date',
    byLabel: 'Returned To',
    reasonTitle: 'Reason for Returning/Turnover',
    maxLines: 12,
    reasons: [
      'Resignation', 'End of Contract', 'Employee Transfer', 'Employee Termination', 'Upgrade/Replacement',
      'Repair/Maintenance', 'Defective', 'No longer needed', 'Loaned Equipment Return', 'Project Completion',
      'Temporary Assignment Ended', 'Company Asset Recovery', 'Compliance Requirement', 'Received Incorrect Equipment',
    ],
  },
  BORROWER: {
    tab: 'Borrowers Tracker',
    title: "BORROWER'S FORM",
    code: '2026-MIS-FORM-005',
    rev: 'REV NO.00 | EFF DATE 06-08-2026',
    ctrlHint: '2026005-IPHLNAGA-00001',
    dateLabel: 'Date Borrowed',
    maxLines: 8,
    reasons: [],
  },
};

const BORROWER_TERMS = [
  'By signing below, the borrower accepts full responsibility for the care, security, and proper business use of the equipment. Any malfunction, damage, or loss must be reported immediately to the MIS department, and no unauthorized software or hardware modifications may be made to the unit.',
  'The borrower agrees to return the equipment in its original condition by the specified return date. Failure to return the unit on time, or any damage or loss resulting from negligence, will be subject to company disciplinary actions and standard equipment accountability policies.',
];

const FORM_MANAGER_ROLES = ['ADMIN', 'ACCOUNTING'];
const CONTROL_NO_PATTERN = /^[A-Z0-9][A-Z0-9_\-]{2,39}$/;

let formsTab = 'ISSUANCE';
let formsRows = [];
let borrowerFilter = 'ALL';
let inventoryCache = null;
let editingFormId = null;
let returningFormId = null;

// ---------- small helpers ----------
function fmToday() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return '---';
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmDaysBetween(fromIso, toIso) {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(fromIso || '');
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(toIso || '');
  if (!a || !b) return 0;
  return Math.round((new Date(+b[1], +b[2] - 1, +b[3]) - new Date(+a[1], +a[2] - 1, +a[3])) / 86400000);
}

function canManageForms() {
  return !!activeUserSession && FORM_MANAGER_ROLES.includes(activeUserSession.role);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

// The borrower status shown on screen. OVERDUE is worked out from the dates.
function borrowerDisplayStatus(row) {
  if (row.status === 'VOID') return 'VOID';
  if (row.status === 'RETURNED' || row.date_returned) return 'RETURNED';
  if (row.expected_return_date && fmDaysBetween(row.expected_return_date, fmToday()) > 0) return 'OVERDUE';
  return 'BORROWED';
}

function statusBadge(label) {
  const cls = { BORROWED: 'fm-b-blue', OVERDUE: 'fm-b-red', RETURNED: 'fm-b-green', VOID: 'fm-b-gray', SAVED: 'fm-b-green' }[label] || 'fm-b-gray';
  return `<span class="fm-badge ${cls}">${escapeHtml(label)}</span>`;
}

// ---------- loading ----------
async function loadFormRows() {
  const { data, error } = await fetchAllPages(() =>
    supabaseClient
      .from('asset_forms')
      .select('*')
      .eq('form_type', formsTab)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
  );
  if (error) {
    console.error('Forms load error:', error);
    formsRows = [];
    const code = error.code || '';
    document.getElementById('formsBody').innerHTML =
      `<tr><td colspan="10" class="fm-empty">Could not load the forms.${
        code === '42P01' ? ' The forms table does not exist yet. Run the 004_forms.sql file in Supabase first.' : ' ' + escapeHtml(error.message || '')
      }</td></tr>`;
    return false;
  }
  formsRows = data || [];
  return true;
}

async function loadInventory() {
  if (inventoryCache) return inventoryCache;
  inventoryCache = await fetchBackendDataRows();
  const depts = [...new Set(inventoryCache.map((i) => (i.department || '').trim()).filter(Boolean))].sort();
  const list = document.getElementById('fmDeptList');
  if (list) list.innerHTML = depts.map((d) => `<option value="${escapeHtml(d)}"></option>`).join('');
  const names = [...new Set(inventoryCache.map((i) => (i.issuedTo || '').trim().toUpperCase()).filter(Boolean))].sort();
  const nameList = document.getElementById('fmNameList');
  if (nameList) nameList.innerHTML = names.map((n) => `<option value="${escapeHtml(n)}"></option>`).join('');
  return inventoryCache;
}

// ---------- list ----------
function setFormsTab(tab) {
  formsTab = FORM_TYPES[tab] ? tab : 'ISSUANCE';
  borrowerFilter = 'ALL';
  document.querySelectorAll('.fm-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === formsTab));
  const cfg = FORM_TYPES[formsTab];
  document.getElementById('fmNewBtn').textContent = '+ New ' + (formsTab === 'BORROWER' ? "Borrower's Form" : cfg.tab + ' Form');
  document.getElementById('fmSearch').value = '';
  document.getElementById('fmSummary').style.display = formsTab === 'BORROWER' ? 'grid' : 'none';
  document.getElementById('fmFilterBar').style.display = formsTab === 'BORROWER' ? 'flex' : 'none';
  refreshFormsPage();
}

async function refreshFormsPage() {
  await loadFormRows();
  renderFormsTable();
}

function formMatchesSearch(row, q) {
  if (!q) return true;
  const hay = [row.control_no, row.employee_name, row.department, row.employee_id, row.purpose]
    .concat(asArray(row.assets).map((a) => [a.tag, a.particulars, a.serial].join(' ')))
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

function renderSummary() {
  const isBorrower = formsTab === 'BORROWER';
  if (!isBorrower) return;
  const live = formsRows.filter((r) => r.status !== 'VOID');
  const out = live.filter((r) => ['BORROWED', 'OVERDUE'].includes(borrowerDisplayStatus(r)));
  const overdue = live.filter((r) => borrowerDisplayStatus(r) === 'OVERDUE');
  const monthStart = fmToday().slice(0, 8) + '01';
  const returnedMonth = live.filter((r) => borrowerDisplayStatus(r) === 'RETURNED' && (r.date_returned || '') >= monthStart);
  document.getElementById('sumOut').textContent = out.length;
  document.getElementById('sumOverdue').textContent = overdue.length;
  document.getElementById('sumReturned').textContent = returnedMonth.length;
  document.querySelectorAll('.fm-filter').forEach((b) => b.classList.toggle('active', b.dataset.filter === borrowerFilter));
}

function renderFormsTable() {
  const head = document.getElementById('formsHead');
  const body = document.getElementById('formsBody');
  const q = document.getElementById('fmSearch').value.trim().toLowerCase();
  const isBorrower = formsTab === 'BORROWER';
  const cfg = FORM_TYPES[formsTab];
  renderSummary();

  head.innerHTML = isBorrower
    ? '<tr><th>CONTROL NO.</th><th>BORROWER</th><th>DEPARTMENT</th><th>ITEMS</th><th>USAGE</th><th>BORROWED</th><th>EXPECTED RETURN</th><th>RETURNED</th><th>STATUS</th><th>ACTIONS</th></tr>'
    : `<tr><th>CONTROL NO.</th><th>EMPLOYEE</th><th>DEPARTMENT</th><th>${escapeHtml(cfg.dateLabel.toUpperCase())}</th><th>${escapeHtml(cfg.byLabel.toUpperCase())}</th><th>ITEMS</th><th>STATUS</th><th>ACTIONS</th></tr>`;

  let rows = formsRows.filter((r) => formMatchesSearch(r, q));
  if (isBorrower && borrowerFilter !== 'ALL') {
    rows = rows.filter((r) => borrowerDisplayStatus(r) === borrowerFilter);
  }
  const cols = isBorrower ? 10 : 8;
  if (rows.length === 0) {
    body.innerHTML = `<tr><td colspan="${cols}" class="fm-empty">${formsRows.length ? 'No forms match your search.' : 'No forms yet. Click the button above to create the first one.'}</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map((r) => {
      const lines = asArray(r.assets);
      const first = lines[0] ? lines[0].particulars || lines[0].tag || '' : '';
      const items = lines.length ? `${lines.length} item${lines.length === 1 ? '' : 's'}<br><span class="fm-sub">${escapeHtml(String(first).slice(0, 40))}</span>` : '0';
      const isVoid = r.status === 'VOID';
      const st = isBorrower ? borrowerDisplayStatus(r) : isVoid ? 'VOID' : 'SAVED';
      const returnBtn =
        isBorrower && ['BORROWED', 'OVERDUE'].includes(st) ? `<button class="fm-act fm-act-ok" data-act="return" data-id="${escapeHtml(r.id)}">Mark Returned</button>` : '';
      const actions = `<button class="fm-act" data-act="print" data-id="${escapeHtml(r.id)}"${isVoid ? ' disabled' : ''}>Print</button>
        <button class="fm-act" data-act="edit" data-id="${escapeHtml(r.id)}"${isVoid ? ' disabled' : ''}>Edit</button>
        ${returnBtn}
        ${isVoid ? '' : `<button class="fm-act fm-act-bad" data-act="void" data-id="${escapeHtml(r.id)}">Void</button>`}`;
      const overdueDays =
        st === 'OVERDUE' ? `<br><span class="fm-sub fm-red">${fmDaysBetween(r.expected_return_date, fmToday())} day(s) late</span>` : '';

      if (isBorrower) {
        return `<tr class="${isVoid ? 'fm-void' : ''}">
          <td><strong>${escapeHtml(r.control_no)}</strong></td>
          <td>${escapeHtml(r.employee_name)}<br><span class="fm-sub">${escapeHtml(r.employee_id || '')}</span></td>
          <td>${escapeHtml(r.department || '---')}</td>
          <td>${items}</td>
          <td>${escapeHtml(r.usage_type || '---')}</td>
          <td>${fmDate(r.form_date)}</td>
          <td>${fmDate(r.expected_return_date)}${overdueDays}</td>
          <td>${fmDate(r.date_returned)}</td>
          <td>${statusBadge(st)}</td>
          <td class="fm-actions">${actions}</td>
        </tr>`;
      }
      return `<tr class="${isVoid ? 'fm-void' : ''}">
        <td><strong>${escapeHtml(r.control_no)}</strong></td>
        <td>${escapeHtml(r.employee_name)}<br><span class="fm-sub">${escapeHtml(r.employee_id || '')}</span></td>
        <td>${escapeHtml(r.department || '---')}</td>
        <td>${fmDate(r.form_date)}</td>
        <td>${escapeHtml(r.by_party || '---')}</td>
        <td>${items}</td>
        <td>${statusBadge(st)}</td>
        <td class="fm-actions">${actions}</td>
      </tr>`;
    })
    .join('');
}

// ---------- editor ----------
function lineInputsHtml(line, borrower) {
  const v = (x) => escapeHtml(x == null ? '' : String(x));
  if (borrower) {
    return `<tr class="fm-line">
      <td><input class="ln-tag" maxlength="40" value="${v(line.tag)}" placeholder="Property Tag ID"></td>
      <td><input class="ln-part" maxlength="120" value="${v(line.particulars)}" placeholder="Description"></td>
      <td><input class="ln-serial" maxlength="60" value="${v(line.serial)}" placeholder="Serial Number"></td>
      <td><input class="ln-cond" maxlength="40" value="${v(line.condition)}" placeholder="Condition"></td>
      <td><button type="button" class="fm-x" data-rm="1" title="Remove line">✕</button></td></tr>`;
  }
  return `<tr class="fm-line">
    <td><input class="ln-part" maxlength="120" value="${v(line.particulars)}" placeholder="Particulars"></td>
    <td><input class="ln-qty" type="number" min="1" max="9999" step="1" value="${v(line.qty == null ? 1 : line.qty)}" style="width:60px"></td>
    <td><input class="ln-serial" maxlength="60" value="${v(line.serial)}" placeholder="Serial Number"></td>
    <td><input class="ln-tag" maxlength="40" value="${v(line.tag)}" placeholder="Property Tag"></td>
    <td><input class="ln-cond" maxlength="40" value="${v(line.condition)}" placeholder="Condition"></td>
    <td><button type="button" class="fm-x" data-rm="1" title="Remove line">✕</button></td></tr>`;
}

function addEditorLine(line) {
  const cfg = FORM_TYPES[formsTab];
  const tbody = document.getElementById('fmLines');
  if (tbody.querySelectorAll('.fm-line').length >= cfg.maxLines) {
    return showToast(`A ${cfg.tab} form has room for ${cfg.maxLines} lines only. Make a second form for more items.`, 'error');
  }
  tbody.insertAdjacentHTML('beforeend', lineInputsHtml(line || {}, formsTab === 'BORROWER'));
}

function collectLines() {
  const lines = [];
  document.querySelectorAll('#fmLines .fm-line').forEach((tr) => {
    const get = (c) => {
      const el = tr.querySelector(c);
      return el ? el.value.trim() : '';
    };
    const line = { particulars: get('.ln-part'), serial: get('.ln-serial'), tag: get('.ln-tag'), condition: get('.ln-cond') };
    if (tr.querySelector('.ln-qty')) line.qty = Number(get('.ln-qty')) || 0;
    if (line.particulars || line.serial || line.tag) lines.push(line);
  });
  return lines;
}

// The "also update the assets" option (new Issuance / Turnover forms only).
function applyAssetsBlock(row) {
  if (formsTab === 'BORROWER') return '';
  if (row) return '<p class="fm-help">Editing a saved form does not change the asset records.</p>';
  const text =
    formsTab === 'ISSUANCE'
      ? 'Also update the assets in this list: <b>Issued To</b> = the employee\'s name, <b>Status</b> = IN USE (and Department, if filled in).'
      : 'Also update the assets in this list: <b>Issued To</b> = the storage location above, <b>Status</b> = AVAILABLE.';
  return `<label class="fm-apply"><input type="checkbox" id="fmApply" checked> <span>${text} Each change is saved in the asset's history.</span></label>`;
}

function renderEditorBody(cfg, row) {
  const f = row || {};
  const v = (x) => escapeHtml(x == null ? '' : String(x));
  const isBorrower = formsTab === 'BORROWER';
  const reasonsChosen = asArray(f.reasons);
  const reasonBoxes = cfg.reasons
    .concat(['Others'])
    .map(
      (r) =>
        `<label class="fm-check"><input type="checkbox" class="fm-reason" value="${escapeHtml(r)}"${reasonsChosen.includes(r) ? ' checked' : ''}> ${escapeHtml(r)}</label>`
    )
    .join('');
  const lineHead = isBorrower
    ? '<tr><th>Property Tag ID</th><th>Description</th><th>Serial Number</th><th>Condition</th><th></th></tr>'
    : '<tr><th>Particulars</th><th>QTY</th><th>Serial Number</th><th>Property Tag</th><th>Condition</th><th></th></tr>';
  const lines = asArray(f.assets);

  return `
    <div class="form-grid-2">
      <div class="form-field"><label>Control No. *</label>
        <input id="fmCtrl" maxlength="40" value="${v(f.control_no)}" placeholder="e.g. ${escapeHtml(cfg.ctrlHint)}" style="text-transform:uppercase"></div>
      <div class="form-field"><label>${escapeHtml(cfg.dateLabel)} *</label>
        <input id="fmDate" type="date" value="${v(f.form_date || fmToday())}"></div>
    </div>
    <div class="form-grid-3">
      <div class="form-field"><label>Name *</label><input id="fmName" maxlength="100" list="fmNameList" autocomplete="off" value="${v(f.employee_name)}"></div>
      <div class="form-field"><label>Designation</label><input id="fmDesig" maxlength="100" value="${v(f.designation)}"></div>
      <div class="form-field"><label>Department</label><input id="fmDept" maxlength="100" list="fmDeptList" value="${v(f.department)}"></div>
    </div>
    <div class="form-grid-3">
      <div class="form-field"><label>Employee ID</label><input id="fmEmpId" maxlength="40" value="${v(f.employee_id)}" placeholder="IPHL-00-000"></div>
      ${
        formsTab === 'ISSUANCE'
          ? `<div class="form-field"><label>Issued by</label><select id="fmBy"><option value="">---</option><option value="PROPERTY"${f.by_party === 'PROPERTY' ? ' selected' : ''}>PROPERTY</option><option value="MIS"${f.by_party === 'MIS' ? ' selected' : ''}>MIS</option></select></div>`
          : formsTab === 'TURNOVER'
          ? `<div class="form-field"><label>Returned To / Storage location</label><input id="fmBy" maxlength="100" value="${v(f.by_party)}" placeholder="e.g. STORAGE BOX 2, LOCKER 5" style="text-transform:uppercase"></div>`
          : `<div class="form-field"><label>Expected Return Date *</label><input id="fmExpected" type="date" value="${v(f.expected_return_date)}"></div>`
      }
      ${
        isBorrower
          ? `<div class="form-field"><label>Date Returned</label><input id="fmReturned" type="date" value="${v(f.date_returned)}"></div>`
          : '<div></div>'
      }
    </div>
    ${
      isBorrower
        ? `<div class="form-grid-2">
            <div class="form-field"><label>Usage *</label>
              <select id="fmUsage"><option value="INTERNAL"${f.usage_type !== 'EXTERNAL' ? ' selected' : ''}>Internal</option><option value="EXTERNAL"${f.usage_type === 'EXTERNAL' ? ' selected' : ''}>External (outside use)</option></select></div>
            <div class="form-field"><label>Purpose</label><input id="fmPurpose" maxlength="200" value="${v(f.purpose)}"></div>
          </div>`
        : ''
    }

    <div id="fmFoundNotice" class="fm-notice" style="display:none;"></div>
    <div class="fm-section">${isBorrower ? 'ASSET/S' : 'LIST OF ASSET/S'}</div>
    <div class="fm-picker">
      <input id="fmPick" placeholder="Search inventory by ID, name, brand or serial number to add an item…" autocomplete="off">
      <div id="fmPickResults" class="fm-pick-results" style="display:none;"></div>
    </div>
    <table class="fm-lines"><thead>${lineHead}</thead><tbody id="fmLines">${lines.map((l) => lineInputsHtml(l, isBorrower)).join('')}</tbody></table>
    <button type="button" class="action-btn" id="fmAddLine" style="background:#e2e8f0;color:#334155;margin-top:6px;">+ Add blank line</button>
    ${applyAssetsBlock(row)}

    ${
      isBorrower
        ? ''
        : `<div class="fm-section">${escapeHtml(cfg.reasonTitle.toUpperCase())}</div>
           <div class="fm-reasons">${reasonBoxes}</div>
           <div class="form-field" style="margin-top:6px;"><label>Others (please specify)</label><input id="fmReasonOther" maxlength="200" value="${v(f.reason_other)}"></div>
           <div class="form-grid-2" style="margin-top:8px;">
             <div class="form-field"><label>MIS Findings</label><textarea id="fmMis" maxlength="1000" rows="3">${v(f.mis_findings)}</textarea></div>
             <div class="form-field"><label>Property Findings</label><textarea id="fmProp" maxlength="1000" rows="3">${v(f.property_findings)}</textarea></div>
           </div>`
    }`;
}

async function openFormEditor(id) {
  if (!canManageForms()) return;
  const cfg = FORM_TYPES[formsTab];
  const row = id ? formsRows.find((r) => r.id === id) : null;
  editingFormId = row ? row.id : null;
  lastSuggestKey = '';
  document.getElementById('fmModalTitle').textContent = (row ? 'Edit ' : 'New ') + cfg.title.replace(/\b(\w)(\w*)/g, (m, a, b) => a + b.toLowerCase());
  document.getElementById('fmEditorBody').innerHTML = renderEditorBody(cfg, row);
  if (!row) addEditorLine({});
  document.getElementById('fmModal').style.display = 'flex';
  loadInventory();
}

function closeFormEditor() {
  document.getElementById('fmModal').style.display = 'none';
  editingFormId = null;
}

function renderPickResults() {
  const box = document.getElementById('fmPickResults');
  const q = document.getElementById('fmPick').value.trim().toLowerCase();
  if (!q || !inventoryCache) {
    box.style.display = 'none';
    return;
  }
  const hits = inventoryCache
    .filter((i) => [i.id, i.name, i.brand, i.model, i.serialNumber].join(' ').toLowerCase().includes(q))
    .slice(0, 6);
  if (!hits.length) {
    box.innerHTML = '<div class="fm-pick-none">No matching item in the inventory. Use "Add blank line" to type it in.</div>';
    box.style.display = 'block';
    return;
  }
  box.innerHTML = hits
    .map(
      (i) =>
        `<button type="button" class="fm-pick-item" data-pick="${escapeHtml(i.id)}"><strong>${escapeHtml(i.id)}</strong> ${escapeHtml(i.name || '')} <span class="fm-sub">${escapeHtml([i.brand, i.model, i.serialNumber].filter(Boolean).join(' · '))}${i.issuedTo ? ' · issued to ' + escapeHtml(i.issuedTo) : ''}</span></button>`
    )
    .join('');
  box.style.display = 'block';
}

function pickInventoryItem(assetId) {
  const item = (inventoryCache || []).find((i) => i.id === assetId);
  if (!item) return;
  const desc = [item.name, item.brand, item.model].filter(Boolean).join(' ');
  addEditorLine({ particulars: desc.slice(0, 120), qty: 1, serial: item.serialNumber || '', tag: item.id, condition: item.condition || '' });
  // Fill an empty first line instead of leaving a blank one in front.
  const rows = [...document.querySelectorAll('#fmLines .fm-line')];
  if (rows.length > 1) {
    const first = rows[0];
    const empty = ![...first.querySelectorAll('input')].some((i) => i.value.trim() && i.type !== 'number');
    if (empty) first.remove();
  }
  document.getElementById('fmPick').value = '';
  document.getElementById('fmPickResults').style.display = 'none';
  const dept = document.getElementById('fmDept');
  if (dept && !dept.value.trim() && item.department) dept.value = item.department;
}

// Turnover: after typing a name, list the units currently issued to that person.
function currentUnitsOf(name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return [];
  return (inventoryCache || []).filter((i) => String(i.issuedTo || '').trim().toLowerCase() === key);
}

function lineTagsInEditor() {
  return new Set([...document.querySelectorAll('#fmLines .ln-tag')].map((el) => el.value.trim().toUpperCase()).filter(Boolean));
}

function addUnitLines(units) {
  const cfg = FORM_TYPES[formsTab];
  let added = 0;
  units.forEach((item) => {
    if (document.querySelectorAll('#fmLines .fm-line').length >= cfg.maxLines) return;
    const desc = [item.name, item.brand, item.model].filter(Boolean).join(' ');
    addEditorLine({ particulars: desc.slice(0, 120), qty: 1, serial: item.serialNumber || '', tag: item.id, condition: item.condition || '' });
    added += 1;
  });
  // Remove the empty starter line if real lines were added.
  const rows = [...document.querySelectorAll('#fmLines .fm-line')];
  if (added && rows.length > 1) {
    const first = rows[0];
    const empty = ![...first.querySelectorAll('input')].some((i) => i.value.trim() && i.type !== 'number');
    if (empty) first.remove();
  }
  return added;
}

let lastSuggestKey = '';

async function suggestUnitsForName(force) {
  if (formsTab !== 'TURNOVER' || editingFormId) return;
  const notice = document.getElementById('fmFoundNotice');
  const nameInput = document.getElementById('fmName');
  if (!notice || !nameInput) return;
  const name = nameInput.value.trim();
  if (!name) {
    notice.style.display = 'none';
    lastSuggestKey = '';
    return;
  }
  // The name box fires both "change" and "focus out": only look the name up once.
  if (!force && name.toLowerCase() === lastSuggestKey) return;
  lastSuggestKey = name.toLowerCase();
  await loadInventory();
  const have = lineTagsInEditor();
  const units = currentUnitsOf(name).filter((u) => !have.has(u.id.toUpperCase()));
  const all = currentUnitsOf(name);
  notice.style.display = 'block';
  if (all.length === 0) {
    notice.className = 'fm-notice';
    notice.textContent = `No units are currently issued to ${name.toUpperCase()} in the inventory. Add the items below by searching, or type them in.`;
    return;
  }
  if (units.length === 0) {
    notice.className = 'fm-notice';
    notice.textContent = `All ${all.length} unit(s) issued to ${name.toUpperCase()} are already in the list.`;
    return;
  }
  const dept = document.getElementById('fmDept');
  if (dept && !dept.value.trim() && units[0].department) dept.value = units[0].department;
  const linesEmpty = ![...document.querySelectorAll('#fmLines .fm-line input')].some((i) => i.value.trim() && i.type !== 'number');
  if (linesEmpty) {
    const added = addUnitLines(units);
    notice.className = 'fm-notice fm-notice-ok';
    notice.textContent = `Added ${added} unit(s) currently issued to ${name.toUpperCase()}${added < units.length ? ` (the form holds ${FORM_TYPES.TURNOVER.maxLines} lines; make a second form for the other ${units.length - added})` : ''}. Remove any that are not being returned.`;
  } else {
    notice.className = 'fm-notice';
    notice.innerHTML = `${units.length} more unit(s) are issued to ${escapeHtml(name.toUpperCase())}. <button type="button" class="fm-act" id="fmAddUnitsBtn">Add them to the list</button>`;
  }
}

function readEditor() {
  const cfg = FORM_TYPES[formsTab];
  const val = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };
  const isBorrower = formsTab === 'BORROWER';
  const lines = collectLines();
  const reasons = [...document.querySelectorAll('.fm-reason:checked')].map((c) => c.value);

  const errors = [];
  const control = val('fmCtrl').toUpperCase();
  if (!CONTROL_NO_PATTERN.test(control)) errors.push('Control No. is required (letters, numbers and dashes only, for example ' + cfg.ctrlHint + ').');
  if (!val('fmName')) errors.push('Name is required.');
  if (!val('fmDate')) errors.push(cfg.dateLabel + ' is required.');
  if (lines.length === 0) errors.push('Add at least one asset line.');
  if (!isBorrower && lines.some((l) => !(Number.isInteger(l.qty) && l.qty >= 1 && l.qty <= 9999))) errors.push('QTY must be a whole number from 1 to 9999.');
  if (isBorrower) {
    if (!val('fmExpected')) errors.push('Expected Return Date is required.');
    if (val('fmExpected') && val('fmDate') && val('fmExpected') < val('fmDate')) errors.push('Expected Return Date cannot be before the Date Borrowed.');
    if (val('fmReturned') && val('fmDate') && val('fmReturned') < val('fmDate')) errors.push('Date Returned cannot be before the Date Borrowed.');
  }
  if (errors.length) return { errors };

  const payload = {
    form_type: formsTab,
    control_no: control,
    employee_name: val('fmName').toUpperCase(),
    designation: val('fmDesig') || null,
    department: val('fmDept').toUpperCase() || null,
    employee_id: val('fmEmpId').toUpperCase() || null,
    form_date: val('fmDate'),
    assets: lines,
  };
  if (isBorrower) {
    payload.usage_type = val('fmUsage') === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL';
    payload.purpose = val('fmPurpose') || null;
    payload.expected_return_date = val('fmExpected');
    payload.date_returned = val('fmReturned') || null;
    payload.status = payload.date_returned ? 'RETURNED' : 'BORROWED';
  } else {
    payload.by_party = val('fmBy') || null;
    payload.reasons = reasons;
    payload.reason_other = reasons.includes('Others') ? val('fmReasonOther') || null : null;
    payload.mis_findings = val('fmMis') || null;
    payload.property_findings = val('fmProp') || null;
    payload.status = 'SAVED';
  }
  return { payload };
}

const FORM_ASSET_LABELS = { issued_to: 'Issued To', status: 'Asset Status', department: 'Department' };

// Works out what the form will change on the asset records (nothing is written here).
function planAssetUpdates(payload) {
  const byId = new Map((inventoryCache || []).map((i) => [i.id.toUpperCase(), i]));
  const changes = [];
  const unmatched = [];
  payload.assets.forEach((line) => {
    const asset = byId.get(String(line.tag || '').trim().toUpperCase());
    if (!asset) {
      unmatched.push(line.tag || line.particulars || '(blank)');
      return;
    }
    const next =
      payload.form_type === 'ISSUANCE'
        ? { issued_to: payload.employee_name, status: 'IN USE' }
        : { issued_to: String(payload.by_party || '').toUpperCase(), status: 'AVAILABLE' };
    if (payload.form_type === 'ISSUANCE' && payload.department) next.department = payload.department;
    const old = { issued_to: asset.issuedTo || '', status: asset.status || '', department: asset.department || '' };
    const diff = Object.keys(next).filter((k) => String(next[k] || '') !== String(old[k] || ''));
    if (diff.length) changes.push({ id: asset.id, name: asset.name, next, old, diff });
  });
  return { changes, unmatched };
}

async function applyAssetUpdates(changes) {
  const failed = [];
  for (const c of changes) {
    const { error } = await supabaseClient.from('assets').update(c.next).eq('id', c.id);
    if (error) {
      console.error('Asset update error:', c.id, error);
      failed.push(c.id);
      continue;
    }
    for (const k of c.diff) {
      await logAssetEvent(c.id, FORM_ASSET_LABELS[k], c.old[k], c.next[k]);
    }
  }
  inventoryCache = null;
  return failed;
}

async function saveForm(andPrint) {
  if (!canManageForms()) return;
  const { payload, errors } = readEditor();
  if (errors) return alert('Please fix the following:\n\n- ' + errors.join('\n- '));

  // New Issuance / Turnover form with "also update the assets" ticked: show what will change first.
  const applyBox = document.getElementById('fmApply');
  const wantsApply = !editingFormId && formsTab !== 'BORROWER' && applyBox && applyBox.checked;
  let plan = null;
  if (wantsApply) {
    if (formsTab === 'TURNOVER' && !payload.by_party) {
      return alert('Please fill in "Returned To / Storage location" (for example STORAGE BOX 2), or untick the option to update the assets.');
    }
    await loadInventory();
    plan = planAssetUpdates(payload);
    const label = (k) => FORM_ASSET_LABELS[k];
    const shown = plan.changes
      .slice(0, 8)
      .map((c) => `• ${c.id} ${String(c.name || '').slice(0, 28)}: ` + c.diff.map((k) => `${label(k)} → ${c.next[k]}`).join(', '))
      .join('\n');
    const more = plan.changes.length > 8 ? `\n…and ${plan.changes.length - 8} more` : '';
    const skipped = plan.unmatched.length ? `\n\nNot found in the inventory (these are only written on the form): ${plan.unmatched.join(', ')}` : '';
    if (plan.changes.length) {
      const ok = await showConfirm(`Saving this form will also update ${plan.changes.length} asset record(s):\n\n${shown}${more}${skipped}`, {
        title: 'Update Assets Too?',
        confirmLabel: 'Save and Update',
      });
      if (!ok) return;
    }
  }

  const email = activeUserSession ? activeUserSession.email : null;
  let result;
  if (editingFormId) {
    const existing = formsRows.find((r) => r.id === editingFormId);
    // Editing must never bring back a voided form.
    if (existing && existing.status === 'VOID') payload.status = 'VOID';
    delete payload.form_type;
    result = await supabaseClient
      .from('asset_forms')
      .update({ ...payload, updated_by: email, updated_at: new Date().toISOString() })
      .eq('id', editingFormId)
      .select()
      .single();
  } else {
    result = await supabaseClient
      .from('asset_forms')
      .insert({ ...payload, created_by: email, updated_by: email })
      .select()
      .single();
  }

  if (result.error) {
    console.error('Form save error:', result.error);
    if (result.error.code === '23505') return alert('This Control No. is already used by another form of this type. Please enter a different one.');
    if (result.error.code === '42P01') return alert('The forms table does not exist yet. Run the 004_forms.sql file in Supabase first.');
    return alert('Could not save the form:\n\n' + (result.error.message || 'Unknown error'));
  }

  const saved = result.data;
  let assetNote = '';
  if (plan && plan.changes.length) {
    const failed = await applyAssetUpdates(plan.changes);
    const done = plan.changes.length - failed.length;
    assetNote = ` ${done} asset(s) updated.`;
    if (failed.length) alert(`The form was saved, but these assets could not be updated (please edit them manually): ${failed.join(', ')}`);
  } else if (plan) {
    assetNote = ' The assets already had these values.';
  }
  closeFormEditor();
  showToast('Form saved: ' + payload.control_no + '.' + assetNote);
  await refreshFormsPage();
  if (andPrint && saved) printFormRow(saved);
}

// ---------- actions ----------
async function voidForm(id) {
  const row = formsRows.find((r) => r.id === id);
  if (!row) return;
  const ok = await showConfirm(
    `Void form ${row.control_no}?\n\nIt will be kept on record (the control number stays used) but can no longer be printed or edited.`,
    { title: 'Void Form', confirmLabel: 'Void Form', confirmColor: '#b91c1c' }
  );
  if (!ok) return;
  const { error } = await supabaseClient
    .from('asset_forms')
    .update({ status: 'VOID', updated_by: activeUserSession.email, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return alert('Could not void the form:\n\n' + error.message);
  showToast('Form voided.');
  refreshFormsPage();
}

function openReturnModal(id) {
  const row = formsRows.find((r) => r.id === id);
  if (!row) return;
  returningFormId = id;
  document.getElementById('fmReturnInfo').textContent = `${row.control_no} — ${row.employee_name}`;
  document.getElementById('fmReturnDate').value = fmToday();
  document.getElementById('fmReturnModal').style.display = 'flex';
}

function closeReturnModal() {
  document.getElementById('fmReturnModal').style.display = 'none';
  returningFormId = null;
}

async function confirmReturn() {
  const row = formsRows.find((r) => r.id === returningFormId);
  const date = document.getElementById('fmReturnDate').value;
  if (!row || !date) return alert('Please choose the return date.');
  if (row.form_date && date < row.form_date) return alert('The return date cannot be before the date borrowed (' + fmDate(row.form_date) + ').');
  const { error } = await supabaseClient
    .from('asset_forms')
    .update({ date_returned: date, status: 'RETURNED', updated_by: activeUserSession.email, updated_at: new Date().toISOString() })
    .eq('id', returningFormId);
  if (error) return alert('Could not save the return:\n\n' + error.message);
  closeReturnModal();
  showToast('Marked as returned.');
  refreshFormsPage();
}

// ---------- printing ----------
function printBox(checked) {
  return `<span class="fs-box">${checked ? '✓' : ''}</span>`;
}

function sheetInfoCell(label, value) {
  return `<div class="fs-info-cell"><div class="fs-info-h">${escapeHtml(label)}</div><div class="fs-info-v">${escapeHtml(value || '')}</div></div>`;
}

function sheetSignatures(type, row) {
  const s = FORM_SIGNATORIES;
  const checked = s.checked
    .map((c) => `<div class="fs-sig"><div class="fs-sig-space"></div><div class="fs-sig-name">${escapeHtml(c.name)}</div><div class="fs-sig-title">${escapeHtml(c.title)}</div><div class="fs-sig-date">DATE:</div></div>`)
    .join('');
  const prepared = `<div class="fs-sig"><div class="fs-sig-space"></div><div class="fs-sig-name">${escapeHtml(s.prepared.name)}</div><div class="fs-sig-title">${escapeHtml(s.prepared.title)}</div><div class="fs-sig-date">DATE:</div></div>`;
  const approved = `<div class="fs-sig"><div class="fs-sig-space"></div><div class="fs-sig-name fs-strong">${escapeHtml(s.approved.name)}</div><div class="fs-sig-title">${escapeHtml(s.approved.title)}</div><div class="fs-sig-date">DATE:</div></div>`;
  const borrower =
    type === 'BORROWER'
      ? `<div class="fs-sig"><div class="fs-sig-space"></div><div class="fs-sig-name">${escapeHtml(row.employee_name)}</div><div class="fs-sig-title">SIGNATURE OVER PRINTED NAME</div><div class="fs-sig-date">DATE:</div></div>`
      : '<div></div>';
  return `
    <div class="fs-sign-row">
      <div class="fs-sign-col"><div class="fs-label">Prepared by:</div>${prepared}</div>
      <div class="fs-sign-col fs-sign-wide"><div class="fs-label">Checked by:</div><div class="fs-sign-three">${checked}</div></div>
    </div>
    <div class="fs-sign-row fs-sign-row2">
      <div class="fs-sign-col">${type === 'BORROWER' ? '<div class="fs-label">Borrower:</div>' + borrower : ''}</div>
      <div class="fs-sign-col fs-sign-appr"><div class="fs-label">Approved by:</div>${approved}</div>
    </div>`;
}

function buildFormSheetHtml(row) {
  const type = row.form_type;
  const cfg = FORM_TYPES[type];
  const lines = asArray(row.assets);
  const isBorrower = type === 'BORROWER';

  const header = `
    <div class="fs-logo"><img src="${FORM_LOGO_URL}" alt="Innovphil"></div>
    <div class="fs-title">${escapeHtml(cfg.title)}</div>
    <div class="fs-code">${escapeHtml(cfg.code)}</div>
    <div class="fs-ctrl">CTRL NO. ${escapeHtml(row.control_no)}<br>${escapeHtml(cfg.rev)}</div>
    <div class="fs-section">INFORMATION</div>`;

  let info;
  if (isBorrower) {
    info = `<div class="fs-info">
      ${sheetInfoCell('Name:', row.employee_name)}${sheetInfoCell('Designation', row.designation)}${sheetInfoCell('Department:', row.department)}
      ${sheetInfoCell('Employee ID:', row.employee_id)}${sheetInfoCell('Date Borrowed:', fmDate(row.form_date))}${sheetInfoCell('Date Returned:', row.date_returned ? fmDate(row.date_returned) : '')}
      <div class="fs-info-cell"><div class="fs-info-h">Usage:</div><div class="fs-info-v">Internal ${printBox(row.usage_type === 'INTERNAL')} &nbsp; External ${printBox(row.usage_type === 'EXTERNAL')}</div></div>
      <div class="fs-info-cell fs-span2"><div class="fs-info-h">Purpose:</div><div class="fs-info-v">${escapeHtml(row.purpose || '')}</div></div>
    </div>`;
  } else {
    const third =
      type === 'ISSUANCE'
        ? `<div class="fs-info-cell"><div class="fs-info-h">Issued by:</div><div class="fs-info-v">${printBox(row.by_party === 'PROPERTY')} PROPERTY &nbsp; ${printBox(row.by_party === 'MIS')} MIS</div></div>`
        : sheetInfoCell('Returned To:', row.by_party);
    info = `<div class="fs-info">
      ${sheetInfoCell('Name:', row.employee_name)}${sheetInfoCell('Designation:', row.designation)}${sheetInfoCell('Department:', row.department)}
      ${sheetInfoCell('Employee ID:', row.employee_id)}${sheetInfoCell(cfg.dateLabel + ':', fmDate(row.form_date))}${third}
    </div>`;
  }

  const minLines = isBorrower ? 8 : 12;
  const blanks = Math.max(0, minLines - lines.length);
  const lineRows = lines
    .map((l) =>
      isBorrower
        ? `<tr><td>${escapeHtml(l.tag)}</td><td>${escapeHtml(l.particulars)}</td><td>${escapeHtml(l.serial)}</td><td>${escapeHtml(l.condition)}</td></tr>`
        : `<tr><td>${escapeHtml(l.particulars)}</td><td class="fs-c">${escapeHtml(l.qty)}</td><td>${escapeHtml(l.serial)}</td><td>${escapeHtml(l.tag)}</td><td>${escapeHtml(l.condition)}</td></tr>`
    )
    .concat(Array(blanks).fill(isBorrower ? '<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>' : '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>'))
    .join('');
  const assetTable = isBorrower
    ? `<div class="fs-section fs-section-b">ASSET/S</div><table class="fs-table fs-table-b"><thead><tr><th style="width:20%">Property Tag ID</th><th>Description</th><th style="width:25%">Serial Number</th><th style="width:16%">Condition</th></tr></thead><tbody>${lineRows}</tbody></table>`
    : `<div class="fs-section">LIST OF ASSET/S</div><table class="fs-table"><thead><tr><th style="width:34%">Particulars</th><th style="width:6%">QTY</th><th style="width:24%">Serial Number</th><th style="width:19%">Property Tag</th><th>Condition</th></tr></thead><tbody>${lineRows}</tbody></table>`;

  let middle = '';
  if (isBorrower) {
    middle = `<div class="fs-terms"><div class="fs-terms-h">Terms &amp; Conditions</div>
      <p>${escapeHtml(BORROWER_TERMS[0])}</p><p>${escapeHtml(BORROWER_TERMS[1])}</p></div>`;
  } else {
    const chosen = asArray(row.reasons);
    const boxes = cfg.reasons
      .map((r) => `<div class="fs-reason">${printBox(chosen.includes(r))} ${escapeHtml(r)}</div>`)
      .concat([`<div class="fs-reason fs-reason-other">${printBox(chosen.includes('Others'))} Others (Please specify: ${escapeHtml(chosen.includes('Others') ? row.reason_other || '' : '')} )</div>`])
      .join('');
    middle = `<div class="fs-reasons"><div class="fs-reasons-h">${escapeHtml(cfg.reasonTitle)}</div><div class="fs-reasons-grid">${boxes}</div></div>
      <div class="fs-findings">
        <div class="fs-find-row"><div class="fs-find-h">MIS FINDINGS:</div><div class="fs-find-v">${escapeHtml(row.mis_findings || '')}</div></div>
        <div class="fs-find-row"><div class="fs-find-h">PROPERTY FINDINGS:</div><div class="fs-find-v">${escapeHtml(row.property_findings || '')}</div></div>
      </div>`;
  }

  return `<div class="fs-sheet">${header}${info}${assetTable}${middle}${sheetSignatures(type, row)}</div>`;
}

// Print = fill in the company's own PDF form and open it ready to print.
// If that is not possible (for example the PDF library did not load), the
// built-in copy of the form is printed instead.
async function printFormRow(row) {
  if (!row || row.status === 'VOID') return;
  if (window.PDFLib && typeof openFilledFormPdf === 'function') {
    const ok = await openFilledFormPdf(row);
    if (ok) return;
  }
  printFormFallback(row);
}

function printFormFallback(row) {
  const area = document.getElementById('formPrintArea');
  area.innerHTML = buildFormSheetHtml(row);
  document.body.classList.add('print-mode-form');
  const cleanup = () => {
    document.body.classList.remove('print-mode-form');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // Wait for the logo to load so it appears on the printout.
  const img = area.querySelector('img');
  const go = () => window.print();
  if (img && !img.complete) {
    img.addEventListener('load', go, { once: true });
    img.addEventListener('error', go, { once: true });
  } else {
    go();
  }
}

// ---------- page start ----------
function initFormsPage() {
  if (!requireAuth()) return;
  applyRoleVisibility();
  if (!canManageForms()) {
    document.getElementById('fmApp').style.display = 'none';
    document.getElementById('fmNoAccess').style.display = 'block';
    return;
  }

  document.querySelectorAll('.fm-tab').forEach((b) => b.addEventListener('click', () => setFormsTab(b.dataset.tab)));
  document.querySelectorAll('.fm-filter').forEach((b) =>
    b.addEventListener('click', () => {
      borrowerFilter = b.dataset.filter;
      renderFormsTable();
    })
  );
  document.getElementById('fmNewBtn').addEventListener('click', () => openFormEditor(null));
  document.getElementById('fmSearch').addEventListener('input', renderFormsTable);

  document.getElementById('formsBody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn || btn.disabled) return;
    const id = btn.dataset.id;
    if (btn.dataset.act === 'edit') openFormEditor(id);
    else if (btn.dataset.act === 'print') printFormRow(formsRows.find((r) => r.id === id));
    else if (btn.dataset.act === 'void') voidForm(id);
    else if (btn.dataset.act === 'return') openReturnModal(id);
  });

  const editor = document.getElementById('fmEditorBody');
  editor.addEventListener('click', (e) => {
    if (e.target.closest('[data-rm]')) {
      const tr = e.target.closest('tr');
      if (tr) tr.remove();
    } else if (e.target.id === 'fmAddLine') {
      addEditorLine({});
    } else if (e.target.id === 'fmAddUnitsBtn') {
      const have = lineTagsInEditor();
      const added = addUnitLines(currentUnitsOf(document.getElementById('fmName').value).filter((u) => !have.has(u.id.toUpperCase())));
      showToast(added + ' unit(s) added.');
      suggestUnitsForName(true);
    } else if (e.target.closest('[data-pick]')) {
      pickInventoryItem(e.target.closest('[data-pick]').dataset.pick);
    }
  });
  editor.addEventListener('input', (e) => {
    if (e.target.id === 'fmPick') renderPickResults();
  });
  editor.addEventListener('change', (e) => {
    if (e.target.id === 'fmName') suggestUnitsForName();
  });
  editor.addEventListener('focusout', (e) => {
    if (e.target.id === 'fmName') suggestUnitsForName();
  });
  document.getElementById('fmSaveBtn').addEventListener('click', () => saveForm(false));
  document.getElementById('fmSavePrintBtn').addEventListener('click', () => saveForm(true));

  const params = new URLSearchParams(window.location.search);
  const tab = (params.get('tab') || '').toUpperCase();
  setFormsTab(tab === 'BORROWERS' || tab === 'BORROWER' ? 'BORROWER' : FORM_TYPES[tab] ? tab : 'ISSUANCE');
}
