// Usage: node fields-test.js <project-dir>
// Tests: new fields (Department, Supplier, Warranty), Witnessed By, Issuance Report, Prepared By.
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const DIR = process.argv[2];
const FAKE = fs.readFileSync(__dirname + '/e2e-report.js', 'utf8').match(/const FAKE_SUPABASE = `([\s\S]*?)`;/)[1];
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(DIR, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
let ok = 0, bad = 0; const check = (n, c, x = '') => { (c ? ok++ : bad++); console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  → ' + x : '')); };

(async () => {
  await new Promise((r) => server.listen(0, r)); const base = 'http://localhost:' + server.address().port;
  const b = await chromium.launch();
  async function openPage(role, db) {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, timezoneId: 'Asia/Manila' }); const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
    page.on('dialog', (d) => { console.log('   (alert: ' + d.message().slice(0, 80) + ')'); d.accept(); });
    await page.route('**/cdn.jsdelivr.net/**', (r) => r.fulfill({ contentType: 'text/javascript', body: r.request().url().includes('supabase') ? FAKE : 'window.Chart=function(){};' }));
    await page.addInitScript(([db, s]) => { window.__DB = db; window.print = () => { window.__printed = true; document.dispatchEvent(new Event('x')); }; sessionStorage.setItem('ACTIVE_SESSION', JSON.stringify(s)); }, [db, { email: role.toLowerCase() + '@x.com', role }]);
    return page;
  }
  const mk = () => ({
    assets: [
      { id: 'IPHLNAGA-00001', name: 'LAPTOP A', category: 'IT EQUIPMENT', branch: 'NAGA', qty: 1, is_deleted: false, issued_to: 'JUAN DELA CRUZ', department: 'MIS', condition: 'IN CONDITION', supplier: 'ACME SUPPLY', supplier_contact: '0917-000-0000', supplier_address: 'NAGA CITY', warranty_months: 12, warranty_expiration: '2027-01-31', unit_price: 0, note: 'ACTIVE', status: 'IN USE', unit: 'PIECE' },
      { id: 'IPHLNAGA-00002', name: 'MOUSE', category: 'IT EQUIPMENT', branch: 'NAGA', qty: 2, is_deleted: false, issued_to: 'JUAN DELA CRUZ', department: 'MIS' },
      { id: 'IPHLNAGA-00003', name: 'CHAIR', category: 'FURNITURES AND FIXTURES', branch: 'NAGA', qty: 1, is_deleted: false, issued_to: 'MARIA SANTOS', department: 'MARKETING' },
      { id: 'IPHLMAKATI-00001', name: 'TABLE', category: 'FURNITURES AND FIXTURES', branch: 'MAKATI', qty: 1, is_deleted: false, issued_to: '', department: '' },
      { id: 'IPHLNAGA-00004', name: '=CMD() FORMULA', category: 'IT EQUIPMENT', branch: 'NAGA', qty: 1, is_deleted: false, issued_to: '<img src=x onerror="window.__pwned=1">', department: 'PMD' },
      { id: 'IPHLNAGA-00005', name: 'GONE', category: 'IT EQUIPMENT', branch: 'NAGA', qty: 1, is_deleted: true, issued_to: 'JUAN DELA CRUZ' },
    ],
    asset_edit_history: [], asset_counts: [], count_history: [],
  });

  // ---------- ADMIN ----------
  let page = await openPage('ADMIN', mk());
  await page.goto(base + '/dashboard/'); await page.waitForSelector('#tableBody tr');
  const heads = await page.$$eval('thead tr:nth-child(2) th', (t) => t.map((x) => x.textContent.trim()));
  const cells = await page.$eval('#tableBody tr:not(.group-header-row)', (r) => r.children.length);
  const topSpans = await page.$$eval('#tableBody', (b) => [...b[0].closest('table').querySelectorAll('thead tr:nth-child(1) th')]).then(() => page.$eval('#tableBody', (b) => [...b.closest('table').querySelectorAll('thead tr:nth-child(1) th')].reduce((n, x) => n + (x.colSpan || 1), 0))); const _unused = await page.$$eval('thead tr:nth-child(1) th', (t) => t.reduce((n, x) => n + (x.colSpan || 1), 0));
  check('table header has a DEPARTMENT column', heads.includes('DEPARTMENT'), heads.join('|').slice(0, 80));
  check('cells per row = number of headers (nothing misaligned)', cells === heads.length + 1 && topSpans === cells, `cells ${cells}, headers ${heads.length}+action, top-span ${topSpans}`);
  const deptCell = await page.$eval('#tableBody tr:not(.group-header-row)', (r) => r.children[11].textContent.trim());
  check('department appears in the right column (next to Issued To)', ['MIS', 'MARKETING', 'PMD', '---'].includes(deptCell), deptCell);
  await page.fill('#globalSearch', ''); await page.type('#globalSearch', 'marketing'); await page.waitForTimeout(200);
  check('search works on department', (await page.$$eval('#tableBody tr', (r) => r.length)) === 1);
  await page.fill('#globalSearch', '');

  // detail modal (admin sees supplier)
  await page.click('#tableBody tr:first-child td:nth-child(2)');
  await page.waitForSelector('#rowDetailModal', { state: 'visible' });
  let detail = await page.innerText('#rowDetailBody');
  check('detail: ADMIN can see Supplier and Warranty', detail.includes('Supplier:') && detail.includes('Warranty:'));
  await page.evaluate(() => closeRowDetailModal());

  // warranty calc
  const calc = await page.evaluate(() => [computeWarrantyExpiration('2026-01-31', 1), computeWarrantyExpiration('2026-03-15', 12), computeWarrantyExpiration('', 12), computeWarrantyExpiration('2026-03-15', ''), computeWarrantyExpiration('2024-02-29', 12)]);
  check('warranty expiration: Jan 31 + 1 month = Feb 28 (not Mar 3)', calc[0] === '2026-02-28', calc[0]);
  check('warranty expiration: +12 months, blank when data is missing', calc[1] === '2027-03-15' && calc[2] === '' && calc[3] === '', JSON.stringify(calc));

  // add new asset with the new fields
  await page.click('#addNewAssetMasterBtn'); await page.waitForSelector('#assetDataModal', { state: 'visible' });
  await page.waitForFunction(() => /^IPHLNAGA-\d{5}$/.test(document.getElementById('formAssetId').value));
  await page.fill('#formAssetName', 'new monitor'); await page.selectOption('#formAssetDepartment', 'ACCOUNTING');
  await page.fill('#formAssetSupplier', 'big shop'); await page.fill('#formAssetSupplierContact', '0999-111-2222'); await page.fill('#formAssetSupplierAddress', 'makati ave');
  await page.fill('#formAssetPurchaseDate', '2026-01-31'); await page.fill('#formAssetWarrantyMonths', '1');
  check('expiration is auto-filled in the form (purchase date + months)', (await page.inputValue('#formAssetWarrantyExpiration')) === '2026-02-28');
  await page.click('#assetDataModal button.btn-dark'); await page.waitForTimeout(500);
  const saved = await page.evaluate(() => window.__DB.assets.find((a) => a.name === 'NEW MONITOR'));
  check('department/supplier/contact/address are saved', saved && saved.department === 'ACCOUNTING' && saved.supplier === 'BIG SHOP' && saved.supplier_contact === '0999-111-2222' && saved.supplier_address === 'MAKATI AVE', JSON.stringify(saved && [saved.department, saved.supplier]));
  check('warranty is saved (1 month, until 2026-02-28)', saved && saved.warranty_months === 1 && saved.warranty_expiration === '2026-02-28', saved && saved.warranty_expiration);

  // warranty validation
  await page.click('#addNewAssetMasterBtn'); await page.waitForSelector('#assetDataModal', { state: 'visible' });
  await page.waitForFunction(() => /^IPHLNAGA-\d{5}$/.test(document.getElementById('formAssetId').value));
  await page.fill('#formAssetName', 'bad warranty'); await page.fill('#formAssetWarrantyMonths', '-5');
  const before = await page.evaluate(() => window.__DB.assets.length);
  await page.click('#assetDataModal button.btn-dark'); await page.waitForTimeout(300);
  check('negative warranty is blocked', (await page.evaluate(() => window.__DB.assets.length)) === before);
  await page.evaluate(() => closeAssetModal());

  // edit -> prefill + history
  await page.evaluate(() => openAssetEditModal('IPHLNAGA-00001')); await page.waitForSelector('#assetDataModal', { state: 'visible' });
  const pre = await page.evaluate(() => [document.getElementById('formAssetDepartment').value, document.getElementById('formAssetSupplier').value, document.getElementById('formAssetWarrantyMonths').value]);
  check('edit: new fields are pre-filled', pre[0] === 'MIS' && pre[1] === 'ACME SUPPLY' && pre[2] === '12', JSON.stringify(pre));
  await page.selectOption('#formAssetDepartment', 'PMD');
  await page.click('#assetDataModal button.btn-dark'); await page.waitForTimeout(500);
  const hist = await page.evaluate(() => window.__DB.asset_edit_history.filter((h) => h.field_changed === 'Department'));
  check('History logs the Department change (MIS → PMD)', hist.length === 1 && hist[0].old_value === 'MIS' && hist[0].new_value === 'PMD', JSON.stringify(hist[0]));
  const exp1 = await page.evaluate(() => window.__DB.assets.find((a) => a.id === 'IPHLNAGA-00001').warranty_expiration);
  check('warranty expiration from Excel is not erased even without a purchase date', exp1 === '2027-01-31', exp1);
  const others = await page.evaluate(() => window.__DB.asset_edit_history.filter((h) => h.asset_id === 'IPHLNAGA-00001' && h.field_changed !== 'Department').map((h) => h.field_changed));
  check('no other accidental "changes" in the log', others.length === 0, others.join(','));
  // unknown legacy department stays selectable
  await page.evaluate(async () => { window.__DB.assets.find((a) => a.id === 'IPHLNAGA-00002').department = 'OLD DEPT'; await openAssetEditModal('IPHLNAGA-00002'); });
  check('an old/unknown department is not erased from the dropdown', (await page.inputValue('#formAssetDepartment')) === 'OLD DEPT');
  await page.evaluate(() => closeAssetModal());

  // ---------- Witnessed By ----------
  await page.evaluate(() => { window.__printed = false; });
  await page.click('#physicalCountBtn'); await page.waitForSelector('#countEntryModal', { state: 'visible' });
  await page.fill('#countEntryWitness', 'ana reyes');
  await page.click('#countEntryModal button.btn-dark');
  await page.waitForFunction(() => window.__printed === true, null, { timeout: 15000 });
  const ch = await page.evaluate(() => window.__DB.count_history[0]);
  check('Witnessed By is saved in Count History (uppercase)', ch && ch.witnessed_by === 'ANA REYES', ch && ch.witnessed_by);
  const meta = await page.innerText('#countSheetMeta').catch(() => '');
  check('Witnessed by appears on the printed sheet', meta.includes('Witnessed by: ANA REYES'), meta.slice(-50));
  await page.evaluate(() => { document.body.classList.remove('print-mode-count'); });

  // ---------- Issuance report ----------
  await page.evaluate(() => toggleSettingsMenu());
  check('"Issuance Report" is in the Settings menu (Admin)', await page.isVisible('#issuanceReportMenuLink'));
  await page.click('#issuanceReportMenuLink'); await page.waitForSelector('#issuanceReportModal', { state: 'visible' });
  await page.waitForFunction(() => document.getElementById('irStatus').textContent.includes('asset(s) loaded'));
  await page.click('#irGenerateBtn');
  const txt = await page.innerText('#irPreview');
  check('grouped by person; JUAN has 2 items, disposed item excluded', txt.includes('JUAN DELA CRUZ — 2 item(s), qty 3') && !txt.includes('GONE'));
  check('"UNASSIGNED" group exists and is last', txt.indexOf('UNASSIGNED') > txt.indexOf('MARIA SANTOS'));
  check('has a signature line for the receiver', txt.includes('Signature:') && txt.includes('Printed name: JUAN DELA CRUZ'));
  check('XSS: no injected elements in the report', (await page.$$('#irPreview img[onerror], #irPreview script')).length === 0);
  await page.selectOption('#irBranch', 'MAKATI'); await page.click('#irGenerateBtn');
  check('branch filter (MAKATI) → only 1 item', (await page.innerText('#irStatus')).includes('1 item(s)'));
  await page.selectOption('#irBranch', 'ALL'); await page.selectOption('#irGroupBy', 'DEPARTMENT'); await page.click('#irGenerateBtn');
  const dtxt = await page.innerText('#irPreview');
  check('group by Department: OLD DEPT, MARKETING, PMD, NO DEPARTMENT', ['OLD DEPT', 'MARKETING', 'PMD', 'NO DEPARTMENT'].every((d) => dtxt.includes(d)) && !dtxt.includes('Signature:'));
  await page.selectOption('#irGroupBy', 'PERSON'); await page.click('#irGenerateBtn');
  const csv = await page.evaluate(() => { const g = window.__issuanceInternals; return g.buildCsv({ groups: g.buildGroups(window.__DB.assets.filter((a) => !a.is_deleted).map((a) => ({ id: a.id, name: a.name, issuedTo: a.issued_to, branch: a.branch, qty: a.qty })), 'PERSON', 'ALL', '') }); });
  check('CSV has a BOM and formulas are neutralised (=CMD → \'=CMD)', csv.charCodeAt(0) === 0xfeff && csv.includes("\"'=CMD() FORMULA\""));
  await page.evaluate(() => { window.__printed = false; });
  await page.click('#irPrintBtn'); await page.waitForFunction(() => window.__printed === true);
  const areas = await page.evaluate(() => [...document.querySelectorAll('.print-only-report')].map((e) => e.id + ':' + (e.innerHTML.length > 0)));
  check('only one print area has content (no duplicates)', areas.filter((a) => a.endsWith(':true')).length === 1 && areas.some((a) => a.startsWith('issuanceReportPrintArea:true')), areas.join(','));
  await page.evaluate(() => document.body.classList.remove('print-mode-report'));

  // ---------- Monthly report: Prepared By ----------
  await page.evaluate(() => closeSettingsMenu && closeSettingsMenu());
  await page.evaluate(() => document.getElementById('issuanceReportModal').style.display = 'none');
  await page.evaluate(() => openMonthlyReportModal());
  await page.waitForSelector('#monthlyReportModal', { state: 'visible' });
  check('Monthly Report: "Prepared by" defaults to the email', (await page.inputValue('#mrPreparedBy')) === 'admin@x.com');
  await page.fill('#mrPreparedBy', 'ROWENA B. SANCHEZ');
  await page.selectOption('#mrMonth', String(new Date().getMonth())); await page.selectOption('#mrYear', String(new Date().getFullYear()));
  await page.click('#mrGenerateBtn'); await page.waitForFunction(() => !document.getElementById('mrGenerateBtn').disabled);
  check('Prepared by appears in the report', (await page.innerText('#mrPreview')).includes('Prepared by: ROWENA B. SANCHEZ'));

  // ---------- VIEWER ----------
  const vpage = await openPage('VIEWER', mk());
  await vpage.goto(base + '/dashboard/'); await vpage.waitForSelector('#tableBody tr');
  await vpage.click('#tableBody tr:first-child td:nth-child(2)'); await vpage.waitForSelector('#rowDetailModal', { state: 'visible' });
  const vd = await vpage.innerText('#rowDetailBody');
  check('VIEWER: cannot see Supplier/Contact/Address', !vd.includes('Supplier') && !vd.includes('0917'));
  check('VIEWER: can still see Department and Warranty', vd.includes('Department:') && vd.includes('Warranty:'));
  check('VIEWER: has no Issuance Report', (await vpage.$('#issuanceReportMenuLink')) === null);

  console.log(`\n${ok}/${ok + bad} passed`);
  await b.close(); server.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('TEST ERROR:', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(2); });
