// Usage: node xss-test.js <project-dir>
// Renders every screen that shows database data using MALICIOUS values,
// then reports whether any injected code ran / any injected element exists.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const DIR = process.argv[2];

const dom = new JSDOM(
  `<!DOCTYPE html><body>
  <table>
    <tbody id="tableBody"></tbody>
    <tbody id="deletedItemsTableBody"></tbody>
    <tbody id="countEntryTableBody"></tbody>
    <tbody id="countSheetTableBody"></tbody>
    <tbody id="countHistoryTableBody"></tbody>
    <tbody id="countHistoryDetailTableBody"></tbody>
    <tbody id="assetEditHistoryTableBody"></tbody>
  </table>
  <div id="rowDetailBody"></div><button id="rowDetailEditBtn"></button><div id="rowDetailModal"></div>
  <select id="assetTypeFilterSelect"></select>
  <div id="countSheetMeta"></div><input type="checkbox" id="groupByIssuedToCheckbox" checked>
  <input id="countEntryDate"><input id="countEntryScopeLabel"><div id="countEntryModal"></div>
  <div id="toastContainer"></div>
  <div id="countHistoryDetailMeta"></div><div id="countHistoryDetailModal"></div>
  <div id="assetEditHistoryTitle"></div><div id="assetEditHistoryModal"></div>
  <div id="deletedItemsModal"></div><div id="countHistoryModal"></div>
  </body>`,
  { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/dashboard/' }
);
const w = dom.window;
w.__pwned = 0;
w.__called = [];
w.alert = () => {};
w.sessionStorage.setItem('ACTIVE_SESSION', JSON.stringify({ email: 'a@b.c', role: 'ADMIN' }));
w.supabaseClient = {}; // truthy so the functions don't bail out early

const files = [
  'shared/session.js', 'shared/ui.js', 'shared/data.js', 'shared/table.js',
  'shared/deleted-items.js', 'shared/physical-count.js', 'shared/count-history.js', 'shared/edit-history.js',
];
const bundle = files.map((f) => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n;\n');
w.eval(bundle + '\n;window.__run = (code) => eval(code);');
const run = (code) => w.__run(code);

const evil = '<img src=x onerror="window.__pwned++">';
const evilId = "A'); window.__pwned++; ('";
const item = {
  id: evilId, name: evil, brand: evil, description: evil, model: evil, serialNumber: evil,
  itemCategory: evil, imageUrl: 'javascript:window.__pwned++', category: evil, branch: evil,
  issuedTo: evil, purchaseDate: '2024-01-01', unit: evil, unitPrice: 10, qty: 2, amount: 20,
  usefulLife: evil, condition: evil, note: evil, status: evil, trackingDate: evil, remarks: evil,
};
w.__evil = evil; w.__item = item;

run(`requireAuth();`);
run(`
  fetchBackendDataRows = async () => [window.__item];
  fetchDeletedAssetRows = async () => [Object.assign({}, window.__item, { deletedBy: window.__evil })];
  fetchCountHistoryRows = async () => [{ id: 7, count_date: window.__evil, scope_category: window.__evil,
    scope_branch: window.__evil, counted_by: window.__evil, item_count: 1, mismatch_count: 1,
    created_at: new Date().toISOString(),
    rows: [{ id: window.__evil, name: window.__evil, brand: window.__evil, category: window.__evil,
      branch: window.__evil, issuedTo: window.__evil, systemQty: window.__evil, countedQty: window.__evil,
      variance: 1, remarks: window.__evil }] }];
  fetchAssetEditHistoryRows = async () => [{ edited_at: null, edited_by: window.__evil,
    field_changed: window.__evil, old_value: window.__evil, new_value: window.__evil }];
`);

(async () => {
  // 1. main table (+ grouped header, asset-type dropdown, row popup, toast)
  run(`renderTableRows([window.__item], true)`);
  run(`populateAssetTypeFilterOptions([window.__item])`);
  run(`openRowDetailModal(window.__item.id)`);
  run(`showToast(window.__evil, 'error')`);

  // 2. other screens
  await run(`renderDeletedItemsTable()`);
  await run(`renderCountHistoryList()`);
  run(`viewCountHistoryDetail(7)`);
  await run(`openAssetEditHistoryModal('x')`);
  await run(`openPhysicalCountModal()`);
  run(`renderCountSheetPrintArea('2026-01-01', [Object.assign({}, window.__item, {systemQty: 1, countedQty: 2, variance: 1, remarks: window.__evil})], true)`);

  // 3. record which handler gets called, with which id, when buttons are clicked
  run(`
    openAssetEditModal = (...a) => window.__called.push(['edit', ...a]);
    openRemarksEditModal = (...a) => window.__called.push(['remarks', ...a]);
    openAssetEditHistoryModal = (...a) => window.__called.push(['history', ...a]);
    disposeAssetRecord = (...a) => window.__called.push(['dispose', ...a]);
    restoreAssetRecord = (...a) => window.__called.push(['restore', ...a]);
    showAssetImagePreview = (...a) => window.__called.push(['preview', ...a]);
  `);
  const doc = w.document;
  [...doc.querySelectorAll('button, img.asset-thumb, input.countedQtyInput')].forEach((el) => {
    if (el.matches('input')) el.dispatchEvent(new w.Event('input'));
    else el.click();
  });
  await new Promise((r) => setTimeout(r, 50));

  const injected = doc.querySelectorAll('img[onerror], script, [onclick], [oninput]').length;
  const jsSrc = [...doc.querySelectorAll('img')].some((i) => /^javascript:/i.test(i.getAttribute('src') || ''));
  const idOk = w.__called.filter((c) => c[1] === evilId).length;
  const bad = w.__called.filter((c) => c[1] !== evilId && c[0] !== 'preview').length;
  console.log('  injected <img onerror>/<script>/inline handlers :', injected, ' (harus 0)');
  console.log('  naipatakbong code (window.__pwned)             :', w.__pwned, ' (harus 0)');
  console.log('  <img src="javascript:..."> sa table             :', jsSrc, ' (harus false)');
  console.log('  buttons na nakatanggap ng tamang ID             :', idOk, '/', w.__called.length - 0, ' mga tawag:', w.__called.map((c) => c[0]).join(','));
  const nameCell = doc.querySelector('#tableBody tr:not(.group-header-row) td:nth-child(2)');
  console.log('  lumalabas na text ng pangalan                   :', nameCell ? JSON.stringify(nameCell.textContent.slice(0, 40)) : 'WALA');
})().catch((e) => console.log('  TEST ERROR:', e.message.split('\n')[0]));
