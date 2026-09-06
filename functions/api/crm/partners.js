// GET  /api/crm/partners?status=&q=   · POST /api/crm/partners
// Referral chuẩn 10% (DEC-20260906-11). Hilton 20% là one-off ghi ở LEAD KK-260901-001, không phải ở partner.
import { json, err, normalize, PARTNER_FIELDS, insertPartner, todayVN } from './_lib.js';

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const status = u.searchParams.get('status');
  const q = (u.searchParams.get('q') || '').trim();
  const where = []; const args = [];
  if (status) { where.push('status = ?'); args.push(status); }
  if (q) { where.push('(name LIKE ? OR contact LIKE ? OR notes LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const rows = (await env.CRM_DB.prepare(`SELECT * FROM partners ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY CASE WHEN next_followup IS NULL THEN 1 ELSE 0 END, next_followup ASC, last_updated DESC LIMIT 300`).bind(...args).all()).results || [];
  return json({ ok: true, today: todayVN(), count: rows.length, partners: rows });
}

export async function onRequestPost({ request, env, data }) {
  let body;
  try { body = await request.json(); } catch (e) { return err('JSON không hợp lệ'); }
  const { data: d, errors } = normalize(body, PARTNER_FIELDS);
  if (!d.name) errors.push('name: cần tên đối tác');
  if (errors.length) return err('Dữ liệu chưa hợp lệ', 400, errors);
  let row;
  try { row = await insertPartner(env.CRM_DB, data.user, d); } catch (e) { return err('Không ghi được đối tác', 500, e && e.message); }
  return json({ ok: true, partner: row }, 201);
}
