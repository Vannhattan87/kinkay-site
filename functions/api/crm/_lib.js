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
      /* 14/09/2026 (CR-32) — THỨ TỰ TRIỂN KHAI. Nếu code lên production TRƯỚC khi chạy
         migration 004 thì cột `contact_key` chưa tồn tại và MỌI lần ghi lead sẽ đổ.
         Đúng loại sự cố `no such column: last_touch` ngày 13/09, chỉ khác là lần này nó
         chặn cả đường ghi lead từ form web — tức là MẤT KHÁCH, không phải chỉ lỗi 500.
         Nên: thiếu cột thì bỏ cột đó ra và ghi tiếp. Mất khoá tra cứu còn hơn mất khách;
         chạy migration rồi thì `backfill-contact-key` điền lại được.
         KHÔNG nuốt lỗi: vẫn log để còn biết mà chạy migration. */
      const msg = String(e && e.message || '');
      /* SQLite báo HAI kiểu khác nhau và tôi suýt chỉ bắt một:
           INSERT  → "table leads has no column named contact_key"
           SELECT  → "no such column: contact_key"
         Đoán chuỗi lỗi thay vì chạy thử chính là cách `last_touch` lọt ra production 13/09.
         Lần này chạy thật rồi mới viết regex. */
      const miss = msg.match(/has no column named\s+([a-z_]+)/i) || msg.match(/no such column:?\s*([a-z_]+)/i);
      if (miss && Object.prototype.hasOwnProperty.call(row, miss[1])) {
        console.log('[KINKAY crm] thieu cot', miss[1], '- ghi tiep khong co cot nay. CHAY MIGRATION 004.');
        const reduced = Object.assign({}, row); delete reduced[miss[1]];
        const rc = Object.keys(reduced);
        await db.prepare(`INSERT INTO ${table} (${rc.join(',')}) VALUES (${rc.map(() => '?').join(',')})`)
          .bind(...rc.map(c => reduced[c])).run();
        return reduced;
      }
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
    // CR-32 T0: khoá tra cứu, sinh ở server. KHÔNG nhận từ client (không nằm trong LEAD_FIELDS).
    contact_key: contactKey(input.contact),
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
export const BOOKING_FIELDS = ['ready_time', 'venue', 'pax', 'includes', 'excludes', 'deposit_mode', 'deposit_amount', 'payment_terms', 'customer_note', 'special_instructions', 'total_fee', 'preferred_language', 'line_items'];
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

// ===================== Line items (CR-20260915-33) =====================
// LUAT: 1 dong = 1 dich vu + 1 don gia + 1 so luong. KHONG phai 1 booking = 1 dong.
//   service  -> qty = pax (so khach DUOC LAM dich vu). Anh huong gia.
//   fee      -> phu phi (di lai, ngoai gio...). qty mac dinh 1. Renderer KHONG in pax.
//   discount -> giam gia. amount LUON am. qty mac dinh 1. Renderer KHONG in pax.
// Kay nhap don gia duong cho moi loai; dau do `type` quyet dinh, khong ai go dau tru.
// Grand Total = tong amount (co dau), khong ngoai le, khong o Total nhap tay.
// Server LUON tu tinh lai amount. Gia tri client gui len chi de doi chieu.
export const LINE_ITEM_TYPES = ['service', 'fee', 'discount'];
export const MAX_LINE_ITEMS = 40;
export const SNAPSHOT_VERSION_LINE_ITEMS = 3;

export function lineItemSign(type) { return type === 'discount' ? -1 : 1; }

