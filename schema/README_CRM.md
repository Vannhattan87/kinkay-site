# KINKAY CRM trong admin · hướng dẫn bật (Tân làm 1 lần, ~15 phút)

Mã: CR-20260906-28. Audit: CR-20260906-27. Bản 1.1 · 06/09/2026 (sau QA ChatGPT vòng 1: cutover flag, seed mới nhất, ID nguyên tử, giới hạn D1).

## Có gì trong repo

| Đường dẫn | Là gì |
|---|---|
| `schema/crm.sql` | Cấu trúc D1 (5 bảng: leads, partners, lead_events, id_counters, meta) |
| `schema/crm-seed-20260906.sql` | Snapshot Sheet lúc 22:40 06/09 (Sheet sửa lần cuối 22:17 06/09). CHỈ dùng nếu Sheet chưa đổi; nếu đã đổi → sinh seed mới bằng tool bên dưới |
| `tools/crm-seed-from-sheet.js` | Sinh seed SQL từ CSV MỚI NHẤT của Sheet (tab Leads + Partners) |
| `tools/crm-reconcile.js` | Đối chiếu Sheet CSV ↔ D1 export JSON: đếm, tập ID, trường trọng yếu. 0 khác biệt mới được cutover |
| `functions/api/crm/_middleware.js` | Cổng đăng nhập: GitHub token của admin → hỏi GitHub → cho qua nếu có quyền push repo |
| `functions/api/crm/_lib.js` | Danh sách dropdown, làm sạch dữ liệu, sinh ID, nhật ký |
| `functions/api/crm/leads.js`, `leads/[id].js` | Danh sách / thêm / xem / cập nhật lead |
| `functions/api/crm/partners.js`, `partners/[id].js` | Đối tác |
| `functions/api/crm/dashboard.js` | Số liệu hành động (đến hạn, quá hạn, expected, actual verified…) |
| `functions/api/crm/export.js` | CSV Leads / Partners / lịch sử → dán vào Sheet làm archive |
| `functions/api/crm/lists.js` | Dropdown + user đang đăng nhập |
| `functions/api/lead.js` (sửa) | Form web ghi thẳng lead New vào CRM khi có `CRM_DB` **và** `CRM_CUTOVER=1` |
| `static/admin/crm/index.html` | Giao diện CRM, mobile-first, 1 file |

## Bật trên Cloudflare (thứ tự bắt buộc · KHÔNG có cửa sổ hai master)

**Giai đoạn A · CHỈ ĐỌC (Sheet vẫn là master).** Biến `CRM_CUTOVER` chưa đặt → API chặn mọi POST/PATCH (423), form web KHÔNG ghi D1, giao diện hiện băng "CHỈ ĐỌC". Kay tiếp tục ghi Sheet như cũ.

1. **Tạo D1**: Cloudflare dashboard → Workers & Pages → D1 SQL Database → Create → tên `kinkay-crm` (region APAC).
2. **Chạy schema**: D1 `kinkay-crm` → Console → dán toàn bộ `schema/crm.sql` → Execute.
3. **Lấy dữ liệu MỚI NHẤT từ Sheet** (đừng tin snapshot cũ):
   - Sheet → tab Leads → File → Download → CSV → `leads.csv`; tab Partners → `partners.csv`.
   - `node tools/crm-seed-from-sheet.js leads.csv partners.csv > schema/crm-seed-$(date +%Y%m%d).sql`
   - Dán file SQL vừa sinh vào Console D1 → Execute. (Nếu Sheet chưa đổi từ 22:17 06/09 thì `crm-seed-20260906.sql` cho kết quả y hệt.)
4. **Gắn binding**: Pages → `kinkay-site` → Settings → Bindings → Add → D1 → Variable name **`CRM_DB`** → `kinkay-crm` → Save (Production).
5. **Push code** ở `C:\dev\kinkay-site`. Cloudflare tự deploy.
6. **Smoke test trước cutover** (Tân/Kay, việc thật, không giả định):
   - https://kinkay.vn/api/crm/lists không đăng nhập → 401.
   - https://kinkay.vn/admin/crm/ trên iPhone Safari + máy tính → Đăng nhập GitHub (popup như CMS) → thấy băng CHỈ ĐỌC, Hôm nay có số, tìm khách được.
   - Thử Lưu một thay đổi → phải bị chặn "CHỈ ĐỌC" (423).
