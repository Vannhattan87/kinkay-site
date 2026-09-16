// GET   /api/crm/leads/KK-260914-005/booking   → chi tiết buổi làm của job này
// PATCH /api/crm/leads/KK-260914-005/booking   {booking:{...}} → sửa chi tiết, KHÔNG phát hành gì
//
// CR-20260916-34 · 16/09/2026 · Tân: "nhìn vô vẫn chưa biết job này chi tiết như thế nào".
//
// VÌ SAO PHẢI CÓ ĐƯỜNG RIÊNG, KHÔNG DÙNG LẠI /confirmations:
//   Trước đây cách DUY NHẤT để nhập giờ có mặt, địa điểm, bảng giá là bấm "Tạo Booking
//   Confirmation". Hai hệ quả, cả hai đều sai:
//     1. Job ở trạng thái New / Contacted / Qualified KHÔNG nhập được gì — BC chặn theo
//        trạng thái. Nhưng Kay biết địa điểm và giờ từ lúc khách mới nhắn, trước khi chốt giá.
//     2. Sửa một chữ trong địa điểm là đẻ ra một bản xác nhận mới gửi khách. Sửa ghi chú
//        nội bộ không được phép sinh ra tài liệu đối ngoại.
//
//   Nên tách: CHI TIẾT BUỔI LÀM là dữ liệu vận hành (Kay cần để đi làm).
//             BOOKING CONFIRMATION là tài liệu đối ngoại (khách cầm).
//   Đường này ghi cái thứ nhất. Snapshot đã phát hành vẫn bất biến — sửa ở đây không bao giờ
//   đụng vào bản xác nhận cũ, đúng luật CR-33.
//
// KHÔNG đụng `expected_revenue`. Đó là ước tính pipeline, khác số đã thoả thuận với khách.
// Trộn hai số này lại chính là gốc của lỗi BC in "pax 2 · 1,8tr" hôm 15/09.
import { json, err, parseBooking, normalizeBooking, bookingMissing, lineItemsTotal, lineItemsPax, logDiff, nowISO } from '../../_lib.js';

async function load(db, id) {
  return db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
}

function shape(lead, booking) {
  const items = Array.isArray(booking.line_items) ? booking.line_items : [];
  return {
    booking,
    booking_missing: bookingMissing(lead, booking),
    booking_total: lineItemsTotal(items),
    booking_pax: lineItemsPax(items)
  };
}

export async function onRequestGet({ params, env }) {
  const lead = await load(env.CRM_DB, params.id);
  if (!lead) return err('Không có lead này', 404);
  return json(Object.assign({ ok: true, lead_id: lead.id }, shape(lead, parseBooking(lead))));
}

export async function onRequestPatch({ params, request, env, data }) {
  const db = env.CRM_DB;
  const lead = await load(db, params.id);
  if (!lead) return err('Không có lead này', 404);

  let body; try { body = await request.json(); } catch (e) { return err('JSON không hợp lệ'); }
  const before = parseBooking(lead);
  const { data: patch, errors } = normalizeBooking(body.booking || {});
  if (errors.length) return err('Dữ liệu chưa hợp lệ', 400, errors);
  if (!Object.keys(patch).length) return err('Không có gì để cập nhật');

  const booking = Object.assign({}, before, patch);
  if (JSON.stringify(booking) === JSON.stringify(before)) {
    return json(Object.assign({ ok: true, changed: 0 }, shape(lead, booking)));
  }

  await db.prepare('UPDATE leads SET booking_json = ?, last_updated = ?, updated_by = ? WHERE id = ?')
    .bind(JSON.stringify(booking), nowISO(), data.user, params.id).run();

  /* Nhật ký: ghi TỪNG trường đổi, tên có tiền tố `booking.` để giao diện gộp nhóm được.
     Bảng giá ghi dạng tóm tắt "3 dòng · 1.800.000" chứ không nhét nguyên mảng JSON vào cột —
     nhật ký dài vô nghĩa là đúng thứ Tân phàn nàn hôm nay. */
  const diff = {}; const flat = {};
  for (const k of Object.keys(patch)) {
    const o = before[k], n = patch[k];
    if (JSON.stringify(o ?? null) === JSON.stringify(n ?? null)) continue;
    if (k === 'line_items') {
      flat['booking.line_items'] = o ? `${o.length} dòng · ${lineItemsTotal(o)}` : null;
      diff['booking.line_items'] = `${n.length} dòng · ${lineItemsTotal(n)}`;
    } else {
      flat['booking.' + k] = o == null ? null : String(o);
      diff['booking.' + k] = n == null ? null : String(n);
    }
  }
  const changed = await logDiff(db, 'lead', params.id, data.user, flat, diff);

  const after = await load(db, params.id);
  return json(Object.assign({ ok: true, changed }, shape(after, booking)));
}
