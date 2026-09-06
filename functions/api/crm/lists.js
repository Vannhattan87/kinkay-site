// GET /api/crm/lists → danh sách dropdown (một nguồn cho cả server và giao diện) + user đang đăng nhập.
import { json, isCutover, LEAD_STATUSES, SOURCES, CHANNELS, SERVICES, SEGMENTS, OWNERS, DEPOSITS, PARTNER_STATUSES, todayVN } from './_lib.js';

export async function onRequestGet({ data, env }) {
  return json({
    ok: true, user: data.user, today: todayVN(), cutover: isCutover(env),
    lead_statuses: LEAD_STATUSES, sources: SOURCES, channels: CHANNELS, services: SERVICES,
    segments: SEGMENTS, owners: OWNERS, deposits: DEPOSITS, partner_statuses: PARTNER_STATUSES
  });
}
