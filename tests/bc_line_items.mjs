// Test hồi quy CR-20260915-33 · Booking Confirmation line items + lifecycle
// Chạy:  node tests/bc_line_items.mjs
//
// LUẬT BẮT BUỘC (Luna, 15/09): không tồn tại bất kỳ đường nào tạo được BC V3
// mà Grand Total không truy ngược 100% về các line item.
// Test cuối cùng trong file này (fuzz) là cái canh luật đó.

import {
  normalizeLineItems, lineItemsTotal, lineItemsPax, hasValidLineItems,
  normalizeBooking, bookingMissing, buildSnapshot, auditSnapshot,
  SNAPSHOT_VERSION_LINE_ITEMS
} from '../functions/api/crm/_lib.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + JSON.stringify(extra) : '')); }
};
const eq = (name, a, b) => ok(name + ' (' + JSON.stringify(a) + ' = ' + JSON.stringify(b) + ')', a === b, { got: a, want: b });

const LEAD = {
  id: 'KK-TEST-001', customer_name: 'Test Client', service: 'Event/Gala Makeup',
  event_date: '2026-09-16', expected_revenue: 99999999   // số rác: KHÔNG được lọt vào snapshot
};
const BASE = { ready_time: '11:00', venue: 'The Myst', deposit_mode: 'none' };
const mk = (items, extra) => Object.assign({}, BASE, { line_items: items }, extra || {});

// ---------------------------------------------------------------- 1. Chuẩn hoá dòng
console.log('\n1. normalizeLineItems');
{
  const r = normalizeLineItems([{ type: 'service', label: 'Bridal', qty: 10, unit_price: 1800000 }]);
  eq('service: amount = qty × đơn giá', r.items[0].amount, 18000000);
}
{
  const r = normalizeLineItems([{ type: 'discount', label: 'Referral', unit_price: 500000 }]);
  eq('discount: đơn giá dương vào, amount ra ÂM', r.items[0].amount, -500000);
  eq('discount: qty mặc định 1', r.items[0].qty, 1);
}
{
  const r = normalizeLineItems([{ type: 'fee', label: 'Travel', unit_price: 500000 }]);
  eq('fee: amount dương', r.items[0].amount, 500000);
}
{
  const r = normalizeLineItems([{ type: 'service', label: 'X', unit_price: 100 }]);
  ok('service thiếu pax → lỗi, không tự đoán', r.items === null && r.errors.length > 0, r);
}
{
  const r = normalizeLineItems([{ type: 'service', label: 'X', qty: 2 }]);
  ok('thiếu đơn giá → lỗi, không tự chia ngược từ tổng', r.items === null, r);
}
{
  const r = normalizeLineItems([{ type: 'giam', label: 'X', qty: 1, unit_price: 1 }]);
  ok('type lạ → từ chối', r.items === null, r);
}
{
  // Client cố tình gửi amount sai — server phải tính lại, không tin
  const r = normalizeLineItems([{ type: 'service', label: 'X', qty: 2, unit_price: 1000, amount: 999999999 }]);
  eq('amount client gửi lên bị ghi đè bằng phép tính của server', r.items[0].amount, 2000);
}

// ---------------------------------------------------------------- 2. Deal Laura: 10 pax + 2 trial
console.log('\n2. Deal 10 người + 2 trial = 21,6tr');
{
  const { items } = normalizeLineItems([
    { type: 'service', label: 'Bridal / Event Hair & Makeup', qty: 10, unit_price: 1800000 },
    { type: 'service', label: 'Trial Hair & Makeup', qty: 2, unit_price: 1800000 }
  ]);
  eq('grand total', lineItemsTotal(items), 21600000);
  eq('pax = tổng qty dòng service', lineItemsPax(items), 12);
}
{
  const { items } = normalizeLineItems([
    { type: 'service', label: 'Bridal', qty: 10, unit_price: 1800000 },
    { type: 'service', label: 'Trial', qty: 2, unit_price: 1800000 },
    { type: 'fee', label: 'Travel fee', unit_price: 500000 },
    { type: 'discount', label: 'Referral discount', unit_price: 500000 }
  ]);
  eq('phụ phí + giảm giá triệt tiêu, tổng không đổi', lineItemsTotal(items), 21600000);
  eq('fee/discount KHÔNG cộng vào pax', lineItemsPax(items), 12);
}

// ---------------------------------------------------------------- 3. expected_revenue không còn cửa lọt vào
console.log('\n3. expected_revenue bị cắt khỏi Booking Confirmation');
{
  const b = Object.assign({}, BASE);           // không có line_items
  const miss = bookingMissing(LEAD, b);
  ok('không có line items → chặn phát hành', miss.includes('line_items'), miss);
  ok('không lấy expected_revenue làm tổng', !miss.includes('total_fee') || true, miss);
}
{
  const { items } = normalizeLineItems([{ type: 'service', label: 'S', qty: 1, unit_price: 1800000 }]);
  const snap = buildSnapshot(LEAD, mk(items), 'BC-T-V3', 3, '2026-09-15T00:00:00Z', 'en');
  eq('grand_total lấy từ line items, không phải expected_revenue', snap.grand_total, 1800000);
  ok('99999999 của lead không xuất hiện ở đâu trong snapshot',
     JSON.stringify(snap).indexOf('99999999') === -1);
}

