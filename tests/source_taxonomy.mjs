// MKT-DEC-20260917-02 — 12 acceptance của Luna §4. node tests/source_taxonomy.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { SOURCES, SERVICES, canonicalSource, classifyWebSource, buildSourceDetail, normalize, LEAD_FIELDS, isForeign } from '../functions/api/crm/_lib.js';
import { onRequestGet as controlRoom } from '../functions/api/crm/control-room.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} — nhan ${JSON.stringify(a)}, can ${JSON.stringify(b)}`);
const errsOf = (body, prev) => normalize(body, LEAD_FIELDS, prev).errors.join(' ; ');

console.log('\nAC1+AC2 — giá trị MỚI sai bị chặn ở server');
ok(/không phải nguồn chuẩn/.test(errsOf({ source: 'Website Form' }, null)), 'tạo mới với source legacy phải bị chặn');
ok(/không phải nguồn chuẩn/.test(errsOf({ source: 'linh tinh' }, null)), 'chuỗi bất kỳ bị chặn');
ok(/dịch vụ chuẩn/.test(errsOf({ service: 'Party / event' }, null)), 'service ngoài danh sách bị chặn');
eq(errsOf({ source: 'Google Search', service: 'Bridal Makeup' }, null), '', 'giá trị chuẩn thì qua');

console.log('AC3 — giá trị CŨ KHÔNG ĐỔI vẫn lưu được khi sửa field khác');
const legacy = { source: 'Website Form', service: 'Party / event', contact: '0900' };
eq(errsOf({ contact: '0911', source: 'Website Form', service: 'Party / event' }, legacy), '',
   'sửa số điện thoại của lead cũ KHÔNG được bị 400 vì nhãn cũ');
eq(errsOf({ contact: '0911' }, legacy), '', 'không gửi source/service thì càng không sao');

console.log('AC4 — ĐỔI giá trị legacy thì phải chọn giá trị chuẩn');
ok(/không phải nguồn chuẩn/.test(errsOf({ source: 'Instagram Organic' }, legacy)), 'đổi sang một legacy khác vẫn bị chặn');
eq(errsOf({ source: 'Instagram' }, legacy), '', 'đổi sang giá trị chuẩn thì được');

console.log('AC5+AC6 — form web: phân loại nguồn + source_detail đúng định dạng');
eq(classifyWebSource({ referrer_host: 'www.instagram.com' }), 'Instagram', 'referrer IG');
eq(classifyWebSource({ referrer_host: 'l.facebook.com' }), 'Facebook', 'referrer FB');
eq(classifyWebSource({ referrer_host: 'chatgpt.com' }), 'AI Referral', 'referrer ChatGPT');
eq(classifyWebSource({ referrer_host: 'www.google.com' }), 'Google Organic (Unclassified)', 'Google chung chung KHÔNG ép thành Search');
eq(classifyWebSource({ referrer_host: 'maps.google.com' }), 'Google Maps / Business Profile', 'Maps');
eq(classifyWebSource({ referrer_host: 'www.google.com', referrer_path: '/maps/place/abc' }), 'Google Maps / Business Profile', 'path /maps');
eq(classifyWebSource({ utm_source: 'google', utm_medium: 'cpc' }), 'Google Search', 'UTM cpc → Search');
eq(classifyWebSource({ utm_source: 'google', utm_campaign: 'gbp' }), 'Google Maps / Business Profile', 'UTM gbp → Maps');
eq(classifyWebSource({ utm_source: 'gon-wedding', utm_medium: 'partner' }), 'Partner', 'UTM partner');
eq(classifyWebSource({}), 'Direct/Unknown', 'không có gì → Direct/Unknown');
eq(classifyWebSource({ referrer_host: 'kinkay.vn' }), 'Direct/Unknown', 'referrer nội bộ không tính là nguồn');
ok(SOURCES.indexOf(classifyWebSource({ referrer_host: 'abc.xyz' })) >= 0, 'mọi kết quả phải là giá trị chuẩn');
eq(classifyWebSource({ referrer_host: 'www.google.com' }) === 'Google Search', false, 'AC9: không được ép Google → Search');

eq(buildSourceDetail({ contact: 'web_form', page: '/en/', referrer_host: 'www.google.com' }),
   'contact=web_form | page=/en/ | referrer_host=www.google.com', 'định dạng cố định, bỏ key rỗng');
eq(buildSourceDetail({ contact: 'web_form', page: '/', utm_source: 'ig', utm_medium: 'bio' }),
   'contact=web_form | page=/ | utm_source=ig | utm_medium=bio', 'thứ tự key cố định');
eq(buildSourceDetail({}), null, 'không có gì thì null');
ok(!/\?|&/.test(buildSourceDetail({ contact: 'web_form', page: '/a' }) || ''), 'không chứa query string');

console.log('AC7 — cf-ipcountry KHÔNG thể lọt vào nationality');
ok(LEAD_FIELDS.indexOf('country') < 0 && LEAD_FIELDS.indexOf('cf_country') < 0, 'country không phải field ghi được');
eq(normalize({ nationality: 'VN', country: 'SG' }, LEAD_FIELDS, null).data.country, undefined, 'country bị loại khỏi payload');
eq(isForeign(null), null, 'không biết vẫn là không biết, không suy từ IP');

