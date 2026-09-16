// GET   /api/crm/leads/KK-260914-005/look   → hồ sơ buổi làm (ĐẦY ĐỦ, nội bộ)
// PATCH /api/crm/leads/KK-260914-005/look   {look:{tone?, liked?, care?, share?}}
//
// CR-20260916-35 · 16/09/2026. Duyệt: Tân (ngoại lệ hẹp DEC-20260906-03).
//
// HỒ SƠ GẮN VỚI BUỔI LÀM, KHÔNG GẮN VỚI KHÁCH — cùng nguyên tắc đã áp cho ảnh ở CR-32.
// "Lần trước làm tông gì" chỉ có nghĩa khi biết lần trước là buổi NÀO. Gom theo khách là
// mất đúng phần đáng giá: khách cưới tháng 11 và khách đi tiệc tháng 3 là hai look khác hẳn,
// hai lưu ý khác hẳn, dù cùng một người.
//
// Trang khách (gom theo số liên hệ) chỉ XẾP các hồ sơ này cạnh nhau theo thời gian.
// Nó không sở hữu dữ liệu và không được đẻ ra một "hồ sơ khách" thứ hai.
//
// Đường này KHÔNG đụng booking_json và KHÔNG phát hành gì cho khách. Muốn khách xem được
// phải tạo link riêng ở /share, và ngay cả khi có link thì `liked` + `care` vẫn không ra.
import { json, err, parseLook, normalizeLook, mergeLook, publicLook, shareIsLive, parseMedia, logDiff, nowISO } from '../../_lib.js';

async function load(db, id) {
  return db.prepare('SELECT id, customer_name, service, event_date, look_json, media_json, share_token FROM leads WHERE id = ?').bind(id).first();
}

function shape(lead, look) {
  return {
    look,
    share_live: shareIsLive(lead, look),
    share_url: shareIsLive(lead, look) ? '/xem/' + lead.share_token : null,
    // Cho giao diện thấy ĐÚNG những gì khách sẽ đọc, không bắt Kay tin lời hứa.
    preview_khach_thay: publicLook(look)
  };
}

export async function onRequestGet({ params, env }) {
  const lead = await load(env.CRM_DB, params.id);
  if (!lead) return err('Không có lead này', 404);
  return json(Object.assign({ ok: true, lead_id: lead.id }, shape(lead, parseLook(lead))));
}

export async function onRequestPatch({ params, request, env, data }) {
  const db = env.CRM_DB;
  const lead = await load(db, params.id);
  if (!lead) return err('Không có lead này', 404);

  let body; try { body = await request.json(); } catch (e) { return err('JSON không hợp lệ'); }
  const before = parseLook(lead);
  const { data: patch, errors } = normalizeLook(body.look || {});
  if (errors.length) return err('Dữ liệu chưa hợp lệ', 400, errors);
  if (!Object.keys(patch).length) return err('Không có gì để cập nhật');

  /* Ảnh gửi khách phải là ảnh CỦA CHÍNH JOB NÀY và phải là ảnh trong kho (kind 'photo').
     normalizeLook() chỉ chặn được hình dạng chuỗi; quyền phải kiểm ở đây, nơi biết job nào.
     Không có bước này thì một key gõ tay trỏ sang job khác sẽ mở ảnh của khách khác qua
     link công khai — đúng kiểu lỗi không ai phát hiện cho tới lúc muộn. */
  if (patch.share && Array.isArray(patch.share.photos)) {
    const own = new Set(parseMedia(lead).filter(m => m && m.kind === 'photo' && m.key).map(m => m.key));
    const lac = patch.share.photos.filter(k => !own.has(k));
    if (lac.length) return err('Có ảnh không thuộc job này', 400, lac.slice(0, 3));
  }

  const look = mergeLook(before, patch);
  look.updated_at = nowISO();
  look.updated_by = data.user;

  await db.prepare('UPDATE leads SET look_json = ?, last_updated = ?, updated_by = ? WHERE id = ?')
    .bind(JSON.stringify(look), nowISO(), data.user, params.id).run();

  /* Nhật ký ghi CÓ ĐỔI HAY KHÔNG, không ghi nội dung. `liked` và `care` là nhận xét về một
     người thật; `lead_events` thì xuất được ra CSV và đi xa hơn màn hình này nhiều. */
  const diff = {}; const flat = {};
  for (const k of ['tone', 'liked', 'care']) {
    if (!(k in patch)) continue;
    if (String(before[k] ?? '') === String(look[k] ?? '')) continue;
    flat['look.' + k] = before[k] ? 'đã có' : null;
    diff['look.' + k] = look[k] ? 'đã ghi' : 'đã xoá';
  }
  if ('share' in patch) {
    const wasLive = shareIsLive(lead, before), nowLive = shareIsLive(lead, look);
    const nB = (before.share && before.share.photos || []).length, nA = (look.share && look.share.photos || []).length;
    if (wasLive !== nowLive) { flat['look.share'] = wasLive ? 'đang bật' : 'đang tắt'; diff['look.share'] = nowLive ? 'bật link gửi khách' : 'tắt link gửi khách'; }
    else if (nB !== nA) { flat['look.share_photos'] = String(nB); diff['look.share_photos'] = String(nA); }
  }
  const changed = await logDiff(db, 'lead', params.id, data.user, flat, diff);

  return json(Object.assign({ ok: true, changed }, shape(lead, look)));
}
