// KINKAY CRM · thư viện dùng chung cho /api/crm/* (Cloudflare Pages Functions) · v1.0 · 06/09/2026
// File bắt đầu bằng "_" nên KHÔNG thành route; chỉ để import.

export const LEAD_STATUSES = [
  'New', 'Contacted', 'Qualified', 'Quoted', 'Waiting for Response', 'Hold',
  'Deposit Paid', 'Confirmed', 'Completed', 'Lost'
];
// Trạng thái còn "mở" (tính vào Expected Revenue, hiện trong hàng đợi bán hàng)
export const OPEN_STATUSES = ['New', 'Contacted', 'Qualified', 'Quoted', 'Waiting for Response', 'Hold', 'Deposit Paid', 'Confirmed'];
export const BOOKED_STATUSES = ['Deposit Paid', 'Confirmed', 'Completed'];

export const SOURCES = ['Direct/Unknown', 'Google Organic', 'Instagram Organic', 'Facebook', 'TikTok', 'Website Form', 'Partner Referral', 'Referral', 'Email', 'AI Referral'];
export const CHANNELS = ['Instagram', 'Facebook/Messenger', 'Zalo', 'Email', 'Website Form', 'Phone', 'Referral', 'Other'];
export const SERVICES = ['Bridal Makeup', 'Destination Wedding', 'Event/Gala Makeup', 'On-Camera / Interview Makeup', 'Commercial / Model / Pageant', 'Pre-wedding Makeup', 'Masterclass', 'Hair Styling', 'Photoshoot Makeup', 'Other'];
export const SEGMENTS = ['B2C', 'Partner-sourced', 'B2B/Commercial'];
export const OWNERS = ['Kay', 'Tan'];
export const DEPOSITS = ['No', 'Yes', 'N/A'];
export const PARTNER_STATUSES = ['New', 'Contacted', 'Nurture', 'Warm', 'Active Opportunity', 'Active Partner', 'Dormant', 'Closed'];

export const LEAD_FIELDS = [
  'created_date', 'customer_name', 'contact', 'contact_channel', 'service', 'event_date', 'source', 'segment',
  'status', 'expected_revenue', 'deposit', 'actual_revenue', 'actual_verified', 'owner', 'next_action',
  'next_followup', 'notes', 'partner_id'
];
export const PARTNER_FIELDS = [
  'created_date', 'name', 'type', 'contact_channel', 'contact', 'status', 'last_touch', 'opportunity',
  'commercial_terms', 'referral_rate', 'next_action', 'next_followup', 'notes', 'owner'
];
const MONEY_FIELDS = ['expected_revenue', 'actual_revenue'];
const DATE_FIELDS = ['created_date', 'event_date', 'next_followup', 'last_touch'];

export const json = (obj, status, extra) =>
  new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra || {})
  });
export const err = (msg, status, detail) => json({ ok: false, error: msg, detail: detail || undefined }, status || 400);

export const nowISO = () => new Date().toISOString();

