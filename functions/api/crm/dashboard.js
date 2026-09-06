// GET /api/crm/dashboard  → chỉ số liệu hành động được (P1 Revenue OS), tính thẳng từ D1, không cache.
import { json, todayVN, OPEN_STATUSES, BOOKED_STATUSES } from './_lib.js';

export async function onRequestGet({ env }) {
  const db = env.CRM_DB;
  const today = todayVN();
  const in30 = new Date(Date.parse(today) + 30 * 86400000).toISOString().slice(0, 10);
  const openQ = OPEN_STATUSES.map(() => '?').join(',');

  const [dueToday, overdue, newLeads, quoted, booked, upcoming, completedFollow, exp, act, unverified, sources, services, partnerDue, counts, meta] = await Promise.all([
    db.prepare(`SELECT id, customer_name, status, next_action, next_followup, contact_channel, contact FROM leads WHERE next_followup = ? AND status NOT IN ('Lost') ORDER BY status`).bind(today).all(),
    db.prepare(`SELECT id, customer_name, status, next_action, next_followup, contact_channel, contact FROM leads WHERE next_followup < ? AND status NOT IN ('Lost','Completed') ORDER BY next_followup`).bind(today).all(),
    db.prepare(`SELECT id, customer_name, service, source, created_date, next_action FROM leads WHERE status = 'New' ORDER BY created_date DESC`).all(),
    db.prepare(`SELECT id, customer_name, service, expected_revenue, next_followup, next_action FROM leads WHERE status IN ('Quoted','Waiting for Response','Hold') ORDER BY next_followup`).all(),
    db.prepare(`SELECT id, customer_name, service, event_date, status, expected_revenue, deposit FROM leads WHERE status IN ('Deposit Paid','Confirmed') ORDER BY event_date`).all(),
    db.prepare(`SELECT id, customer_name, service, event_date, status, expected_revenue FROM leads WHERE event_date >= ? AND event_date <= ? AND status IN (${openQ}) ORDER BY event_date`).bind(today, in30, ...OPEN_STATUSES).all(),
    db.prepare(`SELECT id, customer_name, service, event_date, expected_revenue, actual_revenue, actual_verified, next_action, next_followup FROM leads WHERE status = 'Completed' AND (actual_verified = 0 OR next_followup IS NOT NULL) ORDER BY event_date DESC`).all(),
    db.prepare(`SELECT COALESCE(SUM(expected_revenue),0) AS v, COUNT(*) AS n FROM leads WHERE status IN (${openQ})`).bind(...OPEN_STATUSES).first(),
    db.prepare(`SELECT COALESCE(SUM(actual_revenue),0) AS v, COUNT(*) AS n FROM leads WHERE actual_verified = 1`).first(),
    db.prepare(`SELECT COALESCE(SUM(expected_revenue),0) AS v, COUNT(*) AS n FROM leads WHERE status = 'Completed' AND actual_verified = 0`).first(),
    db.prepare(`SELECT COALESCE(source,'(trống)') AS k, COUNT(*) AS n FROM leads GROUP BY source ORDER BY n DESC`).all(),
    db.prepare(`SELECT COALESCE(service,'(trống)') AS k, COUNT(*) AS n FROM leads GROUP BY service ORDER BY n DESC`).all(),
    db.prepare(`SELECT id, name, status, next_action, next_followup FROM partners WHERE next_followup <= ? AND status NOT IN ('Closed','Dormant') ORDER BY next_followup`).bind(today).all(),
    db.prepare(`SELECT status, COUNT(*) AS n FROM leads GROUP BY status`).all(),
    db.prepare(`SELECT key, value FROM meta`).all()
  ]);

  const byStatus = {}; for (const r of counts.results || []) byStatus[r.status] = r.n;
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const bookedCount = BOOKED_STATUSES.reduce((a, s) => a + (byStatus[s] || 0), 0);
  const qualifiedPlus = total - (byStatus.New || 0) - (byStatus.Contacted || 0);

  return json({
    ok: true, today,
    kpi: {
      total_leads: total,
      qualified_plus: qualifiedPlus,
      bookings: bookedCount,
      completed: byStatus.Completed || 0,
      booking_conversion: qualifiedPlus ? Math.round(bookedCount / qualifiedPlus * 1000) / 10 : null,
      expected_revenue_open: exp.v, expected_open_count: exp.n,
      verified_actual_revenue: act.v, verified_count: act.n,
      completed_unverified_expected: unverified.v, completed_unverified_count: unverified.n,
      by_status: byStatus
    },
    queues: {
      due_today: dueToday.results || [],
      overdue: overdue.results || [],
      new_leads: newLeads.results || [],
      quoted: quoted.results || [],
      booked: booked.results || [],
      upcoming_30d: upcoming.results || [],
      completed_followup: completedFollow.results || [],
      partners_due: partnerDue.results || []
    },
    sources: sources.results || [],
    services: services.results || [],
    meta: Object.fromEntries((meta.results || []).map(r => [r.key, r.value]))
  });
}
