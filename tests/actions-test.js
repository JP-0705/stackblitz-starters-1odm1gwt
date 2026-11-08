const { chromium } = require('playwright'); const http=require('http'), fs=require('fs'), path=require('path');
const DIR=process.argv[2];
const src=fs.readFileSync(__dirname+'/e2e-report.js','utf8');
const FAKE=src.match(/const FAKE_SUPABASE = `([\s\S]*?)`;/)[1];
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]); if(p.endsWith('/'))p+='index.html'; const f=path.join(DIR,p);
 if(!fs.existsSync(f)){res.writeHead(404);return res.end();} res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(f)]||'application/octet-stream'}); res.end(fs.readFileSync(f));});
(async()=>{ await new Promise(r=>server.listen(0,r)); const base='http://localhost:'+server.address().port;
 const b=await chromium.launch();
 for (const role of ['ADMIN','ACCOUNTING']) {
  const ctx=await b.newContext({viewport:{width:1600,height:900}}); const page=await ctx.newPage();
  await page.route('**/cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'text/javascript',body:r.request().url().includes('supabase')?FAKE:'window.Chart=function(){};'}));
  const assets=[1,2,3].map(i=>({id:'IPHLNAGA-0000'+i,name:'ITEM '+i,category:'APPLIANCES',branch:'NAGA',qty:1,is_deleted:false}));
  await page.addInitScript(([db,s])=>{window.__DB=db;sessionStorage.setItem('ACTIVE_SESSION',JSON.stringify(s));},[{assets,asset_edit_history:[],asset_counts:[],count_history:[]},{email:'x@x.com',role}]);
  await page.goto(base+'/dashboard/'); await page.waitForSelector('#tableBody tr button');
  const r=await page.evaluate(()=>{ const td=document.querySelector('#tableBody tr:not(.group-header-row) td:last-child'); const c=td.getBoundingClientRect(); const bs=[...td.querySelectorAll('button')].map(x=>({t:x.textContent.trim(),r:Math.round(x.getBoundingClientRect().right)}));
    const maxR=Math.max(...bs.map(x=>x.r)); return {cellRight:Math.round(c.right), cellW:Math.round(c.width), buttons:bs.map(x=>x.t).join(' | '), overflowPx:Math.max(0,maxR-Math.round(c.right)), tableRight:Math.round(document.querySelector('table').getBoundingClientRect().right)}; });
  console.log(role.padEnd(10),'cell width',r.cellW+'px','| buttons:',r.buttons,'| overflow:',r.overflowPx+'px', r.overflowPx===0?'✅':'❌');
  if(role==='ADMIN'){ await page.evaluate(()=>{document.querySelector('.table-container, .table-scroll, [style*="overflow"]')}); await page.evaluate(()=>{const els=[...document.querySelectorAll('*')].filter(e=>e.scrollWidth>e.clientWidth+50&&getComputedStyle(e).overflowX!=='visible'); els.forEach(e=>e.scrollLeft=e.scrollWidth);}); await page.waitForTimeout(200); await page.screenshot({path:__dirname+'/actions-admin.png'}); }
  await ctx.close(); }
 await b.close(); server.close(); })();