7. **Đối chiếu**: tab "Thêm" → tải Leads.csv + Partners.csv từ CRM, hoặc mở `/api/crm/export?what=leads&format=json` và `what=partners` → lưu `crm-leads.json`, `crm-partners.json` → `node tools/crm-reconcile.js leads.csv partners.csv crm-leads.json crm-partners.json` → phải in **TỔNG KHÁC BIỆT: 0**. Khác → sửa/sinh lại seed, chạy lại. Kay ngừng ghi Sheet từ lúc tải CSV ở bước 3 tới khi bật cutover (nếu Kay đã ghi thêm, tải CSV lại và làm lại 3 → 7).

**Giai đoạn B · CUTOVER (1 thao tác, tức thì).**
8. Pages → Settings → Environment variables → Production → thêm **`CRM_CUTOVER` = `1`** → Save → Deployments → Retry deployment (hoặc push 1 commit rỗng). Từ deploy này: D1 = master, POST/PATCH mở, form web ghi thẳng D1.
9. Cùng lúc: đổi tên tab Leads/Partners trên Sheet thành `Leads (ARCHIVE từ dd/mm)` và ghi 1 dòng ở đầu Dashboard: "Nguồn duy nhất: kinkay.vn/admin/crm/". Comment CR-28 APPROVED trong Control Room.
10. Test end-to-end sau cutover: thêm 1 lead tên "TEST cutover" ở CRM → thấy trong Hôm nay → đổi Status = Lost, ghi chú "test" (không xoá, schema không có xoá). Gửi form web thử 1 lần → lead New Source=Website Form xuất hiện.

Không cần biến môi trường nào khác. Tuỳ chọn: `CRM_ALLOWED_USERS = kinkay-official,Vannhattan87` nếu muốn siết theo tên thay vì theo quyền repo.
**KHÔNG BAO GIỜ** đặt `CRM_DEV_USER` trên Cloudflare (biến này chỉ để test máy local, bỏ qua đăng nhập).

## Sau cutover: 1 nguồn duy nhất

- Kay ghi/cập nhật ở `/admin/crm/`. Form web tự rơi vào CRM (Status New, Source Website Form).
- Google Sheet: **chỉ archive / báo cáo**. Muốn có số trên Sheet: CRM → tab "Thêm" → Tải Leads.csv → dán đè vào tab ARCHIVE. Tuần 1 lần (Chủ nhật, lúc Tân QA). Không sync 2 chiều, không master kép.

## Backup + giới hạn D1 (theo docs Cloudflare, ChatGPT QA 06/09)

- **Time Travel** (khôi phục về bất kỳ phút nào): Workers **Free = 7 ngày**, Workers Paid = 30 ngày. Tài khoản KINKAY đang Free → 7 ngày. Vì vậy backup tay hằng tuần là BẮT BUỘC, không phải tuỳ chọn.
- Giới hạn Free: 500 MB / database, 5 GB tổng tài khoản, 5 triệu row đọc/ngày, 100 nghìn row ghi/ngày. Với vài trăm lead/năm, không chạm tới.
- Backup tay: tab "Thêm" → tải 3 file CSV (leads, partners, lịch sử) → thả vào `KINKAY/13_Analytics_Dashboard/backup/YYYY-MM-DD/` trên Drive. Chủ nhật hằng tuần cùng lúc QA.

## Test đã chạy (06/09, wrangler local + D1 local)

**Vòng 2 (sau QA):** cutover OFF → POST/PATCH trả 423, form web trả 204 nhưng KHÔNG ghi D1 (đếm vẫn 7), GET/export bình thường, băng CHỈ ĐỌC hiện. Seed sinh từ CSV (tool) → nạp → export → reconcile = **0 khác biệt**; sau khi thêm dữ liệu test → reconcile báo 38 khác biệt (âm tính đúng). ID nguyên tử: trước khi có `id_counters`, 20 POST đồng thời → 13 lỗi UNIQUE (0 trùng nhưng mất request); sau → **20/20 lead + 10/10 partner, 0 trùng**; ngày đã có seed 001/002 → cấp đúng 003.

**Vòng 1:**

Schema + seed chạy sạch (7/4/11 events). Dashboard ra đúng số Sheet (7 leads, 6 booking, 4 completed, 85,7%, 5,2tr chưa xác minh, 3,5tr mở). Thêm lead sinh ID `KK-260906-001/002` không trùng. PATCH nhanh ghi 5 thay đổi vào nhật ký, actual_revenue sửa thì cờ verified tự về 0. Form web POST → lead New `KK-260906-003` với ghi chú địa điểm/ngân sách. Export CSV đúng thứ tự cột Sheet. Không token → 401. Giao diện: 5 màn hình render, quick update lưu 3 thay đổi (test jsdom). Chưa test trên điện thoại thật và chưa test popup GitHub thật (cần deploy).
