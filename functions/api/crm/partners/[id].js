// GET / PATCH /api/crm/partners/PT-260905-003
import { json, err, normalize, PARTNER_FIELDS, logDiff, nowISO } from '../_lib.js';

export async function onRequestGet({ params, env }) {
  const db = env.CRM_DB;
  const partner = await db.prepare('SELECT * FROM partners WHERE id = ?').bind(params.id).first();
  if (!partner) return err('Không có đối tác này', 404);
  const leads = (await db.prepare('SELECT id, customer_name, service, event_date, status, expected_revenue, actual_revenue, actual_verified FROM leads WHERE partner_id = ? ORDER BY created_date DESC').bind(params.id).all()).results || [];
  const events = (await db.prepare('SELECT ts, actor, field, old_value, new_value FROM lead_events WHERE entity = ? AND entity_id = ? ORDER BY id DESC LIMIT 50').bind('partner', params.id).all()).results || [];
  return json({ ok: true, partner, leads, events });
}

export async function onRequestPatch({ params, request, env, data }) {
  const db = env.CRM_DB;
  const before = await db.prepare('SELECT * FROM partners WHERE id = ?').bind(params.id).first();
  if (!before) return err('Không có đối tác này', 404);
  let body;
  try { body = await request.json(); } catch (e) { return err('JSON không hợp lệ'); }
  const { data: d, errors } = normalize(body, PARTNER_FIELDS);
  if ('name' in d && !d.name) errors.push('name: không được để trống');
  if (errors.length) return err('Dữ liệu chưa hợp lệ', 400, errors);
  const keys = Object.keys(d);
  if (!keys.length) return err('Không có gì để cập nhật');
  d.last_updated = nowISO(); d.updated_by = data.user;
  await db.prepare(`UPDATE partners SET ${Object.keys(d).map(k => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...Object.keys(d).map(k => d[k]), params.id).run();
  const changed = await logDiff(db, 'partner', params.id, data.user, before, Object.fromEntries(keys.map(k => [k, d[k]])));
  const after = await db.prepare('SELECT * FROM partners WHERE id = ?').bind(params.id).first();
  return json({ ok: true, changed, partner: after });
}
