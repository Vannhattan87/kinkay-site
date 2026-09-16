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
  /* CR-20260916-34: giờ có HAI loại mục trong một job.
       kind 'album' → link Drive https, file của người khác giữ, gỡ ở đây không đụng tới file.
       kind 'photo' → ảnh chụp tại chỗ nằm trong R2, url là đường nội bộ /api/crm/media/<key>
                      nên KHÔNG đi qua cleanMediaUrl() được (hàm đó chỉ nhận https://).
     Vì vậy: khớp theo chuỗi url y nguyên trong danh sách, chứ không chuẩn hoá lại. Chuỗi này
     chỉ dùng để SO SÁNH, không bao giờ được dựng thành thẻ <a> ở đây. */
  const want = String(body.url == null ? '' : body.url).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 2000);
  if (!want) return err('Cần { url } của mục muốn gỡ');

  const list = parseMedia(lead);
  const hit = list.find(m => m && m.url === want);
  if (!hit) return err('Job này không có mục đó', 404);
  const next = list.filter(m => m !== hit);

  /* Ảnh chụp tại chỗ: XOÁ LUÔN FILE TRONG R2. Khác hẳn album Drive.
     Lý do: file này chỉ tồn tại vì dòng metadata này. Gỡ dòng mà để file lại là sinh ra ảnh
     khách nằm trong kho mà không ai còn biết của ai — đúng thứ không được để xảy ra với ảnh
     người thật. Xoá file TRƯỚC khi ghi D1: nếu R2 lỗi thì dừng, dòng metadata còn nguyên và
     bấm lại được. Ngược lại sẽ mất dấu file. */
  if (hit.kind === 'photo' && hit.key) {
    if (!env.CRM_MEDIA) return err('Chưa gắn kho ảnh CRM_MEDIA nên chưa xoá được ảnh này', 503, 'r2_missing');
    await env.CRM_MEDIA.delete(hit.key);
  }

  await save(db, lead.id, next, data.user);
  await logDiff(db, 'lead', lead.id, data.user, {}, { media_removed: hit.kind === 'photo' ? 'ảnh chụp (đã xoá file)' : '1 link' });
  return json({
    ok: true, media: next,
    note: hit.kind === 'photo' ? 'Đã xoá ảnh khỏi job và khỏi kho.' : 'Đã gỡ khỏi job. File trên Drive không bị xoá.'
  });
}