console.log('AC8+AC10 — map báo cáo');
eq(canonicalSource('AI Referral'), 'AI Referral', 'AC8: AI Referral là dòng riêng, không rơi vào Other');
eq(canonicalSource('Website Form'), 'Website Form (legacy)', 'AC10: không giả thành Website Direct');
ok(canonicalSource('Website Form') !== 'Direct/Unknown', 'AC10: không ép thành Direct/Unknown');
eq(canonicalSource('Google Organic'), 'Google Organic (Unclassified)', 'AC9');
eq(canonicalSource('Instagram Organic'), 'Instagram', 'gộp đúng');
eq(canonicalSource('Partner Referral'), 'Partner', 'gộp đúng');
eq(canonicalSource('Email'), 'Email (legacy)', 'Email là cách liên hệ, không phải nguồn');
eq(canonicalSource('gì đó lạ'), 'Other (legacy)', 'không khớp thì rơi vào Other (legacy)');
eq(canonicalSource(''), 'Other (legacy)', 'ô trống KHÔNG được biến thành Direct/Unknown');
eq(canonicalSource('Direct/Unknown'), 'Direct/Unknown', 'giữ nguyên');

console.log('AC11 — Direct/Unknown là lựa chọn có chủ ý (kiểm ở lớp UI + server tạo mới)');
const html = readFileSync('static/admin/crm/index.html', 'utf8');
ok(/opts\(L\.sources, '', true\)/.test(html), 'form Thêm khách KHÔNG preselect nguồn');
ok(/Chọn nguồn khách/.test(html), 'client chặn khi chưa chọn');
ok(/cần chọn nguồn khách/.test(readFileSync('functions/api/crm/leads.js', 'utf8')), 'server cũng chặn');
ok(/\(giá trị cũ\)/.test(html), 'BẪY: giá trị cũ ngoài danh sách vẫn được giữ và chọn sẵn trong select');

console.log('AC12 — 12 lead production đọc qua Control Room không mất record');
{
  const db = new DatabaseSync(':memory:');
  const strip = x => x.split('\n').map(l => { const i = l.indexOf('--'); return i < 0 ? l : l.slice(0, i); }).join('\n');
  const run = f => { for (const st of strip(readFileSync(f, 'utf8')).split(';')) { const t = st.trim(); if (!t) continue; try { db.exec(t); } catch (e) { if (!/duplicate column/i.test(e.message)) throw e; } } };
  run('schema/crm.sql'); db.exec('ALTER TABLE leads ADD COLUMN booking_json TEXT');
  run('schema/crm-migration-004-contact-key-media.sql'); run('schema/crm-migration-006-look-share.sql');
  run('schema/crm-migration-007-marketing-fields.sql');
  // đúng 6 giá trị source đang có thật trong D1 ngày 17/09
  const real = [['Direct/Unknown',5],['Website Form',3],['Instagram Organic',1],['Google Organic',1],['Partner Referral',1],['Facebook',1]];
  let i = 0;
  for (const [src, n] of real) for (let k = 0; k < n; k++)
    db.prepare("INSERT INTO leads(id,created_date,customer_name,status,last_updated,created_at,source) VALUES (?,?,?,?,?,?,?)")
      .run('KK-' + (++i), '2026-09-01', 'K' + i, 'New', 't', '2026-09-01T00:00:00Z', src);
  const shim = { prepare(sql) { let a = []; const api = { bind(...x) { a = x; return api; }, async all() { return { results: db.prepare(sql).all(...a) }; }, async first() { return db.prepare(sql).get(...a) ?? null; } }; return api; } };
  const body = JSON.parse(await (await controlRoom({ env: { CRM_DB: shim } })).text());
  eq(body.source_mix.reduce((a, b) => a + b.leads, 0), 12, 'không mất record nào');
  eq(body.data_quality.direct_unknown, 5, 'Direct/Unknown đếm riêng');
  eq(body.data_quality.direct_unknown_pct, 41.7, '% lỗ hổng dữ liệu');
  eq(body.data_quality.google_unclassified, 1, 'Google chưa rõ');
  eq(body.data_quality.legacy_labels, 3, 'Website Form ×3 thành nhãn cũ');
  const keys = body.source_mix.map(x => x.key).sort();
  eq(keys, ['Direct/Unknown', 'Facebook', 'Google Organic (Unclassified)', 'Instagram', 'Partner', 'Website Form (legacy)'], 'nhãn báo cáo đúng');
  ok(!keys.includes('Website Direct'), 'AC10: không bịa Website Direct');
  // DB phải NGUYÊN VẸN
  const raw = db.prepare("SELECT DISTINCT source FROM leads ORDER BY source").all().map(r => r.source);
  eq(raw, ['Direct/Unknown', 'Facebook', 'Google Organic', 'Instagram Organic', 'Partner Referral', 'Website Form'], 'Rule 04: DB không bị UPDATE một dòng nào');
}

console.log('BẪY — form web có bộ "Dịp" RIÊNG, chặn service ở insertLead sẽ làm mất lead thật');
{
  const { insertLead } = await import('../functions/api/crm/_lib.js');
  const fake = { prepare() { return { bind() { return this; }, async first() { return { n: 1 }; }, async run() { return {}; } }; } };
  let threw = null;
  try { await insertLead(fake, 'website-form', { customer_name: 'A', service: 'Tiệc / sự kiện', source: 'Direct/Unknown' }); }
  catch (e) { threw = e.message; }
  ok(!/service/.test(threw || ''), 'service của form web KHÔNG được ném lỗi ở insertLead — lead sẽ bị nuốt mất');
  let threw2 = null;
  try { await insertLead(fake, 'website-form', { customer_name: 'A', source: 'Website Form' }); }
  catch (e) { threw2 = e.message; }
  ok(/source/.test(threw2 || ''), 'nhưng source sai thì VẪN phải chặn ở mọi write path');
  const form = readFileSync('static/index.html', 'utf8');
  ok(/Tiệc \/ sự kiện/.test(form) && !/Event\/Gala Makeup/.test(form.slice(form.indexOf('lfOccasion'), form.indexOf('lfOccasion') + 900)),
     'ghi nhận sự thật: ô Dịp của form KHÔNG dùng SERVICES');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
