-- KINKAY CRM · MIGRATION 004 · CR-20260913-32 (T0 + T3) · 14/09/2026
-- Duyệt: Tân 14/09 (ngoại lệ HẸP của DEC-20260906-03 P5 Freeze, chỉ cho T0 + T3).
-- Packet phạm vi: `_LUNA_TO_KEI_CR32_20260914` (Google Drive).
--
-- VÌ SAO LÀ 004 CHỨ KHÔNG PHẢI 003:
--   Repo hiện chỉ có tới `crm-migration-002-booking-confirmations.sql`, nên 003 đang trống.
--   NHƯNG nhãn 003 đã được CR-31 Đ8 giữ chỗ cho việc request_id / idempotency (chưa duyệt, chưa chạy).
--   Luna cảnh báo không được để hai migration khác nhau mang cùng một số. Nên đợt này lấy 004
--   và ĐỂ NGUYÊN 003 cho Đ8. Chạy 004 trước 003 không sao: hai migration không đụng nhau.
--
-- Chạy SAU `schema/crm.sql` (v1.1) và `crm-migration-002` (v1.2).
-- An toàn chạy lại: phần CREATE/INSERT có IF NOT EXISTS / OR REPLACE.
-- Riêng ALTER TABLE chỉ chạy được 1 lần — lần 2 báo "duplicate column name", bỏ qua là đúng.
--
-- ROLLBACK (theo yêu cầu Tân + Luna): KHÔNG xoá cột trên production.
--   Quay lui bằng revert code / tắt cờ đọc. Hai cột dưới đây là cộng thêm, không cột nào cũ bị đổi,
--   không dòng nào bị ghi đè, ID job giữ nguyên. Code cũ bỏ qua cột mới là chạy bình thường.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. T0 · contact_key — CHỈ LÀ CHỈ MỤC TRA CỨU, KHÔNG PHẢI DANH TÍNH KHÁCH
-- ─────────────────────────────────────────────────────────────────────────
-- Giá trị = contact đã chuẩn hoá bằng `normContact()` trong `functions/api/crm/_lib.js`
-- (SĐT → chỉ số, +84/84 → 0; email/handle → chữ thường, bỏ @ đầu; giá trị giữ chỗ như
-- "N/A", "chưa có", "0000" → rỗng). Sinh ở tầng JS lúc ghi, KHÔNG sinh bằng SQL —
-- một hàm chuẩn hoá duy nhất cho cả ghi lẫn tra, nếu không thì tra sẽ lệch với ghi.
--
-- BA ĐIỀU CỘT NÀY KHÔNG LÀM, ghi ra đây để người đọc sau không hiểu nhầm:
--   1. KHÔNG chứng minh hai job là của cùng một người. Một số điện thoại có thể là của
--      mẹ cô dâu, của planner đặt hộ, hoặc của người đã đổi chủ số.
--   2. KHÔNG bao giờ được dùng để tự động gộp hoặc tự động nối hai bản ghi.
--   3. KHÔNG đủ để tính KPI khách quay lại chính thức. Việc đó thuộc T1 (đang HOLD).
-- Giao diện phải ghi rõ "cùng số liên hệ · chưa xác nhận cùng người".
--
-- NULL chứ không phải chuỗi rỗng: contact trống / không hợp lệ phải là NULL để chúng
-- KHÔNG dồn chung thành một nhóm. Index của SQLite bỏ qua NULL, nên chúng không bao giờ
-- khớp với nhau — đúng ràng buộc Luna đặt ra.
ALTER TABLE leads ADD COLUMN contact_key TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_contact_key ON leads(contact_key);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. T3 · media_json — ẢNH GẮN VỚI JOB, KHÔNG GẮN VỚI KHÁCH
-- ─────────────────────────────────────────────────────────────────────────
-- Một cột JSON trên chính dòng job, theo đúng khuôn `booking_json` của migration 002:
-- không sinh bảng mới, không nhân bản dữ liệu.
--
-- VÌ SAO GẮN THEO JOB: ảnh sinh ra tại một buổi cụ thể — ngày đó, look đó, người làm đó.
-- Gắn theo khách thì mất thông tin "của lần nào". Trang khách chỉ TỔNG HỢP lại từ các job.
--
-- D1 giữ metadata + link + quyền. FILE KHÔNG NẰM Ở ĐÂY — file ở Google Drive.
-- Dạng: [{ "url": "...", "label": "...", "kind": "album|image",
--          "marketing_ok": false, "added_at": "ISO", "added_by": "github-login" }]
--
-- `marketing_ok` MẶC ĐỊNH false và phải bật thủ công từng mục:
-- quyền xem nội bộ khác quyền dùng cho marketing. Khách đồng ý cho Kay xem lại lần sau
-- KHÔNG đồng nghĩa đồng ý cho lên website hay Instagram. Ai muốn dùng ảnh cho marketing
-- thì phải có xác nhận riêng — xem DEC-20260911-01 về quyền dùng ảnh với đối tác.
-- Không đặt folder ảnh khách thành "ai có link cũng xem được".
ALTER TABLE leads ADD COLUMN media_json TEXT;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Đánh dấu phiên bản schema
-- ─────────────────────────────────────────────────────────────────────────
INSERT OR REPLACE INTO meta(key, value) VALUES ('schema_version', '1.3');
