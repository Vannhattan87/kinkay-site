// GET /api/crm/control-room  → Marketing Control Room MVP v0.1 (CHỈ ĐỌC)
// Duyệt: MKT-DEC-20260916-01, Luna §4 mục G. Thuộc P1 Revenue OS · Engine: CRM Intelligence.
//
// PHẠM VI KHOÁ CỨNG. Endpoint này chỉ trả đủ sáu khối để trả lời năm câu:
//   1. Lead đến từ đâu · 2. Cần dịch vụ gì · 3. Cái nào chốt · 4. Doanh thu từ kênh nào
//   5. Nên SCALE / HOLD / STOP cái gì
// Thêm bất cứ số nào ngoài năm câu đó phải mở DEC mới. Đây không phải nền tảng dashboard.
//
// BA LUẬT KHÔNG ĐƯỢC PHÁ:
//   · NULL quốc tịch KHÔNG BAO GIỜ là khách Việt. Mọi tỉ lệ foreign tính trên phần ĐÃ BIẾT,
//     và luôn in kèm phần chưa biết. Coverage thấp mà giấu đi thì trông y hệt "toàn khách Việt".
//   · Mọi số dựa trên mốc thời gian phải in mẫu số (n=6/17). 11 lead nhập từ Sheet 06/09 không có
//     lịch sử trạng thái nên bị loại khỏi phép tính, KHÔNG được đếm là 0 ngày.
//   · Ba loại tiền KHÔNG được cộng chung: `expected_revenue` là ước tính pipeline,
//     `line_items` là số đã thoả thuận với khách, `actual_revenue` + verified là tiền đã nhận.
//     Trộn ba cái là đúng lỗi CR-33 đã phải sửa bằng migration 005.
import {
  json, err, todayVN, parseBooking, lineItemsTotal,
  isForeign, nationalityStats, statusTimestamps, leadToBookingDays, withCoverage,
  canonicalSource, REPORT_ONLY_SOURCES
} from './_lib.js';

const REACHED_CONFIRMED = ['Deposit Paid', 'Confirmed', 'Completed'];

// Một lead "đã từng chốt" nếu trạng thái HIỆN TẠI đã qua mốc đó, HOẶC nhật ký có mốc đó.
// Phải có cả hai vế: 11 lead seed không có nhật ký nhưng đang ở Completed thật.
const reachedConfirmed = (l, ts) => REACHED_CONFIRMED.indexOf(l.status) >= 0 || !!ts.confirmed_at;
const reachedCompleted = (l, ts) => l.status === 'Completed' || !!ts.completed_at;

function bucket(rows, keyOf) {
  const m = new Map();
  for (const r of rows) {
    const k = keyOf(r.lead) || '(trống)';
    if (!m.has(k)) m.set(k, { key: k, leads: 0, confirmed: 0, completed: 0, nat_known: 0, foreign: 0, agreed_value: 0, agreed_n: 0 });
    const b = m.get(k);
    b.leads++;
    if (r.confirmed) b.confirmed++;
    if (r.completed) b.completed++;
    const f = isForeign(r.lead.nationality);
    if (f !== null) { b.nat_known++; if (f) b.foreign++; }
    if (r.agreed != null) { b.agreed_value += r.agreed; b.agreed_n++; }
  }
  return [...m.values()].sort((a, b) => b.leads - a.leads).map(b => ({
    ...b,
    conv_confirmed: b.leads ? Math.round(b.confirmed / b.leads * 1000) / 10 : null,
    // Tỉ lệ foreign tính trên phần ĐÃ BIẾT của riêng kênh này, kèm mẫu số của chính nó.
    foreign_pct_of_known: b.nat_known ? Math.round(b.foreign / b.nat_known * 1000) / 10 : null,
    nat_coverage: `n=${b.nat_known}/${b.leads}`,
    avg_agreed_value: b.agreed_n ? Math.round(b.agreed_value / b.agreed_n) : null
  }));
}

