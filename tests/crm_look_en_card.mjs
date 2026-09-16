// node tests/crm_look_en_card.mjs
// CR-20260916-36 — bản tiếng Anh của hồ sơ look + bộ chọn look.
//
// Bộ test này tồn tại để trả lời hai câu:
//   1. Khách nước ngoài mở /xem/<token> có đọc được ĐÚNG bản tiếng Anh không, và khi Kay
//      chưa kịp dịch thì có ra ô rỗng không?
//   2. Thêm `tone_en` và `note_en` vào có mở thêm đường rò nào cho `liked` / `care` không?
// Câu 2 quan trọng hơn câu 1. Thêm field vào một object đi ra ngoài là lúc dễ rò nhất.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mod = p => import(new URL(p, import.meta.url).href);
const lib = await mod('../functions/api/crm/_lib.js');
const xem = await mod('../functions/xem/[token].js');

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
};

const BI_MAT_1 = 'CHE-MOI-NHAT-HON-ANH-MAU';
const BI_MAT_2 = 'DA-DAU-VUNG-T-BA-TIENG-LA-TROI';

const LOOK = {
  tone: 'Tông ấm, mắt nâu khói, môi cam đất.',
  tone_en: 'Warm tones, smoky brown eyes, terracotta lips.',
  liked: BI_MAT_1,
  care: BI_MAT_2,
  share: { enabled: true, note: 'Cảm ơn chị đã tin tưởng KINKAY.', note_en: 'Thank you so much, Geia.', photos: ['jobs/KK-1/a.jpg'] }
};

console.log('\nPUBLICLOOK CHON NGON NGU');
await t('lang=en tra ban tieng Anh', () => {
  const p = lib.publicLook(LOOK, 'en');
  assert.equal(p.tone, LOOK.tone_en);
  assert.equal(p.note, LOOK.share.note_en);
});
await t('lang=vi tra ban tieng Viet', () => {
  const p = lib.publicLook(LOOK, 'vi');
  assert.equal(p.tone, LOOK.tone);
  assert.equal(p.note, LOOK.share.note);
});
await t('khong truyen lang thi mac dinh tieng Viet', () => {
  assert.equal(lib.publicLook(LOOK).tone, LOOK.tone);
});
await t('thieu ban tieng Anh thi roi ve tieng Viet, KHONG ra o rong', () => {
  const l = { tone: LOOK.tone, share: { note: LOOK.share.note } };
  const p = lib.publicLook(l, 'en');
  assert.equal(p.tone, LOOK.tone);
  assert.equal(p.note, LOOK.share.note);
});
await t('thieu ban tieng Viet thi roi ve tieng Anh', () => {
  const l = { tone_en: LOOK.tone_en, share: { note_en: LOOK.share.note_en } };
  const p = lib.publicLook(l, 'vi');
  assert.equal(p.tone, LOOK.tone_en);
  assert.equal(p.note, LOOK.share.note_en);
});
await t('khong co gi thi null, khong phai chuoi rong', () => {
  const p = lib.publicLook({}, 'en');
  assert.equal(p.tone, null); assert.equal(p.note, null);
  assert.deepEqual(p.photos, []);
});

console.log('\nTHEM FIELD KHONG DUOC MO THEM DUONG RO');
await t('publicLook chi tra dung 3 khoa', () => {
  assert.deepEqual(Object.keys(lib.publicLook(LOOK, 'en')).sort(), ['note', 'photos', 'tone']);
});
await t('liked / care khong lot ra o ca hai ngon ngu', () => {
  for (const lang of ['vi', 'en']) {
    const s = JSON.stringify(lib.publicLook(LOOK, lang));
    assert.ok(!s.includes(BI_MAT_1), 'lot liked (' + lang + ')');
    assert.ok(!s.includes(BI_MAT_2), 'lot care (' + lang + ')');
  }
});
await t('field noi bo bia them van khong lot ra', () => {
  const s = JSON.stringify(lib.publicLook(Object.assign({ gia_thoa_thuan: 21600000, so_dien_thoai: '0900000000' }, LOOK), 'en'));
  assert.ok(!s.includes('21600000') && !s.includes('0900000000'));
});
await t('normalizeLook nhan tone_en va share.note_en', () => {
  const { data, errors } = lib.normalizeLook({ tone_en: '  Warm tones.  ', share: { note_en: ' Thank you. ' } });
  assert.deepEqual(errors, []);
  assert.equal(data.tone_en, 'Warm tones.');
  assert.equal(data.share.note_en, 'Thank you.');
});

