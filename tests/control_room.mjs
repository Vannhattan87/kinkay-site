// Test /api/crm/control-room (MKT-DEC-20260916-01 §4 muc G). node tests/control_room.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequestGet } from '../functions/api/crm/control-room.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} — nhan ${JSON.stringify(a)}, can ${JSON.stringify(b)}`);

// --- D1 shim tren node:sqlite ---
function mkDb(sqlite) {
  return {
    prepare(sql) {
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async all() { return { results: sqlite.prepare(sql).all(...args) }; },
        async first() { return sqlite.prepare(sql).get(...args) ?? null; },
        async run() { return sqlite.prepare(sql).run(...args); }
      };
      return api;
    }
  };
}
const strip = s => s.split('\n').map(l => { const i = l.indexOf('--'); return i < 0 ? l : l.slice(0, i); }).join('\n');
function build(withM7) {
  const s = new DatabaseSync(':memory:');
  const run = f => { for (const st of strip(readFileSync(f, 'utf8')).split(';')) { const t = st.trim(); if (!t) continue; try { s.exec(t); } catch (e) { if (!/duplicate column/i.test(e.message)) throw e; } } };
  run('schema/crm.sql');
  s.exec('ALTER TABLE leads ADD COLUMN booking_json TEXT');
  run('schema/crm-migration-004-contact-key-media.sql');
  run('schema/crm-migration-006-look-share.sql');
  if (withM7) run('schema/crm-migration-007-marketing-fields.sql');
  return s;
}
const get = async db => { const r = await onRequestGet({ env: { CRM_DB: mkDb(db) } }); return { status: r.status, body: JSON.parse(await r.text()) }; };

