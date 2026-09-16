// node tests/crm_migration_guard.mjs
// CR-20260916-37 — chặn bẫy "code lên trước migration".
//
// Bẫy này sập hai lần trong ngày 16/09. Bộ test tồn tại để nó không sập lần thứ ba mà
// vẫn im lặng: thiếu migration thì PHẢI nói ra thiếu số mấy, không được ném lỗi cú pháp.
import assert from 'node:assert/strict';

const mod = p => import(new URL(p, import.meta.url).href);
const lib = await mod('../functions/api/crm/_lib.js');
const mw  = await mod('../functions/api/crm/_middleware.js');
const hl  = await mod('../functions/api/crm/health.js');

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
};
const J = async r => JSON.parse(await r.text());

console.log('\nNHAN DIEN LOI THIEU MIGRATION');

await t('Loi that cua D1 -> chi dung so migration', () => {
  const g = lib.migrationGapError(new Error('D1_ERROR: no such column: look_json: SQLITE_ERROR'));
  assert.equal(g.kind, 'column');
  assert.equal(g.name, 'look_json');
  assert.equal(g.migration, '006');
  assert.match(g.message, /migration 006/);
});

await t('Cot co tien to bang van nhan dung', () => {
  assert.equal(lib.migrationGapError(new Error('no such column: leads.share_token')).migration, '006');
  assert.equal(lib.migrationGapError(new Error('no such column: superseded_by_id')).migration, '005');
  assert.equal(lib.migrationGapError(new Error('no such column: contact_key')).migration, '004');
});

await t('Thieu BANG cung nhan ra', () => {
  const g = lib.migrationGapError(new Error('D1_ERROR: no such table: booking_confirmations'));
  assert.equal(g.kind, 'table');
  assert.equal(g.migration, '002');
});

await t('Cot la thi van bao thieu migration, khong vo nghia', () => {
  const g = lib.migrationGapError(new Error('no such column: cot_tuong_lai'));
  assert.equal(g.migration, null);
  assert.match(g.message, /migration chưa chạy/);
});

await t('LOI KHAC tra null — khong nuot loi that', () => {
  for (const m of ['UNIQUE constraint failed', 'network error', 'Cannot read properties of undefined', '']) {
    assert.equal(lib.migrationGapError(new Error(m)), null, 'khong duoc nhan nham: ' + m);
  }
  assert.equal(lib.migrationGapError(null), null);
});

console.log('\nCONG /api/crm/* DICH LOI');

const envDev = { CRM_DB: {}, CRM_DEV_USER: 'Kay', CRM_CUTOVER: '1' };
const ctx = (next) => ({ request: new Request('https://kinkay.vn/api/crm/x'), env: envDev, next, data: {} });

await t('Thieu cot -> 503 doc duoc, kem ma migration_missing', async () => {
  const r = await mw.onRequest(ctx(async () => { throw new Error('D1_ERROR: no such column: look_json: SQLITE_ERROR'); }));
  assert.equal(r.status, 503);
  const j = await J(r);
  assert.match(j.error, /migration 006/);
  assert.equal(j.detail, 'migration_missing:006');
  // Khong con la "Unexpected token '<'" nua — do la ca diem cua viec nay.
  assert.ok(!/Unexpected token/.test(j.error));
});

await t('Loi KHAC van nem nguyen, khong bi che thanh loi migration', async () => {
  let nem = null;
  try { await mw.onRequest(ctx(async () => { throw new Error('UNIQUE constraint failed: leads.id'); })); }
  catch (e) { nem = e.message; }
  assert.match(String(nem), /UNIQUE constraint/);
});

await t('Khong loi thi di qua binh thuong', async () => {
  const r = await mw.onRequest(ctx(async () => new Response('{"ok":true}', { status: 200 })));
  assert.equal(r.status, 200);
});

console.log('\n/api/crm/health');

function dbCo(cot) {
  return { prepare(sql) { return { bind() { return this; },
    async first() { return /schema_version/.test(sql) ? { value: '1.5' } : null; },
    async all() {
      const m = /PRAGMA table_info\((\w+)\)/.exec(sql);
      if (m) { if (!cot[m[1]]) throw new Error('no such table: ' + m[1]);
               return { results: cot[m[1]].map(n => ({ name: n })) }; }
      return { results: [] };
    } }; } };
}
const DU = {
  leads: ['booking_json', 'media_json', 'contact_key', 'look_json', 'share_token'],
  booking_confirmations: ['status', 'superseded_at', 'superseded_by_id', 'superseded_reason', 'status_set_by']
};

await t('Du cot -> khop = true', async () => {
  const j = await J(await hl.onRequestGet({ env: { CRM_DB: dbCo(DU), CRM_MEDIA: {} } }));
  assert.equal(j.khop, true);
  assert.deepEqual(j.thieu, []);
  assert.equal(j.kho_anh, 'đã gắn');
});

await t('Thieu cot cua 006 -> chi dung so, cau chu doc duoc', async () => {
  const thieu = { leads: ['booking_json', 'media_json', 'contact_key'], booking_confirmations: DU.booking_confirmations };
  const j = await J(await hl.onRequestGet({ env: { CRM_DB: dbCo(thieu) } }));
  assert.equal(j.khop, false);
  assert.deepEqual(j.migration_can_chay, ['006']);
  assert.equal(j.thieu.length, 2);
  assert.match(j.thong_bao, /migration 006/);
  assert.match(j.thong_bao, /D1 Console|Console/);
  assert.match(j.kho_anh, /CHƯA gắn/);
});

await t('Thieu ca 005 va 006 -> liet ke du, sap xep', async () => {
  const j = await J(await hl.onRequestGet({ env: { CRM_DB: dbCo({ leads: ['booking_json'], booking_confirmations: ['status'] }), CRM_MEDIA: {} } }));
  assert.deepEqual(j.migration_can_chay, ['004', '005', '006']);
});

console.log('\n' + pass + ' pass, ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