console.log('\nTRANG KHACH /xem/<token>');
function mkCtx(booking) {
  const row = {
    id: 'KK-1', customer_name: 'Geia Lopez', service: 'Event / Gala Makeup', event_date: '2026-09-16',
    look_json: JSON.stringify(LOOK), booking_json: JSON.stringify(booking), share_token: 'a'.repeat(32)
  };
  const db = { prepare: () => ({ bind: () => ({ first: async () => row }) }) };
  return { params: { token: 'a'.repeat(32) }, env: { CRM_DB: db } };
}
await t('booking EN -> trang in ban tieng Anh, khong in ban tieng Viet', async () => {
  const html = await (await xem.onRequestGet(mkCtx({ preferred_language: 'en' }))).text();
  assert.ok(html.includes('Warm tones, smoky brown eyes'), 'thieu tone_en');
  assert.ok(html.includes('Thank you so much, Geia.'), 'thieu note_en');
  assert.ok(!html.includes('Tông ấm, mắt nâu khói'), 'van in ban tieng Viet');
});
await t('booking VI -> trang in ban tieng Viet', async () => {
  const html = await (await xem.onRequestGet(mkCtx({ preferred_language: 'vi' }))).text();
  assert.ok(html.includes('Tông ấm, mắt nâu khói'));
  assert.ok(!html.includes('Warm tones, smoky brown eyes'));
});
await t('ca hai ngon ngu deu KHONG in 2 muc noi bo', async () => {
  for (const lg of ['en', 'vi']) {
    const html = await (await xem.onRequestGet(mkCtx({ preferred_language: lg }))).text();
    assert.ok(!html.includes(BI_MAT_1) && !html.includes(BI_MAT_2), 'lot bi mat (' + lg + ')');
  }
});

/* ── BO CHON LOOK ──────────────────────────────────────────────────────────────
   composeLook() song trong static/admin/crm/index.html vi no chay o may Kay. Test doc
   thang tu file do chu KHONG chep lai: mot ban sao trong test la mot ban sao se lech, roi
   test xanh trong khi Kay bam ra cau sai. */
console.log('\nBO CHON LOOK (doc tu admin/crm/index.html)');
const HTML = fs.readFileSync(new URL('../static/admin/crm/index.html', import.meta.url), 'utf8');
const i0 = HTML.indexOf('var LOOK_BANK = [');
const i1 = HTML.indexOf('function aiProbe()');
assert.ok(i0 > 0 && i1 > i0, 'khong tim thay khoi bo chon look trong admin');
const { LOOK_BANK, composeLook } = (new Function(HTML.slice(i0, i1) + '\nreturn { LOOK_BANK: LOOK_BANK, composeLook: composeLook };'))();

await t('moi muc deu co du ca vi lan en', () => {
  LOOK_BANK.forEach(g => g.items.forEach(it => {
    assert.ok(it.vi && it.vi.trim(), 'thieu vi trong nhom ' + g.k);
    assert.ok(it.en && it.en.trim(), 'thieu en trong nhom ' + g.k + ': ' + it.vi);
  }));
});
await t('khong chon gi thi ra chuoi rong, khong ra dau cham co don', () => {
  const r = composeLook({});
  assert.equal(r.vi, ''); assert.equal(r.en, '');
});
await t('cau tieng Anh viet hoa dau cau va ket bang dau cham', () => {
  const r = composeLook({ base: [0], eyes: [1], accent: [0], lips: [0] });
  assert.match(r.en, /^[A-Z]/);
  assert.ok(r.en.trim().endsWith('.'));
  assert.equal(r.en, 'Dewy, luminous base, warm terracotta eyes with gold shimmer on the inner corners, terracotta lips.');
});
await t('cau tieng Viet ghep dung khung', () => {
  const r = composeLook({ base: [0], eyes: [1], accent: [0], lips: [0] });
  assert.equal(r.vi, 'Nền da căng bóng, tươi, mắt cam đất, nhũ vàng khoé mắt trong, môi cam đất.');
});
await t('toc tach thanh cau rieng o ca hai ngon ngu', () => {
  const r = composeLook({ eyes: [0], hair: [1] });
  assert.ok(r.en.includes("Hair: a low chignon with baby's breath."));
  assert.ok(r.vi.includes('Tóc: búi thấp cài hoa baby.'));
});
await t('chi chon toc thi van ra cau day du, khong co dau phay mo coi', () => {
  const r = composeLook({ hair: [0] });
  assert.equal(r.en, 'Hair: a low chignon.');
  assert.equal(r.vi, 'Tóc: búi thấp gọn.');
});
await t('nhieu muc trong mot nhom noi bang and / va', () => {
  const r = composeLook({ hair: [3, 7] });
  assert.ok(r.en.includes(' and '), r.en);
  assert.ok(r.vi.includes(' và '), r.vi);
});
await t('chi chon diem nhan (khong chon mat) van ra cau doc duoc', () => {
  const r = composeLook({ accent: [4] });
  assert.equal(r.en, 'Natural individual lashes.');
  assert.equal(r.vi, 'Mi giả tự nhiên.');
});
await t('chon het moi nhom van ra 2 cau, khong vo khung', () => {
  const sel = {}; LOOK_BANK.forEach(g => { sel[g.k] = g.items.map((_, i) => i); });
  const r = composeLook(sel);
  assert.ok(r.en.length > 80 && r.vi.length > 80);
  assert.ok(!/,\s*\./.test(r.en) && !/,\s*\./.test(r.vi), 'co dau phay mo coi');
  assert.ok(!/\.\s*\./.test(r.en), 'cham doi');
});

console.log('\n' + pass + ' pass, ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
