// GET /api/crm/history?lead=KK-260905-001   → các job KHÁC có CÙNG SỐ LIÊN HỆ với job này
// GET /api/crm/history?contact=0933953179   → tra thẳng bằng một chuỗi liên hệ bất kỳ
//
// CR-20260913-32 · T0 · 14/09/2026. Duyệt: Tân (ngoại lệ hẹp DEC-20260906-03).
//
// ĐÂY LÀ TRA CỨU, KHÔNG PHẢI HỒ SƠ KHÁCH HÀNG.
// Endpoint trả các job dùng CÙNG MỘT SỐ LIÊN HỆ đã chuẩn hoá. Nó KHÔNG khẳng định
// chúng là của cùng một người, và KHÔNG tạo bất kỳ liên kết nào trong database.
// Một số điện thoại có thể là của mẹ cô dâu, của planner đặt cho nhiều cô dâu khác nhau,
// hoặc của người vừa đổi chủ số. Vì vậy mọi phản hồi đều mang cờ `confirmed_same_person: false`
// và `warning` — giao diện BẮT BUỘC hiển thị, không được nuốt đi cho gọn.
//
// Việc "Kay xác nhận đây đúng là khách cũ X" thuộc T1, đang HOLD, chưa có ở đây.
// Đừng dùng số đếm của endpoint này làm KPI khách quay lại chính thức.
import { json, err, contactKey } from './_lib.js';

const WARNING = 'Cùng số liên hệ · CHƯA xác nhận là cùng một người. '
              + 'Số này có thể là của người đặt hộ (mẹ, planner) hoặc đã đổi chủ. Kay tự kiểm trước khi dùng.';

export async function onRequestGet({ request, env }) {
  const db = env.CRM_DB;
  const u = new URL(request.url);
  const leadId = (u.searchParams.get('lead') || '').trim();
  const rawContact = (u.searchParams.get('contact') || '').trim();

  let key = null, self = null;
  if (leadId) {
    self = await db.prepare('SELECT id, customer_name, contact, contact_key FROM leads WHERE id = ?').bind(leadId).first();
    if (!self) return err('Không có lead này', 404);
    // Dòng cũ chưa backfill thì tính tại chỗ — không ghi gì vào DB, chỉ để tra cho ra kết quả.
    key = self.contact_key || contactKey(self.contact);
  } else if (rawContact) {
    key = contactKey(rawContact);
  } else {
    return err('Cần ?lead= hoặc ?contact=');
  }

  // Không có khoá hợp lệ (khách chưa để liên hệ, hoặc để "N/A") → KHÔNG tra.
  // Trả rỗng chứ không gom mọi bản ghi thiếu liên hệ lại với nhau.
  if (!key) {
    return json({
      ok: true, contact_key: null, confirmed_same_person: false,
      count: 0, jobs: [],
      note: 'Job này chưa có liên hệ hợp lệ nên không tra được. Không gom chung với các job khác cũng thiếu liên hệ.'
    });
  }

  const args = [key];
  let sql = 'SELECT id, created_date, customer_name, contact, contact_channel, service, event_date, status, '
          + 'expected_revenue, actual_revenue, owner, media_json FROM leads WHERE contact_key = ?';
  if (leadId) { sql += ' AND id != ?'; args.push(leadId); }
  sql += ' ORDER BY COALESCE(event_date, created_date) DESC, id DESC LIMIT 100';

  const rows = (await db.prepare(sql).bind(...args).all()).results || [];

  // Tên khác nhau trên cùng một số là tín hiệu đáng chú ý, không phải lỗi: rất có thể là
  // người đặt hộ. Đếm ra đây để giao diện cảnh báo mạnh hơn thay vì để Kay tự nhận ra.
  const names = new Set(rows.map(r => String(r.customer_name || '').trim().toLowerCase()).filter(Boolean));
  if (self && self.customer_name) names.add(String(self.customer_name).trim().toLowerCase());

  return json({
    ok: true,
    contact_key: key,
    confirmed_same_person: false,      // T1 mới có xác nhận; đợt này luôn false
    warning: WARNING,
    distinct_names: names.size,
    mixed_names: names.size > 1,       // >1 tên trên cùng số → gần như chắc có người đặt hộ
    count: rows.length,
    jobs: rows
  });
}
