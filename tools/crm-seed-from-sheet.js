// KINKAY CRM · sinh file seed SQL từ bản xuất CSV MỚI NHẤT của Sheet LIVE (QA 06/09 điểm 2: migration freshness)
//
// Dùng ngay TRƯỚC cutover, để không dựa vào snapshot 06/09 nếu Sheet đã đổi:
//   1. Google Sheet KINKAY_Lead_Tracker_LIVE_v2.0 → tab Leads → File → Download → CSV  → leads.csv
//   2. tab Partners → CSV → partners.csv
//   3. node tools/crm-seed-from-sheet.js leads.csv partners.csv > schema/crm-seed-YYYYMMDD.sql
//   4. Chạy file SQL đó vào D1 (D1 phải TRỐNG, hoặc xoá bằng: DELETE FROM lead_events; DELETE FROM leads; DELETE FROM partners;)
//   5. node tools/crm-reconcile.js leads.csv partners.csv <export-json-từ-CRM>  → 0 khác biệt thì mới bật CRM_CUTOVER=1
//
// Quy ước chuyển đổi giống hệt crm-seed-20260906.sql: ô trống → NULL; "1,500,000 ₫" → 1500000;
// "0 ₫" ở Actual Revenue → NULL + actual_verified=0; dd/mm/yyyy → yyyy-mm-dd; giữ nguyên ID, tên, note.
// Không bịa: cột không có trong Sheet → NULL.

const fs = require('fs');

function parseCSV(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c === '\r') { }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function toObjects(rows) {
  const head = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r.some(x => String(x).trim() !== '')).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] == null ? '' : String(r[i])).trim()])));
}
const nz = v => (v == null || v === '' ? null : v);
const money = v => { if (v == null || v === '') return null; const n = Number(String(v).replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? Math.round(n) : null; };
const date = v => { if (!v) return null; let m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`; m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return null; };
const lit = v => v == null ? 'NULL' : (typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");
const ts = d => (d ? d + 'T00:00:00Z' : new Date().toISOString());

const [leadsCsv, partnersCsv] = process.argv.slice(2);
if (!leadsCsv || !partnersCsv) { console.error('Dùng: node tools/crm-seed-from-sheet.js leads.csv partners.csv > schema/crm-seed-YYYYMMDD.sql'); process.exit(1); }
const leads = toObjects(parseCSV(fs.readFileSync(leadsCsv, 'utf8')));
const partners = toObjects(parseCSV(fs.readFileSync(partnersCsv, 'utf8')));
const stamp = new Date().toISOString();
const out = [];
out.push(`-- KINKAY CRM · SEED sinh tự động từ Sheet LIVE · ${stamp} · ${leads.length} leads · ${partners.length} partners`);
out.push(`-- Sinh bằng tools/crm-seed-from-sheet.js. Chạy 1 lần vào D1 trống, SAU schema/crm.sql.`);
const seenL = new Set(), seenP = new Set(); const warn = [];
for (const l of leads) {
  const id = l['Lead ID']; if (!id) { warn.push('Lead thiếu ID: ' + JSON.stringify(l)); continue; }
  if (seenL.has(id)) { warn.push('Lead ID trùng trong CSV: ' + id); continue; } seenL.add(id);
  const created = date(l['Created Date']) || date(l['Last Updated']);
  if (!created) { warn.push('Lead ' + id + ' không có Created Date hợp lệ → dùng hôm nay'); }
  const actual = money(l['Actual Revenue']);
  const partnerMatch = (l['Notes'] || '').match(/\bPT-\d{6}-\d{3}\b/);
  const vals = {
    id, created_date: created || new Date().toISOString().slice(0, 10), customer_name: l['Customer Name'] || '(không tên)', contact: nz(l['Contact']),
    contact_channel: nz(l['Contact Channel']), service: nz(l['Service']), event_date: date(l['Event Date']), source: nz(l['Source']),
    segment: nz(l['Segment']), status: l['Status'] || 'New', expected_revenue: money(l['Expected Revenue']), deposit: nz(l['Deposit']),
    actual_revenue: actual && actual > 0 ? actual : null, actual_verified: 0, owner: l['Owner'] || 'Kay',
    next_action: nz(l['Next Action']), next_followup: date(l['Next Follow-up']), notes: nz(l['Notes']),
    partner_id: nz(l['Partner ID']) || (partnerMatch ? partnerMatch[0] : null),
    last_updated: ts(date(l['Last Updated'])), updated_by: 'import', created_at: ts(created)
  };
  const cols = Object.keys(vals);
  out.push(`INSERT INTO leads (${cols.join(',')}) VALUES (${cols.map(c => lit(vals[c])).join(',')});`);
}
for (const p of partners) {
  const id = p['Partner ID']; if (!id) { warn.push('Partner thiếu ID: ' + JSON.stringify(p)); continue; }
  if (seenP.has(id)) { warn.push('Partner ID trùng trong CSV: ' + id); continue; } seenP.add(id);
  const created = date(p['Created Date']);
  const vals = {
    id, created_date: created || new Date().toISOString().slice(0, 10), name: p['Partner / Studio'] || p['Name'] || '(không tên)', type: nz(p['Type']),
    contact_channel: nz(p['Contact Channel']), contact: nz(p['Contact']), status: p['Status'] || 'New', last_touch: date(p['Last Touch']),
    opportunity: nz(p['Opportunity']), commercial_terms: nz(p['Commercial Terms']), referral_rate: 0.10,
    next_action: nz(p['Next Action']), next_followup: date(p['Next Follow-up']), notes: nz(p['Notes']), owner: p['Owner'] || 'Kay',
    last_updated: ts(date(p['Last Updated']) || date(p['Last Touch'])), updated_by: 'import', created_at: ts(created)
  };
  const cols = Object.keys(vals);
  out.push(`INSERT INTO partners (${cols.join(',')}) VALUES (${cols.map(c => lit(vals[c])).join(',')});`);
}
out.push(`INSERT INTO lead_events (entity, entity_id, ts, actor, field, old_value, new_value) SELECT 'lead', id, '${stamp}', 'import', 'create', NULL, 'Import từ Sheet LIVE ${stamp.slice(0, 10)}' FROM leads;`);
out.push(`INSERT INTO lead_events (entity, entity_id, ts, actor, field, old_value, new_value) SELECT 'partner', id, '${stamp}', 'import', 'create', NULL, 'Import từ Sheet LIVE ${stamp.slice(0, 10)}' FROM partners;`);
out.push(`INSERT OR REPLACE INTO meta(key, value) VALUES ('seed_source', 'KINKAY_Lead_Tracker_LIVE_v2.0 · CSV ${stamp} · ${seenL.size} leads · ${seenP.size} partners');`);
out.push(`INSERT OR REPLACE INTO meta(key, value) VALUES ('seed_applied_at', datetime('now'));`);
process.stdout.write(out.join('\n') + '\n');
if (warn.length) console.error('CẢNH BÁO:\n- ' + warn.join('\n- '));
console.error(`OK: ${seenL.size} leads, ${seenP.size} partners`);
