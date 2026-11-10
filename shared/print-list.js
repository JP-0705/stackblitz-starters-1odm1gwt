// PRINT LIST — choose which columns to print and how large the font is.
// The choice is remembered by the browser (localStorage). The on-screen table is not changed:
// unselected columns are only hidden while printing and restored afterwards.
(function () {
  // [column number in the table, label]. Image and Actions are never printed, so they are not listed.
  const COLUMNS = [
    [1, 'INNOV-ID'], [2, 'Name'], [3, 'Brand'], [4, 'Description'], [5, 'Model'], [6, 'Serial Number'],
    [7, 'Asset Type'], [9, 'Category'], [10, 'Branch'], [11, 'Issued To'], [12, 'Department'],
    [13, 'Date of Purchase'], [14, 'Unit'], [15, 'Unit Price'], [16, 'Quantity'], [17, 'Amount'],
    [18, 'Useful Life'], [19, 'Age'], [20, 'Warranty Expiry'], [21, 'Condition'], [22, 'Note'],
    [23, 'Status'], [24, 'Tracking Date'], [25, 'Remarks'],
  ];
  const IMPORTANT = [1, 2, 3, 5, 6, 9, 10, 11, 12, 16, 21, 23, 25];
  const FONT_SIZES = { SMALL: 6.5, MEDIUM: 8, LARGE: 9.5 };
  const KEY = 'innovphil.printList.v1';
  const ALWAYS_HIDDEN = [8, 26]; // Image, Actions
  let applied = null;

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && Array.isArray(saved.cols) && FONT_SIZES[saved.size]) return saved;
    } catch (e) { /* storage unavailable: use the defaults */ }
    return { cols: IMPORTANT.slice(), size: 'MEDIUM' };
  }
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function ensureModal() {
    if (document.getElementById('printListModal')) return;
    const m = document.createElement('div');
    m.id = 'printListModal';
    m.className = 'modal-backdrop no-print';
    m.innerHTML = `
      <div class="modal-box">
        <h3>🖨️ Print List</h3>
        <p style="font-size:12px; color:#64748b; margin-bottom:12px;">
          Choose the columns to print. The fewer the columns, the larger and easier to read the text.
        </p>
        <div style="display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
          <button type="button" class="action-btn" id="plImportant" style="background:#e2e8f0; color:#334155;">Important only</button>
          <button type="button" class="action-btn" id="plAll" style="background:#e2e8f0; color:#334155;">All</button>
          <button type="button" class="action-btn" id="plNone" style="background:#e2e8f0; color:#334155;">Clear all</button>
        </div>
        <div id="plColumns" style="display:grid; grid-template-columns:1fr 1fr; gap:6px 14px; margin-bottom:14px;"></div>
        <label style="font-size:12px; color:#475569;">Font size<br>
          <select id="plSize" style="padding:8px; border:1px solid #cbd5e1; border-radius:8px;">
            <option value="SMALL">Small (saves paper)</option>
            <option value="MEDIUM">Medium</option>
            <option value="LARGE">Large</option>
          </select></label>
        <div class="modal-actions">
          <button type="button" id="plCancel" class="action-btn" style="background:#e2e8f0; color:#334155;">Cancel</button>
          <button type="button" id="plPrint" class="action-btn btn-dark">🖨️ Print</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    const box = document.getElementById('plColumns');
    COLUMNS.forEach(([idx, label]) => {
      const l = document.createElement('label');
      l.style.cssText = 'font-size:12px; display:flex; align-items:center; gap:6px; cursor:pointer;';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.dataset.col = String(idx);
      l.appendChild(cb); l.appendChild(document.createTextNode(label));
      box.appendChild(l);
    });
    const setAll = (fn) => box.querySelectorAll('input').forEach((c) => { c.checked = fn(Number(c.dataset.col)); });
    document.getElementById('plImportant').addEventListener('click', () => setAll((i) => IMPORTANT.includes(i)));
    document.getElementById('plAll').addEventListener('click', () => setAll(() => true));
    document.getElementById('plNone').addEventListener('click', () => setAll(() => false));
    document.getElementById('plCancel').addEventListener('click', close);
    document.getElementById('plPrint').addEventListener('click', printNow);
    m.addEventListener('click', (e) => { if (e.target === m) close(); });
  }

  function openPrintListDialog() {
    ensureModal();
    const st = load();
    document.querySelectorAll('#plColumns input').forEach((c) => { c.checked = st.cols.includes(Number(c.dataset.col)); });
    document.getElementById('plSize').value = st.size;
    document.getElementById('printListModal').style.display = 'flex';
  }
  function close() {
    const m = document.getElementById('printListModal');
    if (m) m.style.display = 'none';
  }

  // Hides the columns that were not selected. restore() puts them back.
  function apply(visible, size) {
    restore();
    const table = document.querySelector('.data-container table');
    if (!table) return;
    const show = new Set(visible.filter((i) => !ALWAYS_HIDDEN.includes(i)));
    const hidden = [];
    const hide = (el) => { if (el) { el.classList.add('pl-hide'); hidden.push(el); } };
    const spans = [];
    table.querySelectorAll('colgroup col').forEach((c, i) => { if (!show.has(i + 1)) hide(c); });
    table.querySelectorAll('thead tr.header-main-row th').forEach((th, i) => { if (!show.has(i + 1)) hide(th); });
    table.querySelectorAll('#tableBody tr:not(.group-header-row)').forEach((tr) => {
      [...tr.children].forEach((td, i) => { if (!show.has(i + 1)) hide(td); });
    });
    // Group headings (ASSET INFO, DESIGNATION...) and the "Group by Issued To" rows
    let start = 1;
    table.querySelectorAll('thead tr.header-category-row th').forEach((th) => {
      const orig = th.colSpan || 1;
      if (th.rowSpan > 1) { hide(th); return; } // ACTIONS
      let n = 0;
      for (let i = start; i < start + orig; i++) if (show.has(i)) n++;
      spans.push([th, orig]);
      if (n === 0) hide(th); else th.colSpan = n;
      start += orig;
    });
    table.querySelectorAll('#tableBody tr.group-header-row td').forEach((td) => {
      spans.push([td, td.colSpan]);
      td.colSpan = Math.max(1, show.size);
    });
    document.body.style.setProperty('--pl-font', FONT_SIZES[size] + 'px');
    applied = { hidden, spans };
  }

  function restore() {
    if (!applied) return;
    applied.hidden.forEach((el) => el.classList.remove('pl-hide'));
    applied.spans.forEach(([el, n]) => { el.colSpan = n; });
    document.body.style.removeProperty('--pl-font');
    applied = null;
  }

  function printNow() {
    const cols = [...document.querySelectorAll('#plColumns input:checked')].map((c) => Number(c.dataset.col));
    if (cols.length === 0) return alert('Select at least one column.');
    const size = document.getElementById('plSize').value;
    save({ cols, size });
    close();
    apply(cols, size);
    // short delay so the changes are drawn before the print dialog opens
    setTimeout(() => { window.print(); }, 50);
  }

  window.addEventListener('afterprint', restore);
  window.openPrintListDialog = openPrintListDialog;
  window.__printListInternals = { apply, restore, COLUMNS, IMPORTANT };
})();
