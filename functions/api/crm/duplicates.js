// GET /api/crm/duplicates?customer_name=&contact=&event_date=&service=&exclude=KK-...
// Dò khách/job đã có trước khi thêm (11/09/2026). Chuẩn hoá tên (bỏ dấu, bỏ Ms./chị/cô) + contact (SĐT, @handle).
// Giao diện gọi khi Kay gõ tên/contact ở form Thêm, và ở trang chi tiết để hiện "job khác của khách này".
import { json, cleanDate, findSimilarLeads } from './_lib.js';

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const input = {
    customer_name: u.searchParams.get('customer_name') || '',
    contact: u.searchParams.get('contact') || '',
    event_date: cleanDate(u.searchParams.get('event_date')),
    service: u.searchParams.get('service') || ''
  };
  const matches = await findSimilarLeads(env.CRM_DB, input, u.searchParams.get('exclude') || null);
  return json({ ok: true, count: matches.length, matches });
}
