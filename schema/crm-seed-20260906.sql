-- KINKAY CRM · SEED MIGRATION 1 LẦN từ KINKAY_Lead_Tracker_LIVE_v2.0 (Google Sheet)
-- Đọc Sheet lúc 06/09/2026 22:40 ICT (tab Leads 7 dòng, tab Partners 4 dòng).
-- Giữ nguyên Lead ID / Partner ID, tên, note nguyên văn. Ô trống → NULL. KHÔNG bịa giá trị.
--
-- Quy ước chuyển đổi (ghi rõ để QA):
--   "1,500,000 ₫"  → 1500000        · ô trống Expected Revenue → NULL
--   "0 ₫" ở Actual Revenue → NULL, actual_verified = 0  (Sheet ghi rõ 0 = "chưa xác minh", không phải đã thu 0)
--   dd/mm/yyyy → yyyy-mm-dd          · Deposit giữ nguyên Yes / No / N/A
--
-- Chạy SAU schema/crm.sql, chỉ 1 lần:
--   wrangler d1 execute kinkay-crm --remote --file=schema/crm-seed-20260906.sql
-- Chạy lần 2 sẽ lỗi PRIMARY KEY (cố ý, để không nhân đôi dữ liệu).

INSERT INTO leads (id, created_date, customer_name, contact, contact_channel, service, event_date, source, segment, status, expected_revenue, deposit, actual_revenue, actual_verified, owner, next_action, next_followup, notes, partner_id, last_updated, updated_by, created_at) VALUES
('KK-260905-001','2026-09-05','Crystal Blazely','@crystalblazely','Instagram','Event/Gala Makeup',NULL,'Instagram Organic','B2C','Confirmed',1500000,'N/A',NULL,0,'Kay',
 'Bổ sung giá chốt, ngày/giờ và khách sạn; tới onsite gặp Crystal, nhận tiền mặt theo thỏa thuận (không yêu cầu cọc).','2026-09-06',
 'Gala dinner in District 1; onsite hotel requested; quote 1.5m/session; kinkay.vn shared. 06/09/2026 — Tân xác nhận Kay đã chốt gói Crystal. Cập nhật thanh toán từ Tân: Crystal không thoải mái chuyển khoản tiền cọc; Kay đã đồng ý không yêu cầu cọc, tới ngày onsite gặp khách và nhận tiền mặt. Deposit=N/A (miễn yêu cầu cọc cho booking này); Status=Confirmed. Actual Revenue=0: chưa ghi nhận thu tiền; cập nhật khi Kay xác nhận số tiền mặt thực nhận. Giá 1.500.000 là báo giá trước đó, giá chốt và ngày/giờ/khách sạn cụ thể chưa được bổ sung.',
 NULL,'2026-09-06T00:00:00Z','import','2026-09-05T00:00:00Z'),
('KK-260905-002','2026-09-05','Jessica Novia','@jessicanoviaaa_','Instagram','Photoshoot Makeup','2026-11-14','Google Organic','B2C','Deposit Paid',2000000,'Yes',NULL,0,'Kay',
 'Confirm call time, hotel logistics and remaining balance','2026-09-06',
 'Found KINKAY via Google/website; staying at Triple E Hotel Fine Art Museum; makeup + hair 2.0m; schedule note says deposit paid',
 NULL,'2026-09-05T00:00:00Z','import','2026-09-05T00:00:00Z'),
('KK-260901-001','2026-09-01','Hilton Saigon destination wedding / Nguyệt Hà','Nguyệt Hà','Facebook/Messenger','Destination Wedding','2026-10-24','Partner Referral','Partner-sourced','Quoted',NULL,'No',NULL,0,'Kay',
 'Xác nhận scope, hạng mục giảm 20% và touch-up; sau đó chốt tổng giá Hilton theo DEC-20260906-11','2026-09-06',
 'Base quoted: bride 5.0m + mother 2.5m + groom 1.0m; touch-up 1.5-2.0m if requested; 20% planner discount verbally offered. APPROVED 06/09/2026, DEC-20260906-11: 20% discount one-off cho Hilton 24/10; standard referral 10% cho case sau; không cộng chồng. Partner PT-260901-001. Scope/base discount và add-on chưa xác nhận, Expected Revenue để trống.',
 'PT-260901-001','2026-09-06T00:00:00Z','import','2026-09-01T00:00:00Z'),
('KK-260826-001','2026-08-26','VC Interview Client 1','Not retained','Other','On-Camera / Interview Makeup','2026-08-26','Direct/Unknown','B2C','Completed',1300000,'N/A',NULL,0,'Kay',
 'Ask for review/referral if appropriate','2026-09-08',
 'At-home makeup for interview to work as VC/host for streaming website; name/contact not retained',
 NULL,'2026-08-26T00:00:00Z','import','2026-08-26T00:00:00Z'),
('KK-260827-001','2026-08-27','VC Interview Client 2','Not retained','Other','On-Camera / Interview Makeup','2026-08-27','Direct/Unknown','B2C','Completed',1300000,'N/A',NULL,0,'Kay',
 'Ask for review/referral if appropriate','2026-09-08',
 'At-home makeup for interview to work as VC/host for streaming website; name/contact not retained',
 NULL,'2026-08-27T00:00:00Z','import','2026-08-27T00:00:00Z'),
