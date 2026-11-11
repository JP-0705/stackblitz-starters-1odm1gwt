// Fills in the company's OWN form PDFs (forms/templates/*.pdf) with the data saved in the
// system. The forms are not recreated — the original PDF is kept exactly as it is and the
// typed information is written onto it.
//
// All positions below are in PDF points measured from the TOP-LEFT of a Letter page
// (612 x 792). If the company ever changes a form, replace the PDF in forms/templates/
// and adjust the numbers for that form here.
//
// Needs the pdf-lib script (loaded in forms/index.html).

const FORM_PDF_FILES = {
  ISSUANCE: '/forms/templates/asset-issuance-form.pdf',
  TURNOVER: '/forms/templates/asset-turnover-form.pdf',
  BORROWER: '/forms/templates/borrowers-form.pdf',
};

const PDF_PAGE_HEIGHT = 792;
const PDF_BOX_W = 5.7;
const PDF_BOX_H = 8.7;

// Each asset row on the form: [top, bottom]
const ISSUANCE_ROWS = [[275, 285], [285, 295], [295, 304], [304, 313], [313, 323], [323, 332], [332, 341], [341, 351], [351, 360], [360, 369], [369, 379], [379, 388], [388, 397]];
const TURNOVER_ROWS = [[262.4, 274], [274, 285.4], [285.4, 297], [297, 308.4], [308.4, 320], [320, 331.4], [331.4, 343], [343, 358], [358, 372], [372, 387], [387, 401], [401, 416]];
const BORROWER_ROWS = [349, 362, 375, 388, 401, 414, 427, 440].map((t) => [t, t + 12.5]);

// Positions of the reason checkboxes, in the same order as FORM_TYPES[..].reasons followed by "Others".
const ISSUANCE_REASON_BOXES = [
  [65, 424.5], [171.5, 424.5], [251.4, 420.6], [331.3, 420.6], [411.2, 420.6], [497.9, 420.6],
  [65, 441.4], [171.5, 437.6], [251.4, 437.6], [331.3, 437.6], [411.2, 437.6], [497.9, 437.6],
  [65, 458.8], [171.5, 458.8], [251.4, 458.8],
];
const TURNOVER_REASON_BOXES = [
  [65, 445.7], [131.5, 445.7], [211.6, 445.7], [311.4, 441.9], [394.8, 441.9], [479.4, 445.7],
  [65, 462.6], [131.5, 462.6], [211.6, 462.6], [311.4, 462.6], [394.8, 458.8], [479.4, 458.8],
  [65, 475.7], [131.5, 475.7], [211.6, 479.7],
];

