// End-to-end: real dashboard page in Chromium + in-memory fake Supabase.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const DIR = process.argv[2];
const OUT = process.argv[3];

// ---------- tiny static server ----------
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(DIR, p);
  if (!f.startsWith(DIR) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  const ext = path.extname(f);
  res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[ext] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});

// ---------- fake database ----------
const M = (d, t) => new Date(`2026-${d}T${t}+08:00`).toISOString(); // Manila time
const assets = [];
for (let i = 1; i <= 1200; i++) {
  const branch = i % 2 ? 'NAGA' : 'MAKATI';
  assets.push({ id: `IPHL${branch}-${String(i).padStart(5, '0')}`, name: `ITEM ${i}`, category: 'IT EQUIPMENT', branch,
    qty: 1, unit_price: 100, amount: 100, condition: 'IN CONDITION', note: 'ACTIVE', status: 'IN USE', is_deleted: false });
}
const EVIL = '<img src=x onerror="window.__pwned=1">';
assets.push({ id: 'IPHLNAGA-99001', name: 'OLD PRINTER (DELETED)', category: 'IT EQUIPMENT', branch: 'NAGA', qty: 1, is_deleted: true, deleted_at: M('10-12', '10:00:00'), deleted_by: 'admin@x.com' });
assets[0].name = EVIL; // first asset has a malicious name
const history = [];
let hid = 1;
const H = (asset_id, field, o, n, when, by = 'admin@x.com') => history.push({ id: hid++, asset_id, edited_by: by, field_changed: field, old_value: o, new_value: n, edited_at: when });
// boundaries
H('IPHLNAGA-00003', 'Unit Price', '1', '2', M('09-30', '23:59:59'));   // Sept -> excluded
H('IPHLNAGA-00003', 'Unit Price', '3', '4', M('11-01', '00:00:00'));   // Nov  -> excluded
H('IPHLNAGA-00003', 'Unit Price', '5', '6', M('10-01', '00:00:00'));   // included
H('IPHLNAGA-00003', 'Unit Price', '7', '8', M('10-31', '23:59:59'));   // included
// new / moves / delete / restore
H('IPHLNAGA-00005', 'Asset Added', '(none)', 'LAPTOP NEW', M('10-05', '09:00:00'), 'acct@x.com');
H('IPHLMAKATI-00002', 'Asset Added', '(none)', '=HYPERLINK("http://evil")', M('10-06', '09:00:00'));
H('IPHLNAGA-00007', 'Issued To', '(empty)', 'JUAN DELA CRUZ', M('10-07', '10:30:00'));
H('IPHLNAGA-00007', 'Issued To', 'JUAN DELA CRUZ', 'MARIA SANTOS', M('10-20', '14:15:00'));
H('IPHLMAKATI-00004', 'Branch', 'MAKATI', 'NAGA', M('10-08', '11:00:00'));
H('IPHLNAGA-99001', 'Asset Deleted', 'OLD PRINTER (DELETED)', '(deleted)', M('10-12', '10:00:00'), 'acct@x.com');
H('IPHLNAGA-00009', 'Asset Restored', '(deleted)', 'RESTORED ITEM', M('10-13', '10:00:00'));
H('IPHLNAGA-00001', 'Remarks', '(empty)', 'SEE NOTE', M('10-14', '08:00:00'));
// 1005 edits with the SAME timestamp -> tests paging past the 1000-row cap + tie-break
for (let i = 1; i <= 1005; i++) H(assets[i].id, 'Unit Price', '100', '150', M('10-20', '09:00:00'));

