// GET   /api/crm/leads/KK-260905-001   → 1 lead + nhật ký thay đổi
// PATCH /api/crm/leads/KK-260905-001   → cập nhật nhanh (chỉ gửi cột cần đổi; Kay 60s)
// DELETE /api/crm/leads/KK-260905-001  {reason} → xoá bản ghi NHẬP SAI / TRÙNG / TEST (Tân yêu cầu 11/09/2026)
//   Khách thật không chốt vẫn là Status = Lost, không xoá. Xoá chụp nguyên dòng vào lead_events → khôi phục ở /api/crm/trash.
//   Chặn xoá khi job đã phát hành Booking Confirmation (khách đã cầm bản xác nhận).
import { json, err, normalize, LEAD_FIELDS, logDiff, nowISO, deleteWithSnapshot } from '../_lib.js';

export async function onRequestGet({ params, env }) {
  const db = env.CRM_DB;
  const lead = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(params.id).first();
  if (!lead) return err('Không có lead này', 404);
  const events = (await db.prepare('SELECT ts, actor, field, old_value, new_value FROM lead_events WHERE entity = ? AND entity_id = ? ORDER BY id DESC LIMIT 100')
    .bind('lead', params.id).all()).results || [];
  let partner = null;
  if (lead.partner_id) partner = await db.prepare('SELECT id, name, type, status, commercial_terms, referral_rate FROM partners WHERE id = ?').bind(lead.partner_id).first();
  return json({ ok: true, lead, partner, events });
}

export async function onRequestPatch({ params, request, env, data }) {
  const db = env.CRM_DB;
  const before = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(params.id).first();
  if (!before) return err('Không có lead này', 404);
  let body;
  try { body = await request.json(); } catch (e) { return err('JSON không hợp lệ'); }
  const { data: d, errors } = normalize(body, LEAD_FIELDS);
  if ('customer_name' in d && !d.customer_name) errors.push('customer_name: không được để trống');
  if (errors.length) return err('Dữ liệu chưa hợp lệ', 400, errors);
  // Luật tiền thật: sửa actual_revenue thì cờ verified reset về 0 trừ khi gửi kèm actual_verified=true (Tân xác minh).
  if ('actual_revenue' in d && !('actual_verified' in d)) d.actual_verified = 0;
  const keys = Object.keys(d);
  if (!keys.length) return err('Không có gì để cập nhật');
  d.last_updated = nowISO();
  d.updated_by = data.user;
  const set = Object.keys(d).map(k => `${k} = ?`).join(', ');
  await db.prepare(`UPDATE leads SET ${set} WHERE id = ?`).bind(...Object.keys(d).map(k => d[k]), params.id).run();
  const changed = await logDiff(db, 'lead', params.id, data.user, before, Object.fromEntries(keys.map(k => [k, d[k]])));
  const after = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(params.id).first();
  return json({ ok: true, changed, lead: after });
}

export async function onRequestDelete({ params, request, env, data }) {
  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }
  const r = await deleteWithSnapshot(env.CRM_DB, 'lead', params.id, data.user, body.reason);
  if (!r.ok) return json({ ok: false, error: r.error, code: r.code }, r.status);
  return json(r);
}
