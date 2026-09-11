// GET  /api/crm/trash?entity=lead|partner   → bản ghi đã xoá (chưa khôi phục), mới nhất trước
// POST /api/crm/trash  {entity, id}          → khôi phục nguyên dòng gốc, giữ nguyên ID
// Bản gốc nằm trong lead_events (field='delete', old_value = JSON toàn bộ dòng). Xem deleteWithSnapshot trong _lib.js.
import { json, err, nowISO } from './_lib.js';

const TABLE = { lead: 'leads', partner: 'partners' };

export async function onRequestGet({ request, env }) {
  const db = env.CRM_DB;
  const entity = new URL(request.url).searchParams.get('entity') || 'lead';
  const table = TABLE[entity];
  if (!table) return err('entity phải là lead | partner');
  const rows = (await db.prepare(`
    SELECT e.id AS event_id, e.entity, e.entity_id, e.ts, e.actor, e.new_value AS reason, e.old_value AS snapshot
    FROM lead_events e
    WHERE e.entity = ? AND e.field = 'delete'
      AND e.id = (SELECT MAX(id) FROM lead_events x WHERE x.entity = e.entity AND x.entity_id = e.entity_id AND x.field = 'delete')
      AND NOT EXISTS (SELECT 1 FROM ${table} t WHERE t.id = e.entity_id)
    ORDER BY e.id DESC LIMIT 100`).bind(entity).all()).results || [];
  const items = rows.map(r => {
    let s = {}; try { s = JSON.parse(r.snapshot); } catch (e) { }
    return {
      entity: r.entity, id: r.entity_id, deleted_at: r.ts, deleted_by: r.actor, reason: r.reason,
      name: s.customer_name || s.name || '', service: s.service || s.type || null, event_date: s.event_date || null,
      status: s.status || null, expected_revenue: s.expected_revenue ?? null
    };
  });
  return json({ ok: true, entity, count: items.length, items });
}

export async function onRequestPost({ request, env, data }) {
  const db = env.CRM_DB;
  let body;
  try { body = await request.json(); } catch (e) { return err('JSON không hợp lệ'); }
  const entity = body.entity || 'lead';
  const table = TABLE[entity];
  if (!table || !body.id) return err('Cần entity (lead | partner) và id');
  const exists = await db.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(body.id).first();
  if (exists) return err('Bản ghi này đang tồn tại, không cần khôi phục', 409);
  const ev = await db.prepare(`SELECT old_value FROM lead_events WHERE entity = ? AND entity_id = ? AND field = 'delete' ORDER BY id DESC LIMIT 1`).bind(entity, body.id).first();
  if (!ev) return err('Không tìm thấy bản gốc đã xoá', 404);
  let row;
  try { row = JSON.parse(ev.old_value); } catch (e) { return err('Bản gốc hỏng, không đọc được', 500); }
  // Chỉ chèn các cột bảng hiện có (schema có thể đã thêm/bớt cột sau lúc xoá).
  let cols = Object.keys(row);
  try {
    const info = (await db.prepare(`PRAGMA table_info(${table})`).all()).results || [];
    if (info.length) { const have = new Set(info.map(c => c.name)); cols = cols.filter(c => have.has(c)); }
  } catch (e) { /* PRAGMA không chạy được thì dùng nguyên cột snapshot */ }
  const ts = nowISO();
  await db.batch([
    db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).bind(...cols.map(c => row[c] ?? null)),
    db.prepare('INSERT INTO lead_events(entity, entity_id, ts, actor, field, old_value, new_value) VALUES (?,?,?,?,?,?,?)')
      .bind(entity, body.id, ts, data.user, 'restore', null, row.status || null)
  ]);
  return json({ ok: true, restored: { entity, id: body.id } });
}
