// POST   /api/crm/leads/KK-260914-005/share   → tạo (hoặc đổi) link gửi khách, bật luôn
// DELETE /api/crm/leads/KK-260914-005/share   → THU HỒI: link cũ chết vĩnh viễn
//
// CR-20260916-35 · 16/09/2026.
//
// Khách không có tài khoản, nên /xem/<token> nằm NGOÀI cổng xác thực. Thứ duy nhất đứng
// giữa ảnh của khách và cả internet là token 32 ký tự hex từ crypto.getRandomValues.
// Vì vậy ở đây có mấy luật cứng, đừng nới:
//
//   1. TOKEN KHÔNG BAO GIỜ TÁI SỬ DỤNG. Mỗi lần POST sinh token hoàn toàn mới. Gửi nhầm
//      người thì POST lại là link cũ chết ngay, không cần chờ gì.
//   2. THU HỒI LÀ GÁN NULL, không phải hạ cờ. Cờ `enabled` là tắt tạm (giữ danh sách ảnh
//      Kay đã chọn); DELETE là dập cầu dao — token biến mất khỏi database, link cũ trả 404
//      và không có đường sống lại.
//   3. TẠO LINK KHÔNG TỰ CHỌN ẢNH. Mặc định 0 ảnh. Kay tick từng tấm. Mặc định phải là
//      "chưa gửi gì cả", vì cái giá của mặc định sai ở đây là ảnh khách lọt ra ngoài.
import { json, err, parseLook, mergeLook, shareIsLive, newShareToken, logDiff, nowISO } from '../../_lib.js';

async function load(db, id) {
  return db.prepare('SELECT id, customer_name, look_json, share_token FROM leads WHERE id = ?').bind(id).first();
}

export async function onRequestPost({ params, request, env, data }) {
  const db = env.CRM_DB;
  const lead = await load(db, params.id);
  if (!lead) return err('Không có lead này', 404);

  const before = parseLook(lead);
  const had = !!lead.share_token;

  // Vòng lặp chống đụng token. 16 byte ngẫu nhiên thì xác suất trùng gần như không có,
  // nhưng cột đang UNIQUE — đụng một lần mà không bắt là 500 vào mặt Kay giữa buổi làm.
  let token = null;
  for (let i = 0; i < 5 && !token; i++) {
    const t = newShareToken();
    const dup = await db.prepare('SELECT id FROM leads WHERE share_token = ?').bind(t).first();
    if (!dup) token = t;
  }
  if (!token) return err('Không sinh được mã link, thử lại', 503);

  // Giữ nguyên ảnh Kay đã tick lần trước khi chỉ đổi link; enabled bật lên.
  const look = mergeLook(before, { share: { enabled: true } });
  if (!Array.isArray(look.share.photos)) look.share.photos = [];
  look.share.created_at = nowISO();
  look.share.created_by = data.user;

  await db.prepare('UPDATE leads SET share_token = ?, look_json = ?, last_updated = ?, updated_by = ? WHERE id = ?')
    .bind(token, JSON.stringify(look), nowISO(), data.user, params.id).run();

  await logDiff(db, 'lead', params.id, data.user, { 'look.share': had ? 'đang có link' : null },
    { 'look.share': had ? 'đổi link mới, link cũ đã chết' : 'tạo link gửi khách' });

  return json({
    ok: true, share_url: '/xem/' + token, share_live: true,
    so_anh_dang_gui: look.share.photos.length,
    nhac: look.share.photos.length ? undefined : 'Link đã bật nhưng chưa tick ảnh nào. Khách mở ra sẽ chưa thấy ảnh.'
  }, 201);
}

export async function onRequestDelete({ params, env, data }) {
  const db = env.CRM_DB;
  const lead = await load(db, params.id);
  if (!lead) return err('Không có lead này', 404);
  const before = parseLook(lead);
  const wasLive = shareIsLive(lead, before);

  // Hạ cờ CÙNG LÚC với xoá token. Nếu chỉ xoá token mà để enabled=true thì lần tạo link sau
  // sẽ bật sẵn mà Kay không chủ động bật — mất một bước có ý thức.
  const look = mergeLook(before, { share: { enabled: false } });

  await db.prepare('UPDATE leads SET share_token = NULL, look_json = ?, last_updated = ?, updated_by = ? WHERE id = ?')
    .bind(JSON.stringify(look), nowISO(), data.user, params.id).run();

  await logDiff(db, 'lead', params.id, data.user, { 'look.share': wasLive ? 'đang bật' : 'đang tắt' },
    { 'look.share': 'thu hồi link, link cũ đã chết' });

  return json({ ok: true, share_live: false, note: 'Đã thu hồi. Link cũ không mở được nữa, kể cả người đã lưu lại.' });
}
