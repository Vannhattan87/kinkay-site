// GET  /api/crm/confirmations/BC-KK-260905-001-V1        → snapshot lịch sử (chỉ đọc, sau xác thực CRM). Không có endpoint công khai.
// POST /api/crm/confirmations/BC-KK-260905-001-V1        → đổi TRẠNG THÁI PHÁT HÀNH (CR-20260915-33).
//        body { status:'voided'|'active', reason?:'...' }
//        KHÔNG bao giờ sửa snapshot_json. Snapshot đã phát hành là bất biến, kể cả khi nội dung sai.
//        Sai thì đánh dấu voided để chặn đường gửi, không phải sửa lại lịch sử.
import { json, err, nowISO } from '../_lib.js';

const SETTABLE = ['voided', 'active'];   // 'superseded' do server tự đặt khi phát hành bản mới, người không đặt tay

export async function onRequestGet({ params, env }) {
  const row = await env.CRM_DB.prepare('SELECT * FROM booking_confirmations WHERE id = ?').bind(params.id).first();
  if (!row) return err('Không có confirmation này', 404);
  let snapshot = null; try { snapshot = JSON.parse(row.snapshot_json); } catch (e) { }
  const status = row.status || 'active';
  return json({
    ok: true,
    confirmation: {
      id: row.id, lead_id: row.lead_id, version: row.version,
      generated_at: row.generated_at, generated_by: row.generated_by,
      status, sendable: status === 'active',
      superseded_at: row.superseded_at || null, superseded_by_id: row.superseded_by_id || null,
      superseded_reason: row.superseded_reason || null, status_set_by: row.status_set_by || null,
      snapshot
    }
  });
}

export async function onRequestPost({ params, request, env, data }) {
  const db = env.CRM_DB;
  const row = await db.prepare('SELECT * FROM booking_confirmations WHERE id = ?').bind(params.id).first();
  if (!row) return err('Không có confirmation này', 404);

  let body; try { body = await request.json(); } catch (e) { return err('JSON không hợp lệ'); }
  const next = String(body && body.status || '').trim();
  if (!SETTABLE.includes(next)) return err("status phải là 'voided' hoặc 'active'", 400);

  const cur = row.status || 'active';
  if (cur === next) return json({ ok: true, unchanged: true, status: cur });

  // Gỡ void: chỉ cho quay về 'active' khi bản này KHÔNG bị bản khác thay thế.
  // Nếu đã có bản sau thì trạng thái đúng của nó là 'superseded', không phải 'active'.
  if (next === 'active' && row.superseded_by_id) {
    return err('Bản này đã bị ' + row.superseded_by_id + ' thay thế, không thể đặt lại thành active', 409);
  }

  const reason = String(body && body.reason || '').trim().slice(0, 300) || null;
  if (next === 'voided' && !reason) return err('Phải ghi lý do khi đánh dấu bản này là sai', 400);

  const ts = nowISO();
  if (next === 'voided') {
    await db.prepare('UPDATE booking_confirmations SET status=?, superseded_at=COALESCE(superseded_at,?), superseded_reason=?, status_set_by=? WHERE id=?')
      .bind('voided', ts, reason, data.user, params.id).run();
  } else {
    await db.prepare('UPDATE booking_confirmations SET status=?, superseded_reason=NULL, status_set_by=? WHERE id=?')
      .bind('active', data.user, params.id).run();
  }

  await db.prepare('INSERT INTO lead_events(entity, entity_id, ts, actor, field, old_value, new_value) VALUES (?,?,?,?,?,?,?)')
    .bind('lead', row.lead_id, ts, data.user, 'bc_status:' + params.id, cur, next + (reason ? ' · ' + reason : '')).run();

  return json({ ok: true, id: params.id, status: next, sendable: next === 'active', reason });
}
