// node tests/crm_look_share.mjs
// CR-20260916-35 — hồ sơ buổi làm + link gửi khách.
//
// Câu hỏi mà bộ test này tồn tại để trả lời:
//   nếu link /xem/<token> bị forward vào một group chat 200 người thì cái gì lọt ra?
// Mọi test dưới đây đều quy về đó. Phần còn lại là phụ.
import assert from 'node:assert/strict';

const mod = p => import(new URL(p, import.meta.url).href);
const lib   = await mod('../functions/api/crm/_lib.js');
const look  = await mod('../functions/api/crm/leads/[id]/look.js');
const share = await mod('../functions/api/crm/leads/[id]/share.js');
const xem   = await mod('../functions/xem/[token].js');
const anh   = await mod('../functions/xem/[token]/anh/[[path]].js');

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
};

// ── hai chuỗi này KHÔNG được xuất hiện ở bất cứ đâu ngoài CRM ──────────────
const BI_MAT_1 = 'CHE-MOI-NHAT-HON-ANH-MAU';
const BI_MAT_2 = 'DA-DAU-VUNG-T-BA-TIENG-LA-TROI';

function makeDb(rows) {
  const db = {
    rows,
    prepare(sql) {
      let args = [];
      const st = {
        bind(...a) { args = a; return st; },
        async first() {
          if (/WHERE share_token = \?/.test(sql)) return rows.find(r => r.share_token && r.share_token === args[0]) || null;
          if (/WHERE id = \?/.test(sql)) return rows.find(r => r.id === args[0]) || null;
          return null;
        },
        async all() { return { results: [] }; },
        async run() {
          if (/UPDATE leads SET/.test(sql)) {
            /* Chi lay tham so cho ve phai la '?'. `SET share_token = NULL, look_json = ?`
               chi binh MOT tham so — bo qua chi tiet nay la ban gia lap gan nham cot, roi
               bao loi o code that trong khi code that dung. */
            const id = args[args.length - 1];
            const r = rows.find(x => x.id === id);
            let i = 0;
            sql.match(/SET (.+?) WHERE/)[1].split(',').forEach(part => {
              const [col, val] = part.split('=').map(x => x.trim());
              if (val === '?') r[col] = args[i++];
              else if (/^null$/i.test(val)) r[col] = null;
            });
          }
          return {};
        }
      };
      return st;
    },
    async batch(st) { for (const s of st) await s.run(); return []; }
  };
  return db;
}
const makeR2 = (keys = []) => ({
  keys: new Set(keys),
  async get(k) { return this.keys.has(k) ? { body: 'BYTES', httpEtag: '"e"', writeHttpMetadata(h) { h.set('content-type', 'image/jpeg'); } } : null; }
});

const LEAD = () => ({
  id: 'KK-260914-005', customer_name: 'Geia Lopez', status: 'Confirmed',
  service: 'Event/Gala Makeup', event_date: '2026-09-16',
  booking_json: JSON.stringify({ venue: 'The Myst', ready_time: '11:00', preferred_language: 'en' }),
  media_json: JSON.stringify([
    { kind: 'photo', key: 'jobs/KK-260914-005/a.jpg', url: '/api/crm/media/jobs/KK-260914-005/a.jpg' },
    { kind: 'photo', key: 'jobs/KK-260914-005/b.jpg', url: '/api/crm/media/jobs/KK-260914-005/b.jpg' },
    { kind: 'album', url: 'https://drive.google.com/drive/folders/x' }
  ]),
  look_json: null, share_token: null
});
const OTHER = () => ({ id: 'KK-260101-001', customer_name: 'Khach khac', service: 'Bridal Makeup',
  media_json: JSON.stringify([{ kind: 'photo', key: 'jobs/KK-260101-001/z.jpg' }]),
  booking_json: null, look_json: null, share_token: null });

const reqJ = (body, method = 'PATCH') => new Request('https://kinkay.vn/x', {
  method, headers: { 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body)
});
const J = async r => JSON.parse(await r.text());
const ctx = (db, extra = {}) => Object.assign({ params: { id: 'KK-260914-005' }, env: { CRM_DB: db }, data: { user: 'Kay' } }, extra);

console.log('\nCUA RA DUY NHAT (publicLook)');

await t('publicLook chi tra ve tone/note/photos', () => {
  const p = lib.publicLook({ tone: 'Tong am', liked: BI_MAT_1, care: BI_MAT_2, share: { note: 'Cam on', photos: ['jobs/a/b.jpg'] } });
  assert.deepEqual(Object.keys(p).sort(), ['note', 'photos', 'tone']);
  const s = JSON.stringify(p);
  assert.ok(!s.includes(BI_MAT_1), 'liked lot ra');
  assert.ok(!s.includes(BI_MAT_2), 'care lot ra');
});

