-- KINKAY CRM · MIGRATION 005 · CR-20260915-33 · 15/09/2026
-- Duyệt: Tân 15/09 (ngoại lệ HẸP của DEC-20260906-03 P5 Freeze, chỉ cho CR-33).
-- QA: Luna (3 vòng: line items → signed adjustments → lifecycle 3 trạng thái).
--
-- VÌ SAO LÀ 005 CHỨ KHÔNG PHẢI 003:
--   Số 003 đã khai tử (xem đầu file 004). 004 đã chạy, schema_version 1.3.
--   Nhãn 005 trước đây giữ chỗ cho CR-31 Đ8 (request_id / idempotency) — chưa duyệt, chưa build, chưa chạy.
--   CR-33 build trước và chạy trước nên lấy 005.
--   *** CR-31 Đ8 KHI LÀM PHẢI DÙNG 006 VÀ schema_version 1.5. ***
--   Ghi ở đây vì người chạy migration đọc file này trước, không đọc Control Room.
--
-- Chạy SAU crm.sql (1.1), 002 (1.2), 004 (1.3).
-- An toàn chạy lại: CREATE/INSERT có IF NOT EXISTS / OR REPLACE.
-- ALTER TABLE chỉ chạy được 1 lần — lần 2 báo "duplicate column name", bỏ qua là đúng.
--
-- HAI LỚP LỖI KHÁC NHAU, SỬA RIÊNG:
--   (A) Grand Total tách rời khỏi phạm vi đã bán  → line_items
--   (B) Bản đã phát hành mà sai vẫn gửi lại được  → lifecycle
-- Không lớp nào sửa nội dung snapshot đã phát hành. Snapshot vẫn immutable.

-- =============================================================
-- (A) LINE ITEMS — nguồn sự thật duy nhất của Grand Total
-- =============================================================
-- KHÔNG cần cột mới: lưu trong leads.booking_json (cột đã có từ 002).
--   booking_json.line_items = [
--     { type:"service",  label:"Bridal Hair & Makeup", qty:10, unit_price:1800000, amount: 18000000 },
--     { type:"service",  label:"Trial Hair & Makeup",  qty:2,  unit_price:1800000, amount:  3600000 },
--     { type:"fee",      label:"Travel fee",           qty:1,  unit_price: 500000, amount:   500000 },
--     { type:"discount", label:"Referral discount",    qty:1,  unit_price: 500000, amount:  -500000 }
--   ]
-- QUY ƯỚC (thi hành ở functions/api/crm/_lib.js, không ở SQL):
--   · type: 'service' | 'fee' | 'discount'
--   · unit_price LUÔN nhập dương. Dấu do type quyết định. Kay không bao giờ gõ dấu trừ.
--   · amount = sign(type) × qty × unit_price, SERVER tự tính, không tin giá trị client gửi.
--   · Grand Total = Σ amount. Không ngoại lệ, không ô Total nhập tay.
--   · pax hiển thị = Σ qty của các dòng 'service'. Không còn là field rời.
--   · expected_revenue KHÔNG còn fallback vào Booking Confirmation (ước tính ≠ số đã thoả thuận).

-- =============================================================
-- (B) LIFECYCLE — active / superseded / voided
-- =============================================================
-- KHÔNG suy ra trạng thái từ "version cao nhất": có thể tồn tại V4 nháp hoặc V4 voided
-- trong khi V3 vẫn là bản có hiệu lực. Quan hệ phải được ghi thẳng.

ALTER TABLE booking_confirmations ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE booking_confirmations ADD COLUMN superseded_at TEXT;
ALTER TABLE booking_confirmations ADD COLUMN superseded_by_id TEXT;
ALTER TABLE booking_confirmations ADD COLUMN superseded_reason TEXT;
ALTER TABLE booking_confirmations ADD COLUMN status_set_by TEXT;

-- status:
--   'active'      → gửi / gửi lại được
--   'superseded'  → mặc định KHÔNG gửi; chỉ Xem. Gửi được nhưng phải qua bước xác nhận riêng.
--   'voided'      → TUYỆT ĐỐI không gửi, dưới mọi đường. Tồn tại để audit.
-- superseded_by_id trỏ tới bản thay thế (NULL nếu voided mà không có bản thay).

CREATE INDEX IF NOT EXISTS idx_bc_status ON booking_confirmations(lead_id, status);

-- -------------------------------------------------------------
-- BACKFILL: mọi bản hiện có là 'active' theo DEFAULT ở trên.
-- KHÔNG đánh dấu superseded hàng loạt theo version — đó chính là phép suy diễn
-- mà thiết kế này loại bỏ. Từ nay server tự set khi phát hành bản mới.
--
-- NGOẠI LỆ DUY NHẤT: hai bản của lead KK-260914-005 (Geia Lopez) đã đối chiếu
-- snapshot production 15/09/2026 và xác minh sai PHẠM VI ĐÃ BÁN:
--   V1 pax=2 · total 1.800.000   (sai)
--   V2 pax=2 · total 1.800.000   (sai)
--   V3 pax=1 · total 1.800.000   (đúng — thoả thuận là 1 khách × 1.800.000)
-- Chúng sai dữ kiện chứ không phải chỉ cũ, nên vào 'voided', không phải 'superseded'.
-- -------------------------------------------------------------
UPDATE booking_confirmations
   SET status            = 'voided',
       superseded_at     = '2026-09-15T09:04:07.626Z',
       superseded_by_id  = 'BC-KK-260914-005-V3',
       superseded_reason = 'pax 2 sai pham vi da ban; thoa thuan la 1 khach x 1.800.000',
       status_set_by     = 'CR-20260915-33'
 WHERE id IN ('BC-KK-260914-005-V1', 'BC-KK-260914-005-V2')
   AND status = 'active';

INSERT OR REPLACE INTO meta(key, value) VALUES ('schema_version', '1.4');