const L = (id, o = {}) => ({ id, created_date: '2026-09-01', customer_name: id, status: 'New', last_updated: 't', created_at: '2026-09-01T00:00:00Z', ...o });
function seed(db, leads, events = []) {
  for (const l of leads) {
    const k = Object.keys(l);
    db.prepare(`INSERT INTO leads(${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).run(...k.map(x => l[x]));
  }
  for (const e of events) db.prepare("INSERT INTO lead_events(entity,entity_id,ts,actor,field,old_value,new_value) VALUES ('lead',?,?,'t',?,NULL,?)").run(e[0], e[1], e[2] || 'status', e[3]);
}

console.log('\n1. Chua chay migration 007 → 409 noi ro, khong phai 500');
{
  const { status, body } = await get(build(false));
  eq(status, 409, 'status');
  eq(body.code, 'migration_007_missing', 'code');
  ok(/nationality/.test(body.missing.join(',')), 'neu ten cot thieu');
}

console.log('2. NULL quoc tich khong bao gio thanh khach Viet');
{
  const db = build(true);
  seed(db, [
    L('KK-1', { nationality: 'Singapore', source: 'Website Form', service: 'Event/Gala Makeup', status: 'Completed' }),
    L('KK-2', { nationality: 'Viet Nam', source: 'Instagram Organic', service: 'Bridal Makeup' }),
    L('KK-3', { source: 'Instagram Organic', service: 'Bridal Makeup' }),
    L('KK-4', { source: 'Instagram Organic', service: 'Bridal Makeup' })
  ]);
  const { body } = await get(db);
  const v = body.lead_volume;
  eq([v.total, v.nationality_known, v.nationality_unknown, v.foreign_among_known], [4, 2, 2, 1], 'dem');
  eq(v.foreign_pct_of_known, 50, 'ti le tren phan DA BIET (1/2), khong phai 1/4');
  ok(v.foreign_pct_of_known !== 25, 'TUYET DOI khong lay tong lam mau so');
  eq(v.coverage, 'n=2/4', 'coverage');
  ok(!('foreign_pct' in v), 'khong duoc co mot con so foreign duy nhat tren tong');
}

console.log('3. Khong co quoc tich nao → tra null, khong tra 0%');
{
  const db = build(true);
  seed(db, [L('KK-1'), L('KK-2')]);
  const { body } = await get(db);
  eq(body.lead_volume.foreign_pct_of_known, null, 'null chu khong phai 0');
  ok(/Chưa lead nào/.test(body.lead_volume.note), 'noi thang la chua noi duoc gi');
}

console.log('4. 11 lead seed khong co nhat ky: van tinh la da chot, nhung bi loai khoi trung binh ngay');
{
  const db = build(true);
  seed(db, [
    L('KK-SEED', { status: 'Completed' }),                                  // nhap tu Sheet, 0 event
    L('KK-REAL', { status: 'Confirmed', created_at: '2026-09-01T00:00:00Z' })
  ], [['KK-REAL', '2026-09-04T00:00:00Z', 'status', 'Confirmed']]);
  const { body } = await get(db);
  eq([body.conversion.reached_confirmed, body.conversion.reached_completed], [2, 1], 'trang thai hien tai van tinh');
  const d = body.lead_to_booking_days;
  eq([d.n, d.of, d.excluded, d.avg_days], [1, 2, 1, 3], 'chi 1/2 lead co lich su');
  eq(d.coverage, 'n=1/2', 'in mau so');
  ok(d.avg_days === 3, 'lead seed KHONG duoc dem la 0 ngay (neu dem, trung binh se la 1.5)');
  ok(d.avg_days !== 1.5, 'khong duoc keo trung binh xuong bang 0');
}

console.log('5. Confirmed lan DAU, khong phai lan cuoi');
{
  const db = build(true);
  seed(db, [L('KK-1', { status: 'Confirmed', created_at: '2026-09-01T00:00:00Z' })], [
    ['KK-1', '2026-09-03T00:00:00Z', 'status', 'Confirmed'],
    ['KK-1', '2026-09-05T00:00:00Z', 'status', 'Hold'],
    ['KK-1', '2026-09-09T00:00:00Z', 'status', 'Confirmed']
  ]);
  const { body } = await get(db);
  eq(body.lead_to_booking_days.avg_days, 2, 'lay lan DAU (2 ngay), khong phai lan cuoi (8 ngay)');
}

console.log('6. Tien: ba nhom tach bach, khong fallback expected_revenue');
{
  const db = build(true);
  const bj = t => JSON.stringify({ line_items: [{ type: 'service', label: 'Makeup', qty: 1, unit_price: t, amount: t }] });
  seed(db, [
    L('KK-1', { status: 'Confirmed', booking_json: bj(1800000), expected_revenue: 9999999 }),
    L('KK-2', { status: 'Completed', booking_json: bj(2200000), actual_revenue: 2200000, actual_verified: 1 }),
    L('KK-3', { status: 'Confirmed', expected_revenue: 5000000 })   // da chot nhung CHUA co line items
  ]);
  const { body } = await get(db);
  const r = body.revenue;
  eq(r.agreed_open.value, 1800000, 'chi lay line items, KHONG lay expected_revenue 9.999.999');
  eq(r.agreed_open.n, 1, 'KK-3 khong co line items nen khong duoc tinh');
  eq(r.agreed_completed.value, 2200000, 'da xong viec');
  eq(r.verified_cash.value, 2200000, 'tien da xac minh la nhom RIENG');
  ok(r.warning && /1 job/.test(r.warning), 'phai canh bao 1 job da chot chua co bang gia');
  ok(r.agreed_open.value !== 9999999 && r.agreed_open.value !== 6800000, 'khong tron uoc tinh pipeline vao');
}

console.log('7. Source mix: moi kenh co mau so quoc tich RIENG');
{
  const db = build(true);
  seed(db, [
    L('KK-1', { source: 'Google Organic', nationality: 'UK', status: 'Completed' }),
    L('KK-2', { source: 'Google Organic' }),
    L('KK-3', { source: 'Instagram Organic', nationality: 'Viet Nam' })
  ]);
  const { body } = await get(db);
  // MKT-DEC-20260917-02 E6: nhan bao cao, khong phai chu trong DB
  const g = body.source_mix.find(s => s.key === 'Google Organic (Unclassified)');
  eq([g.leads, g.nat_known, g.foreign, g.foreign_pct_of_known], [2, 1, 1, 100], 'Google: 1/1 da biet la foreign');
  eq(g.nat_coverage, 'n=1/2', 'mau so cua rieng kenh nay');
  ok(g.foreign_pct_of_known !== 50, 'khong lay tong lead cua kenh lam mau so');
  const i = body.source_mix.find(s => s.key === 'Instagram');
  eq(i.foreign_pct_of_known, 0, 'IG: 0/1 foreign');
}

console.log('8. Lead khong co source/service → gom vao (trong), khong roi mat');
{
  const db = build(true);
  seed(db, [L('KK-1'), L('KK-2', { source: 'TikTok' })]);
  const { body } = await get(db);
  eq(body.source_mix.reduce((a, b) => a + b.leads, 0), 2, 'tong khop');
  ok(body.source_mix.some(s => s.key === 'Other (legacy)'), 'source rong gom vao Other (legacy), KHONG bien thanh Direct/Unknown');
  ok(!body.source_mix.some(s => s.key === 'Direct/Unknown'), 'chua tung ghi nguon != khach tu tim den');
}

console.log('9. Database rong khong vo');
{
  const { status, body } = await get(build(true));
  eq(status, 200, 'van 200');
  eq([body.lead_volume.total, body.conversion.lead_to_confirmed_pct, body.lead_to_booking_days.avg_days], [0, null, null], 'tra null chu khong chia cho 0');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
