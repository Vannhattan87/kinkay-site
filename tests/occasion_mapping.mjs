// MKT-DEC-20260917-02 §4A (R-I) — 6 acceptance bổ sung của Luna. node tests/occasion_mapping.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  SERVICES, OCCASION_TO_SERVICE, OCCASION_KEYS_AWAITING_LUNA,
  occasionKeyFromLabel, serviceFromOccasion, insertLead
} from '../functions/api/crm/_lib.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} — nhan ${JSON.stringify(a)}, can ${JSON.stringify(b)}`);

// Quét MỌI trang có form, lấy mọi <option> trong ô Dịp.
function walk(d, out = []) { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p, out) : (n.endsWith('.html') && out.push(p)); } return out; }
const forms = walk('static').filter(f => readFileSync(f, 'utf8').includes('id="lfOccasion"'));
const options = [];
for (const f of forms) {
  const s = readFileSync(f, 'utf8');
  const blk = s.slice(s.indexOf('id="lfOccasion"'), s.indexOf('</select>', s.indexOf('id="lfOccasion"')));
  for (const m of blk.matchAll(/<option([^>]*)>([^<]*)<\/option>/g)) {
    const attrs = m[1], text = m[2].trim();
    const v = /value="([^"]*)"/.exec(attrs);
    const value = v ? v[1] : text;
    if (!value) continue;                              // dòng "— Chọn dịp —"
    const k = /data-key="([^"]*)"/.exec(attrs);
    options.push({ file: f, value, key: k ? k[1] : null });
  }
}

console.log(`\n(quét ${forms.length} trang có form, ${options.length} lựa chọn)`);

console.log('AC-1 — mỗi occasion_key hiện hành đều có map, và ra giá trị thuộc SERVICES');
ok(forms.length >= 13, `phải quét được ít nhất 13 trang, thấy ${forms.length}`);
for (const o of options) {
  ok(!!o.key, `${o.file}: option "${o.value}" THIẾU data-key`);
  if (!o.key) continue;
  const svc = OCCASION_TO_SERVICE[o.key];
  ok(!!svc, `key "${o.key}" không có trong OCCASION_TO_SERVICE`);
  ok(SERVICES.includes(svc), `"${o.key}" → "${svc}" KHÔNG thuộc SERVICES`);
}
for (const [k, v] of Object.entries(OCCASION_TO_SERVICE)) ok(SERVICES.includes(v), `map ${k} → ${v} ngoài SERVICES`);

console.log('AC-2 — cùng một dịp ở bản Việt và bản Anh cho cùng một service');
const pairs = [
  ['Cưới — ngày cưới', 'Wedding — the day itself'],
  ['Tiệc / sự kiện', 'Party / event'],
  ['Cưới — chụp ảnh cưới / pre-wedding', 'Wedding — pre-wedding shoot'],
  ['Cưới — trial thử look', 'Wedding — bridal trial'],
  ['Mẹ cô dâu / người nhà', 'Mother of the bride / groom'],
  ['Khác', 'Other']
];
for (const [vi, en] of pairs) {
  const a = serviceFromOccasion({ occasion: vi }), b = serviceFromOccasion({ occasion: en });
  ok(a.ok && b.ok, `chưa map: ${vi} / ${en}`);
  eq(a.service, b.service, `"${vi}" và "${en}" phải ra cùng service`);
  eq(a.key, b.key, `"${vi}" và "${en}" phải dùng cùng key`);
}

console.log('AC-3 — lead web MỚI không còn tạo service = nhãn của form');
const fakeDb = { prepare() { return { bind() { return this; }, async first() { return { n: 1 }; }, async run() { return {}; } }; } };
for (const label of ['Party / event', 'Tiệc / sự kiện', 'Wedding — the day itself', 'Áo dài photoshoot']) {
  let msg = null;
  try { await insertLead(fakeDb, 'website-form', { customer_name: 'A', source: 'Direct/Unknown', service: label }); }
  catch (e) { msg = e.message; }
  ok(/service không chuẩn/.test(msg || ''), `insertLead phải từ chối nhãn form "${label}"`);
  ok(SERVICES.includes(serviceFromOccasion({ occasion: label }).service), `"${label}" phải dịch ra được service chuẩn`);
}
const src = readFileSync('functions/api/lead.js', 'utf8');
ok(/service:\s*occ\.service/.test(src), 'lead.js phải ghi occ.service, không phải lead.occasion');
ok(!/service:\s*lead\.occasion/.test(src), 'lead.js KHÔNG được còn ghi thẳng lead.occasion vào service');

