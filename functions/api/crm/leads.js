// GET  /api/crm/leads?status=&q=&due=today|overdue|upcoming&limit=   → danh sách
// POST /api/crm/leads                                                  → thêm khách (form tối giản của Kay)
import { json, err, normalize, LEAD_FIELDS, insertLead, todayVN, OPEN_STATUSES } from './_lib.js';

export async function onRequestGet({ request, env }) {
  const db = env.CRM_DB;
  const u = new URL(request.url);
  const status = u.searchParams.get('status');
  const q = (u.searchParams.get('q') || '').trim();
  const due = u.searchParams.get('due');
  const limit = Math.min(parseInt(u.searchParams.get('limit') || '200', 10) || 200, 500);
  const today = todayVN();

  const where = []; const args = [];
  if (status) { where.push('status = ?'); args.push(status); }
  if (q) { where.push('(customer_name LIKE ? OR contact LIKE ? OR notes LIKE ? OR id LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  if (due === 'today') { where.push('next_followup = ? AND status != ?'); args.push(today, 'Lost'); }
  if (due === 'overdue') { where.push('next_followup < ? AND status != ? AND status != ?'); args.push(today, 'Lost', 'Completed'); }
  if (due === 'upcoming') { where.push(`event_date >= ? AND status IN (${OPEN_STATUSES.map(() => '?').join(',')})`); args.push(today, ...OPEN_STATUSES); }

  const sql = `SELECT * FROM leads ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY CASE WHEN next_followup IS NULL THEN 1 ELSE 0 END, next_followup ASC, last_updated DESC LIMIT ?`;
  const rows = (await db.prepare(sql).bind(...args, limit).all()).results || [];
  return json({ ok: true, today, count: rows.length, leads: rows });
}

export async function onRequestPost({ request, env, data }) {
  let body;
  try { body = await request.json(); } catch (e) { return err('JSON không hợp lệ'); }
  const { data: d, errors } = normalize(body, LEAD_FIELDS);
  if (!d.customer_name) errors.push('customer_name: cần tên khách');
  if (errors.length) return err('Dữ liệu chưa hợp lệ', 400, errors);
  if (!d.status) d.status = 'New';
  if (!d.owner) d.owner = 'Kay';
  try {
    const row = await insertLead(env.CRM_DB, data.user, d);
    return json({ ok: true, lead: row }, 201);
  } catch (e) {
    return err('Không ghi được lead', 500, e && e.message);
  }
}
