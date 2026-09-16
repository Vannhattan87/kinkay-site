// GET /api/crm/health   → database có khớp với code đang chạy không?
//
// CR-20260916-37 · 16/09/2026.
//
// Tồn tại để trả lời MỘT câu, TRƯỚC khi Kay đụng phải: code vừa deploy có cột nó cần chưa?
//
// Ngày 16/09 bẫy "code lên trước migration" sập hai lần. Cả hai lần đều phát hiện bằng cách
// tệ nhất: người dùng bấm vào rồi thấy hỏng. Endpoint này đọc thẳng PRAGMA table_info và
// so với danh sách cột code cần, nên biết được ngay lúc mở app, không phải đợi ai bấm trúng.
//
// Nhẹ và an toàn: chỉ PRAGMA + một SELECT trên `meta`, không đụng dữ liệu khách.
// Giao diện gọi nó một lần lúc khởi động và treo băng cảnh báo nếu thiếu.
import { json, SCHEMA_VERSION_REQUIRED, COLUMN_MIGRATION } from './_lib.js';

// Cột mà CODE HIỆN TẠI cần. Thêm cột trong migration mới thì thêm vào đây cùng lúc.
const CAN_CO = {
  leads: ['booking_json', 'media_json', 'contact_key', 'look_json', 'share_token'],
  booking_confirmations: ['status', 'superseded_at', 'superseded_by_id', 'superseded_reason', 'status_set_by']
};

async function cotCua(db, bang) {
  try {
    const r = await db.prepare(`PRAGMA table_info(${bang})`).all();
    return new Set((r.results || []).map(x => x.name));
  } catch (e) { return null; }   // bảng chưa có
}

export async function onRequestGet({ env }) {
  const db = env.CRM_DB;
  let schema = null;
  try {
    const r = await db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").first();
    schema = r && r.value || null;
  } catch (e) { schema = null; }

  const thieu = [];
  for (const bang of Object.keys(CAN_CO)) {
    const co = await cotCua(db, bang);
    if (co === null) { thieu.push({ bang, cot: null, migration: '002', ghi_chu: 'chưa có bảng' }); continue; }
    for (const c of CAN_CO[bang]) {
      if (!co.has(c)) thieu.push({ bang, cot: c, migration: COLUMN_MIGRATION[c] || null });
    }
  }

  const so = [...new Set(thieu.map(x => x.migration).filter(Boolean))].sort();
  return json({
    ok: true,
    khop: thieu.length === 0,
    schema_version: schema,
    schema_version_can: SCHEMA_VERSION_REQUIRED,
    thieu,
    migration_can_chay: so,
    // Câu này hiện thẳng lên giao diện, viết cho người đọc chứ không cho máy.
    thong_bao: thieu.length === 0
      ? 'Database khớp với code đang chạy.'
      : `Code đã deploy nhưng database còn thiếu migration ${so.join(', ')}. `
        + `Mở Cloudflare → D1 → kinkay-crm → Console, chạy schema/crm-migration-${so[0]}-*.sql. `
        + `Trước khi chạy xong, các tính năng mới sẽ báo lỗi.`,
    // R2 chưa gắn thì nút chụp ảnh chết — cùng loại bệnh "deploy xong còn thiếu một bước tay".
    kho_anh: env.CRM_MEDIA ? 'đã gắn' : 'CHƯA gắn binding R2 CRM_MEDIA'
  });
}