console.log('AC-4 — lead cũ mang Party / event vẫn sửa field khác và lưu được, service không đổi');
{
  const { normalize, LEAD_FIELDS } = await import('../functions/api/crm/_lib.js');
  const prev = { service: 'Party / event', source: 'Website Form', contact: '0900' };
  eq(normalize({ contact: '0911', service: 'Party / event' }, LEAD_FIELDS, prev).errors, [], 'giữ nguyên service cũ thì phải lưu được');
  eq(normalize({ contact: '0911' }, LEAD_FIELDS, prev).errors, [], 'không gửi service thì càng phải được');
  ok(normalize({ service: 'Tiệc / sự kiện' }, LEAD_FIELDS, prev).errors.length > 0, 'ĐỔI sang một nhãn form khác thì phải bị chặn');
  eq(normalize({ service: 'Event/Gala Makeup' }, LEAD_FIELDS, prev).errors, [], 'đổi sang giá trị chuẩn thì được');
}

console.log('AC-5 — thêm một option mới mà quên map thì test này FAIL trước khi deploy');
{
  // Mô phỏng đúng cái sẽ xảy ra: một option lạ, không data-key, không nằm trong bảng map.
  const r1 = serviceFromOccasion({ occasion: 'Dịp hoàn toàn mới chưa ai map' });
  eq(r1.ok, false, 'nhãn lạ phải KHÔNG resolve được');
  eq(r1.code, 'unknown_occasion', 'mã lỗi rõ ràng');
  const r2 = serviceFromOccasion({ occasion_key: 'key_chua_ton_tai' });
  eq(r2.ok, false, 'key lạ phải KHÔNG resolve được');
  eq(r2.code, 'unmapped_occasion_key', 'phân biệt được key lạ với nhãn lạ');
  ok(occasionKeyFromLabel('Dịp hoàn toàn mới chưa ai map') === null, 'không fuzzy match, không đoán');
  ok(occasionKeyFromLabel('Tiệc') === null, 'substring KHÔNG được khớp — "Tiệc" không phải "Tiệc / sự kiện"');
}

console.log('AC-6 — server từ chối thì client KHÔNG báo thành công giả');
{
  const pjs = readFileSync('static/assets/page.js', 'utf8');
  ok(/if \(!r \|\| r\.status >= 400\) return finish\(false\)/.test(pjs), 'status >= 400 phải finish(false)');
  ok(/\.catch\(function \(\) \{ finish\(false\); \}\)/.test(pjs), 'lỗi mạng cũng phải finish(false)');
  ok(/occasion_key: d\.occasion_key/.test(pjs), 'client phải gửi occasion_key');
  ok(/getAttribute\('data-key'\)/.test(pjs), 'client đọc khoá từ data-key chứ không từ chữ hiển thị');
  const ljs = readFileSync('functions/api/lead.js', 'utf8');
  ok(/await fireWebhook\(env, lead\);\s*\n\s*\/\/[^\n]*\n\s*const isOcc/.test(ljs) || /crmTried && !crmOk/.test(ljs),
     'không nhận ra dịp thì vẫn phải bắn webhook trước khi trả lỗi — không mất lead im lặng');
  ok(/isOcc \? 400 : 500/.test(ljs), 'lỗi dữ liệu đầu vào trả 400, không phải 500');
}

console.log('§4B — bảng map kinh doanh cuối của Luna, và KHÔNG còn khoá nào chờ duyệt');
eq(OCCASION_KEYS_AWAITING_LUNA.length, 0, 'OCCASION_KEYS_AWAITING_LUNA phải = 0');
const FINAL = {
  corporate_headshot: 'Photoshoot Makeup',
  headshot_portrait: 'Photoshoot Makeup',
  wedding_family: 'Event/Gala Makeup',
  wedding_guest: 'Event/Gala Makeup',
  full_glam_combo: 'Other'
};
for (const [k, v] of Object.entries(FINAL)) eq(OCCASION_TO_SERVICE[k], v, `§4B: ${k}`);
// Guardrail Luna: On-Camera giu nghia HEP, khong hut lead chup anh
const onCam = Object.entries(OCCASION_TO_SERVICE).filter(([, v]) => v === 'On-Camera / Interview Makeup').map(([k]) => k);
eq(onCam, [], 'KHÔNG dịp nào của form được map vào On-Camera / Interview Makeup (nghĩa hẹp: phỏng vấn/quay hình)');
// Guardrail Luna: Bridal Makeup chi danh cho CO DAU
const bridal = Object.entries(OCCASION_TO_SERVICE).filter(([, v]) => v === 'Bridal Makeup').map(([k]) => k).sort();
eq(bridal, ['bridal_trial', 'engagement', 'wedding_ancestral', 'wedding_day'], 'Bridal Makeup chỉ gồm dịp của chính cô dâu');
ok(!bridal.includes('wedding_family') && !bridal.includes('wedding_guest'), 'người nhà và khách dự cưới KHÔNG được tính vào Bridal');
// Guardrail Luna: Hair Styling khong chua goi makeup+toc
const hair = Object.entries(OCCASION_TO_SERVICE).filter(([, v]) => v === 'Hair Styling').map(([k]) => k).sort();
eq(hair, ['hair_party', 'hair_wedding'], 'Hair Styling chỉ gồm dịch vụ tóc đơn thuần');

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
