const { JSDOM } = require('jsdom'); const fs=require('fs'); const path=require('path');
const DIR=process.argv[2];
const dom=new JSDOM(`<body>
<input id="modalTargetIndexId"><input id="formAssetId"><select id="formAssetBranch"><option>NAGA</option><option>MAKATI</option></select>
<div id="assetDataModal"></div>
<input type="file" id="formAssetImageFile">${['Name','Brand','Model','Description','SerialNumber','ItemCategory','ImageUrl','IssuedTo','PurchaseDate','UnitPrice','Quantity','UsefulLife','Note','TrackingDate','Amount','Unit'].map(n=>`<input id="formAsset${n}">`).join('')}
<select id="formAssetCategory"><option>IT EQUIPMENT</option></select><select id="formAssetCondition"><option>IN CONDITION</option></select><select id="formAssetStatus"><option>IN USE</option></select>
<h2 id="modalBoxTitle"></h2><img id="formAssetImagePreview"><button id="removeAssetImageBtn"></button>
</body>`,{runScripts:'outside-only',url:'https://example.test/dashboard/'});
const w=dom.window; const alerts=[]; w.alert=(m)=>alerts.push(m);
let existing=[]; let inserted=[]; let uploads=0; let insertError=null;
w.supabaseClient={
  from:()=>{ const q={ _like:null,
    select(){return q;}, like(c,p){q._like=p.replace('%','');return q;}, order(){return q;},
    limit(){ const rows=existing.filter(id=>id.startsWith(q._like)).sort().reverse().slice(0,1).map(id=>({id})); return Promise.resolve({data:rows,error:null}); },
    eq(){return q;}, maybeSingle(){return Promise.resolve({data:null});},
    insert(r){inserted.push(r); return Promise.resolve({error:insertError});} }; return q; },
  storage:{from:()=>({upload:()=>{uploads++;return Promise.resolve({error:null});},getPublicUrl:()=>({data:{publicUrl:'x'}}),remove:()=>Promise.resolve({error:null})})}
};
const src=['shared/ui.js','shared/data.js','shared/asset-modal.js'].map(f=>fs.readFileSync(path.join(DIR,f),'utf8')).join('\n;\n');
w.eval(src+';window.logAssetEvent=async()=>{};window.__run=(c)=>eval(c);'); const run=(c)=>w.__run(c); const tick=()=>new Promise(r=>setTimeout(r,20));
(async()=>{
  const id=()=>w.document.getElementById('formAssetId').value;
  existing=['IPHL-APP-001','IPHLNAGA-00040','IPHLNAGA-00041','IPHLMAKATI-00007'];
  run(`openAssetInsertModal()`); await tick();
  console.log('NAGA  (may 00041)        ->', id(), id()==='IPHLNAGA-00042'?'OK':'MALI');
  w.document.getElementById('formAssetBranch').value='MAKATI'; w.document.getElementById('formAssetBranch').dispatchEvent(new w.Event('change')); await tick();
  console.log('MAKATI (may 00007)       ->', id(), id()==='IPHLMAKATI-00008'?'OK':'MALI');
  existing=[]; w.document.getElementById('formAssetBranch').value='NAGA'; w.document.getElementById('formAssetBranch').dispatchEvent(new w.Event('change')); await tick();
  console.log('NAGA  (wala pang bago)   ->', id(), id()==='IPHLNAGA-00001'?'OK':'MALI');
  console.log('placeholder              ->', w.document.getElementById('formAssetId').placeholder);
  const f=w.document.getElementById('formAssetId');
  console.log('field read-only          ->', f.readOnly===true?'OK':'MALI');
  // even if someone forces a wrong/old value via devtools, save regenerates the correct next ID
  existing=['IPHLNAGA-00041']; f.value='IPHLMAKATI-00001'; w.document.getElementById('formAssetName').value='x'; alerts.length=0; inserted=[];
  await run(`commitAssetStorageChange()`);
  console.log('pinilit na maling ID     -> na-save bilang:', inserted[0] && inserted[0].id, inserted[0] && inserted[0].id==='IPHLNAGA-00042'?'OK':'MALI');
  // duplicate key
  inserted=[]; insertError={code:'23505',message:'dup'}; existing=['IPHLNAGA-00005']; alerts.length=0;
  w.document.getElementById('formAssetId').value='IPHLNAGA-00005'; await run(`commitAssetStorageChange()`); await tick();
  console.log('duplicate (23505)        -> bagong ID:', id(), '| mensahe:', (alerts[0]||'').slice(0,45));
})();