const FAKE_SUPABASE = `
(function(){
  const DB = window.__DB; const MAX_ROWS = 1000; window.__log = [];
  const cmp = (a,b)=> a<b?-1:a>b?1:0;
  class Q {
    constructor(t){ this.t=t; this.f=[]; this.o=[]; this.r=null; this.l=null; this.mode='select'; this.payload=null; this.single=false; }
    select(){ return this; }
    eq(c,v){ this.f.push(r=>r[c]===v); return this; }
    like(c,p){ const pre=p.replace('%',''); this.f.push(r=>String(r[c]).startsWith(pre)); return this; }
    gte(c,v){ this.f.push(r=>new Date(r[c])>=new Date(v)); return this; }
    lt(c,v){ this.f.push(r=>new Date(r[c])<new Date(v)); return this; }
    order(c,opt){ this.o.push([c, !(opt&&opt.ascending===false)]); return this; }
    range(a,b){ this.r=[a,b]; return this; }
    limit(n){ this.l=n; return this; }
    maybeSingle(){ this.single=true; return this; }
    insert(rows){ this.mode='insert'; this.payload=Array.isArray(rows)?rows:[rows]; return this; }
    upsert(rows,opt){ this.mode='upsert'; this.payload=Array.isArray(rows)?rows:[rows]; return this; }
    update(obj){ this.mode='update'; this.payload=obj; return this; }
    then(res,rej){ return Promise.resolve(this.run()).then(res,rej); }
    run(){
      const rows = DB[this.t]; if(!rows) return {data:null,error:{message:'no table '+this.t}};
      if(this.mode==='upsert'){ this.payload.forEach(p=>{ const i=rows.findIndex(r=>r.asset_id===p.asset_id&&r.count_date===p.count_date); if(i>=0) Object.assign(rows[i],p); else rows.push(Object.assign({},p)); }); window.__log.push([this.t,'upsert',this.payload.length]); return {data:null,error:null}; }
      if(this.mode==='insert'){ this.payload.forEach(p=>{ rows.push(Object.assign({id:rows.length+100000, edited_at:new Date().toISOString()}, p)); window.__log.push([this.t,'insert',p]); }); return {data:null,error:null}; }
      let out = rows.filter(r=>this.f.every(f=>f(r)));
      if(this.mode==='update'){ out.forEach(r=>Object.assign(r,this.payload)); window.__log.push([this.t,'update',this.payload]); return {data:null,error:null}; }
      this.o.slice().reverse().forEach(([c,asc])=>{ out=out.slice().sort((a,b)=> (asc?1:-1)*cmp(a[c],b[c])); });
      let from=0, to=MAX_ROWS-1; if(this.r){ from=this.r[0]; to=Math.min(this.r[1], this.r[0]+MAX_ROWS-1); }
      out = out.slice(from, to+1); if(this.l!=null) out=out.slice(0,this.l);
      if(this.single) return {data: out[0]||null, error:null};
      return {data: out, error:null};
    }
  }
  const client = { from:t=>new Q(t), rpc:async()=>({error:null}),
    auth:{ signOut:async()=>({}), getSession:async()=>({data:{session:null}}), signInWithPassword:async()=>({error:null}), updateUser:async()=>({error:null}) },
    storage:{ from:()=>({ remove:async()=>({error:null}) }) } };
  window.supabase = { createClient: ()=>client };
})();`;

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch();
  const results = [];
  const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? '  ✅ ' : '  ❌ ') + name + (extra ? '  → ' + extra : '')); };

  async function newPage(role, email) {
    const ctx = await browser.newContext({ timezoneId: 'Asia/Manila', acceptDownloads: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('  PAGE ERROR:', e.message));
    await page.route('**/cdn.jsdelivr.net/**', (route) => {
      if (route.request().url().includes('supabase')) return route.fulfill({ contentType: 'text/javascript', body: FAKE_SUPABASE });
      return route.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){};' });
    });
    await page.route('**/i.ibb.co/**', (r) => r.abort());
    await page.addInitScript(([db, session]) => {
      window.__DB = db;
      sessionStorage.setItem('ACTIVE_SESSION', JSON.stringify(session));
      window.print = () => { window.__printed = true; };
    }, [{ assets: JSON.parse(JSON.stringify(assets)), asset_edit_history: JSON.parse(JSON.stringify(history)), asset_counts: [], count_history: [] }, { email, role }]);
    await page.goto(base + '/dashboard/');
    await page.waitForFunction(() => document.getElementById('totalCounter') && document.getElementById('totalCounter').innerText !== '0' && document.getElementById('totalCounter').innerText !== '', null, { timeout: 15000 });
    return page;
  }

  async function runReport(page, month, year, branch = 'ALL') {
    await page.click('.settings-gear-btn');
    await page.click('#monthlyReportMenuLink');
    await page.selectOption('#mrYear', String(year));
    await page.selectOption('#mrMonth', String(month));
    await page.selectOption('#mrBranch', branch);
    await page.click('#mrGenerateBtn');
    await page.waitForFunction(() => /change\(s\)|No changes|Could not/.test(document.getElementById('mrStatus').textContent), null, { timeout: 20000 });
  }

  console.log('\n[1] ADMIN');
  let page = await newPage('ADMIN', 'admin@x.com');
  const total = await page.innerText('#totalCounter');
  check('dashboard nagpakita ng LAHAT ng 1,200 asset (pagination)', total.trim() === '1200', 'totalCounter=' + total);
  check('may "Monthly Report" sa Settings menu', (await page.locator('#monthlyReportMenuLink').count()) === 1);

  await runReport(page, 9, 2026); // October
  const status = await page.innerText('#mrStatus');
  const expectedTotal = 2 + 2 + 1 + 1 + 2 + 1 + 1 + 1 + 1005 - 0; // see below
  // 2 boundary edits + 2 added + 2 issued + 1 branch + 1 deleted + 1 restored + 1 remarks + 1005 edits
  const exp = 2 + 2 + 2 + 1 + 1 + 1 + 1 + 1005;
  check('tamang bilang ng galaw sa Oktubre (hindi kasama ang Sept 30 / Nov 1)', status.startsWith(exp + ' change(s)'), status);
  const summary = (await page.locator('#mrPreview .report-summary tbody td').allInnerTexts()).map(Number);
  console.log('     summary [new, issued, branch, disposed, restored, missing, found, edits, total, assets]:', JSON.stringify(summary));
  check('summary: new=2 issued=2 branch=1 disposed=1 (lumang "Deleted") restored=1 missing=0 found=0', summary[0] === 2 && summary[1] === 2 && summary[2] === 1 && summary[3] === 1 && summary[4] === 1 && summary[5] === 0 && summary[6] === 0);
  check('summary: edits = 1005 + 2 (hangganan) + 1 (remarks) = 1008', summary[7] === 1008, 'edits=' + summary[7]);
  const octText = await page.innerText('#mrPreview');
  check('lumang "Asset Deleted" ay lumalabas bilang DISPOSED na may paliwanag', octText.includes('logged as "deleted" before Dispose was added'));
  const previewHtml = await page.innerHTML('#mrPreview');
  check('pangalan ng na-delete na asset ay lumalabas (Admin)', previewHtml.includes('OLD PRINTER (DELETED)'));
  check('walang injected <img onerror> sa preview (XSS)', (await page.locator('#mrPreview img').count()) === 0);
  check('walang naipatakbong code', (await page.evaluate(() => window.__pwned)) !== 1);

  // CSV
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#mrCsvBtn')]);
  const csvPath = path.join(OUT, 'report.csv');
  await download.saveAs(csvPath);
  const csv = fs.readFileSync(csvPath, 'utf8');
  const csvLines = csv.split('\r\n');
  check('CSV filename tama', download.suggestedFilename() === 'INNOVPHIL_Monthly_Report_2026-10_ALL.csv', download.suggestedFilename());
  check('CSV may BOM para sa Excel', csv.charCodeAt(0) === 0xfeff);
  check('CSV: 1 header + ' + exp + ' row', csvLines.length === exp + 1, 'lines=' + csvLines.length);
  check('CSV: ang "=HYPERLINK" ay hindi magiging formula', csv.includes(`"'=HYPERLINK(""http://evil"")"`) && !csv.includes(',"=HYPERLINK'));
  check('CSV: header tama', csvLines[0].replace('\uFEFF','') === '"Date","Time","Category","Asset ID","Asset Name","Branch","Field","Old Value","New Value","Changed By"');

  // Print -> PDF
  await page.click('#mrPrintBtn');
  check('print ay tinawag', (await page.evaluate(() => window.__printed)) === true);
  check('body may print-mode-report', await page.evaluate(() => document.body.classList.contains('print-mode-report')));
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(OUT, 'report-all.pdf'), format: 'A4', printBackground: true });
  await page.emulateMedia({ media: 'screen' });

  // Branch filter
  await page.evaluate(() => { document.body.classList.remove('print-mode-report'); });
  await page.selectOption('#mrBranch', 'MAKATI');
  await page.click('#mrGenerateBtn');
  await page.waitForFunction(() => /change\(s\)|No changes/.test(document.getElementById('mrStatus').textContent));
  const mk = await page.innerText('#mrPreview');
  check('branch filter MAKATI: may lumabas na MAKATI item at ang branch transfer', mk.includes('IPHLMAKATI-00004') && !mk.includes('IPHLNAGA-00007'));

  // ---------------- DISPOSE ----------------
  await page.click('#mrCloseBtn');
  const dbRows = () => page.evaluate(() => window.__DB.assets);
  const firstDispose = page.locator('#tableBody button[data-action="dispose"]').first();
  check('may "📦 Dispose" button (wala nang "Del")', (await firstDispose.innerText()).includes('Dispose'));
  const disposeId = await firstDispose.getAttribute('data-id');
  await firstDispose.click();
  check('bumukas ang Dispose modal', await page.isVisible('#disposeAssetModal'));
  const localToday = await page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  check('default na petsa ay ARAW NGAYON sa oras ng user', (await page.inputValue('#disposeDate')) === localToday, localToday);
  await page.click('#disposeConfirmBtn');
  check('walang reason -> may error, hindi natuloy', (await page.innerText('#disposeError')).includes('reason') && (await dbRows()).find(a => a.id === disposeId).is_deleted !== true);
  await page.selectOption('#disposeReason', 'OTHER');
  await page.click('#disposeConfirmBtn');
  check('"OTHER" na walang remarks -> hinarang', (await page.innerText('#disposeError')).includes('Remarks'));
  await page.selectOption('#disposeReason', 'SOLD');
  await page.fill('#disposeRemarks', 'Sold to ABC Corp, OR #1234');
  await page.click('#disposeConfirmBtn');
  await page.waitForTimeout(300);
  const disposed = (await dbRows()).find(a => a.id === disposeId);
  check('na-dispose: is_deleted + reason + petsa + remarks + sino', disposed.is_deleted === true && disposed.disposal_reason === 'SOLD' && disposed.disposal_date === localToday && disposed.disposal_remarks.includes('ABC') && disposed.deleted_by === 'admin@x.com');
  const dlog = await page.evaluate(() => window.__log.filter((l) => l[0] === 'asset_edit_history' && l[2].field_changed === 'Asset Disposed'));
  check('naka-log na "Asset Disposed" kasama ang pangalan at dahilan', dlog.length === 1 && dlog[0][2].old_value === 'ITEM 2' && dlog[0][2].new_value.startsWith('SOLD (' + localToday + ')'), dlog[0] && dlog[0][2].new_value);
  check('nawala sa dashboard (1199)', (await page.innerText('#totalCounter')).trim() === '1199');
  // Disposed Items list
  await page.click('.settings-gear-btn');
  check('Admin: "📦 Disposed Items" ang label (hindi Deleted)', (await page.innerText('#deletedItemsMenuLink')).includes('Disposed Items'));
  await page.click('#deletedItemsMenuLink');
  await page.waitForFunction(() => document.querySelectorAll('#deletedItemsTableBody tr').length >= 2);
  const dTxt = await page.innerText('#deletedItemsTableBody');
  check('Disposed Items ay may reason, petsa, remarks', dTxt.includes('SOLD') && dTxt.includes(localToday) && dTxt.includes('ABC Corp'));
  check('lumang "deleted" ay may label na previously deleted', dTxt.includes('UNSPECIFIED') || dTxt.includes('---'));
  await page.click('#deletedItemsModal .modal-actions button');

  // ---------------- MISSING (during physical count) ----------------
  await page.click('#physicalCountBtn');
  await page.waitForFunction(() => document.querySelectorAll('#countEntryTableBody .countMissingCheck').length > 100);
  check('count entry: may "NOT FOUND?" column', (await page.locator('#countEntryModal th.th-missing').count()) === 1);
  const rowsInModal = await page.locator('#countEntryTableBody tr[data-row-asset-id]').count();
  check('count entry ay may 1,199 row (wala ang na-dispose)', rowsInModal === 1199, String(rowsInModal));
  const r1 = page.locator('#countEntryTableBody tr[data-row-asset-id]').nth(0);
  const r2 = page.locator('#countEntryTableBody tr[data-row-asset-id]').nth(1);
  const miss1 = await r1.getAttribute('data-row-asset-id');
  const miss2 = await r2.getAttribute('data-row-asset-id');
  await r1.locator('.countMissingCheck').check();
  await r2.locator('.countMissingCheck').check();
  await r1.locator('.countRemarksInput').fill('Hinanap sa bodega, wala');
  check('pag-tick ng Missing: counted=0, naka-lock, variance -1', (await r1.locator('.countedQtyInput').inputValue()) === '0' && (await r1.locator('.countedQtyInput').isDisabled()) && (await r1.locator('.variance-cell').innerText()) === '-1');
  await r2.locator('.countMissingCheck').uncheck();
  check('pag-untick: bumabalik sa system qty at na-unlock', (await r2.locator('.countedQtyInput').inputValue()) === '1' && !(await r2.locator('.countedQtyInput').isDisabled()));
  await r2.locator('.countMissingCheck').check();
  await page.evaluate(() => { window.__printed = false; });
  await page.click('#countEntryModal button.btn-dark');
  await page.waitForSelector('#customConfirmModal', { state: 'visible' });
  check('may confirmation bago i-mark na missing', (await page.innerText('#customConfirmMessage')).includes('2 item(s)'));
  await page.click('#customConfirmOkBtn');
  await page.waitForFunction(() => window.__printed === true, null, { timeout: 15000 });
  const dbA = await dbRows();
  const m1 = dbA.find(a => a.id === miss1), m2 = dbA.find(a => a.id === miss2);
  check('na-mark na missing sa database kasama ang petsa/huling hawak/remarks/sino', m1.is_missing === true && m1.missing_date === localToday && m1.missing_remarks === 'Hinanap sa bodega, wala' && m1.missing_marked_by === 'admin@x.com' && m2.is_missing === true, m1.missing_date);
  const mlog = await page.evaluate(() => window.__log.filter((l) => l[0] === 'asset_edit_history' && l[2].field_changed === 'Asset Marked Missing'));
  check('naka-log ang 2 "Asset Marked Missing"', mlog.length === 2 && mlog[0][2].new_value.startsWith('Not found during physical count ' + localToday), mlog[0] && mlog[0][2].new_value);
  const savedCounts = await page.evaluate(() => window.__DB.asset_counts.filter(c => c.counted_qty === 0).length);
  check('na-save ang count na 0 para sa missing', savedCounts === 2);
  const hist = await page.evaluate(() => window.__DB.count_history[0]);
  check('Count History: may "MISSING" sa remarks', JSON.stringify(hist).includes('MISSING — Hinanap sa bodega, wala'));
  await page.waitForFunction(() => document.getElementById('totalCounter').innerText.trim() === '1197');
  check('dashboard bumaba sa 1,197 (hindi na binibilang ang missing)', true);

  // hindi na kasama sa susunod na bilang
  await page.click('#physicalCountBtn');
  await page.waitForFunction(() => document.querySelectorAll('#countEntryTableBody .countMissingCheck').length > 100);
  check('susunod na count: 1,197 row lang, wala ang 2 missing', (await page.locator('#countEntryTableBody tr[data-row-asset-id]').count()) === 1197 && (await page.locator(`#countEntryTableBody tr[data-row-asset-id="${miss1}"]`).count()) === 0);
  await page.evaluate(() => closeCountEntryModal());

  // ---------------- MISSING ITEMS screen ----------------
  await page.click('.settings-gear-btn');
  await page.click('#missingItemsMenuLink');
  await page.waitForFunction(() => document.querySelectorAll('#missingItemsTableBody button[data-found]').length === 2);
  const mTxt = await page.innerText('#missingItemsTableBody');
  check('Missing Items list: 2 item, may remarks at petsa', mTxt.includes(miss1) && mTxt.includes(miss2) && mTxt.includes('Hinanap sa bodega') && mTxt.includes(localToday));
  await page.locator(`#missingItemsTableBody button[data-found="${miss1}"]`).click();
  await page.click('#customConfirmOkBtn');
  await page.waitForFunction(() => document.querySelectorAll('#missingItemsTableBody button[data-found]').length === 1);
  const found = (await dbRows()).find(a => a.id === miss1);
  check('Found: bumalik sa active at nabura ang missing details', found.is_missing === false && found.missing_date === null && found.missing_remarks === null);
  await page.waitForFunction(() => document.getElementById('totalCounter').innerText.trim() === '1198');
  check('Found: bumalik sa dashboard (1,198)', true);
  await page.locator(`#missingItemsTableBody button[data-writeoff="${miss2}"]`).click();
  check('Write-off: bumukas ang Dispose modal na naka-preset na "LOST / STOLEN"', (await page.inputValue('#disposeReason')) === 'LOST / STOLEN');
  await page.click('#disposeConfirmBtn');
  await page.waitForFunction(() => document.querySelectorAll('#missingItemsTableBody button[data-found]').length === 0);
  const wo = (await dbRows()).find(a => a.id === miss2);
  check('Write-off: Disposed na (LOST / STOLEN) at hindi na missing', wo.is_deleted === true && wo.disposal_reason === 'LOST / STOLEN' && wo.is_missing === false);
  await page.click('#missingCloseBtn');

  // ---------------- REPORT reflects everything (current month) ----------------
  await page.evaluate(() => { document.body.classList.remove('print-mode-count'); });
  const now = await page.evaluate(() => ({ m: new Date().getMonth(), y: new Date().getFullYear() }));
  await page.click('.settings-gear-btn');
  await page.click('#monthlyReportMenuLink');
  await page.selectOption('#mrYear', String(now.y)); await page.selectOption('#mrMonth', String(now.m)); await page.selectOption('#mrBranch', 'ALL');
  await page.click('#mrGenerateBtn');
  await page.waitForFunction(() => /change\(s\)/.test(document.getElementById('mrStatus').textContent));
  const nowSummary = (await page.locator('#mrPreview .report-summary tbody td').allInnerTexts()).map(Number);
  console.log('     buwang ito [new, issued, branch, disposed, restored, missing, found, edits, total, assets]:', JSON.stringify(nowSummary));
  check('report ngayong buwan: disposed=2 (SOLD + LOST), missing=2, found=1', nowSummary[3] === 2 && nowSummary[5] === 2 && nowSummary[6] === 1, JSON.stringify(nowSummary));
  const nowHtml = await page.innerText('#mrPreview');
  check('report: nakalista ang dahilan ng disposal at ang details ng missing', nowHtml.includes('SOLD (') && nowHtml.includes('LOST / STOLEN (') && nowHtml.includes('Not found during physical count'));
  check('report: may seksyong "3. DISPOSED / RESTORED" at "4. MISSING / FOUND"', nowHtml.includes('3. DISPOSED / RESTORED') && nowHtml.includes('4. MISSING / FOUND'));
  await page.click('#mrCloseBtn');
  await page.context().close();

  console.log('\n[2] ACCOUNTING');
  page = await newPage('ACCOUNTING', 'acct@x.com');
  await runReport(page, 9, 2026);
  const acctHtml = await page.innerHTML('#mrPreview');
  check('Accounting nakakagawa ng report', (await page.innerText('#mrStatus')).includes('change(s)'));
  check('Accounting: may Dispose button at Missing Items link', (await page.locator('#tableBody button[data-action="dispose"]').count()) > 0 && (await page.locator('#missingItemsMenuLink').count()) === 1);
  check('Accounting: HINDI makita ang Disposed Items (Admin lang, restore)', await page.evaluate(() => getComputedStyle(document.getElementById('deletedItemsMenuLink')).display === 'none'));
  check('Accounting: pangalan ng na-delete na asset ay galing sa mismong event (hindi niya mabasa ang deleted)', acctHtml.includes('OLD PRINTER (DELETED)'));
  await page.context().close();

  console.log('\n[3] VIEWER');
  page = await newPage('VIEWER', 'view@x.com');
  check('Viewer: WALANG Monthly Report link', (await page.locator('#monthlyReportMenuLink').count()) === 0);
  check('Viewer: WALANG Missing Items link at WALANG Dispose button', (await page.locator('#missingItemsMenuLink').count()) === 0 && (await page.locator('#tableBody button[data-action="dispose"]').count()) === 0);
  check('Viewer: hindi makapag-dispose kahit tawagin sa console', await page.evaluate(async () => { await window.disposeAssetRecord('IPHLNAGA-00003'); const m = document.getElementById('disposeAssetModal'); return !m || m.style.display !== 'flex'; }));
  check('Viewer: hindi makabukas kahit tawagin sa console', await page.evaluate(() => { window.openMonthlyReportModal(); const m = document.getElementById('monthlyReportModal'); return !m || m.style.display !== 'flex'; }));
  await page.context().close();

  await browser.close(); server.close();
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad}/${results.length} pumasa` + (bad ? `  —  ${bad} BUMAGSAK` : ''));
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('E2E FAILED:', e); server.close(); process.exit(2); });
