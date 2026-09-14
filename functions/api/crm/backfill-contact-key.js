// GET  /api/crm/backfill-contact-key            → CHẠY KHÔ. Không ghi gì. Báo cáo sẽ đổi những gì.
// POST /api/crm/backfill-contact-key {apply:true} → ghi thật.
//
// CR-20260913-32 · T0 · 14/09/2026.
//
// VÌ SAO PHẢI CHẠY BẰNG JS CHỨ KHÔNG PHẢI MỘT CÂU UPDATE SQL:
// `contact_key` là kết quả của `normContact()` — bỏ dấu, bắt SĐT trong chuỗi lẫn chữ,
// đổi +84/84 thành 0, loại giá trị giữ chỗ ("N/A", "chưa có", "0000"), cắt tiền tố
// instagram.com/facebook.com. SQLite của D1 không làm nổi. Viết lại logic đó bằng SQL là
// tạo ra bản chuẩn hoá THỨ HAI — rồi lúc tra sẽ lệch với lúc ghi. Một hàm duy nhất.
//
// BA RÀNG BUỘC LUNA ĐẶT, thực thi ở đây:
//   1. CHỈ ghi giá trị tra cứu đã chuẩn hoá. Không tạo bất kỳ quan hệ người nào.
//   2. contact rỗng / không hợp lệ → để NULL, KHÔNG dồn chung thành một nhóm.
//   3. Có chạy khô, báo số nhóm và các nhóm đáng ngờ, trước khi ghi.
//
// KHÔNG đụng tới ID job, không đổi cột nào khác, không xoá gì. Chạy lại nhiều lần cho ra
// cùng kết quả. Quay lui = ngừng đọc cột (không xoá cột production — yêu cầu của Tân).
import { json, err, contactKey, nowISO } from './_lib.js';

async function scan(db) {
  const rows = (await db.prepare(
    'SELECT id, customer_name, contact, contact_key FROM leads ORDER BY id'
  ).all()).results || [];

  const toWrite = [];      // dòng cần đổi
  const groups = {};       // key -> [{id, name}]
  let noContact = 0, already = 0;

  for (const r of rows) {
    const want = contactKey(r.contact);
    if (want === null) noContact++;
    else (groups[want] = groups[want] || []).push({ id: r.id, name: String(r.customer_name || '').trim() });

    const have = r.contact_key === undefined ? null : r.contact_key;
    if ((have || null) === want) { already++; continue; }
    toWrite.push({ id: r.id, from: have, to: want });
  }

  // Nhóm có NHIỀU TÊN KHÁC NHAU trên cùng một số = gần như chắc có người đặt hộ
  // (mẹ cô dâu, planner). Không phải lỗi, và tuyệt đối KHÔNG được tự gộp — chỉ nêu ra
  // để Tân và Luna nhìn trước khi bấm ghi.
  const mixed = Object.keys(groups).map(k => {
    const names = [...new Set(groups[k].map(x => x.name.toLowerCase()).filter(Boolean))];
    return names.length > 1
      ? { contact_key: k, jobs: groups[k].length, names: [...new Set(groups[k].map(x => x.name))] }
      : null;
  }).filter(Boolean);

  const keys = Object.keys(groups);
  return {
    total_leads: rows.length,
    no_valid_contact: noContact,        // sẽ để NULL, không gom nhóm
    already_correct: already,
    will_write: toWrite.length,
    distinct_keys: keys.length,
    keys_with_multiple_jobs: keys.filter(k => groups[k].length > 1).length,
    mixed_name_groups: mixed,           // xem kỹ mấy nhóm này
    sample: toWrite.slice(0, 20),
    _toWrite: toWrite
  };
}

export async function onRequestGet({ env }) {
  const r = await scan(env.CRM_DB);
  delete r._toWrite;
  return json({
    ok: true, mode: 'dry-run', wrote: 0,
    note: 'Chưa ghi gì. Muốn ghi thật thì POST cùng endpoint với body {"apply":true}.',
    ...r
  });
}

export async function onRequestPost({ request, env, data }) {
  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }
  // Cố ý bắt gửi đúng `apply:true`. Gọi nhầm POST không được phép ghi vào production.
  if (body.apply !== true) return err('Cần {"apply": true} để ghi thật. Không có thì dùng GET để chạy khô.');

  const r = await scan(env.CRM_DB);
  const toWrite = r._toWrite; delete r._toWrite;

  let wrote = 0;
  const failed = [];
  for (const w of toWrite) {
    try {
      // CHỈ đụng `contact_key`. Không chạm last_updated/updated_by: đây là việc dọn nội bộ,
      // không phải Kay sửa hồ sơ — ghi đè dấu vết sửa của cô ấy là làm hỏng nhật ký.
      await env.CRM_DB.prepare('UPDATE leads SET contact_key = ? WHERE id = ?').bind(w.to, w.id).run();
      wrote++;
    } catch (e) { failed.push({ id: w.id, error: e && e.message }); }
  }

  // Một dòng nhật ký cho cả đợt, ghi SỰ VIỆC chứ không ghi liên hệ của khách
  // (`lead_events` xuất được ra CSV — xem lỗ export đã nêu trong packet CR-32 09:05).
  try {
    await env.CRM_DB.prepare(
      'INSERT INTO lead_events(entity, entity_id, ts, actor, field, old_value, new_value) VALUES (?,?,?,?,?,?,?)'
    ).bind('lead', 'BACKFILL-CR32', nowISO(), data && data.user || 'system', 'contact_key_backfill',
           null, `${wrote}/${toWrite.length} dòng`).run();
  } catch (e) { /* nhật ký hỏng không được làm hỏng kết quả backfill */ }

  return json({ ok: failed.length === 0, mode: 'apply', wrote, failed, ...r });
}