// Ngày "hôm nay" theo giờ Việt Nam (UTC+7), dạng YYYY-MM-DD. Cloudflare chạy UTC nên phải tự cộng.
export function todayVN() {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// Làm sạch input: chuỗi cắt độ dài, bỏ ký tự điều khiển. Tiền → số nguyên VND hoặc null. Ngày → YYYY-MM-DD hoặc null.
export function cleanStr(v, max) {
  if (v == null) return null;
  const s = String(v).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ').trim();
  if (!s) return null;
  return s.slice(0, max || 400);
}
export function cleanMoney(v) {
  if (v == null || v === '') return null;
  const n = Math.round(Number(String(v).replace(/[^\d.-]/g, '')));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
export function cleanDate(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);   // dd/mm/yyyy như Sheet
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

// Chuẩn hoá một patch/record theo danh sách cột cho phép. Trả {data, errors}.
export function normalize(body, allowed) {
  const data = {}; const errors = [];
  for (const k of allowed) {
    if (!(k in body)) continue;
    const v = body[k];
    if (MONEY_FIELDS.includes(k)) data[k] = cleanMoney(v);
    else if (DATE_FIELDS.includes(k)) {
      const d = cleanDate(v);
      if (v && !d) errors.push(k + ': ngày không hợp lệ (cần YYYY-MM-DD)');
      data[k] = d;
    }
    else if (k === 'actual_verified') data[k] = v ? 1 : 0;
    else if (k === 'referral_rate') { const r = Number(v); data[k] = Number.isFinite(r) && r >= 0 && r <= 1 ? r : 0.10; }
    else if (k === 'notes' || k === 'commercial_terms') data[k] = cleanStr(v, 4000);
    else data[k] = cleanStr(v, 400);
  }
  if ('status' in data && data.status && !LEAD_STATUSES.includes(data.status) && !PARTNER_STATUSES.includes(data.status))
    errors.push('status không nằm trong danh sách');
  if ('deposit' in data && data.deposit && !DEPOSITS.includes(data.deposit)) errors.push('deposit phải là Yes / No / N/A');
  return { data, errors };
}

// Sinh ID KK-YYMMDD-### / PT-YYMMDD-### NGUYÊN TỬ (QA 06/09 điểm 4).
// Một câu UPSERT ... RETURNING trên bảng id_counters: SQLite khoá ghi theo câu lệnh, nên N request
// cùng lúc nhận N số khác nhau. Lần đầu trong ngày, bộ đếm khởi tạo = MAX số đã có (kể cả seed từ Sheet) + 1.
// Đã đo: 20 POST đồng thời trước khi có bảng đếm → 13 lỗi; sau → 20/20 OK, 0 trùng (xem README_CRM.md).
export async function nextId(db, table, prefix, ymd) {
  const ymdShort = ymd.replace(/-/g, '').slice(2); // 2026-09-06 -> 260906
  const key = `${prefix}-${ymdShort}`;
  const like = `${key}-%`;
  const r = await db.prepare(`
    INSERT INTO id_counters (key, n)
    VALUES (?1, (SELECT COALESCE(MAX(CAST(substr(id, -3) AS INTEGER)), 0) + 1 FROM ${table} WHERE id LIKE ?2))
    ON CONFLICT(key) DO UPDATE SET n = n + 1
    RETURNING n`).bind(key, like).first();
  return `${key}-${String(r.n).padStart(3, '0')}`;
}

// Ghi nhật ký thay đổi từng cột.
export async function logDiff(db, entity, id, actor, before, after) {
  const stmts = [];
  const ts = nowISO();
  for (const k of Object.keys(after)) {
    const o = before ? before[k] : null;
    const n = after[k];
    if (String(o ?? '') === String(n ?? '')) continue;
    stmts.push(db.prepare('INSERT INTO lead_events(entity, entity_id, ts, actor, field, old_value, new_value) VALUES (?,?,?,?,?,?,?)')
      .bind(entity, id, ts, actor, k, o == null ? null : String(o), n == null ? null : String(n)));
  }
  if (stmts.length) await db.batch(stmts);
  return stmts.length;
}

// Cờ cutover (QA ChatGPT 06/09 điểm 1): CRM_CUTOVER=1 mới cho GHI. Chưa bật = chỉ đọc/đối chiếu,
// Sheet vẫn là master, form web vẫn đi đường cũ. Không có cửa sổ hai master.
export const isCutover = env => String(env && env.CRM_CUTOVER || '').trim() === '1';

// Chèn có chống trùng ID (QA điểm 4): ID sinh từ MAX trong ngày; 2 request gần đồng thời có thể
// tính ra cùng ID → INSERT thứ hai vỡ PRIMARY KEY → bắt lỗi, tính lại ID, thử lại tối đa 6 lần.
const isDup = e => /UNIQUE|PRIMARY KEY|constraint/i.test(String(e && e.message || e));
async function insertWithRetry(db, table, prefix, ymd, build) {
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt++) {
    const id = await nextId(db, table, prefix, ymd);
    const row = build(id);
    const cols = Object.keys(row);
    try {
      await db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
        .bind(...cols.map(c => row[c])).run();
      return row;
    } catch (e) {
      if (!isDup(e)) throw e;
      lastErr = e;
    }
  }
  throw new Error('Không sinh được ID duy nhất sau 6 lần: ' + (lastErr && lastErr.message));
}

// Chèn lead mới (dùng chung cho API và form web /api/lead).
export async function insertLead(db, actor, input) {
  const ymd = input.created_date || todayVN();
  const ts = nowISO();
  const row = await insertWithRetry(db, 'leads', 'KK', ymd, id => ({
    id, created_date: ymd,
    customer_name: input.customer_name, contact: input.contact ?? null, contact_channel: input.contact_channel ?? null,
    service: input.service ?? null, event_date: input.event_date ?? null, source: input.source ?? null,
    segment: input.segment ?? null, status: input.status || 'New',
    expected_revenue: input.expected_revenue ?? null, deposit: input.deposit ?? null,
    actual_revenue: input.actual_revenue ?? null, actual_verified: input.actual_verified ? 1 : 0,
    owner: input.owner || 'Kay', next_action: input.next_action ?? null, next_followup: input.next_followup ?? null,
    notes: input.notes ?? null, partner_id: input.partner_id ?? null,
    last_updated: ts, updated_by: actor, created_at: ts
  }));
  await db.prepare('INSERT INTO lead_events(entity, entity_id, ts, actor, field, old_value, new_value) VALUES (?,?,?,?,?,?,?)')
    .bind('lead', row.id, ts, actor, 'create', null, row.status).run();
  return row;
}

// Chèn đối tác mới, cùng cơ chế chống trùng.
export async function insertPartner(db, actor, d) {
  const ymd = d.created_date || todayVN();
  const ts = nowISO();
  const row = await insertWithRetry(db, 'partners', 'PT', ymd, id => ({
    id, created_date: ymd, name: d.name, type: d.type ?? null, contact_channel: d.contact_channel ?? null, contact: d.contact ?? null,
    status: d.status || 'New', last_touch: d.last_touch ?? null, opportunity: d.opportunity ?? null,
    commercial_terms: d.commercial_terms ?? null, referral_rate: d.referral_rate ?? 0.10,
    next_action: d.next_action ?? null, next_followup: d.next_followup ?? null, notes: d.notes ?? null,
    owner: d.owner || 'Kay', last_updated: ts, updated_by: actor, created_at: ts
  }));
  await db.prepare('INSERT INTO lead_events(entity, entity_id, ts, actor, field, old_value, new_value) VALUES (?,?,?,?,?,?,?)')
    .bind('partner', row.id, ts, actor, 'create', null, row.status).run();
  return row;
}

// ===================== Booking Confirmation (CR-20260907-29) =====================
// Trường booking chỉ dành cho khách thấy, lưu trong leads.booking_json. KHÔNG có trường nội bộ ở đây.
export const BOOKING_FIELDS = ['ready_time', 'venue', 'pax', 'includes', 'excludes', 'deposit_mode', 'deposit_amount', 'payment_terms', 'customer_note', 'special_instructions', 'total_fee', 'preferred_language'];
export const BC_LANGS = ['vi', 'en']; // ngôn ngữ bản xác nhận khách thấy; KHÔNG tự đoán từ tên/quốc tịch/nguồn
// Tên dịch vụ chuẩn KINKAY hiển thị theo ngôn ngữ. Dịch vụ lạ/tuỳ chỉnh → giữ nguyên, không tự dịch.
export const SERVICE_DISPLAY = {
  vi: { 'Bridal Makeup': 'Makeup cô dâu', 'Destination Wedding': 'Makeup cưới destination', 'Event/Gala Makeup': 'Makeup dự tiệc / gala', 'On-Camera / Interview Makeup': 'Makeup lên hình / phỏng vấn', 'Commercial / Model / Pageant': 'Makeup thương mại / người mẫu / pageant', 'Pre-wedding Makeup': 'Makeup chụp ảnh cưới', 'Masterclass': 'Masterclass', 'Hair Styling': 'Làm tóc', 'Photoshoot Makeup': 'Makeup chụp ảnh' },
  en: { 'Bridal Makeup': 'Bridal Makeup', 'Destination Wedding': 'Destination Wedding Makeup', 'Event/Gala Makeup': 'Event / Gala Makeup', 'On-Camera / Interview Makeup': 'On-Camera / Interview Makeup', 'Commercial / Model / Pageant': 'Commercial / Model / Pageant Makeup', 'Pre-wedding Makeup': 'Pre-wedding Makeup', 'Masterclass': 'Masterclass', 'Hair Styling': 'Hair Styling', 'Photoshoot Makeup': 'Photoshoot Makeup' }
};
export const BC_FOOTER = {
  vi: 'Thông tin trên phản ánh nội dung booking đã được thống nhất tại thời điểm xác nhận. Vui lòng báo KINKAY nếu cần điều chỉnh.',
  en: 'This confirmation reflects the booking details agreed at the time of issue. Please let KINKAY know if any information needs to be updated.'
};
export const DEPOSIT_MODES = ['amount', 'none', 'na']; // số tiền cọc / không cần cọc (đã thống nhất) / không áp dụng
export const BC_ELIGIBLE_STATUSES = ['Quoted', 'Hold', 'Deposit Paid', 'Confirmed'];

export function parseBooking(lead) {
  try { return lead && lead.booking_json ? JSON.parse(lead.booking_json) : {}; } catch (e) { return {}; }
}
export function normalizeBooking(b) {
  const out = {}; const errors = [];
  if (!b || typeof b !== 'object') return { data: out, errors };
  for (const k of BOOKING_FIELDS) {
    if (!(k in b)) continue;
    const v = b[k];
    if (k === 'deposit_amount' || k === 'total_fee') out[k] = cleanMoney(v);
    else if (k === 'pax') { const n = parseInt(String(v).replace(/\D/g, ''), 10); out[k] = Number.isFinite(n) && n > 0 ? n : null; }
    else if (k === 'deposit_mode') { const m = cleanStr(v, 10); if (m && !DEPOSIT_MODES.includes(m)) errors.push('deposit_mode phải là amount / none / na'); out[k] = m; }
    else if (k === 'ready_time') { const t = cleanStr(v, 40); if (t && !/^\d{1,2}:\d{2}/.test(t)) errors.push('ready_time cần dạng HH:MM'); out[k] = t; }
    else if (k === 'preferred_language') { const l = cleanStr(v, 5); if (l && !BC_LANGS.includes(l)) errors.push('preferred_language phải là vi hoặc en'); out[k] = l; }
    else out[k] = cleanStr(v, k === 'includes' || k === 'customer_note' || k === 'special_instructions' || k === 'excludes' ? 1200 : 300);
  }
  return { data: out, errors };
}

// Kiểm tra đủ dữ liệu khách thấy chưa. Trả danh sách thiếu (mã trường), KHÔNG tự điền giá trị mặc định.
export function bookingMissing(lead, booking) {
  const miss = [];
  if (!lead.customer_name) miss.push('customer_name');
  if (!lead.service) miss.push('service');
  if (!lead.event_date) miss.push('event_date');
  if (!booking.ready_time) miss.push('ready_time');
  if (!booking.venue) miss.push('venue');
  const total = booking.total_fee != null ? booking.total_fee : lead.expected_revenue;
  if (total == null) miss.push('total_fee');
  if (!booking.deposit_mode) miss.push('deposit_mode');
  else if (booking.deposit_mode === 'amount' && booking.deposit_amount == null) miss.push('deposit_amount');
  return miss;
}

// Snapshot: chỉ dữ liệu khách thấy + thương hiệu. Không source/segment/owner/next action/notes nội bộ/partner.
export function buildSnapshot(lead, booking, id, version, issuedAtISO, language) {
  const lang = BC_LANGS.includes(language) ? language : 'vi';
  const total = booking.total_fee != null ? booking.total_fee : lead.expected_revenue;
  const depAmt = booking.deposit_mode === 'amount' ? booking.deposit_amount : 0;
  const map = SERVICE_DISPLAY[lang] || {};
  return {
    confirmation_id: id, version, booking_id: lead.id, issued_at: issuedAtISO, language: lang,
    customer_name: lead.customer_name, service: lead.service, service_display: map[lead.service] || lead.service,
    event_date: lead.event_date,
    ready_time: booking.ready_time, venue: booking.venue, pax: booking.pax ?? null,
    includes: booking.includes ?? null, excludes: booking.excludes ?? null,
    total_fee: total, deposit_mode: booking.deposit_mode, deposit_amount: booking.deposit_mode === 'amount' ? booking.deposit_amount : null,
    remaining_balance: total != null ? Math.max(0, total - (depAmt || 0)) : null,
    payment_terms: booking.payment_terms ?? null, customer_note: booking.customer_note ?? null,
    special_instructions: booking.special_instructions ?? null,
    brand: { name: 'KINKAY', tagline: 'MAKEUP ARTIST', site: 'kinkay.vn', phone: '0933 953 179', instagram: '@kinkay.official', footer: BC_FOOTER[lang] }
  };
}