('KK-260828-001','2026-08-28','VC Interview Client 3','Not retained','Other','On-Camera / Interview Makeup','2026-08-28','Direct/Unknown','B2C','Completed',1300000,'N/A',NULL,0,'Kay',
 'Ask for review/referral if appropriate','2026-09-08',
 'At-home makeup for interview to work as VC/host for streaming website; name/contact not retained',
 NULL,'2026-08-28T00:00:00Z','import','2026-08-28T00:00:00Z'),
('KK-260831-001','2026-08-31','VC Interview Client 4','Not retained','Other','On-Camera / Interview Makeup','2026-08-31','Direct/Unknown','B2C','Completed',1300000,'N/A',NULL,0,'Kay',
 'Ask for review/referral if appropriate','2026-09-08',
 'At-home makeup for interview to work as VC/host for streaming website; name/contact not retained',
 NULL,'2026-08-31T00:00:00Z','import','2026-08-31T00:00:00Z');

INSERT INTO partners (id, created_date, name, type, contact_channel, contact, status, last_touch, opportunity, commercial_terms, referral_rate, next_action, next_followup, notes, owner, last_updated, updated_by, created_at) VALUES
('PT-260905-001','2026-09-05','NUVO Studio','Studio / Production','Facebook/Messenger','NUVO Studio','Nurture','2026-09-05','Future model shoots / test concepts',
 'TBD per project cho studio thuê trực tiếp; nếu giới thiệu khách: standard referral 10% (DEC-20260906-11), base/payout xác nhận từng case.',0.10,
 'Follow up with fresh portfolio after 3-4 weeks','2026-10-01',
 'Current project already staffed; they said they will save Kay''s contact for future projects','Kay','2026-09-05T00:00:00Z','import','2026-09-05T00:00:00Z'),
('PT-260905-002','2026-09-05','Calme Studio','Studio / Beauty Production','Email','contact@calmestudio.com','Nurture','2026-09-05','Lookbook / beauty shoot MUA',
 'TBD per project cho studio thuê trực tiếp; nếu giới thiệu khách: standard referral 10% (DEC-20260906-11), base/payout xác nhận từng case.',0.10,
 'Follow up with fresh portfolio after 3-4 weeks','2026-10-01',
 'Calme replied they will save Kay''s information for future work','Kay','2026-09-05T00:00:00Z','import','2026-09-05T00:00:00Z'),
('PT-260905-003','2026-09-05','LinhLeChi Photography','Wedding Photography','Instagram','LinhLeChi_Photography','Active Opportunity','2026-09-05','Wedding + pre-wedding referral partnership',
 'Bride 5.0m; lễ gia tiên 3.0m; bà sui 2.5m; pre-wedding pending. Standard referral 10% approved (DEC-20260906-11); base/payout phải thống nhất trước khi chốt.',0.10,
 'Xác nhận giá pre-wedding rồi gửi; trình bày referral chuẩn 10% và chốt cơ sở tính / thời điểm thanh toán.','2026-09-06',
 'Recognized Kay''s work on Vân Nhi and asked pricing; warmest current partner signal','Kay','2026-09-06T00:00:00Z','import','2026-09-05T00:00:00Z'),
('PT-260901-001','2026-09-01','Nguyệt Hà / Wedding Planner','Wedding Planner','Facebook/Messenger','Nguyệt Hà','Active Opportunity','2026-09-05','Hilton Saigon destination wedding 24/10 and future referrals',
 'APPROVED DEC-20260906-11: Hilton 24/10/2026 (KK-260901-001) discount 20% ONE-OFF vì Kay đã báo; không cộng referral 10%. Case sau: standard referral 10%. Scope/base discount Hilton còn chờ xác nhận.',0.10,
 'Giữ cam kết Hilton 20%; xác nhận scope/base discount/touch-up và tổng giá. Case mới dùng referral chuẩn 10%.','2026-09-06',
 'Specific 24/10 lead is also logged in Leads: KK-260901-001. Policy approved 06/09/2026 by Tân; chưa có xác nhận mới từ planner trong phiên cập nhật này.','Kay','2026-09-06T00:00:00Z','import','2026-09-01T00:00:00Z');

INSERT INTO lead_events (entity, entity_id, ts, actor, field, old_value, new_value)
SELECT 'lead', id, '2026-09-06T15:40:00Z', 'import', 'create', NULL, 'Import 1 lần từ KINKAY_Lead_Tracker_LIVE_v2.0 (06/09/2026)' FROM leads;
INSERT INTO lead_events (entity, entity_id, ts, actor, field, old_value, new_value)
SELECT 'partner', id, '2026-09-06T15:40:00Z', 'import', 'create', NULL, 'Import 1 lần từ KINKAY_Lead_Tracker_LIVE_v2.0 (06/09/2026)' FROM partners;

INSERT OR REPLACE INTO meta(key, value) VALUES ('seed_source', 'KINKAY_Lead_Tracker_LIVE_v2.0 · đọc 06/09/2026 22:40 ICT · 7 leads · 4 partners');
INSERT OR REPLACE INTO meta(key, value) VALUES ('seed_applied_at', datetime('now'));