const FORM_PDF_LAYOUT = {
  ISSUANCE: {
    control: { cover: [443.4, 139.5, 104, 12], base: 149 },
    name: { x: 65, base: 206, w: 152 },
    designation: { x: 229, base: 206, w: 152 },
    department: { x: 393, base: 206, w: 152 },
    employeeId: { x: 65, base: 230.5, w: 152 },
    date: { x: 229, base: 230.5, w: 152 },
    byBoxes: { PROPERTY: [392.5, 222.9], MIS: [463.6, 222.9] },
    rows: ISSUANCE_ROWS,
    cols: [
      { key: 'particulars', x: 64, w: 154 },
      { key: 'qty', x: 221, w: 30, center: true },
      { key: 'serial', x: 257, w: 126 },
      { key: 'tag', x: 391, w: 66 },
      { key: 'condition', x: 464, w: 84 },
    ],
    reasonBoxes: ISSUANCE_REASON_BOXES,
    reasonOther: { x: 331, base: 466.5, w: 208 },
    findings: { mis: { x: 176, top: 483, bottom: 508, w: 370 }, property: { x: 176, top: 508, bottom: 533, w: 370 } },
  },
  TURNOVER: {
    control: { cover: [462.2, 120.5, 86, 10.5], base: 128.5 },
    name: { x: 65, base: 190, w: 152 },
    designation: { x: 229, base: 190, w: 152 },
    department: { x: 393, base: 190, w: 152 },
    employeeId: { x: 65, base: 214, w: 152, cover: [61, 205.5, 160, 12] }, // the form has "IPHL-00-000" printed here
    date: { x: 229, base: 214, w: 152 },
    byText: { x: 393, base: 214, w: 152 },
    rows: TURNOVER_ROWS,
    cols: [
      { key: 'particulars', x: 64, w: 152 },
      { key: 'qty', x: 222, w: 24, center: true },
      { key: 'serial', x: 251, w: 95 },
      { key: 'tag', x: 354, w: 76 },
      { key: 'condition', x: 439, w: 108 },
    ],
    reasonBoxes: TURNOVER_REASON_BOXES,
    reasonOther: { x: 290, base: 487, w: 250 },
    findings: { mis: { x: 176, top: 507, bottom: 532, w: 370 }, property: { x: 176, top: 532, bottom: 558, w: 370 } },
  },
  BORROWER: {
    control: { cover: [443.4, 161.5, 104, 12], base: 171 },
    name: { x: 66.6, base: 241, w: 136 },
    designation: { x: 212.4, base: 241, w: 138 },
    department: { x: 359, base: 241, w: 186 },
    employeeId: { x: 66.6, base: 265, w: 136 },
    dateBorrowed: { x: 212.4, base: 265, w: 138 },
    dateReturned: { x: 359, base: 265, w: 186 },
    usageBoxes: { INTERNAL: [115, 281.2, 8.4, 8.5], EXTERNAL: [174.5, 281.2, 8.4, 8.5] },
    purpose: { x: 212.4, base: 288.5, w: 330 },
    rows: BORROWER_ROWS,
    cols: [
      { key: 'tag', x: 64, w: 78 },
      { key: 'particulars', x: 150, w: 152 },
      { key: 'serial', x: 309, w: 148 },
      { key: 'condition', x: 464, w: 82 },
    ],
  },
};

// Turns any text into something the PDF's standard font can print.
function pdfSafeText(font, value) {
  const text = String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ');
  let out = '';
  for (const ch of text) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch (e) {
      out += '?';
    }
  }
  return out;
}

