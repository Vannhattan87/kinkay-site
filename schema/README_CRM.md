# KINKAY CRM trong admin · hướng dẫn bật (Tân làm 1 lần, ~15 phút)

Mã: CR-20260906-28. Audit: CR-20260906-27. Bản 1.0 MVP · 06/09/2026.

## Có gì trong repo

| Đường dẫn | Là gì |
|---|---|
| `schema/crm.sql` | Cấu trúc D1 (4 bảng: leads, partners, lead_events, meta) |
| `schema/crm-seed-20260906.sql` | Import 1 LẦN 7 leads + 4 partners từ Sheet LIVE, giữ nguyên ID |
| `functions/api/crm/_middleware.js` | Cổng đăng nhập: GitHub token của admin → hỏi GitHub → cho qua nếu có quyền push repo |
| `functions/api/crm/_lib.js` | Danh sách dropdown, làm sạch dữ liệu, sinh ID, nhật ký |
| `functions/api/crm/leads.js`, `leads/[id].js` | Danh sách / thêm / xem / cập nhật lead |
| `functions/api/crm/partners.js`, `partners/[id].js` | Đối tác |
| `functions/api/crm/dashboard.js` | Số liệu hành động (đến hạn, quá hạn, expected, actual verified…) |
| `functions/api/crm/export.js` | CSV Leads / Partners / lịch sử → dán vào Sheet làm archive |
| `functions/api/crm/lists.js` | Dropdown + user đang đăng nhập |
| `functions/api/lead.js` (sửa) | Form web ghi thẳng lead New vào CRM khi có `CRM_DB` |
| `static/admin/crm/index.html` | Giao diện CRM, mobile-first, 1 file |

## Bật trên Cloudflare (thứ tự bắt buộc)

1. **Tạo D1**: Cloudflare dashboard → Workers & Pages → D1 SQL Database → Create → tên `kinkay-crm` (region APAC).
2. **Chạy schema**: trong D1 `kinkay-crm` → Console → dán toàn bộ `schema/crm.sql` → Execute.
   (Hoặc trên máy: `npx wrangler login` rồi `npx wrangler d1 execute kinkay-crm --remote --file=schema/crm.sql`.)
3. **Import dữ liệu Sheet 1 lần**: Console → dán `schema/crm-seed-20260906.sql` → Execute. Chạy lần 2 sẽ báo lỗi PRIMARY KEY, đó là cố ý.
   Kiểm tra: `SELECT COUNT(*) FROM leads;` → 7. `SELECT COUNT(*) FROM partners;` → 4.
4. **Gắn binding**: Workers & Pages → Pages → `kinkay-site` → Settings → Bindings → Add → D1 database → Variable name **`CRM_DB`** → chọn `kinkay-crm` → Save. Làm cho **Production** (Preview tuỳ ý).
5. **Push code** (commit + push ở `C:\dev\kinkay-site` như mọi lần). Cloudflare tự deploy.
6. **Mở** https://kinkay.vn/admin/crm/ → "Đăng nhập bằng GitHub" → popup như CMS → vào.
   Ai đăng bài được (tài khoản `kinkay-official`, `Vannhattan87`) thì dùng được. Không có tài khoản nào khác.

Không cần biến môi trường nào mới. Tuỳ chọn: `CRM_ALLOWED_USERS = kinkay-official,Vannhattan87` nếu muốn siết theo tên thay vì theo quyền repo.
**KHÔNG BAO GIỜ** đặt `CRM_DEV_USER` trên Cloudflare (biến này chỉ để test máy local, bỏ qua đăng nhập).

## Sau khi bật: 1 nguồn duy nhất

- Từ lúc bật: **CRM là master**. Kay ghi/cập nhật ở `/admin/crm/`. Form web tự rơi vào CRM (Status New, Source Website Form).
- Google Sheet `KINKAY_Lead_Tracker_LIVE_v2.0`: **chỉ archive / báo cáo**. Không nhập tay vào Sheet nữa. Muốn có số trên Sheet: CRM → tab "Thêm" → Tải Leads.csv → dán đè vào tab Leads. Tuần 1 lần là đủ (Chủ nhật, lúc Tân QA).
- Không có sync 2 chiều. Không có bản master thứ hai.
- Đổi từ Sheet sang CRM chỉ tính là xong khi Tân đối chiếu 7 lead + 4 partner trên `/admin/crm/` khớp Sheet (cột, ID, note) và ghi comment CR-28 APPROVED.

## Backup

- D1 có Time Travel 30 ngày (khôi phục tới bất kỳ phút nào) sẵn, không phải bật.
- Backup tay: tab "Thêm" → tải 3 file CSV (leads, partners, lịch sử) → thả vào `KINKAY/13_Analytics_Dashboard/backup/` trên Drive. Tuần 1 lần.

## Test đã chạy (06/09, wrangler local + D1 local)

Schema + seed chạy sạch (7/4/11 events). Dashboard ra đúng số Sheet (7 leads, 6 booking, 4 completed, 85,7%, 5,2tr chưa xác minh, 3,5tr mở). Thêm lead sinh ID `KK-260906-001/002` không trùng. PATCH nhanh ghi 5 thay đổi vào nhật ký, actual_revenue sửa thì cờ verified tự về 0. Form web POST → lead New `KK-260906-003` với ghi chú địa điểm/ngân sách. Export CSV đúng thứ tự cột Sheet. Không token → 401. Giao diện: 5 màn hình render, quick update lưu 3 thay đổi (test jsdom). Chưa test trên điện thoại thật và chưa test popup GitHub thật (cần deploy).
