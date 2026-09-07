// GET /api/crm/confirmations/BC-KK-260905-001-V1 → snapshot lịch sử (chỉ đọc, sau xác thực CRM). Không có endpoint công khai.
import { json, err } from '../_lib.js';

export async function onRequestGet({ params, env }) {
  const row = await env.CRM_DB.prepare('SELECT * FROM booking_confirmations WHERE id = ?').bind(params.id).first();
  if (!row) return err('Không có confirmation này', 404);
  let snapshot = null; try { snapshot = JSON.parse(row.snapshot_json); } catch (e) { }
  return json({ ok: true, confirmation: { id: row.id, lead_id: row.lead_id, version: row.version, generated_at: row.generated_at, generated_by: row.generated_by, snapshot } });
}