await t('Field noi bo MOI them vao sau cung khong tu lot ra', () => {
  // Danh sach TRANG: them khoa la thi no phai bi bo, khong phai duoc cho qua.
  const p = lib.publicLook({ tone: 'x', bi_mat_tuong_lai: BI_MAT_1, share: { bi_mat_2: BI_MAT_2 } });
  assert.ok(!JSON.stringify(p).includes(BI_MAT_1));
  assert.ok(!JSON.stringify(p).includes(BI_MAT_2));
});

await t('Link chi song khi CA token va enabled deu dung', () => {
  const L = { share_token: 'abc' };
  assert.equal(lib.shareIsLive(L, { share: { enabled: true } }), true);
  assert.equal(lib.shareIsLive(L, { share: { enabled: false } }), false);
  assert.equal(lib.shareIsLive({ share_token: null }, { share: { enabled: true } }), false);
  assert.equal(lib.shareIsLive(L, {}), false);
});

console.log('\nGHI HO SO (/look)');

await t('Ghi duoc 3 muc, nhat ky KHONG chua noi dung', async () => {
  const lead = LEAD(); const db = makeDb([lead]);
  const events = [];
  const orig = db.prepare.bind(db);
  db.prepare = sql => { const st = orig(sql); if (/lead_events/.test(sql)) { const b = st.bind; st.bind = (...a) => { events.push(a); return st; }; } return st; };
  const r = await look.onRequestPatch(Object.assign(ctx(db), { request: reqJ({ look: { tone: 'Tong am', liked: BI_MAT_1, care: BI_MAT_2 } }) }));
  const j = await J(r);
  assert.equal(j.look.liked, BI_MAT_1);
  const ev = JSON.stringify(events);
  assert.ok(!ev.includes(BI_MAT_1) && !ev.includes(BI_MAT_2), 'nhat ky khong duoc chua noi dung nhan xet ve khach');
});

await t('Chan anh cua JOB KHAC lot vao danh sach gui khach', async () => {
  const db = makeDb([LEAD(), OTHER()]);
  const r = await look.onRequestPatch(Object.assign(ctx(db), {
    request: reqJ({ look: { share: { photos: ['jobs/KK-260101-001/z.jpg'] } } })
  }));
  assert.equal(r.status, 400);
  assert.match((await J(r)).error, /không thuộc job này/);
});

await t('Anh cua dung job thi nhan', async () => {
  const db = makeDb([LEAD()]);
  const r = await look.onRequestPatch(Object.assign(ctx(db), {
    request: reqJ({ look: { share: { photos: ['jobs/KK-260914-005/a.jpg'] } } })
  }));
  assert.equal(r.status || 200, 200);
  assert.deepEqual((await J(r)).look.share.photos, ['jobs/KK-260914-005/a.jpg']);
});

console.log('\nLINK GUI KHACH (/share)');

let liveDb, liveToken;
await t('POST tao token 32 hex, bat link, MAC DINH 0 anh', async () => {
  const lead = LEAD(); liveDb = makeDb([lead]);
  const r = await share.onRequestPost(ctx(liveDb));
  const j = await J(r);
  liveToken = j.share_url.split('/').pop();
  assert.match(liveToken, /^[0-9a-f]{32}$/);
  assert.equal(j.share_live, true);
  assert.equal(j.so_anh_dang_gui, 0, 'tao link KHONG duoc tu chon anh');
  assert.ok(j.nhac, 'phai nhac Kay la chua tick anh nao');
});

await t('POST lan hai sinh token MOI, token cu chet', async () => {
  const cu = liveToken;
  const r = await share.onRequestPost(ctx(liveDb));
  const moi = (await J(r)).share_url.split('/').pop();
  assert.notEqual(moi, cu);
  const hit = await liveDb.prepare('SELECT id FROM leads WHERE share_token = ?').bind(cu).first();
  assert.equal(hit, null, 'token cu van con tra ra lead');
  liveToken = moi;
});

await t('DELETE thu hoi: token ve NULL, khong the song lai', async () => {
  const cu = liveToken;
  await share.onRequestDelete(ctx(liveDb));
  assert.equal(liveDb.rows[0].share_token, null);
  const hit = await liveDb.prepare('SELECT id FROM leads WHERE share_token = ?').bind(cu).first();
  assert.equal(hit, null);
});

console.log('\nTRANG KHACH XEM (/xem/<token>) — PHAN QUAN TRONG NHAT');

async function setupLive() {
  const lead = LEAD(); const db = makeDb([lead, OTHER()]);
  await share.onRequestPost(ctx(db));
  await look.onRequestPatch(Object.assign(ctx(db), { request: reqJ({ look: {
    tone: 'Tong am, mat nau khoi', liked: BI_MAT_1, care: BI_MAT_2,
    share: { note: 'Cam on chi da tin tuong KINKAY', photos: ['jobs/KK-260914-005/a.jpg'] }
  } }) }));
  return { db, token: lead.share_token, lead };
}

