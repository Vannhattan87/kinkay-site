// GET  /api/crm/partners?status=&q=   · POST /api/crm/partners
// Referral chuẩn 10% (DEC-20260906-11). Hilton 20% là one-off ghi ở LEAD KK-260901-001, không phải ở partner.
import { json, err, normalize, PARTNER_FIELDS, nextId, nowISO, todayVN } from './_lib.js';

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
  const db = env.CRM_DB;
  const ymd = d.created_date || todayVN();
  const id = await nextId(db, 'partners', 'PT', ymd);
  const ts = nowISO();
  const row = {
    id, created_date: ymd, name: d.name, type: d.type ?? null, contact_channel: d.contact_channel ?? null, contact: d.contact ?? null,
    status: d.status || 'New', last_touch: d.last_touch ?? null, opportunity: d.opportunity ?? null,
    commercial_terms: d.commercial_terms ?? null, referral_rate: d.referral_rate ?? 0.10,
    next_action: d.next_action ?? null, next_followup: d.next_followup ?? null, notes: d.notes ?? null,
    owner: d.owner || 'Kay', last_updated: ts, updated_by: data.user, created_at: ts
  };
  const cols = Object.keys(row);
  await db.prepare(`INSERT INTO partners (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).bind(...cols.map(c => row[c])).run();
  await db.prepare('INSERT INTO lead_events(entity, entity_id, ts, actor, field, old_value, new_value) VALUES (?,?,?,?,?,?,?)')
    .bind('partner', id, ts, data.user, 'create', null, row.status).run();
  return json({ ok: true, partner: row }, 201);
}