export function normalizeLineItems(v) {
  const errors = [];
  if (v == null || v === '') return { items: null, errors };
  let raw = v;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch (e) { return { items: null, errors: ['line_items khong phai JSON hop le'] }; }
  }
  if (!Array.isArray(raw)) return { items: null, errors: ['line_items phai la danh sach'] };
  if (raw.length === 0) return { items: [], errors };
  if (raw.length > MAX_LINE_ITEMS) return { items: null, errors: ['line_items toi da ' + MAX_LINE_ITEMS + ' dong'] };

  const items = [];
  for (let i = 0; i < raw.length; i++) {
    const it = raw[i], n = i + 1;
    if (!it || typeof it !== 'object') { errors.push('Dong ' + n + ': khong hop le'); continue; }
    const type = cleanStr(it.type, 12);
    if (!LINE_ITEM_TYPES.includes(type)) { errors.push('Dong ' + n + ': type phai la service / fee / discount'); continue; }
    const label = cleanStr(it.label, 120);
    if (!label) { errors.push('Dong ' + n + ': thieu ten dong'); continue; }

    let qty = parseInt(String(it.qty == null ? '' : it.qty).replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(qty) || qty < 1) {
      if (type === 'service') { errors.push('Dong ' + n + ': dong dich vu phai co so khach (pax >= 1)'); continue; }
      qty = 1;
    }
    const unit = cleanMoney(it.unit_price);
    if (unit == null) { errors.push('Dong ' + n + ': thieu don gia (nhap so duong)'); continue; }
    if (unit === 0 && type !== 'fee') { errors.push('Dong ' + n + ': don gia phai lon hon 0'); continue; }

    const amount = lineItemSign(type) * qty * unit;
    items.push({ type, label, qty, unit_price: unit, amount });
  }
  if (errors.length) return { items: null, errors };
  return { items, errors };
}

// Grand Total = tong amount. Ham DUY NHAT duoc phep sinh ra tong tien cua mot Booking Confirmation.
export function lineItemsTotal(items) {
  if (!Array.isArray(items) || !items.length) return null;
  let t = 0;
  for (const it of items) t += Number(it.amount) || 0;
  return t;
}

// pax hien thi = tong qty cua cac dong service. fee/discount khong cong vao.
export function lineItemsPax(items) {
  if (!Array.isArray(items) || !items.length) return null;
  let p = 0;
  for (const it of items) if (it.type === 'service') p += Number(it.qty) || 0;
  return p > 0 ? p : null;
}

export function hasValidLineItems(booking) {
  return Array.isArray(booking && booking.line_items) && booking.line_items.length > 0;
}


