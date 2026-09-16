// node tests/crm_job_detail.mjs
// CR-20260916-34 — chi tiết buổi làm + ảnh chụp tại chỗ.
// Chạy không cần wrangler: giả lập D1 và R2 vừa đủ cho các đường đang test.
import assert from 'node:assert/strict';

const mod = p => import(new URL(p, import.meta.url).href);
const booking = await mod('../functions/api/crm/leads/[id]/booking.js');
const photo   = await mod('../functions/api/crm/leads/[id]/photo.js');
const media   = await mod('../functions/api/crm/leads/[id]/media.js');
const serve   = await mod('../functions/api/crm/media/[[path]].js');

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
};

// ── D1 giả: chỉ hiểu đúng các câu lệnh mà 3 file trên phát ra ──────────────
function makeDb(lead) {
  const events = [];
  const db = {
    lead, events,
    prepare(sql) {
      let args = [];
      const st = {
        bind(...a) { args = a; return st; },
        async first() {
          if (/FROM leads/.test(sql)) return db.lead ? { ...db.lead } : null;
          if (/COALESCE\(MAX\(version\)/.test(sql)) return { v: 1 };
          return null;
        },
        async all() { return { results: [] }; },
        async run() {
          if (/UPDATE leads SET/.test(sql)) {
            const cols = sql.match(/SET (.+?) WHERE/)[1].split(',').map(x => x.trim().split(' ')[0]);
            cols.forEach((c, i) => { db.lead[c] = args[i]; });
          }
          if (/INSERT INTO lead_events/.test(sql)) events.push({ field: args[4], old: args[5], neu: args[6] });
          return { success: true };
        },
        _sql: sql, _args: () => args
      };
      return st;
    },
    async batch(stmts) { for (const s of stmts) await s.run(); return []; }
  };
  return db;
}
function makeR2() {
  const store = new Map();
  return {
    store,
    async put(k, v, o) { store.set(k, { v, o }); },
    async get(k) {
      if (!store.has(k)) return null;
      return { body: 'BODY', httpEtag: '"x"', writeHttpMetadata(h) { h.set('content-type', 'image/jpeg'); } };
    },
    async delete(k) { store.delete(k); }
  };
}
const LEAD = () => ({
  id: 'KK-260914-005', customer_name: 'Geia Lopez', status: 'Confirmed',
  service: 'Event/Gala Makeup', event_date: '2026-09-16',
  expected_revenue: 1800000, actual_revenue: null, booking_json: null, media_json: null
});
const req = (body, init = {}) => new Request('https://kinkay.vn/api/crm/x', {
  method: init.method || 'POST',
  headers: init.headers || { 'content-type': 'application/json' },
  body: body === undefined ? undefined : (typeof body === 'string' || body instanceof ArrayBuffer ? body : JSON.stringify(body))
});
const J = async r => JSON.parse(await r.text());

console.log('\nCHI TIET BUOI LAM (/booking)');

await t('PATCH ghi duoc gio + dia diem khi booking con trong', async () => {
  const db = makeDb(LEAD());
  const r = await booking.onRequestPatch({
    params: { id: 'KK-260914-005' }, env: { CRM_DB: db }, data: { user: 'Vannhattan87' },
    request: req({ booking: { ready_time: '11:00', venue: 'The Myst Dong Khoi' } })
  });
  const j = await J(r);
  assert.equal(r.status || 200, 200);
  assert.equal(j.booking.ready_time, '11:00');
  assert.equal(j.booking.venue, 'The Myst Dong Khoi');
  // con thieu bang gia + coc -> phai noi ra, khong duoc im
  assert.ok(j.booking_missing.includes('line_items'), 'phai bao thieu line_items');
  assert.ok(j.booking_missing.includes('deposit_mode'), 'phai bao thieu deposit_mode');
  assert.equal(j.booking_total, null);
});

await t('PATCH KHONG dung toi expected_revenue', async () => {
  const db = makeDb(LEAD());
  await booking.onRequestPatch({
    params: { id: 'KK-260914-005' }, env: { CRM_DB: db }, data: { user: 'Kay' },
    request: req({ booking: { line_items: [{ type: 'service', label: 'Event', qty: 2, unit_price: 1250000 }] } })
  });
  // uoc tinh pipeline (1.8tr) khong duoc chay theo so da chot (2.5tr). Day la gia tri cua CR-33.
  assert.equal(db.lead.expected_revenue, 1800000);
  const b = JSON.parse(db.lead.booking_json);
  assert.equal(b.line_items[0].amount, 2500000);
});

await t('Bang gia sai (thieu don gia) bi tra 400, khong ghi nua voi', async () => {
  const db = makeDb(LEAD());
  const r = await booking.onRequestPatch({
    params: { id: 'KK-260914-005' }, env: { CRM_DB: db }, data: { user: 'Kay' },
    request: req({ booking: { line_items: [{ type: 'service', label: 'Event', qty: 2 }] } })
  });
  assert.equal(r.status, 400);
  assert.equal(db.lead.booking_json, null, 'khong duoc ghi gi khi du lieu sai');
});

await t('Nhat ky ghi ten nguoi doc duoc, khong nhet nguyen JSON', async () => {
  const db = makeDb(LEAD());
  await booking.onRequestPatch({
    params: { id: 'KK-260914-005' }, env: { CRM_DB: db }, data: { user: 'Kay' },
    request: req({ booking: { venue: 'An Lam', line_items: [{ type: 'service', label: 'Bridal', qty: 1, unit_price: 3000000 }] } })
  });
  const f = db.events.map(e => e.field);
  assert.ok(f.includes('booking.venue'));
  assert.ok(f.includes('booking.line_items'));
  const li = db.events.find(e => e.field === 'booking.line_items');
  assert.equal(li.neu, '1 dòng · 3000000', 'phai la tom tat, khong phai mang JSON');
});

await t('GET tra ve du booking + tong + pax', async () => {
  const lead = LEAD();
  lead.booking_json = JSON.stringify({
    ready_time: '11:00', venue: 'The Myst',
    line_items: [{ type: 'service', label: 'Event', qty: 2, unit_price: 900000, amount: 1800000 }]
  });
  const r = await booking.onRequestGet({ params: { id: lead.id }, env: { CRM_DB: makeDb(lead) } });
  const j = await J(r);
  assert.equal(j.booking_total, 1800000);
  assert.equal(j.booking_pax, 2);
});

console.log('\nANH CHUP TAI CHO (/photo, /media)');

await t('Chua gan R2 -> 503 noi ro phai lam gi, khong 500 HTML', async () => {
  const r = await photo.onRequestPost({
    params: { id: 'KK-260914-005' }, env: { CRM_DB: makeDb(LEAD()) }, data: { user: 'Kay' },
    request: req(new ArrayBuffer(2000), { headers: { 'content-type': 'image/jpeg' } })
  });
  assert.equal(r.status, 503);
  const j = await J(r);
  assert.ok(/CRM_MEDIA/.test(j.error), 'loi phai chi ten binding');
});

await t('File khong phai anh -> 415', async () => {
  const r = await photo.onRequestPost({
    params: { id: 'KK-260914-005' }, env: { CRM_DB: makeDb(LEAD()), CRM_MEDIA: makeR2() }, data: { user: 'Kay' },
    request: req('xxx', { headers: { 'content-type': 'application/pdf' } })
  });
  assert.equal(r.status, 415);
});

await t('Upload anh -> vao R2, vao media_json, marketing_ok TAT', async () => {
  const db = makeDb(LEAD()); const r2 = makeR2();
  const r = await photo.onRequestPost({
    params: { id: 'KK-260914-005' }, env: { CRM_DB: db, CRM_MEDIA: r2 }, data: { user: 'Kay' },
    request: req(new ArrayBuffer(50000), { headers: { 'content-type': 'image/jpeg' } })
  });
  assert.equal(r.status, 201);
  const j = await J(r);
  const it = j.added;
  assert.equal(it.kind, 'photo');
  assert.equal(it.marketing_ok, false, 'chup duoc KHONG co nghia duoc dang');
  assert.ok(it.key.startsWith('jobs/KK-260914-005/'), 'key phai co id job o dau: ' + it.key);
  assert.equal(it.url, '/api/crm/media/' + it.key);
  assert.equal(r2.store.size, 1);
  assert.equal(JSON.parse(db.lead.media_json).length, 1);
});

await t('Xoa anh -> xoa CA file trong R2', async () => {
  const db = makeDb(LEAD()); const r2 = makeR2();
  await photo.onRequestPost({
    params: { id: 'KK-260914-005' }, env: { CRM_DB: db, CRM_MEDIA: r2 }, data: { user: 'Kay' },
    request: req(new ArrayBuffer(50000), { headers: { 'content-type': 'image/jpeg' } })
  });
  const url = JSON.parse(db.lead.media_json)[0].url;
  const r = await media.onRequestDelete({
    params: { id: 'KK-260914-005' }, env: { CRM_DB: db, CRM_MEDIA: r2 }, data: { user: 'Kay' },
    request: req({ url }, { method: 'DELETE' })
  });
  const j = await J(r);
  assert.equal(j.media.length, 0);
  assert.equal(r2.store.size, 0, 'file phai bi xoa khoi kho, khong de lai anh vo chu');
});

await t('Xoa link Drive -> KHONG dung toi R2', async () => {
  const lead = LEAD();
  lead.media_json = JSON.stringify([{ url: 'https://drive.google.com/drive/folders/abc', kind: 'album', label: 'Album' }]);
  const db = makeDb(lead); const r2 = makeR2(); r2.store.set('jobs/x/y.jpg', {});
  const r = await media.onRequestDelete({
    params: { id: lead.id }, env: { CRM_DB: db, CRM_MEDIA: r2 }, data: { user: 'Kay' },
    request: req({ url: 'https://drive.google.com/drive/folders/abc' }, { method: 'DELETE' })
  });
  const j = await J(r);
  assert.equal(j.media.length, 0);
  assert.equal(r2.store.size, 1, 'file tren Drive/kho khac khong duoc dung toi');
  assert.ok(/Drive không bị xoá/.test(j.note));
});

await t('Doc anh: key la duong la -> 400, khong leo ra ngoai', async () => {
  for (const p of [['..', 'etc', 'passwd'], ['secrets', 'a.jpg'], ['']]) {
    const r = await serve.onRequestGet({
      params: { path: p }, env: { CRM_MEDIA: makeR2() },
      request: new Request('https://kinkay.vn/api/crm/media/x')
    });
    assert.equal(r.status, 400, 'phai chan: ' + JSON.stringify(p));
  }
});

await t('Doc anh dung key -> 200, cache private', async () => {
  const r2 = makeR2(); r2.store.set('jobs/KK-1/a.jpg', {});
  const r = await serve.onRequestGet({
    params: { path: ['jobs', 'KK-1', 'a.jpg'] }, env: { CRM_MEDIA: r2 },
    request: new Request('https://kinkay.vn/api/crm/media/jobs/KK-1/a.jpg')
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control'), /private/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});

console.log('\n' + pass + ' pass, ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
