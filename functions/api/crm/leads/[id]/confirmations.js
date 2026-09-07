// Booking Confirmation · CR-20260907-29
// GET  /api/crm/leads/:id/confirmations        → { eligible, missing, booking, versions:[{id,version,generated_at,generated_by}] }
// POST /api/crm/leads/:id/confirmations        → body { booking:{...} } → lưu booking_json vào lead (có nhật ký),
//                                                kiểm tra đủ trường, tạo snapshot V(n+1). KHÔNG đụng actual_revenue / actual_verified.
// Cổng cutover của _middleware áp dụng: cutover OFF → POST bị 423 như mọi ghi khác. GET vẫn được.
import { json, err, nowISO, logDiff, parseBooking, normalizeBooking, bookingMissing, buildSnapshot, BC_ELIGIBLE_STATUSES, BC_LANGS } from '../../_lib.js';

// Ngôn ngữ bản xác nhận: 1) preferred_language trên lead → 2) bản phát hành gần nhất → 3) vi. Không đoán từ tên/nguồn.
async function resolveLanguage(db, leadId, booking) {
  if (BC_LANGS.includes(booking.preferred_language)) return { language: booking.preferred_language, from: 'lead' };
  const last = await db.prepare('SELECT snapshot_json FROM booking_confirmations WHERE lead_id = ? ORDER BY version DESC LIMIT 1').bind(leadId).first();
  if (last) { try { const l = JSON.parse(last.snapshot_json).language; if (BC_LANGS.includes(l)) return { language: l, from: 'last_version' }; } catch (e) { } }
  return { language: 'vi', from: 'default' };
}

export async function onRequestGet({ params, env }) {
  const db = env.CRM_DB;
  const lead = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(params.id).first();
  if (!lead) return err('Không có lead này', 404);
  const booking = parseBooking(lead);
  const versions = ((await db.prepare('SELECT id, version, generated_at, generated_by, snapshot_json FROM booking_confirmations WHERE lead_id = ? ORDER BY version DESC').bind(params.id).all()).results || [])
    .map(v => { let language = null; try { language = JSON.parse(v.snapshot_json).language || null; } catch (e) { } return { id: v.id, version: v.version, generated_at: v.generated_at, generated_by: v.generated_by, language }; });
  const lang = await resolveLanguage(db, params.id, booking);
  return json({ ok: true, eligible: BC_ELIGIBLE_STATUSES.includes(lead.status), missing: bookingMissing(lead, booking), booking, versions, language: lang.language, language_from: lang.from });
}

export async function onRequestPost({ params, request, env, data }) {
  const db = env.CRM_DB;
  const lead = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(params.id).first();
  if (!lead) return err('Không có lead này', 404);
  if (!BC_ELIGIBLE_STATUSES.includes(lead.status)) return err('Chỉ tạo Booking Confirmation khi trạng thái là Quoted / Hold / Deposit Paid / Confirmed', 400, lead.status);
  let body; try { body = await request.json(); } catch (e) { return err('JSON không hợp lệ'); }
  const before = parseBooking(lead);
  const { data: patch, errors } = normalizeBooking(body.booking || {});
  // Ngôn ngữ bản này: body.language (Kay chọn) → lưu luôn thành preferred_language của lead để lần sau không phải chọn lại.
  if (body.language != null) { if (!BC_LANGS.includes(body.language)) errors.push('language phải là vi hoặc en'); else patch.preferred_language = body.language; }
  if (errors.length) return err('Dữ liệu booking chưa hợp lệ', 400, errors);
  const booking = Object.assign({}, before, patch);

  // Lưu booking_json nếu có thay đổi (ghi nhật ký từng trường). expected_revenue chỉ điền khi ĐANG TRỐNG và Kay nhập total_fee.
  const ts = nowISO();
  const upd = {}; const diff = {};
  if (JSON.stringify(booking) !== JSON.stringify(before)) { upd.booking_json = JSON.stringify(booking); for (const k of Object.keys(patch)) if (String(before[k] ?? '') !== String(patch[k] ?? '')) diff['booking.' + k] = patch[k]; }
  if (lead.expected_revenue == null && booking.total_fee != null) { upd.expected_revenue = booking.total_fee; diff.expected_revenue = booking.total_fee; }
  if (Object.keys(upd).length) {
    upd.last_updated = ts; upd.updated_by = data.user;
    await db.prepare(`UPDATE leads SET ${Object.keys(upd).map(k => k + ' = ?').join(', ')} WHERE id = ?`).bind(...Object.keys(upd).map(k => upd[k]), params.id).run();
    const beforeFlat = {}; for (const k of Object.keys(diff)) beforeFlat[k] = k.startsWith('booking.') ? before[k.slice(8)] : lead[k.replace('booking.', '')];
    await logDiff(db, 'lead', params.id, data.user, beforeFlat, diff);
    Object.assign(lead, upd);
  }

  const missing = bookingMissing(lead, booking);
  if (missing.length) return json({ ok: false, error: 'Còn thiếu thông tin cho khách', missing, booking }, 422);
  const language = (await resolveLanguage(db, params.id, booking)).language;

  // Version kế tiếp; UNIQUE(lead_id, version) + thử lại chống 2 lần bấm cùng lúc.
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS v FROM booking_confirmations WHERE lead_id = ?').bind(params.id).first();
    const version = r.v; const id = `BC-${params.id}-V${version}`;
    const snapshot = buildSnapshot(lead, booking, id, version, ts, language);
    try {
      await db.prepare('INSERT INTO booking_confirmations (id, lead_id, version, snapshot_json, generated_at, generated_by) VALUES (?,?,?,?,?,?)')
        .bind(id, params.id, version, JSON.stringify(snapshot), ts, data.user).run();
      await db.prepare('INSERT INTO lead_events(entity, entity_id, ts, actor, field, old_value, new_value) VALUES (?,?,?,?,?,?,?)')
        .bind('lead', params.id, ts, data.user, 'booking_confirmation', null, id).run();
      return json({ ok: true, confirmation: { id, version, generated_at: ts, generated_by: data.user, snapshot } }, 201);
    } catch (e) { if (!/UNIQUE|constraint/i.test(String(e && e.message))) return err('Không lưu được confirmation', 500, e && e.message); }
  }
  return err('Không cấp được số version', 500);
}
