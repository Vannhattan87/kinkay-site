// GET    /api/crm/leads/KK-260905-001/media        → danh sách ảnh/album của ĐÚNG job này
// POST   /api/crm/leads/KK-260905-001/media        {url, label?, kind?, marketing_ok?} → thêm 1 mục
// DELETE /api/crm/leads/KK-260905-001/media        {url}  → gỡ 1 mục khỏi job này
//
// CR-20260913-32 · T3 · 14/09/2026. Duyệt: Tân (ngoại lệ hẹp DEC-20260906-03).
//
// ẢNH GẮN VỚI JOB, KHÔNG GẮN VỚI KHÁCH. Ảnh sinh ra tại một buổi cụ thể — ngày đó, look đó,
// người làm đó. Gắn theo khách là mất thông tin "của lần nào", phần có giá trị nhất khi
// Kay mở lại trước buổi sau. Trang khách chỉ TỔNG HỢP từ các job, không sở hữu ảnh.
//
// D1 giữ metadata + link + quyền. FILE KHÔNG NẰM Ở ĐÂY — file ở Google Drive.
// `marketing_ok` mặc định false, phải bật riêng từng mục: quyền xem nội bộ khác quyền dùng
// cho marketing. Khách để Kay xem lại lần sau KHÔNG có nghĩa đồng ý cho lên website.
import { json, err, parseMedia, buildMediaItem, cleanMediaUrl, logDiff, nowISO } from '../../_lib.js';

async function loadLead(db, id) {
  return db.prepare('SELECT id, customer_name, media_json FROM leads WHERE id = ?').bind(id).first();
}

// Ghi lại cả mảng. An toàn ở đây vì media là một danh sách nhỏ do MỘT người (Kay) sửa tay
// trong giao diện admin, không phải đường ghi tự động như `notes` của form web — chỗ đó đã
// phải chuyển sang append nguyên tử vì hai request đồng thời (xem lead.js 13/09).
async function save(db, id, list, actor) {
  await db.prepare('UPDATE leads SET media_json = ?, last_updated = ?, updated_by = ? WHERE id = ?')
    .bind(JSON.stringify(list), nowISO(), actor, id).run();
}

export async function onRequestGet({ params, env }) {
  const lead = await loadLead(env.CRM_DB, params.id);
  if (!lead) return err('Không có lead này', 404);
  const media = parseMedia(lead);
  return json({
    ok: true, lead_id: lead.id, count: media.length, media,
    marketing_ok_count: media.filter(m => m.marketing_ok === true).length
  });
}

export async function onRequestPost({ params, request, env, data }) {
  const db = env.CRM_DB;
  const lead = await loadLead(db, params.id);
  if (!lead) return err('Không có lead này', 404);

  let body;
  try { body = await request.json(); } catch (e) { return err('JSON không hợp lệ'); }

  const built = buildMediaItem(body, data.user);
  if (built.error) return err(built.error);

  const list = parseMedia(lead);
  if (list.some(m => m.url === built.item.url)) return err('Link này đã có trong job', 409);
  if (list.length >= 30) return err('Một job tối đa 30 mục. Gom vào một album Drive rồi dán 1 link.', 409);

  list.push(built.item);
  await save(db, lead.id, list, data.user);
  // Nhật ký ghi SỰ VIỆC, không ghi nguyên nội dung: `lead_events` xuất được ra CSV.
  await logDiff(db, 'lead', lead.id, data.user, {}, { media_added: built.item.label || built.item.kind });
  return json({ ok: true, media: list, added: built.item }, 201);
}

export async function onRequestDelete({ params, request, env, data }) {
  const db = env.CRM_DB;
  const lead = await loadLead(db, params.id);
  if (!lead) return err('Không có lead này', 404);

  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }
  const url = cleanMediaUrl(body.url);
  if (!url) return err('Cần { url } của mục muốn gỡ');

  const list = parseMedia(lead);
  const next = list.filter(m => m.url !== url);
  if (next.length === list.length) return err('Job này không có link đó', 404);

  await save(db, lead.id, next, data.user);
  // Gỡ khỏi CRM không xoá file trên Drive — file vẫn nguyên, chỉ mất liên kết ở đây.
  await logDiff(db, 'lead', lead.id, data.user, {}, { media_removed: '1 mục' });
  return json({ ok: true, media: next, note: 'Đã gỡ khỏi job. File trên Drive không bị xoá.' });
}