export function parseBooking(lead) {
  try { return lead && lead.booking_json ? JSON.parse(lead.booking_json) : {}; } catch (e) { return {}; }
}
export function normalizeBooking(b) {
  const out = {}; const errors = [];
  if (!b || typeof b !== 'object') return { data: out, errors };
  for (const k of BOOKING_FIELDS) {
    if (!(k in b)) continue;
    const v = b[k];
    if (k === 'line_items') { const r = normalizeLineItems(v); if (r.errors.length) errors.push(...r.errors); else out[k] = r.items; }
    else if (k === 'deposit_amount' || k === 'total_fee') out[k] = cleanMoney(v);
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
  // CR-33: tien cua ban xac nhan CHI den tu line items.
  // `expected_revenue` la uoc tinh pipeline, KHONG phai so da thoa thuan voi khach - khong fallback vao day nua.
  if (!hasValidLineItems(booking)) miss.push('line_items');
  if (!booking.deposit_mode) miss.push('deposit_mode');
  else if (booking.deposit_mode === 'amount' && booking.deposit_amount == null) miss.push('deposit_amount');
  return miss;
}

// Snapshot: chỉ dữ liệu khách thấy + thương hiệu. Không source/segment/owner/next action/notes nội bộ/partner.
export function buildSnapshot(lead, booking, id, version, issuedAtISO, language) {
  const lang = BC_LANGS.includes(language) ? language : 'vi';
  const map = SERVICE_DISPLAY[lang] || {};

  // Pricing identity: Grand Total = tong line items. Khong co duong nao khac sinh ra con so nay.
  const items = Array.isArray(booking.line_items) ? booking.line_items : [];
  const total = lineItemsTotal(items);

  // Payment identity: amount_paid + balance_due = grand_total. Coc la mot lan thanh toan, khong phai dong hang.
  const depAmt = booking.deposit_mode === 'amount' ? (booking.deposit_amount || 0) : 0;
  const paid = Math.min(depAmt, total == null ? 0 : total);
  const balance = total == null ? null : total - paid;

  return {
    confirmation_id: id, version, snapshot_version: SNAPSHOT_VERSION_LINE_ITEMS,
    booking_id: lead.id, issued_at: issuedAtISO, language: lang,
    customer_name: lead.customer_name, service: lead.service, service_display: map[lead.service] || lead.service,
    event_date: lead.event_date,
    ready_time: booking.ready_time, venue: booking.venue,
    // pax suy ra TU line items, khong phai field roi. Khong co duong nao de pax lech khoi tong tien.
    pax: lineItemsPax(items),
    line_items: items.map(function (it) { return { type: it.type, label: it.label, qty: it.qty, unit_price: it.unit_price, amount: it.amount }; }),
    grand_total: total,
    total_fee: total,
    includes: booking.includes ?? null, excludes: booking.excludes ?? null,
    deposit_mode: booking.deposit_mode, deposit_amount: booking.deposit_mode === 'amount' ? booking.deposit_amount : null,
    amount_paid: paid, balance_due: balance,
    remaining_balance: balance,
    payment_terms: booking.payment_terms ?? null, customer_note: booking.customer_note ?? null,
    special_instructions: booking.special_instructions ?? null,
    brand: { name: 'KINKAY', tagline: 'MAKEUP ARTIST', site: 'kinkay.vn', phone: '0933 953 179', instagram: '@kinkay.official', footer: BC_FOOTER[lang] }
  };
}

// Bat bien cua moi snapshot V3. Dung o server truoc khi INSERT va trong test hoi quy.
export function auditSnapshot(snap) {
  const bad = [];
  if (!snap || snap.snapshot_version !== SNAPSHOT_VERSION_LINE_ITEMS) return ['khong phai snapshot V3'];
  const items = snap.line_items;
  if (!Array.isArray(items) || !items.length) bad.push('khong co line_items');
  else {
    items.forEach(function (it, i) {
      const n = i + 1;
      if (!LINE_ITEM_TYPES.includes(it.type)) bad.push('dong ' + n + ': type la');
      if (it.amount !== lineItemSign(it.type) * it.qty * it.unit_price) bad.push('dong ' + n + ': amount khong bang qty x don gia');
      if (it.type === 'discount' && !(it.amount < 0)) bad.push('dong ' + n + ': discount phai am');
      if (it.type === 'service' && !(it.qty >= 1)) bad.push('dong ' + n + ': service phai co pax >= 1');
    });
    const sum = lineItemsTotal(items);
    if (snap.grand_total !== sum) bad.push('grand_total khong truy nguoc duoc ve line items');
    if (snap.total_fee !== sum) bad.push('total_fee lech grand_total');
    const declaredPax = lineItemsPax(items);
    if ((snap.pax ?? null) !== (declaredPax ?? null)) bad.push('pax khong khop tong qty cua dong service');
  }
  const paid = snap.amount_paid || 0, due = snap.balance_due;
  if (snap.grand_total != null && due != null && paid + due !== snap.grand_total) bad.push('amount_paid + balance_due khac grand_total');
  return bad;
}

// ===================== Chống trùng khách + Xoá có khôi phục (11/09/2026, Tân yêu cầu) =====================
// Bối cảnh: Kay gõ tay tên khách mỗi lần thêm job nên cùng 1 người thành nhiều bản ghi rời, và không có cách
// gỡ bản ghi nhập sai. Nguyên tắc:
//   · Lost  = khách thật không chốt (vẫn tính vào tỉ lệ chuyển đổi).
//   · Xoá   = nhập sai / nhập trùng / test. Bản ghi rời khỏi mọi KPI, nhưng TOÀN BỘ dòng gốc được chụp vào
//             lead_events (field='delete', old_value = JSON) nên khôi phục được bất cứ lúc nào, không phụ thuộc
//             Time Travel 7 ngày của D1. Không cần migration.

// Tên: bỏ danh xưng đầu (Ms., Mrs., chị, cô, c.…) TRƯỚC khi bỏ dấu (để "Chi" là tên thật không bị cắt như "chị"),
// rồi bỏ dấu, đ→d, chữ thường, gộp khoảng trắng. "Ms. Diễm" = "Ms. Diem" = "chị Diễm" → "diem".
const NAME_PREFIX = /^(?:(?:ms|mrs|mr|miss|mdm|madam|dr|chị|cô|bạn)(?:\.\s*|\s+)|(?:c|a|e)\.\s*)/u;
export function normName(v) {
  let s = String(v || '').normalize('NFC').toLowerCase().trim();
  for (let i = 0; i < 2; i++) { const t = s.replace(NAME_PREFIX, ''); if (t.trim()) s = t.trim(); }
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  return s.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
// Contact: bỏ giá trị giữ chỗ ("Not retained", "N/A"...). SĐT → chỉ số, 84 → 0. Handle/email → chữ thường, bỏ @ đầu.
const CONTACT_PLACEHOLDER = /^(not retained|n\/?a|na|none|null|unknown|khong|khong co|chua co|chua|-+|—|\?+|0+)$/;
export function normContact(v) {
  let s = String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (!s || CONTACT_PLACEHOLDER.test(s)) return '';
  const joined = s.replace(/(\d)[\s.()-]+(?=\d)/g, '$1');
  /* {8,10} cắt cụt dạng "0084933953179" (0 + 12 chữ số): bắt được đúng 10 số đầu rồi dừng,
     ra một khoá sai và ngắn. Nới lên {8,12} để ôm trọn dạng có mã quốc gia, phần chuẩn hoá
     tiền tố ngay bên dưới sẽ cắt về dạng 0xxxxxxxxx. */
  const phone = joined.match(/(?:\+?84|0)\d{8,12}/);
  if (phone && !/@[a-z]/.test(s)) {
    /* 14/09/2026 (CR-32) — LỖI CÓ SẴN, bộ test T0 bắt được, KHÔNG phải lỗi đợt này sinh ra.
       "+84 (0) 933 953 179" (dạng in trên danh thiếp Việt Nam) bỏ dấu ngăn thành "+840933953179",
       rồi nhánh `startsWith('84')` cho ra "0" + "0933953179" = "00933953179" — lệch hẳn với
       "0933953179" của cùng một số viết cách khác. `lead.js` đã vá đúng ca này ngày 12/09 nhưng
       `_lib.js` thì chưa, nên `findSimilarLeads` bên `/admin/crm/` ĐANG bỏ sót loại trùng này
       trên production. Nay contact_key dùng chung hàm này nên buộc phải sửa tận gốc. */
    let d = phone[0].replace(/\D/g, '');
    d = d.replace(/^0084/, '0');            // dạng quốc tế 0084...
    if (d.startsWith('84')) d = '0' + d.slice(2);
    return d.replace(/^0{2,}(?=\d)/, '0'); // gom "00933..." về "0933..."
  }
  /* Số nước ngoài (không rơi vào nhánh 84/0 ở trên). Trước đây trả nguyên chuỗi, nên
     "+1 415 555 0123" và "+14155550123" thành HAI khoá khác nhau — cùng một người mà tra
     không ra nhau. Đúng tệp khách quốc tế mà P3 đang nhắm, nên phải gom dấu ngăn lại. */
  if (/^\+?[\d\s.()-]{7,}$/.test(s)) {
    const d = s.replace(/[\s.()-]/g, '');
    if (/^\+?\d{7,15}$/.test(d)) return d;
  }
  s = s.replace(/^https?:\/\/(www\.)?(instagram\.com|facebook\.com|fb\.com|tiktok\.com\/@?)\/?/, '').replace(/^@/, '').replace(/\/+$/, '').trim();
  return s.length >= 3 ? s : '';
}

/* CR-32 T0 (14/09/2026) — KHOÁ TRA CỨU, KHÔNG PHẢI DANH TÍNH KHÁCH.
   Dùng lại ĐÚNG `normContact` ở trên: một hàm chuẩn hoá duy nhất cho cả lúc GHI (sinh
   `contact_key`) lẫn lúc TRA (findSimilarLeads). Hai hàm khác nhau là tra lệch với ghi.

   Trả `null` chứ không trả '' khi contact trống / giữ chỗ / quá ngắn. Lý do là ràng buộc
   Luna đặt: contact rỗng hoặc không hợp lệ KHÔNG được dồn chung thành một nhóm. SQLite
   không cho hai NULL bằng nhau và index bỏ qua NULL, nên chúng không bao giờ khớp nhau.
   Nếu để '' thì mọi khách thiếu liên hệ sẽ thành "cùng một người" — đúng cái phải tránh.

   Cột này KHÔNG chứng minh hai job là của cùng một người (mẹ đặt hộ, planner đặt cho
   nhiều cô dâu, số đổi chủ), KHÔNG được dùng để tự gộp, và KHÔNG đủ để tính KPI khách
   quay lại chính thức. Việc đó thuộc T1, đang HOLD. */
export function contactKey(v) {
  const k = normContact(v);
  return k ? k : null;
}

// Tìm bản ghi giống input. Trả mảng { lead, level, reasons } sắp theo độ chắc:
//   same_job     = cùng khách (tên hoặc contact) + cùng ngày sự kiện + cùng dịch vụ → gần như chắc là nhập trùng
//   same_contact = cùng contact → cùng 1 khách (job khác)
//   same_name    = cùng tên sau chuẩn hoá → có thể cùng khách
//   similar_name = tên này là đầu tên kia ("Hoa" vs "Hoa Nguyễn") → gợi ý yếu
export async function findSimilarLeads(db, input, excludeId) {
  const n = normName(input.customer_name);
  const c = normContact(input.contact);
  if (!n && !c) return [];
  const rows = (await db.prepare('SELECT id, created_date, customer_name, contact, contact_channel, service, event_date, source, segment, status, expected_revenue FROM leads ORDER BY created_date DESC LIMIT 3000').all()).results || [];
  const rank = { same_job: 0, same_contact: 1, same_name: 2, similar_name: 3 };
  const out = [];
  for (const r of rows) {
    if (excludeId && r.id === excludeId) continue;
    const rn = normName(r.customer_name), rc = normContact(r.contact);
    const reasons = [];
    const contactHit = !!(c && rc && c === rc);
    const nameHit = !!(n && rn && n === rn);
    let prefixHit = false;
    if (!nameHit && n && rn) {
      const [a, b] = n.length <= rn.length ? [n, rn] : [rn, n];
      prefixHit = a.length >= 3 && (b === a || b.startsWith(a + ' ') || b.endsWith(' ' + a));
    }
    if (contactHit) reasons.push('contact');
    if (nameHit) reasons.push('name');
    if (!contactHit && !nameHit && !prefixHit) continue;
    let level = contactHit ? 'same_contact' : nameHit ? 'same_name' : 'similar_name';
    const sameDate = !!(input.event_date && r.event_date && input.event_date === r.event_date);
    const sameService = !!(input.service && r.service && input.service === r.service);
    if ((contactHit || nameHit) && sameDate && sameService) { level = 'same_job'; reasons.push('event_date', 'service'); }
    else if (sameDate) reasons.push('event_date');
    out.push({ lead: r, level, reasons });
  }
  out.sort((x, y) => rank[x.level] - rank[y.level] || String(y.lead.created_date).localeCompare(String(x.lead.created_date)));
  return out.slice(0, 20);
}

/* CR-32 T3 (14/09/2026) — ẢNH / ALBUM GẮN VỚI JOB.
   D1 giữ metadata + link + quyền; file nằm ở Google Drive, không nằm trong database.
   Gắn theo JOB chứ không theo khách: ảnh sinh ra tại một buổi cụ thể, mất thông tin
   "của lần nào" là mất phần có giá trị nhất. Trang khách chỉ TỔNG HỢP từ các job.

   `marketing_ok` mặc định false và phải bật riêng từng mục. Quyền xem nội bộ khác quyền
   dùng cho marketing: khách để Kay xem lại lần sau KHÔNG có nghĩa là đồng ý lên website. */
const MEDIA_KINDS = ['album', 'image'];
export function parseMedia(row) {
  try { const a = JSON.parse(row && row.media_json || '[]'); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }   // dữ liệu hỏng thì coi như chưa có, không làm gãy trang chi tiết
}
/* CHỈ NHẬN https://. Luna QA 14/09 điểm 3 yêu cầu chặn cả non-HTTPS, không chỉ
   javascript:/data:. Bản trước cho qua http:// — album Drive vốn luôn là https nên siết
   lại không mất gì, mà bỏ được đường link khách bị nghe lén hoặc bị chèn giữa đường.
   Chặn luôn khoảng trắng và ký tự điều khiển trong URL (dạng "https://a b" hay
   "java\nscript:" là mẹo lách quen thuộc). Link này sẽ thành thẻ <a> nên phải sạch từ server. */
export function cleanMediaUrl(v) {
  const s = String(v == null ? '' : v).trim();
  if (!/^https:\/\//i.test(s)) return '';
  if (/[\s<>"'`\\]/.test(s)) return '';          // khoảng trắng + ký tự có thể thoát khỏi thuộc tính
  if (/[\u0000-\u001f\u007f]/.test(s)) return ''; // ký tự điều khiển
  if (s.length > 2000) return '';
  try { const u = new URL(s); return u.protocol === 'https:' ? s : ''; }
  catch (e) { return ''; }                        // URL không phân tích được thì loại
}
export function buildMediaItem(input, actor) {
  const url = cleanMediaUrl(input && input.url);
  if (!url) return { error: 'Link phải bắt đầu bằng http:// hoặc https://' };
  const kind = MEDIA_KINDS.indexOf(input.kind) >= 0 ? input.kind : 'album';
  return {
    item: {
      url,
      // Nhãn do người gõ. Giữ nguyên chữ tiếng Việt, chỉ bỏ ký tự điều khiển; phần chống
      // chèn mã là việc của giao diện (escape + không dùng innerHTML cho chuỗi thô).
      label: String(input.label == null ? '' : input.label).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120),
      kind,
      marketing_ok: input.marketing_ok === true,   // mặc định false, phải gửi đúng true
      added_at: nowISO(),
      added_by: actor || 'unknown'
    }
  };
}

// Xoá có chụp bản gốc. entity: 'lead' | 'partner'. Trả { ok, error?, status? }.
const DELETE_REASONS = ['Nhập trùng', 'Nhập sai', 'Test', 'Khác'];
export { DELETE_REASONS };
export async function deleteWithSnapshot(db, entity, id, actor, reason) {
  const table = entity === 'partner' ? 'partners' : 'leads';
  const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
  if (!row) return { ok: false, status: 404, error: entity === 'partner' ? 'Không có đối tác này' : 'Không có lead này' };
  if (entity === 'lead') {
    let bc = 0;
    try { bc = (await db.prepare('SELECT COUNT(*) AS n FROM booking_confirmations WHERE lead_id = ?').bind(id).first()).n || 0; } catch (e) { bc = 0; }
    if (bc > 0) return { ok: false, status: 409, error: `Job này đã phát hành ${bc} Booking Confirmation cho khách nên không xoá. Khách huỷ thì đổi trạng thái Lost.`, code: 'has_confirmation' };
  } else {
    const n = (await db.prepare('SELECT COUNT(*) AS n FROM leads WHERE partner_id = ?').bind(id).first()).n || 0;
    if (n > 0) return { ok: false, status: 409, error: `Đối tác này đang gắn với ${n} khách. Gỡ Partner ID ở các khách đó trước, hoặc đổi trạng thái Closed.`, code: 'has_leads' };
  }
  const why = cleanStr(reason, 200) || 'Khác';
  await db.batch([
    db.prepare('INSERT INTO lead_events(entity, entity_id, ts, actor, field, old_value, new_value) VALUES (?,?,?,?,?,?,?)')
      .bind(entity, id, nowISO(), actor, 'delete', JSON.stringify(row), why),
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id)
  ]);
  return { ok: true, deleted: { id, entity, reason: why } };
}

// ===================== Hồ sơ buổi làm + link gửi khách (CR-20260916-35) =====================
// Tân 16/09: "không có chỗ để xem hồ sơ lưu của khách... để lần sau khách biết muốn làm i như
// vậy, hay thay đổi chỉnh sửa, thử look mới."
//
// HAI LỚP, MỘT CỬA RA.
//   Lớp NỘI BỘ   : tone, liked, care  → chỉ sống trong CRM sau cổng đăng nhập.
//   Lớp ĐỐI NGOẠI: tone, share.note, đúng các ảnh trong share.photos → khách đọc qua /xem/<token>.
// `publicLook()` dưới đây là CỬA RA DUY NHẤT. Trang công khai không được chạm vào look thô,
// không được tự lọc field, không được thêm một khoá nào "cho tiện". Một hàm, một chỗ để kiểm,
// một chỗ để test. Thêm field mới vào hồ sơ mà quên sửa hàm này thì field đó KHÔNG lọt ra —
// mặc định an toàn, đúng chiều cần thiết.
//
// `liked` và `care` là chỗ Kay ghi thật: khách chê môi nhạt, da dầu 3 tiếng là trôi, mẹ chồng
// khó tính. Ghi thật chỉ xảy ra khi người ghi CHẮC CHẮN khách không bao giờ đọc được. Rò một
// lần là từ đó không ai ghi thật nữa, và cả trường dữ liệu này thành vô dụng.
export const LOOK_TEXT_FIELDS = ['tone', 'liked', 'care'];
export const MAX_SHARE_PHOTOS = 24;

export function parseLook(lead) {
  try { const o = lead && lead.look_json ? JSON.parse(lead.look_json) : {}; return (o && typeof o === 'object') ? o : {}; }
  catch (e) { return {}; }
}

export function normalizeLook(input) {
  const out = {}; const errors = [];
  if (!input || typeof input !== 'object') return { data: out, errors };
  for (const k of LOOK_TEXT_FIELDS) {
    if (!(k in input)) continue;
    out[k] = cleanStr(input[k], 1500);
  }
  if ('share' in input) {
    const s = input.share;
    if (s === null) { out.share = null; }              // null = thu hồi
    else if (typeof s !== 'object') { errors.push('share phải là object hoặc null'); }
    else {
      const sh = {};
      if ('enabled' in s) sh.enabled = s.enabled === true;
      if ('note' in s) sh.note = cleanStr(s.note, 800);
      if ('photos' in s) {
        if (!Array.isArray(s.photos)) errors.push('share.photos phải là mảng');
        else if (s.photos.length > MAX_SHARE_PHOTOS) errors.push(`share.photos tối đa ${MAX_SHARE_PHOTOS} ảnh`);
        // Chỉ nhận key R2 dạng jobs/<id>/<file>. Việc kiểm key có ĐÚNG job này không nằm ở
        // look.js — ở đây chỉ chặn hình dạng rác, không chặn được quyền.
        else sh.photos = s.photos.map(p => cleanStr(p, 300)).filter(p => /^jobs\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(p));
      }
      out.share = sh;
    }
  }
  return { data: out, errors };
}

// Gộp patch vào look cũ. `share` gộp nông một cấp để bật/tắt link không xoá mất danh sách ảnh.
export function mergeLook(before, patch) {
  const next = Object.assign({}, before, patch);
  if ('share' in patch) {
    next.share = patch.share === null ? null : Object.assign({}, before.share || {}, patch.share);
  }
  return next;
}

/* CỬA RA DUY NHẤT cho trang khách xem. Trả về đúng những gì khách được thấy, không hơn.
   Danh sách trắng, không phải danh sách đen: thêm field nội bộ mới vào look_json thì nó
   KHÔNG tự lọt ra đây. Hàm này thuần, không chạm DB, nên test được thẳng. */
export function publicLook(look) {
  const l = look && typeof look === 'object' ? look : {};
  const s = l.share && typeof l.share === 'object' ? l.share : {};
  return {
    tone: cleanStr(l.tone, 1500) || null,
    note: cleanStr(s.note, 800) || null,
    photos: Array.isArray(s.photos) ? s.photos.slice(0, MAX_SHARE_PHOTOS) : []
  };
}

// Link chỉ sống khi CẢ HAI đúng: có token trong cột riêng, và share.enabled === true.
// Hai công tắc có chủ ý: tắt tạm (enabled=false, giữ danh sách ảnh đã chọn) khác thu hồi
// hẳn (share_token = NULL, link cũ chết vĩnh viễn).
export function shareIsLive(lead, look) {
  return !!(lead && lead.share_token && look && look.share && look.share.enabled === true);
}

export function newShareToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===================== Chặn bẫy "code lên trước migration" (CR-20260916-37) =====================
// Ngày 16/09/2026 cái bẫy này sập HAI LẦN trong một ngày:
//   · CR-33 push 15/09, migration 005 không chạy → Booking Confirmation chết trên production
//     suốt gần một ngày, không ai biết, cho tới khi Tân chụp màn hình gửi lên.
//   · CR-35 push 16/09, migration 006 chưa chạy → hồ sơ buổi làm, trang khách và link gửi khách
//     cùng chết. Tân bấm vào đúng lúc đang làm việc.
//
// Cả hai lần triệu chứng y hệt nhau và vô dụng như nhau: Cloudflare trả trang HTML lỗi,
// giao diện ném ra `Unexpected token '<'`. Không nói được thiếu cái gì, không nói được phải
// làm gì. Người ngồi trước màn hình chỉ thấy phần mềm hỏng.
//
// Không thể bắt migration chạy tự động — D1 không có runner, và chạy DDL tự động lúc có
// request là cách hay nhất để hỏng database vào đúng giờ đông khách. Thứ ĐỔI ĐƯỢC là:
// khi thiếu, phải nói ra thiếu migration số mấy, chứ không ném lỗi cú pháp vào mặt người dùng.
//
// Bảng dưới đây map CỘT → SỐ MIGRATION sinh ra nó. Thêm cột mới trong migration nào thì
// thêm một dòng vào đây cùng lúc, đừng để lần sau.
export const COLUMN_MIGRATION = {
  // 002
  booking_json: '002',
  // 004
  contact_key: '004', media_json: '004',
  // 005 (bảng booking_confirmations)
  status: '005', superseded_at: '005', superseded_by_id: '005', superseded_reason: '005', status_set_by: '005',
  // 006
  look_json: '006', share_token: '006'
};

export const TABLE_MIGRATION = { booking_confirmations: '002' };

/* Nhận diện lỗi "database thiếu thứ code đang hỏi". Trả null nếu là lỗi khác — KHÔNG nuốt
   lỗi thật thành thông báo migration, vì như vậy chỉ đổi một lỗi khó hiểu này lấy một lỗi
   khó hiểu khác. D1 gói lỗi kiểu:  D1_ERROR: no such column: look_json: SQLITE_ERROR */
export function migrationGapError(e) {
  const msg = String((e && (e.message || e.cause && e.cause.message)) || e || '');
  let m = /no such column:?\s*([A-Za-z0-9_.]+)/i.exec(msg);
  if (m) {
    const col = m[1].split('.').pop();
    const num = COLUMN_MIGRATION[col];
    return {
      kind: 'column', name: col, migration: num || null,
      message: num
        ? `Tính năng này cần migration ${num} (cột \`${col}\`) mà database chưa chạy. Chạy schema/crm-migration-${num}-*.sql trong D1 Console rồi thử lại.`
        : `Database chưa có cột \`${col}\`. Có migration chưa chạy — xem schema/README_CRM.md.`
    };
  }
  m = /no such table:?\s*([A-Za-z0-9_.]+)/i.exec(msg);
  if (m) {
    const tb = m[1].split('.').pop();
    const num = TABLE_MIGRATION[tb];
    return {
      kind: 'table', name: tb, migration: num || null,
      message: num
        ? `Tính năng này cần migration ${num} (bảng \`${tb}\`) mà database chưa chạy.`
        : `Database chưa có bảng \`${tb}\`. Có migration chưa chạy — xem schema/README_CRM.md.`
    };
  }
  return null;
}

// Phiên bản schema mà CODE HIỆN TẠI cần. Tăng cùng lúc với mỗi migration mới.
export const SCHEMA_VERSION_REQUIRED = '1.5';
