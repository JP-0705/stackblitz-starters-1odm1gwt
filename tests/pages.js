const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const out = [];
  for (const [label, dir] of [['LUMA', process.argv[2]], ['BAGO', process.argv[3]]]) {
    const css = fs.readFileSync(dir + '/shared/styles.css', 'utf8');
    const names = ['LAPTOP DELL LATITUDE 5420','OFFICE CHAIR ERGONOMIC','AIR CONDITIONER 1.5HP SPLIT TYPE','MONITOR 24 INCH','STEEL CABINET 4-DRAWER'];
    let rows = '';
    for (let i = 1; i <= 800; i++) {
      const n = names[i % names.length];
      rows += `<tr><td>IPHLNAGA-${String(i).padStart(5,'0')}</td><td>${n}</td><td>DELL</td><td>IT EQUIPMENT</td><td>NAGA</td><td>JUAN DELA CRUZ</td><td>1</td><td style="min-width:${label==='LUMA'?70:50}px;">&nbsp;</td><td style="min-width:${label==='LUMA'?70:50}px;">&nbsp;</td><td style="min-width:${label==='LUMA'?90:80}px;">&nbsp;</td></tr>`;
    }
    const html = `<html><head><style>${css}</style></head><body class="print-mode-count">
      <div class="data-container">x</div>
      <div id="countSheetPrintArea" class="print-only-count"><h2>INNOVPHIL PHYSICAL COUNT SHEET</h2><p>Branch: NAGA</p>
      <table class="count-sheet-table"><thead><tr><th>INNOV-ID</th><th>NAME</th><th>BRAND</th><th>CATEGORY</th><th>BRANCH</th><th>ISSUED TO</th><th>SYSTEM QTY</th><th>COUNTED QTY</th><th>VARIANCE</th><th>REMARKS</th></tr></thead>
      <tbody>${rows}</tbody></table></div></body></html>`;
    const page = await browser.newPage();
    await page.setContent(html);
    await page.emulateMedia({ media: 'print' });
    const f = `${label}.pdf`;
    await page.pdf({ path: f, format: 'A4', preferCSSPageSize: false, printBackground: true });
    out.push(label);
  }
  await browser.close();
})();
