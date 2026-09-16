// Test migration 007 + số suy ra (MKT-DEC-20260916-01). Chạy: node tests/marketing_007.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { isForeign, nationalityStats, statusTimestamps, leadToBookingDays, withCoverage, LEAD_FIELDS } from '../functions/api/crm/_lib.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} — nhan ${JSON.stringify(a)}, can ${JSON.stringify(b)}`);

const db = new DatabaseSync(':memory:');
// Bo chu thich TRUOC khi tach cau lenh. Bay that gap o crm.sql: chu thich cuoi dong co chua
// dau ';' ("VND da nhan; NULL = chua xac minh") nen tach trong khi con chu thich la vo cau lenh.
const strip = src => src.split('\n').map(l => {
  const i = l.indexOf('--');
  return i < 0 ? l : l.slice(0, i);
}).join('\n');
const run = f => {
  for (const st of strip(readFileSync(f, 'utf8')).split(';')) {
    const s = st.trim(); if (!s) continue;
    try { db.exec(s); }
    catch (e) { if (!/duplicate column/i.test(e.message)) throw new Error(f + ': ' + e.message + ' :: ' + s.slice(0, 80)); }
  }
};

run('schema/crm.sql');
db.exec("ALTER TABLE leads ADD COLUMN booking_json TEXT");
run('schema/crm-migration-004-contact-key-media.sql');
run('schema/crm-migration-006-look-share.sql');
run('schema/crm-migration-007-marketing-fields.sql');

console.log('\n1. Schema');
const cols = db.prepare("PRAGMA table_info(leads)").all().map(c => c.name);
for (const c of ['nationality', 'source_detail', 'lost_reason']) ok(cols.includes(c), `thieu cot ${c}`);
for (const c of ['foreign_lead', 'foreign_booking', 'confirmed_at', 'completed_at'])
  ok(!cols.includes(c), `cot ${c} KHONG duoc ton tai — Luna §4 muc C cam luu derived state`);
eq(db.prepare("SELECT value v FROM meta WHERE key='schema_version'").get().v, '1.6', 'schema_version');
const nn = db.prepare("PRAGMA table_info(leads)").all().filter(c => ['nationality','source_detail','lost_reason'].includes(c.name));
ok(nn.every(c => c.notnull === 0), 'ba cot moi phai nullable');
for (const f of ['nationality', 'source_detail', 'lost_reason']) ok(LEAD_FIELDS.includes(f), `LEAD_FIELDS thieu ${f}`);

console.log('2. Chay lai migration khong vo, du lieu cu khong bi ghi de');
db.exec("INSERT INTO leads(id,created_date,customer_name,status,last_updated,created_at,expected_revenue) VALUES ('KK-1','2026-09-01','Cu',	'Completed','t','2026-09-01T00:00:00Z',1800000)");
run('schema/crm-migration-007-marketing-fields.sql');
const old = db.prepare("SELECT * FROM leads WHERE id='KK-1'").get();
eq([old.customer_name, old.expected_revenue, old.nationality], ['Cu', 1800000, null], 'dong cu phai nguyen ven, 3 cot moi = NULL');

console.log('3. isForeign — ba gia tri, NULL khong bao gio thanh khach Viet');
eq(isForeign('Singapore'), true, 'Singapore');
eq(isForeign('Việt Nam'), false, 'Viet Nam co dau');
eq(isForeign('vietnamese'), false, 'vietnamese');
eq(isForeign(null), null, 'NULL = chua biet');
eq(isForeign('   '), null, 'rong = chua biet');
ok(isForeign(null) !== false, 'NULL TUYET DOI khong duoc bang false');

console.log('4. nationalityStats — khong bao mot ti le foreign duy nhat tren tong');
const s = nationalityStats([{nationality:'Singapore'},{nationality:'UK'},{nationality:'Viet Nam'},{nationality:null},{nationality:null}]);
eq([s.total, s.known, s.unknown, s.foreign_among_known], [5, 3, 2, 2], 'dem');
eq(s.foreign_pct_of_known, 2/3, 'ti le tinh tren KNOWN chu khong tren tong');
ok(s.foreign_pct_of_known !== 2/5, 'khong duoc lay tong lam mau so');
eq(s.coverage_label, 'n=3/5', 'nhan coverage');
eq(nationalityStats([]).foreign_pct_of_known, null, 'khong co du lieu thi tra null, khong phai 0');
eq(nationalityStats([{nationality:null},{nationality:null}]).foreign_pct_of_known, null, 'coverage 0 thi tra null');

console.log('5. statusTimestamps — Confirmed lan DAU, Completed lan CUOI');
const ev = [
  {field:'status', ts:'2026-09-10T00:00:00Z', new_value:'Confirmed'},
  {field:'status', ts:'2026-09-11T00:00:00Z', new_value:'Hold'},
  {field:'status', ts:'2026-09-12T00:00:00Z', new_value:'Confirmed'},
  {field:'status', ts:'2026-09-13T00:00:00Z', new_value:'Completed'},
  {field:'status', ts:'2026-09-14T00:00:00Z', new_value:'Completed'}
];
const t = statusTimestamps([...ev].reverse());
eq(t.confirmed_at, '2026-09-10T00:00:00Z', 'confirmed_at = lan DAU');
eq(t.completed_at, '2026-09-14T00:00:00Z', 'completed_at = lan CUOI');
eq(statusTimestamps([{field:'create', ts:'2026-09-01T00:00:00Z', new_value:'Confirmed'}]).confirmed_at, '2026-09-01T00:00:00Z', 'lead tao thang o Confirmed');
eq(statusTimestamps([{field:'notes', ts:'2026-09-01T00:00:00Z', new_value:'Confirmed'}]).confirmed_at, null, 'doi ghi chu chua chu Confirmed KHONG tinh');

console.log('6. 11 lead seed 06/09 khong co event → NULL, khong phai 0 ngay');
eq(statusTimestamps([]), {confirmed_at:null, completed_at:null}, 'khong event');
eq(leadToBookingDays({created_at:'2026-09-01T00:00:00Z'}, []), null, 'lead seed tra NULL');
eq(leadToBookingDays({created_at:'2026-09-01T00:00:00Z'}, [{field:'status',ts:'2026-09-04T00:00:00Z',new_value:'Confirmed'}]), 3, '3 ngay');

console.log('7. withCoverage — luon in mau so');
const c = withCoverage([3, 5, null, null, 7], 5);
eq([c.n, c.of, c.excluded, c.avg, c.label], [3, 5, 2, 5, 'n=3/5'], 'coverage');
ok(c.avg === 5 && c.avg !== 3, 'trung binh chi tren 3 gia tri co that, khong chia cho 5');
eq(withCoverage([], 17).avg, null, 'khong co gia tri thi null chu khong phai 0');

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
