// Forms page: list, create, duplicate control no., XSS, borrower overdue/return, viewer blocked, printing.
const { chromium } = require('playwright'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=process.argv[2]; const OUT=process.argv[3]||'out';
const server=http.createServer((q,r)=>{let p=q.url.split('?')[0]; if(p.endsWith('/'))p+='index.html'; const f=path.join(DIR,p); if(!fs.existsSync(f)){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':{'.js':'text/javascript','.css':'text/css','.html':'text/html'}[path.extname(f)]||'application/octet-stream'}); r.end(fs.readFileSync(f));});
const FAKE=`(function(){const DB=window.__DB;let n=1;
class Q{constructor(t){this.t=t;this.f=[];this.o=[];this.r=null;this.mode='select';this.p=null;this.one=false;}
select(){return this;} eq(c,v){this.f.push(r=>r[c]===v);return this;} gte(c,v){this.f.push(r=>String(r[c])>=String(v));return this;}
order(c,o){this.o.push([c,!(o&&o.ascending===false)]);return this;} range(a,b){this.r=[a,b];return this;} limit(){return this;}
single(){this.one=true;return this;} maybeSingle(){this.one=true;return this;}
insert(x){this.mode='insert';this.p=x;return this;} update(x){this.mode='update';this.p=x;return this;}
then(a,b){return Promise.resolve(this.run()).then(a,b);}
run(){const rows=DB[this.t]; if(!rows) return {data:null,error:{message:'no table'}};
 if(this.mode==='insert'){ if(this.t==='asset_forms' && rows.some(r=>r.form_type===this.p.form_type&&r.control_no===this.p.control_no)) return {data:null,error:{code:'23505',message:'duplicate'}};
  const row=Object.assign({id:'f'+(n++),created_at:new Date().toISOString(),status:'SAVED'},this.p); rows.push(row); window.__log.push(['insert',row]); return {data:this.one?row:[row],error:null}; }
 let out=rows.filter(r=>this.f.every(f=>f(r)));
 if(this.mode==='update'){out.forEach(r=>Object.assign(r,this.p)); window.__log.push(['update',this.p]); return {data:this.one?out[0]:out,error:null};}
 this.o.slice().reverse().forEach(([c,a])=>{out=out.slice().sort((x,y)=>(a?1:-1)*(x[c]<y[c]?-1:x[c]>y[c]?1:0));});
 if(this.r) out=out.slice(this.r[0],this.r[1]+1); return {data:out,error:null};}}
window.__log=[]; const c={from:t=>new Q(t),rpc:async()=>({error:null}),auth:{signOut:async()=>({}),getSession:async()=>({data:{session:null}}),updateUser:async()=>({error:null})},storage:{from:()=>({remove:async()=>({error:null})})}};
window.supabase={createClient:()=>c};})();`;
(async()=>{await new Promise(r=>server.listen(0,r)); const base='http://localhost:'+server.address().port; const b=await chromium.launch(); const res=[];
const check=(n,ok,x='')=>{res.push(ok);console.log((ok?'  ✅ ':'  ❌ ')+n+(x?'  → '+x:''));};
const today=new Date(); const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; const dayOff=n=>iso(new Date(today.getFullYear(),today.getMonth(),today.getDate()+n));
async function open(role,url='/forms/'){const ctx=await b.newContext({viewport:{width:1400,height:900},timezoneId:'Asia/Manila'});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>{errs.push(e.message);console.log('  PAGE ERROR',e.message);});
 const alerts=[];page.on('dialog',d=>{alerts.push(d.message());d.accept();});
 await page.route('**/cdn.jsdelivr.net/**',r=>r.request().url().includes('pdf-lib')?r.fulfill({contentType:'text/javascript',body:fs.readFileSync(require.resolve('pdf-lib/dist/pdf-lib.min.js'),'utf8')}):r.fulfill({contentType:'text/javascript',body:FAKE})); await page.route('**/i.ibb.co/**',r=>r.abort());
 const assets=[{id:'IPHLNAGA-00001',name:'LAPTOP',brand:'DELL',model:'LATITUDE',serial_number:'SN123',category:'IT EQUIPMENT',branch:'NAGA',qty:1,condition:'IN CONDITION',department:'MIS',is_deleted:false,is_missing:false,amount:1,unit_price:1},{id:'IPHLNAGA-00002',name:'MONITOR',brand:'LG',model:'24',serial_number:'M2',category:'IT EQUIPMENT',branch:'NAGA',qty:1,condition:'IN CONDITION',department:'FINANCE',status:'IN USE',issued_to:'JUAN DELA CRUZ',is_deleted:false,is_missing:false,amount:1,unit_price:1},{id:'IPHLNAGA-00003',name:'KEYBOARD',brand:'LOGI',model:'K',serial_number:'K3',category:'IT EQUIPMENT',branch:'NAGA',qty:1,condition:'IN CONDITION',department:'FINANCE',status:'IN USE',issued_to:'JUAN DELA CRUZ',is_deleted:false,is_missing:false,amount:1,unit_price:1},{id:'IPHLNAGA-00004',name:'MOUSE',brand:'LOGI',model:'M',serial_number:'M4',category:'IT EQUIPMENT',branch:'NAGA',qty:1,condition:'IN CONDITION',department:'MIS',status:'AVAILABLE',issued_to:'STORAGE BOX 1',is_deleted:false,is_missing:false,amount:1,unit_price:1}];
 await page.addInitScript(([db,s])=>{window.__DB=db;sessionStorage.setItem('ACTIVE_SESSION',JSON.stringify(s));window.print=()=>{window.__printed=(window.__printed||0)+1;window.__printHtml=document.getElementById('formPrintArea').innerHTML;};},[{assets,asset_forms:[],asset_edit_history:[]},{email:role.toLowerCase()+'@x.com',role,token:'t'}]);
 await page.goto(base+url); await page.waitForTimeout(500); return {page,alerts,errs};}

// ---- Admin flow
let {page,alerts,errs}=await open('ADMIN');
check('Forms menu visible for Admin, opens on the Forms page with 3 choices', await page.locator('#formsNavGroup').isVisible() && await page.locator('#formsSub .nav-sub-link').count()===3 && await page.locator('#formsSub').isVisible());
check('IT Forms highlighted', (await page.textContent('#formsSub .nav-sub-link.active')).trim()==='IT Forms');
await page.click('#fmNewBtn'); await page.waitForSelector('#fmCtrl');
await page.fill('#fmCtrl','2026004-iphlnaga-00001'); await page.fill('#fmName','<img src=x onerror="window.__pwned=1">'); await page.fill('#fmDesig','ANALYST'); await page.fill('#fmDept','mis'); await page.fill('#fmEmpId','IPHL-00-111');
await page.selectOption('#fmBy','MIS');
await page.fill('#fmPick','sn123'); await page.waitForSelector('.fm-pick-item'); await page.click('.fm-pick-item');
check('Inventory pick filled the line', await page.inputValue('.ln-tag')==='IPHLNAGA-00001' && (await page.inputValue('.ln-serial'))==='SN123' && (await page.locator('#fmLines .fm-line').count())===1);
await page.check('.fm-reason[value="New Asset Request"]'); await page.check('.fm-reason[value="Others"]'); await page.fill('#fmReasonOther','TESTING'); await page.fill('#fmMis','All good');
await page.click('#fmSavePrintBtn'); await page.waitForSelector('#customConfirmOkBtn',{state:'visible'}); const confirmText=await page.textContent('#customConfirmMessage'); await page.click('#customConfirmOkBtn'); await page.waitForTimeout(800);
check('Issuance: asks before updating assets and shows the change', confirmText.includes('IPHLNAGA-00001') && confirmText.includes('Status → IN USE'));
const a1=await page.evaluate(()=>window.__DB.assets.find(a=>a.id==='IPHLNAGA-00001'));
check('Issuance: asset now Issued To the employee, status IN USE, department set', a1.issued_to.startsWith('<IMG') && a1.status==='IN USE' && a1.department==='MIS');
const hist=await page.evaluate(()=>window.__DB.asset_edit_history.filter(h=>h.asset_id==='IPHLNAGA-00001').map(h=>h.field_changed));
check('Issuance: changes written to the asset history', hist.includes('Issued To') && hist.includes('Asset Status'), hist.join(','));
check('Saved issuance form appears in list', (await page.textContent('#formsBody')).includes('2026004-IPHLNAGA-00001'));
check('Control no. uppercased', (await page.evaluate(()=>window.__DB.asset_forms[0].control_no))==='2026004-IPHLNAGA-00001');
check('Save & Print opened the form in a new tab', page.context().pages().length>=2);
check('XSS in name did not run (list + print)', !(await page.evaluate(()=>window.__pwned)) && (await page.locator('#formsBody img').count())===0 && (await page.locator('#formPrintArea img[src*="x"]').count())===0);
// duplicate
await page.click('#fmNewBtn'); await page.fill('#fmCtrl','2026004-IPHLNAGA-00001'); await page.fill('#fmName','JUAN'); await page.fill('.ln-part','MOUSE'); await page.click('#fmSaveBtn'); await page.waitForTimeout(400);
check('Duplicate control no. is refused with a clear message', alerts.some(a=>a.includes('already used')) && (await page.evaluate(()=>window.__DB.asset_forms.length))===1);
await page.click('#fmModal button:has-text("Cancel")');
// validation
await page.click('#fmNewBtn'); await page.click('#fmSaveBtn'); await page.waitForTimeout(200);
check('Empty form is refused', alerts.some(a=>a.includes('Control No. is required')) && alerts.some(a=>a.includes('Name is required')));
await page.click('#fmModal button:has-text("Cancel")');
// edit + void
await page.click('button[data-act="edit"]'); await page.fill('#fmDesig','SENIOR ANALYST'); await page.click('#fmSaveBtn'); await page.waitForTimeout(400);
check('Edit saved', (await page.evaluate(()=>window.__DB.asset_forms[0].designation))==='SENIOR ANALYST');
await page.click('button[data-act="void"]'); await page.click('#customConfirmOkBtn'); await page.waitForTimeout(400);
check('Void keeps the record, disables print/edit', (await page.evaluate(()=>window.__DB.asset_forms[0].status))==='VOID' && await page.locator('button[data-act="print"]').isDisabled());

// ---- Turnover tab + print render
await page.click('.fm-tab[data-tab="TURNOVER"]'); await page.click('#fmNewBtn'); await page.fill('#fmCtrl','2026003-IPHLNAGA-00001'); await page.fill('#fmName','MARIA'); await page.fill('#fmBy','ROWENA'); await page.fill('.ln-part','LAPTOP DELL'); await page.check('.fm-reason[value="Resignation"]'); await page.click('#fmSaveBtn'); await page.waitForTimeout(400);
check('Turnover form saved under its own tab', (await page.textContent('#formsBody')).includes('2026003-IPHLNAGA-00001') && !(await page.textContent('#formsBody')).includes('2026004'));

// ---- Borrower flow
await page.click('.fm-tab[data-tab="BORROWER"]');
for (const [ctrl,name,exp] of [['2026005-IPHLNAGA-00001','PEDRO',dayOff(-3)],['2026005-IPHLNAGA-00002','ANA',dayOff(5)]]) {
  await page.click('#fmNewBtn'); await page.fill('#fmCtrl',ctrl); await page.fill('#fmName',name); await page.fill('#fmDate',dayOff(-10)); await page.fill('#fmExpected',exp); await page.selectOption('#fmUsage','EXTERNAL'); await page.fill('#fmPurpose','Field work'); await page.fill('.ln-tag','IPHLNAGA-00001'); await page.fill('.ln-part','LAPTOP'); await page.click('#fmSaveBtn'); await page.waitForTimeout(400);
}
check('Summary: 2 out, 1 overdue', (await page.textContent('#sumOut'))==='2' && (await page.textContent('#sumOverdue'))==='1');
check('Overdue row shows days late', (await page.textContent('#formsBody')).includes('3 day(s) late'));
await page.click('.fm-filter[data-filter="OVERDUE"]');
check('Overdue filter works', (await page.locator('#formsBody tr').count())===1 && (await page.textContent('#formsBody')).includes('PEDRO'));
await page.click('button[data-act="return"]'); await page.fill('#fmReturnDate',dayOff(-1)); await page.click('button:has-text("Save Return")'); await page.waitForTimeout(400);
check('Mark Returned works', (await page.textContent('#sumOverdue'))==='0' && (await page.textContent('#sumOut'))==='1' && (await page.textContent('#sumReturned'))==='1');
await page.fill('#fmSearch','ana'); await page.click('.fm-filter[data-filter="ALL"]');
check('Search works', (await page.locator('#formsBody tr').count())===1);
errs.length? check('No page errors',false,errs.join('|')) : check('No page errors',true);

// ---- Print to PDF for all three types
const rows=await page.evaluate(()=>window.__DB.asset_forms);
const full={ISSUANCE:{form_type:'ISSUANCE',control_no:'2026004-IPHLNAGA-00123',employee_name:'JUAN DELA CRUZ',designation:'IT SUPPORT',department:'MIS',employee_id:'IPHL-00-123',form_date:dayOff(0),by_party:'MIS',assets:[{particulars:'LAPTOP DELL LATITUDE',qty:1,serial:'SN12345',tag:'IPHLNAGA-00001',condition:'GOOD'},{particulars:'MOUSE',qty:2,serial:'',tag:'',condition:'NEW'}],reasons:['New Asset Request','Warranty Replacement','Others'],reason_other:'Pilot test',mis_findings:'Unit tested OK',property_findings:'Tagged'},
 TURNOVER:{form_type:'TURNOVER',control_no:'2026003-IPHLNAGA-00009',employee_name:'MARIA SANTOS',designation:'ACCOUNTANT',department:'FINANCE',employee_id:'IPHL-00-009',form_date:dayOff(0),by_party:'ROWENA SANCHEZ',assets:[{particulars:'DESKTOP PC',qty:1,serial:'S9',tag:'IPHLNAGA-00009',condition:'DEFECTIVE'}],reasons:['Resignation','Defective'],mis_findings:'',property_findings:''},
 BORROWER:{form_type:'BORROWER',control_no:'2026005-IPHLNAGA-00004',employee_name:'PEDRO REYES',designation:'FIELD ENGINEER',department:'OPERATIONS',employee_id:'IPHL-00-044',form_date:dayOff(0),usage_type:'EXTERNAL',purpose:'Site visit',expected_return_date:dayOff(3),assets:[{tag:'IPHLNAGA-00001',particulars:'LAPTOP DELL',serial:'SN12345',condition:'GOOD'}]}};
for (const t of Object.keys(full)) {
  await page.evaluate((r)=>{document.getElementById('formPrintArea').innerHTML=buildFormSheetHtml(r);document.body.classList.add('print-mode-form');},full[t]);
  await page.waitForTimeout(150);
  await page.emulateMedia({media:'print'});
  await page.pdf({path:`${OUT}/form-${t}.pdf`,format:'Letter',preferCSSPageSize:true,printBackground:true});
  await page.emulateMedia({media:'screen'});
  await page.evaluate(()=>document.body.classList.remove('print-mode-form'));
}
for (const t of Object.keys(full)) { const info=require('child_process').execSync(`pdfinfo ${OUT}/form-${t}.pdf`).toString(); check(`${t} prints on exactly 1 Letter page`, /Pages:\s+1\b/.test(info)); }

// ---- Turnover: units load automatically, assets move to the storage location
({page,alerts}=await open('ADMIN'));
await page.click('.fm-tab[data-tab="TURNOVER"]'); await page.click('#fmNewBtn'); await page.waitForSelector('#fmName');
await page.fill('#fmName','juan dela cruz'); await page.press('#fmName','Tab'); await page.waitForTimeout(500);
check('Turnover: typing a name lists the units issued to that person', (await page.locator('#fmLines .fm-line').count())===2 && (await page.textContent('#fmFoundNotice')).includes('Added 2'));
check('Turnover: department filled from the units', (await page.inputValue('#fmDept'))==='FINANCE');
await page.fill('#fmCtrl','2026003-IPHLNAGA-00050');
await page.click('#fmSaveBtn'); await page.waitForTimeout(300);
check('Turnover: storage location is required when updating assets', alerts.some(a=>a.includes('Storage location')));
await page.fill('#fmBy','storage box 2'); await page.click('#fmSaveBtn'); await page.waitForSelector('#customConfirmOkBtn',{state:'visible'});
check('Turnover: confirmation shows the new location', (await page.textContent('#customConfirmMessage')).includes('Issued To → STORAGE BOX 2'));
await page.click('#customConfirmOkBtn'); await page.waitForTimeout(800);
const as=await page.evaluate(()=>window.__DB.assets.filter(a=>['IPHLNAGA-00002','IPHLNAGA-00003'].includes(a.id)));
check('Turnover: both units moved to STORAGE BOX 2 and are AVAILABLE', as.every(a=>a.issued_to==='STORAGE BOX 2' && a.status==='AVAILABLE'));
// unticking leaves assets alone
await page.click('#fmNewBtn'); await page.fill('#fmCtrl','2026003-IPHLNAGA-00051'); await page.fill('#fmName','PEDRO'); await page.fill('#fmBy','LOCKER 5'); await page.fill('#fmPick','m4'); await page.waitForSelector('.fm-pick-item'); await page.click('.fm-pick-item'); await page.uncheck('#fmApply'); await page.click('#fmSaveBtn'); await page.waitForTimeout(700);
check('Untick: form saved, asset left unchanged', (await page.evaluate(()=>window.__DB.asset_forms.length))===2 && (await page.evaluate(()=>window.__DB.assets.find(a=>a.id==='IPHLNAGA-00004').issued_to))==='STORAGE BOX 1');
// no units for a name
await page.click('#fmNewBtn'); await page.fill('#fmName','NOBODY'); await page.press('#fmName','Tab'); await page.waitForTimeout(400);
check('Turnover: unknown name shows a friendly note', (await page.textContent('#fmFoundNotice')).includes('No units are currently issued'));
await page.click('#fmModal button:has-text("Cancel")');
// Issuance never offers the option on edit
await page.click('.fm-tab[data-tab="ISSUANCE"]'); 

// ---- Filled company PDFs
for (const t of Object.keys(full)) {
  const b64=await page.evaluate(async(r)=>{const bytes=await buildFilledFormPdf(r);let s='';bytes.forEach(x=>s+=String.fromCharCode(x));return btoa(s);},full[t]);
  fs.writeFileSync(`${OUT}/filled-${t}.pdf`,Buffer.from(b64,'base64'));
  const info=require('child_process').execSync(`pdfinfo ${OUT}/filled-${t}.pdf`).toString();
  check(`${t}: company PDF filled, still 1 page`, /Pages:\s+1\b/.test(info));
}
// Print button opens the filled PDF in a new tab
const [popup]=await Promise.all([page.context().waitForEvent('page',{timeout:8000}).catch(()=>null), page.evaluate((r)=>openFilledFormPdf(r),full.ISSUANCE)]);
if(popup) await popup.waitForTimeout(800); check('Print opens a new tab with the PDF', !!popup && /^(blob:|about:blank)/.test(popup.url()||''), popup?popup.url().slice(0,30):'no tab');
// ---- Dashboard button
({page,errs}=await open('ADMIN','/analytics/'));
await page.evaluate((d)=>{window.__DB.asset_forms.push({form_type:'BORROWER',status:'BORROWED',expected_return_date:d[0],date_returned:null},{form_type:'BORROWER',status:'BORROWED',expected_return_date:d[1],date_returned:null},{form_type:'BORROWER',status:'RETURNED',expected_return_date:d[0],date_returned:d[1]});return renderBorrowersBadge();},[dayOff(-2),dayOff(4)]);
check('Dashboard: Borrowers tracker button visible with live counts', await page.locator('#borrowersTrackerBtn').isVisible() && (await page.textContent('#borrowersBadge')).trim()==='2 out · 1 overdue', await page.textContent('#borrowersBadge'));
check('Dashboard button links to the tracker tab', (await page.getAttribute('#borrowersTrackerBtn','href'))==='/forms/?tab=borrowers');
await page.goto(base+'/forms/?tab=borrowers'); await page.waitForTimeout(500);
check('Link opens the Borrowers Tracker tab', await page.locator('.fm-tab[data-tab="BORROWER"].active').count()===1 && await page.locator('#fmSummary').isVisible());
({page}=await open('VIEWER','/analytics/'));
check('Viewer does not see the tracker button', !(await page.locator('#borrowersTrackerBtn').isVisible()));
// ---- Sidebar Forms menu on another page + placeholder pages
({page,errs}=await open('ADMIN','/analytics/'));
check('Menu starts closed on other pages', !(await page.locator('#formsSub').isVisible()));
await page.click('#formsGroupToggle');
check('Click opens the 3 choices', await page.locator('#formsSub').isVisible() && (await page.locator('#formsSub .nav-sub-link').allTextContents()).map(x=>x.trim()).join('|')==='IT Forms|Accounting Forms|PMD Forms');
for (const [u,name] of [['/forms/accounting/','Accounting Forms'],['/forms/pmd/','PMD Forms']]) {
  await page.goto(base+u); await page.waitForTimeout(400);
  check(name+' page opens, menu open and highlighted', (await page.textContent('.fm-title')).trim()===name && (await page.textContent('#formsSub .nav-sub-link.active')).trim()===name);
}
({page}=await open('VIEWER','/forms/pmd/'));
check('Viewer cannot see the PMD placeholder content', !(await page.locator('#fmApp').isVisible()));
// ---- Viewer blocked
({page}=await open('VIEWER'));
check('Viewer: Forms menu hidden', !(await page.locator('#formsNavGroup').isVisible()));
check('Viewer: page shows no-access message and no data', await page.locator('#fmNoAccess').isVisible() && !(await page.locator('#fmApp').isVisible()));
await b.close(); server.close(); const bad=res.filter(x=>!x).length; console.log(`\n${res.length-bad}/${res.length} passed`); process.exit(bad?1:0);})();
