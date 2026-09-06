// KINKAY CRM · đối chiếu Sheet LIVE (CSV) với D1 (export JSON) TRƯỚC khi bật CRM_CUTOVER=1 (QA 06/09 điểm 2)
//
//   1. Sheet → tab Leads → CSV → leads.csv ; tab Partners → CSV → partners.csv
//   2. Mở https://kinkay.vn/api/crm/export?what=leads&format=json (đã đăng nhập ở /admin/crm/ thì dùng tab "Thêm" → tải)
//      hoặc: curl -H "Authorization: Bearer <token>" ... > crm-leads.json ; tương tự what=partners > crm-partners.json
//   3. node tools/crm-reconcile.js leads.csv partners.csv crm-leads.json crm-partners.json
//   Kết quả: đếm, tập ID (thiếu/thừa), và từng trường trọng yếu khác nhau. "0 khác biệt" mới được cutover.
//
// So sánh sau khi chuẩn hoá giống seed (tiền → số, ngày → ISO, trống → null, "0 ₫" actual → null).

const fs = require('fs');
const { parseCSV, toObjects, money, date, nz } = (() => {
  function parseCSV(text) {
    const rows = []; let row = []; let cell = ''; let q = false; text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) { const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c === '\r') { } else cell += c; }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); } return rows;
  }
  const toObjects = rows => { const head = rows[0].map(h => h.trim()); return rows.slice(1).filter(r => r.some(x => String(x).trim() !== '')).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] == null ? '' : String(r[i])).trim()]))); };
  const nz = v => (v == null || v === '' ? null : v);
  const money = v => { if (v == null || v === '') return null; const n = Number(String(v).replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? Math.round(n) : null; };
  const date = v => { if (!v) return null; let m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`; m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return null; };
  return { parseCSV, toObjects, money, date, nz };
})();

const [leadsCsv, partnersCsv, leadsJson, partnersJson] = process.argv.slice(2);
if (!leadsCsv || !partnersCsv || !leadsJson || !partnersJson) { console.error('Dùng: node tools/crm-reconcile.js leads.csv partners.csv crm-leads.json crm-partners.json'); process.exit(1); }
const loadJson = f => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return j.rows || j; };

const sheetLeads = toObjects(parseCSV(fs.readFileSync(leadsCsv, 'utf8')));
const sheetPartners = toObjects(parseCSV(fs.readFileSync(partnersCsv, 'utf8')));
const dbLeads = loadJson(leadsJson), dbPartners = loadJson(partnersJson);

const normLead = l => ({ status: nz(l['Status']), expected_revenue: money(l['Expected Revenue']), actual_revenue: (m => (m && m > 0 ? m : null))(money(l['Actual Revenue'])),
  next_followup: date(l['Next Follow-up']), event_date: date(l['Event Date']), customer_name: nz(l['Customer Name']), notes: nz(l['Notes']), deposit: nz(l['Deposit']), service: nz(l['Service']), source: nz(l['Source']) });
const normPartner = p => ({ status: nz(p['Status']), name: nz(p['Partner / Studio'] || p['Name']), next_followup: date(p['Next Follow-up']), last_touch: date(p['Last Touch']), commercial_terms: nz(p['Commercial Terms']), notes: nz(p['Notes']) });
const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o[k] == null || o[k] === '' ? null : o[k]]));

let diffs = 0;
function compare(label, sheetRows, idCol, norm, dbRows) {
  const S = new Map(sheetRows.map(r => [r[idCol], norm(r)]));
  const D = new Map(dbRows.map(r => [r.id, r]));
  console.log(`\n== ${label}: Sheet ${S.size} · D1 ${D.size}`);
  if (S.size !== D.size) { diffs++; console.log('  KHÁC SỐ LƯỢNG'); }
  for (const id of S.keys()) if (!D.has(id)) { diffs++; console.log('  THIẾU trong D1: ' + id); }
  for (const id of D.keys()) if (!S.has(id)) { diffs++; console.log('  THỪA trong D1 (không có ở Sheet): ' + id); }
  for (const [id, s] of S) {
    const d = D.get(id); if (!d) continue;
    const dd = pick(d, Object.keys(s));
    for (const k of Object.keys(s)) {
      if (String(s[k] ?? '') !== String(dd[k] ?? '')) { diffs++; console.log(`  ${id} · ${k}: Sheet=${JSON.stringify(s[k])} | D1=${JSON.stringify(dd[k])}`); }
    }
  }
}
compare('LEADS', sheetLeads, 'Lead ID', normLead, dbLeads);
compare('PARTNERS', sheetPartners, 'Partner ID', normPartner, dbPartners);
console.log(`\nTỔNG KHÁC BIỆT: ${diffs}` + (diffs ? '  → CHƯA được cutover. Sửa D1 (hoặc sinh lại seed) rồi chạy lại.' : '  → khớp. Có thể bật CRM_CUTOVER=1.'));
process.exit(diffs ? 2 : 0);