async function buildFilledFormPdf(row) {
  const lib = window.PDFLib;
  if (!lib) throw new Error('pdf-lib is not loaded');
  const layout = FORM_PDF_LAYOUT[row.form_type];
  const file = FORM_PDF_FILES[row.form_type];
  if (!layout || !file) throw new Error('Unknown form type');

  const response = await fetch(file, { cache: 'no-cache' });
  if (!response.ok) throw new Error('Could not load the form file (' + response.status + ')');
  const pdf = await lib.PDFDocument.load(await response.arrayBuffer());
  const page = pdf.getPages()[0];
  const font = await pdf.embedFont(lib.StandardFonts.Helvetica);
  const bold = await pdf.embedFont(lib.StandardFonts.HelveticaBold);
  const ink = lib.rgb(0.05, 0.05, 0.35);
  const white = lib.rgb(1, 1, 1);
  const toY = (top) => PDF_PAGE_HEIGHT - top;

  // Writes one line of text, shrinking it until it fits the width.
  function text(value, x, base, width, size, useBold, center) {
    const f = useBold ? bold : font;
    const s = pdfSafeText(f, value);
    if (!s) return;
    let fs = size || 9;
    while (fs > 5.5 && f.widthOfTextAtSize(s, fs) > width) fs -= 0.25;
    let drawn = s;
    while (drawn.length > 1 && f.widthOfTextAtSize(drawn, fs) > width) drawn = drawn.slice(0, -1);
    const dx = center ? x + (width - f.widthOfTextAtSize(drawn, fs)) / 2 : x;
    page.drawText(drawn, { x: dx, y: toY(base), size: fs, font: f, color: ink });
  }

  // Writes text over several lines inside a box.
  function paragraph(value, box) {
    const s = pdfSafeText(font, value);
    if (!s) return;
    const size = 8;
    const maxLines = Math.max(1, Math.floor((box.bottom - box.top - 2) / 9.5));
    const words = s.split(' ');
    const lines = [];
    let line = '';
    words.forEach((w) => {
      const test = line ? line + ' ' + w : w;
      if (font.widthOfTextAtSize(test, size) <= box.w) line = test;
      else {
        if (line) lines.push(line);
        line = w;
      }
    });
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((l, i) => page.drawText(l, { x: box.x, y: toY(box.top + 9.5 + i * 9.5), size, font, color: ink }));
  }

  // A clear X drawn in the middle of a printed checkbox.
  function cross(left, top, w, h) {
    const cx = left + w / 2;
    const cy = toY(top + h * 0.55);
    const r = 3;
    const opts = { thickness: 1.3, color: ink };
    page.drawLine({ start: { x: cx - r, y: cy - r }, end: { x: cx + r, y: cy + r }, ...opts });
    page.drawLine({ start: { x: cx - r, y: cy + r }, end: { x: cx + r, y: cy - r }, ...opts });
  }
  const checkBox = (pos, w, h) => cross(pos[0], pos[1], w || PDF_BOX_W, h || PDF_BOX_H);

  const dateText = (iso) => (iso ? fmDate(iso) : '');

  // Control number (replaces the blank "2026004-IPHL_____-_____").
  const c = layout.control;
  page.drawRectangle({ x: c.cover[0], y: toY(c.cover[1] + c.cover[3]), width: c.cover[2], height: c.cover[3], color: white });
  text(row.control_no, c.cover[0] + 1, c.base, c.cover[2] - 2, 9, true);

  // Information block
  const f = (spec, value, size) => text(value, spec.x, spec.base, spec.w, size || 9);
  f(layout.name, row.employee_name);
  f(layout.designation, row.designation);
  f(layout.department, row.department);
  if (layout.employeeId.cover) {
    const cv = layout.employeeId.cover;
    page.drawRectangle({ x: cv[0], y: toY(cv[1] + cv[3]), width: cv[2], height: cv[3], color: white });
  }
  f(layout.employeeId, row.employee_id);

  if (row.form_type === 'ISSUANCE') {
    f(layout.date, dateText(row.form_date));
    if (layout.byBoxes[row.by_party]) checkBox(layout.byBoxes[row.by_party]);
  } else if (row.form_type === 'TURNOVER') {
    f(layout.date, dateText(row.form_date));
    f(layout.byText, row.by_party);
  } else {
    // Date Borrowed, with the expected return date added next to it (the form has no box for it).
    const borrowed = dateText(row.form_date);
    const expected = row.expected_return_date ? ' (return by ' + dateText(row.expected_return_date) + ')' : '';
    text(borrowed + expected, layout.dateBorrowed.x, layout.dateBorrowed.base, layout.dateBorrowed.w, 8.5);
    f(layout.dateReturned, dateText(row.date_returned));
    if (layout.usageBoxes[row.usage_type]) {
      const b = layout.usageBoxes[row.usage_type];
      cross(b[0], b[1], b[2], b[3]);
    }
    f(layout.purpose, row.purpose);
  }

  // Asset lines
  const lines = asArray(row.assets).slice(0, layout.rows.length);
  lines.forEach((line, i) => {
    const [top, bottom] = layout.rows[i];
    const base = top + (bottom - top) / 2 + 2.8;
    layout.cols.forEach((col) => {
      const value = col.key === 'qty' ? (line.qty == null ? '' : String(line.qty)) : line[col.key];
      text(value, col.x, base, col.w, 8, false, col.center);
    });
  });

  // Reasons and findings (issuance / turnover)
  if (layout.reasonBoxes) {
    const reasons = asArray(row.reasons);
    const names = FORM_TYPES[row.form_type].reasons.concat(['Others']);
    names.forEach((name, i) => {
      if (reasons.includes(name) && layout.reasonBoxes[i]) checkBox(layout.reasonBoxes[i]);
    });
    if (reasons.includes('Others') && row.reason_other) f(layout.reasonOther, row.reason_other, 8);
    paragraph(row.mis_findings, layout.findings.mis);
    paragraph(row.property_findings, layout.findings.property);
  }

  return pdf.save();
}

// Opens the filled-in form in a new tab, ready to print.
// The tab is opened right away (inside the click) so the browser does not block it.
async function openFilledFormPdf(row) {
  const tab = window.open('', '_blank');
  try {
    const bytes = await buildFilledFormPdf(row);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    if (tab) {
      tab.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = (row.control_no || 'form') + '.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    return true;
  } catch (err) {
    console.error('Form PDF error:', err);
    if (tab) tab.close();
    return false;
  }
}