export async function onRequestGet({ env }) {
  const db = env.CRM_DB;

  // Migration 007 chưa chạy thì nói thẳng, đừng để truy vấn vỡ thành lỗi 500 khó hiểu.
  const cols = ((await db.prepare('PRAGMA table_info(leads)').all()).results || []).map(c => c.name);
  const missing = ['nationality', 'source_detail', 'lost_reason'].filter(c => cols.indexOf(c) < 0);
  if (missing.length) {
    return json({
      ok: false, code: 'migration_007_missing', missing,
      error: 'Chưa chạy migration 007 trên D1. Thiếu cột: ' + missing.join(', ') +
             '. Chạy schema/crm-migration-007-marketing-fields.sql rồi mở lại trang này.'
    }, 409);
  }

  const [leadsQ, evQ] = await Promise.all([
    db.prepare('SELECT * FROM leads').all(),
    // Đọc THẲNG lead_events. KHÔNG đi qua GET /leads/<id> — endpoint đó có LIMIT 100,
    // lead sửa nhiều lần sẽ rụng event cũ và mốc "lần ĐẦU Confirmed" ra sai.
    db.prepare("SELECT entity_id, ts, field, new_value FROM lead_events WHERE entity = 'lead' AND field IN ('status','create')").all()
  ]);
  const leads = leadsQ.results || [];

  const byLead = new Map();
  for (const e of evQ.results || []) {
    if (!byLead.has(e.entity_id)) byLead.set(e.entity_id, []);
    byLead.get(e.entity_id).push(e);
  }

  const rows = leads.map(l => {
    const ev = byLead.get(l.id) || [];
    const ts = statusTimestamps(ev);
    const items = (parseBooking(l).line_items) || [];
    // Chỉ tính là "đã thoả thuận" khi CÓ line items. Không fallback sang expected_revenue —
    // đó là ước tính pipeline, không phải số đã chốt với khách (CR-33).
    const agreed = items.length ? lineItemsTotal(items) : null;
    return {
      lead: l, ev, ts, agreed,
      confirmed: reachedConfirmed(l, ts),
      completed: reachedCompleted(l, ts),
      days: leadToBookingDays(l, ev)
    };
  });

  const nat = nationalityStats(leads);
  const confirmedN = rows.filter(r => r.confirmed).length;
  const completedN = rows.filter(r => r.completed).length;

  // Tiền: ba nhóm tách bạch, mỗi nhóm có mẫu số riêng.
  const agreedRows = rows.filter(r => r.agreed != null);
  const openAgreed = agreedRows.filter(r => r.lead.status === 'Confirmed' || r.lead.status === 'Deposit Paid');
  const doneAgreed = agreedRows.filter(r => r.lead.status === 'Completed');
  const verified = leads.filter(l => l.actual_verified === 1 && l.actual_revenue != null);
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);

  const foreignRows = rows.filter(r => isForeign(r.lead.nationality) === true);

  return json({
    ok: true, today: todayVN(), scope: 'MKT-DEC-20260916-01 · Luna §4 muc G · read-only',

    // 1. Lead đến từ đâu (phần "bao nhiêu" + độ phủ quốc tịch)
    lead_volume: {
      total: nat.total, nationality_known: nat.known, nationality_unknown: nat.unknown,
      foreign_among_known: nat.foreign_among_known,
      foreign_pct_of_known: nat.foreign_pct_of_known == null ? null : Math.round(nat.foreign_pct_of_known * 1000) / 10,
      coverage: nat.coverage_label,
      // Cố ý KHÔNG có trường "foreign_pct" trên tổng. Luna §4 muc D cấm một con số duy nhất
      // khi độ phủ chưa đủ, vì nó biến "chưa biết" thành "khách Việt".
      note: nat.known === 0
        ? 'Chưa lead nào có quốc tịch. Chưa nói được gì về tệp khách nước ngoài.'
        : `Đọc là: trong ${nat.known} lead đã biết quốc tịch thì ${nat.foreign_among_known} là khách nước ngoài. Còn ${nat.unknown} lead chưa biết.`
    },

    // 2. Lead đến từ đâu (phần "kênh nào")
    /* MKT-DEC-20260917-02 §4 E6 — đọc qua `canonicalSource`. DB giữ nguyên chữ cũ,
       chỉ lớp báo cáo gộp lại. Không UPDATE, không backfill một dòng nào. */
    source_mix: bucket(rows, l => canonicalSource(l.source)),

    /* E6 — chất lượng dữ liệu phải hiện thành số, không giấu trong bảng.
       42% Direct/Unknown hôm 17/09 là vấn đề cần giảm, nhưng cách chữa KHÔNG phải
       biến "chưa biết" thành "đã biết" giả. */
    data_quality: (() => {
      const cnt = k => rows.filter(r => canonicalSource(r.lead.source) === k).length;
      const legacy = rows.filter(r => REPORT_ONLY_SOURCES.indexOf(canonicalSource(r.lead.source)) >= 0).length;
      const unknown = cnt('Direct/Unknown');
      const unclass = cnt('Google Organic (Unclassified)');
      return {
        total: rows.length,
        direct_unknown: unknown,
        direct_unknown_pct: rows.length ? Math.round(unknown / rows.length * 1000) / 10 : null,
        google_unclassified: unclass,
        legacy_labels: legacy,
        other_legacy: cnt('Other (legacy)'),
        note: 'Ba nhóm này là LỖ HỔNG DỮ LIỆU, không phải kênh. Giảm chúng bằng cách hỏi khách và gắn UTM, không bằng cách đoán.'
      };
    })(),

    // 3. Họ cần dịch vụ gì
    service_mix: bucket(rows, l => l.service),

    // 4. Lead nào convert
    conversion: {
      total: rows.length,
      reached_confirmed: confirmedN, reached_completed: completedN,
      lead_to_confirmed_pct: rows.length ? Math.round(confirmedN / rows.length * 1000) / 10 : null,
      lead_to_completed_pct: rows.length ? Math.round(completedN / rows.length * 1000) / 10 : null,
      foreign_total: foreignRows.length,
      foreign_confirmed: foreignRows.filter(r => r.confirmed).length
    },

    // 5. Doanh thu đến từ đâu — BA nhóm riêng, không cộng lại với nhau
    revenue: {
      agreed_open: { value: sum(openAgreed, r => r.agreed), n: openAgreed.length, label: 'Đã thoả thuận, chưa xong việc (line items, Confirmed + Deposit Paid)' },
      agreed_completed: { value: sum(doneAgreed, r => r.agreed), n: doneAgreed.length, label: 'Đã thoả thuận, việc đã xong (line items, Completed)' },
      avg_agreed_booking: agreedRows.length ? Math.round(sum(agreedRows, r => r.agreed) / agreedRows.length) : null,
      verified_cash: { value: sum(verified, l => l.actual_revenue), n: verified.length, label: 'Tiền Tân đã xác minh thực nhận' },
      line_items_coverage: `n=${agreedRows.length}/${rows.filter(r => r.confirmed).length} job đã chốt có bảng giá chi tiết`,
      warning: agreedRows.length < confirmedN
        ? `${confirmedN - agreedRows.length} job đã chốt nhưng chưa có line items, nên không nằm trong số "đã thoả thuận". Đừng đọc số này như tổng doanh thu.`
        : null
    },

    // 6. Nhanh chậm — luôn kèm mẫu số
    lead_to_booking_days: (() => {
      const c = withCoverage(rows.map(r => r.days), rows.length);
      return {
        avg_days: c.avg == null ? null : Math.round(c.avg * 10) / 10,
        n: c.n, of: c.of, excluded: c.excluded, coverage: c.label,
        note: c.excluded ? `${c.excluded} lead không có lịch sử trạng thái (nhập từ Sheet 06/09 hoặc chưa từng chốt) nên bị loại khỏi trung bình.` : null
      };
    })()
  });
}