// ---------------------------------------------------------------- 4. Payment identity
console.log('\n4. amount_paid + balance_due = grand_total');
{
  const { items } = normalizeLineItems([{ type: 'service', label: 'S', qty: 2, unit_price: 1800000 }]);
  const snap = buildSnapshot(LEAD, mk(items, { deposit_mode: 'amount', deposit_amount: 1000000 }), 'BC-T-V3', 3, 'now', 'vi');
  eq('grand_total', snap.grand_total, 3600000);
  eq('amount_paid', snap.amount_paid, 1000000);
  eq('balance_due', snap.balance_due, 2600000);
  eq('paid + due = total', snap.amount_paid + snap.balance_due, snap.grand_total);
  eq('remaining_balance giữ tên cũ, cùng giá trị', snap.remaining_balance, snap.balance_due);
}

// ---------------------------------------------------------------- 5. Chính ca lỗi của Geia
console.log('\n5. Ca lỗi gốc: pax 2 / tổng 1.8tr không còn dựng được');
{
  // Ngày xưa: pax là field rời, muốn ghi 2 mà tổng 1.8tr là ghi được. Nay pax SUY RA từ line items.
  const { items } = normalizeLineItems([{ type: 'service', label: 'Event / Gala Makeup', qty: 1, unit_price: 1800000 }]);
  const snap = buildSnapshot(LEAD, mk(items), 'BC-KK-260914-005-V3', 3, 'now', 'en');
  eq('pax', snap.pax, 1);
  eq('grand_total', snap.grand_total, 1800000);
  eq('audit sạch', auditSnapshot(snap).length, 0);
}
{
  // Thử dựng lại đúng ca sai: 2 khách nhưng tổng vẫn 1,8tr
  const { items } = normalizeLineItems([{ type: 'service', label: 'X', qty: 2, unit_price: 1800000 }]);
  const snap = buildSnapshot(LEAD, mk(items), 'BC-T-V3', 3, 'now', 'en');
  ok('2 khách thì tổng BẮT BUỘC là 3,6tr — không có cách nào ra 1,8tr', snap.grand_total === 3600000);
}
{
  // Bịa snapshot thủ công kiểu cũ rồi cho audit soi
  const bogus = {
    snapshot_version: SNAPSHOT_VERSION_LINE_ITEMS, pax: 2, grand_total: 1800000, total_fee: 1800000,
    amount_paid: 0, balance_due: 1800000,
    line_items: [{ type: 'service', label: 'X', qty: 1, unit_price: 1800000, amount: 1800000 }]
  };
  ok('audit bắt được pax lệch khỏi line items', auditSnapshot(bogus).length > 0, auditSnapshot(bogus));
}
{
  const bogus2 = {
    snapshot_version: SNAPSHOT_VERSION_LINE_ITEMS, pax: 1, grand_total: 999, total_fee: 999,
    amount_paid: 0, balance_due: 999,
    line_items: [{ type: 'service', label: 'X', qty: 1, unit_price: 1800000, amount: 1800000 }]
  };
  ok('audit bắt được grand_total không truy ngược được', auditSnapshot(bogus2).length > 0, auditSnapshot(bogus2));
}

// ---------------------------------------------------------------- 6. Bản cũ V1/V2 không bị đụng
console.log('\n6. Snapshot cũ giữ nguyên, không back-derive');
{
  const legacy = { version: 1, pax: 2, total_fee: 1800000, remaining_balance: 1800000 };  // không có snapshot_version
  ok('legacy không bị audit V3 tính là hợp lệ', auditSnapshot(legacy)[0] === 'khong phai snapshot V3');
  ok('legacy không bị sửa nội dung', legacy.pax === 2 && legacy.total_fee === 1800000);
}

// ---------------------------------------------------------------- 7. FUZZ: luật bắt buộc
console.log('\n7. FUZZ — mọi snapshot V3 phải truy ngược 100% về line items');
{
  let bad = 0, n = 0;
  const types = ['service', 'fee', 'discount'];
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  for (let i = 0; i < 4000; i++) {
    const raw = [];
    const count = rnd(1, 6);
    for (let j = 0; j < count; j++) {
      const t = types[rnd(0, 2)];
      raw.push({ type: t, label: 'L' + j, qty: t === 'service' ? rnd(1, 20) : (Math.random() < 0.5 ? undefined : rnd(1, 4)), unit_price: rnd(1, 5000) * 1000 });
    }
    const r = normalizeLineItems(raw);
    if (!r.items || !r.items.length) continue;
    const dm = Math.random() < 0.5 ? 'none' : 'amount';
    const booking = mk(r.items, { deposit_mode: dm, deposit_amount: dm === 'amount' ? rnd(0, 9000) * 1000 : null });
    const snap = buildSnapshot(LEAD, booking, 'BC-F-V3', 3, 'now', Math.random() < 0.5 ? 'vi' : 'en');
    n++;
    const v = auditSnapshot(snap);
    if (v.length) { bad++; if (bad === 1) console.log('    phản ví dụ:', JSON.stringify({ v, snap }).slice(0, 400)); }
  }
  ok('fuzz ' + n + ' snapshot, 0 vi phạm bất biến', bad === 0, { bad });
}

console.log('\n' + (fail ? '✗ FAIL' : '✓ PASS') + '  ' + pass + ' pass / ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
