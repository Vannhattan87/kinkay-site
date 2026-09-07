-- KINKAY CRM · MIGRATION 002 · Booking Confirmation · 07/09/2026 · CR-20260907-29
-- Chạy SAU schema/crm.sql (v1.1). An toàn chạy lại (IF NOT EXISTS); riêng ALTER TABLE chỉ chạy 1 lần
-- (chạy lần 2 báo "duplicate column" là bình thường, bỏ qua).
--
-- 1. Cột booking_json trên leads: các trường CHỈ dùng cho Booking Confirmation mà Sheet/CRM chưa có
--    (giờ hẹn, địa điểm, số người, gồm gì, cọc số tiền, điều khoản thanh toán, ghi chú cho khách).
--    Để 1 cột JSON thay vì 9 cột mới: không nhân bản bảng, không đụng cột doanh thu hiện có.
--    Tiền tổng = expected_revenue (đã có). actual_revenue / actual_verified KHÔNG liên quan.
ALTER TABLE leads ADD COLUMN booking_json TEXT;

-- 2. Bảng snapshot: mỗi lần tạo confirmation = 1 dòng, KHÔNG sửa/ghi đè. Lead đổi sau đó thì V1 vẫn nguyên.
CREATE TABLE IF NOT EXISTS booking_confirmations (
  id            TEXT PRIMARY KEY,              -- BC-KK-260905-001-V1
  lead_id       TEXT NOT NULL,
  version       INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,                 -- toàn bộ nội dung khách thấy, đủ để vẽ lại ảnh y hệt
  generated_at  TEXT NOT NULL,                 -- ISO 8601
  generated_by  TEXT,                          -- GitHub login
  UNIQUE(lead_id, version)
);
CREATE INDEX IF NOT EXISTS idx_bc_lead ON booking_confirmations(lead_id);

INSERT OR REPLACE INTO meta(key, value) VALUES ('schema_version', '1.2');
