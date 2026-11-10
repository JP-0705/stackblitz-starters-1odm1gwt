const { JSDOM } = require('jsdom'); const fs=require('fs'); const path=require('path');
const DIR=process.argv[2];
const dom=new JSDOM('<body></body>',{runScripts:'outside-only',url:'https://example.test/x/'});
const w=dom.window; w.sessionStorage.setItem('ACTIVE_SESSION','{corrupted json');
let loc=null; 
try {
  w.eval(fs.readFileSync(path.join(DIR,'shared/session.js'),'utf8')+';window.__r=()=>requireAuth();');
  console.log('  session.js still loads when the stored data is corrupt: YES');
  const r=w.__r(); console.log('  requireAuth() returned:', r, '(null = sent back to login, no crash)');
} catch(e){ console.log('  CRASH:', e.message); }
