-- KINKAY CRM · MIGRATION 007 · MKT-DEC-20260916-01 · 16/09/2026
-- Duyệt: Luna §4 "APPROVED — WITH SCOPE LOCK" (16/09). Tân giữ quyền override.
--
-- ─────────────────────────────────────────────────────────────────────────
-- SỐ MIGRATION
-- ─────────────────────────────────────────────────────────────────────────
-- File 006 ghi "CR-31 Đ8 từ nay dùng 007 và schema_version 1.6". CR-31 Đ8 (request_id /
-- idempotency) tới giờ VẪN chưa duyệt, chưa build, chưa chạy. Luật từ file 004 là DÃY SỐ
-- PHẢI PHẢN ÁNH THỨ TỰ CHẠY THẬT — giữ chỗ không thắng được thứ tự thật. Migration này
-- build trước và chạy trước nên lấy 007.
--
--   *** CR-31 Đ8 TỪ NAY DÙNG 008 VÀ schema_version 1.7. ***
--
-- Chạy SAU crm-migration-006 (schema_version 1.5).
-- CHẶN CỨNG: KHÔNG chạy file này cho tới khi 005 và 006 đã push, đã chạy, đã verify trên
-- production. Luna §4 mục A đặt đây là điều kiện tiên quyết, không phải khuyến nghị.
--
-- An toàn chạy lại: CREATE INDEX có IF NOT EXISTS. ALTER TABLE chỉ chạy được 1 lần —
-- lần 2 báo "duplicate column name", bỏ qua là đúng.
--
-- ─────────────────────────────────────────────────────────────────────────
-- PHẠM VI: BA CỘT. KHÔNG HƠN.
-- ─────────────────────────────────────────────────────────────────────────
-- Packet đầu của Kei xin 8 cột. Luna cắt còn 3. Năm cột bị loại và LÝ DO, ghi ở đây vì
-- người chạy migration đọc file này chứ không đọc sổ tranh luận:
--
--   resident_status  — chưa có quyết định kinh doanh nào cần tới nó. Hoãn.
--   foreign_lead     — DERIVED. Suy từ nationality. Lưu cột thì sửa nationality xong
--   foreign_booking    cờ vẫn cũ, thành số sai mà không ai biết. Đúng bệnh `pax` ở CR-33.
--   confirmed_at     — DERIVED từ lead_events. logDiff() đã ghi mọi lần đổi `status` kèm ts
--   completed_at       từ ngày cutover 07/09. Thêm cột là nhân đôi sự thật.
--
-- ─────────────────────────────────────────────────────────────────────────
-- LUẬT DỮ LIỆU CHO `nationality` — đọc trước khi nhập dòng đầu tiên
-- ─────────────────────────────────────────────────────────────────────────
-- CHỈ ghi khi khách TỰ NÓI RA. Tuyệt đối không suy từ:
--   tên · số điện thoại · giọng nói · ảnh · khách sạn · ngôn ngữ nhắn tin · nguồn lead
-- Không biết thì để NULL. NULL nghĩa là CHƯA BIẾT, không bao giờ nghĩa là khách Việt.
-- Một KPI dựng trên phỏng đoán thì tệ hơn không có KPI, vì nó trông như sự thật.

ALTER TABLE leads ADD COLUMN nationality   TEXT;   -- ISO-ish tên nước khách tự khai, NULL = chưa biết
ALTER TABLE leads ADD COLUMN source_detail TEXT;   -- chi tiết nguồn: truy vấn Google, tên đối tác, "bạn giới thiệu"
ALTER TABLE leads ADD COLUMN lost_reason   TEXT;   -- chỉ điền khi status = Lost

-- Đếm coverage nationality là truy vấn chạy mỗi lần mở Control Room. Index cho rẻ.
CREATE INDEX IF NOT EXISTS idx_leads_nationality ON leads(nationality);

INSERT OR REPLACE INTO meta(key, value) VALUES ('schema_version', '1.6');

-- ─────────────────────────────────────────────────────────────────────────
-- KHÔNG CÓ BACKFILL TRONG FILE NÀY. CỐ Ý.
-- ─────────────────────────────────────────────────────────────────────────
-- 11 lead nhập từ Sheet ngày 06/09 (7 lead seed + 4 job VC) vào bằng file SQL, không đi qua
-- insertLead(), nên không có event `create` và không có lịch sử `status`. Ba cột mới của
-- chúng là NULL, và lịch sử trạng thái của chúng không dựng lại được.
--
-- Luna §4 CẤM sinh event giả để lấp. Báo cáo phải in mẫu số ra ngoài (`n=6/17`) chứ không
-- được giấu phần thiếu. Viết lịch sử chưa từng xảy ra thì ba tháng sau không ai phân biệt
-- được số thật với số bịa.