await t('Trang khach KHONG chua mot chu nao cua 2 muc noi bo', async () => {
  const { db, token } = await setupLive();
  const r = await xem.onRequestGet({ params: { token }, env: { CRM_DB: db } });
  assert.equal(r.status || 200, 200);
  const html = await r.text();
  assert.ok(!html.includes(BI_MAT_1), 'LOT "khach che gi" RA TRANG KHACH');
  assert.ok(!html.includes(BI_MAT_2), 'LOT "luu y da toc" RA TRANG KHACH');
  assert.ok(html.includes('Tong am, mat nau khoi'), 'thieu tong');
  assert.ok(html.includes('Cam on chi'), 'thieu loi nhan');
  assert.match(r.headers.get('x-robots-tag'), /noindex/);
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  assert.match(r.headers.get('cache-control'), /no-store/);
});

await t('Trang khach khong ro tien / trang thai / ghi chu noi bo', async () => {
  const { db, token, lead } = await setupLive();
  lead.notes = 'GHI CHU NOI BO KHONG DUOC RA';
  lead.expected_revenue = 1800000;
  lead.next_action = 'VIEC TIEP NOI BO';
  const html = await (await xem.onRequestGet({ params: { token }, env: { CRM_DB: db } })).text();
  ['GHI CHU NOI BO', '1800000', '1.800.000', 'VIEC TIEP', 'Confirmed'].forEach(x =>
    assert.ok(!html.includes(x), 'lot ra: ' + x));
});

await t('Token sai / la / rong deu 404 y het nhau', async () => {
  const { db } = await setupLive();
  for (const tk of ['', 'abc', 'x'.repeat(32), '0'.repeat(31), '0'.repeat(33), '../etc']) {
    const r = await xem.onRequestGet({ params: { token: tk }, env: { CRM_DB: db } });
    assert.equal(r.status, 404, 'phai chan: ' + JSON.stringify(tk));
  }
});

await t('Tat link (enabled=false) -> 404, khong he lo gi them', async () => {
  const { db, token } = await setupLive();
  await look.onRequestPatch(Object.assign(ctx(db), { request: reqJ({ look: { share: { enabled: false } } }) }));
  const r = await xem.onRequestGet({ params: { token }, env: { CRM_DB: db } });
  assert.equal(r.status, 404);
});

console.log('\nANH QUA LINK CONG KHAI (/xem/<token>/anh/...)');

await t('Anh DA TICK: 200', async () => {
  const { db, token } = await setupLive();
  const r = await anh.onRequestGet({ params: { token, path: ['jobs', 'KK-260914-005', 'a.jpg'] },
    env: { CRM_DB: db, CRM_MEDIA: makeR2(['jobs/KK-260914-005/a.jpg']) } });
  assert.equal(r.status || 200, 200);
  assert.match(r.headers.get('cache-control'), /no-store/);
  assert.match(r.headers.get('x-robots-tag'), /noimageindex/);
});

await t('Anh CUNG JOB nhung CHUA TICK: 404', async () => {
  const { db, token } = await setupLive();
  const r = await anh.onRequestGet({ params: { token, path: ['jobs', 'KK-260914-005', 'b.jpg'] },
    env: { CRM_DB: db, CRM_MEDIA: makeR2(['jobs/KK-260914-005/b.jpg']) } });
  assert.equal(r.status, 404, 'anh chua tick ma van xem duoc qua link');
});

await t('Token job A KHONG mo duoc anh job B', async () => {
  const { db, token, lead } = await setupLive();
  // Nhet thang key cua job khac vao share.photos, bo qua kiem tra o tang API.
  const lk = JSON.parse(lead.look_json); lk.share.photos.push('jobs/KK-260101-001/z.jpg');
  lead.look_json = JSON.stringify(lk);
  const r = await anh.onRequestGet({ params: { token, path: ['jobs', 'KK-260101-001', 'z.jpg'] },
    env: { CRM_DB: db, CRM_MEDIA: makeR2(['jobs/KK-260101-001/z.jpg']) } });
  assert.equal(r.status, 404, 'cua 4 (prefix theo lead id) khong chan duoc');
});

await t('Thu hoi link -> anh chet theo ngay', async () => {
  const { db, token } = await setupLive();
  await share.onRequestDelete(ctx(db));
  const r = await anh.onRequestGet({ params: { token, path: ['jobs', 'KK-260914-005', 'a.jpg'] },
    env: { CRM_DB: db, CRM_MEDIA: makeR2(['jobs/KK-260914-005/a.jpg']) } });
  assert.equal(r.status, 404);
});

await t('Di nguoc cay thu muc: 404', async () => {
  const { db, token } = await setupLive();
  for (const p of [['..', '..', 'etc'], ['secrets', 'a.jpg'], ['jobs', 'KK-260914-005', '..', '..', 'x']]) {
    const r = await anh.onRequestGet({ params: { token, path: p },
      env: { CRM_DB: db, CRM_MEDIA: makeR2() } });
    assert.equal(r.status, 404, 'phai chan: ' + JSON.stringify(p));
  }
});

console.log('\n' + pass + ' pass, ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
