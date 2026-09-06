-- KINKAY CRM · Cloudflare D1 (SQLite) · v1.0 · 06/09/2026 · CR-20260906-28
--
-- Nguồn dữ liệu khách DUY NHẤT sau migration (thay KINKAY_Lead_Tracker_LIVE_v2.0).
-- Cột khớp 1:1 với tab Leads / Partners của Sheet LIVE để import không mất gì và export ngược
-- ra Sheet (archive/báo cáo) không cần đổi tên cột.
--
-- Chạy 1 lần:  wrangler d1 execute kinkay-crm --remote --file=schema/crm.sql
-- (hoặc dán vào Console của D1 trên dashboard Cloudflare)
--
-- Tiền: INTEGER đồng VND, NULL = chưa có giá/chưa xác minh (KHÔNG dùng 0 thay cho "chưa biết").
-- Ngày: TEXT ISO YYYY-MM-DD. Thời điểm: TEXT ISO 8601 UTC.

CREATE TABLE IF NOT EXISTS leads (
  id               TEXT PRIMARY KEY,            -- KK-YYMMDD-### (giữ nguyên ID từ Sheet)
  created_date     TEXT NOT NULL,               -- YYYY-MM-DD
  customer_name    TEXT NOT NULL,
  contact          TEXT,                        -- @handle / số / email
  contact_channel  TEXT,                        -- Instagram, Zalo, Facebook/Messenger, Website Form...
  service          TEXT,
  event_date       TEXT,                        -- YYYY-MM-DD, NULL nếu chưa chốt
  source           TEXT,                        -- Google Organic, Instagram Organic, Partner Referral...
  segment          TEXT,                        -- B2C, Partner-sourced, B2B/Commercial
  status           TEXT NOT NULL DEFAULT 'New',
  expected_revenue INTEGER,                     -- VND, NULL = chưa báo giá
  deposit          TEXT,                        -- Yes / No / N/A (cờ, không phải số tiền)
  actual_revenue   INTEGER,                     -- VND đã nhận; NULL = chưa xác minh
  actual_verified  INTEGER NOT NULL DEFAULT 0,  -- 1 = Tân đã xác minh số actual_revenue
  owner            TEXT NOT NULL DEFAULT 'Kay',
  next_action      TEXT,
  next_followup    TEXT,                        -- YYYY-MM-DD
  notes            TEXT,
  partner_id       TEXT,                        -- PT-... nếu do đối tác giới thiệu
  last_updated     TEXT NOT NULL,               -- ISO 8601
  updated_by       TEXT,                        -- GitHub login người sửa gần nhất
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_status   ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_followup ON leads(next_followup);
CREATE INDEX IF NOT EXISTS idx_leads_event    ON leads(event_date);

CREATE TABLE IF NOT EXISTS partners (
  id               TEXT PRIMARY KEY,            -- PT-YYMMDD-###
  created_date     TEXT NOT NULL,
  name             TEXT NOT NULL,
  type             TEXT,                        -- Wedding Planner, Wedding Photography, Studio / Production...
  contact_channel  TEXT,
  contact          TEXT,
  status           TEXT NOT NULL DEFAULT 'New', -- New, Contacted, Nurture, Warm, Active Opportunity, Active Partner, Dormant, Closed
  last_touch       TEXT,                        -- YYYY-MM-DD, chỉ đổi khi trao đổi thật
  opportunity      TEXT,
  commercial_terms TEXT,                        -- REFERRAL 10% | base | payee | payout... ; Hilton: DISCOUNT 20% ONE-OFF
  referral_rate    REAL NOT NULL DEFAULT 0.10,  -- chuẩn 10% (DEC-20260906-11). Hilton 20% là one-off ghi ở lead, KHÔNG ghi ở đây.
  next_action      TEXT,
  next_followup    TEXT,
  notes            TEXT,
  owner            TEXT NOT NULL DEFAULT 'Kay',
  last_updated     TEXT NOT NULL,
  updated_by       TEXT,
  created_at       TEXT NOT NULL
);

-- Nhật ký thay đổi: ai đổi gì lúc nào. Dùng để QA tuần (Tân) và để không ai "sửa lặng lẽ" tiền.
CREATE TABLE IF NOT EXISTS lead_events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  entity    TEXT NOT NULL,                      -- lead | partner
  entity_id TEXT NOT NULL,
  ts        TEXT NOT NULL,
  actor     TEXT,                               -- GitHub login hoặc 'website-form' / 'import'
  field     TEXT NOT NULL,                      -- tên cột, hoặc 'create'
  old_value TEXT,
  new_value TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_entity ON lead_events(entity, entity_id);

-- Cấu hình nhỏ (ví dụ: ngày import, phiên bản schema)
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
INSERT OR REPLACE INTO meta(key, value) VALUES ('schema_version', '1.0');
