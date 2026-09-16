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

## TRẠNG THÁI: ĐÃ CUTOVER 13:40 07/09/2026 · D1 = master · Sheet = ARCHIVE · CRM_CUTOVER=1 đang bật trên Production

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

## Booking Confirmation (CR-20260907-29) · thêm 07/09/2026

Kay mở lead (Quoted / Hold / Deposit Paid / Confirmed) → nút **Tạo Booking Confirmation** → CRM kiểm tra thiếu gì (tên, dịch vụ, ngày, giờ hẹn, địa điểm, tổng phí, cọc) → sheet chỉ hỏi phần thiếu → xem trước ảnh 1080×1350 → **Chia sẻ ảnh** (Web Share API, ra sheet chia sẻ iPhone: Zalo/IG/WhatsApp) hoặc **Lưu ảnh** → snapshot lưu D1 `booking_confirmations` (BC-<lead>-V1, V2… không ghi đè). Không phải hoá đơn; tên khách thấy = "Booking Confirmation".

- Migration: `schema/crm-migration-002-booking-confirmations.sql` (thêm cột `leads.booking_json` + bảng `booking_confirmations`, schema 1.2). Chạy vào D1 sau `crm.sql`, 1 lần.
- API (sau xác thực CRM, cùng cổng cutover: POST bị 423 khi `CRM_CUTOVER` OFF): `GET/POST /api/crm/leads/:id/confirmations`, `GET /api/crm/confirmations/:id`.
- Ảnh vẽ bằng Canvas 2D ngay trên máy Kay, không thư viện, không service ảnh, không SaaS; font Playfair + Be Vietnam Pro tự host (`/assets/fonts/`); wordmark vẽ chữ theo đúng logo SVG. Nội dung dài → tự co chữ thân 1 → 0,9 → 0,8 → 0,72, không cắt.
- Tiền: Tổng phí = `expected_revenue` (chỉ điền khi đang trống). Cọc = số tiền / không cần cọc / không áp dụng, độc lập với cờ Deposit Yes/No/N/A. **Không** đụng `actual_revenue` / `actual_verified`.
- Không đưa lên ảnh: Source, Segment, Owner, Next Action, Follow-up, ghi chú nội bộ, điều khoản đối tác.
- **Ngôn ngữ bản xác nhận (07/09 chiều):** chọn `Tiếng Việt` / `English` ở đầu sheet mỗi lần tạo. Không tự đoán từ tên/quốc tịch/nguồn. Ưu tiên: `preferred_language` trên lead (lưu trong `booking_json`) → ngôn ngữ bản gần nhất → `vi`. Chọn 1 lần là nhớ; đổi ngôn ngữ + tạo lại = version mới, bản cũ giữ nguyên. Snapshot có `language`, `service_display` (tên dịch vụ chuẩn theo bảng cố định; dịch vụ lạ giữ nguyên). Chỉ dịch nhãn hệ thống + footer; địa điểm/gồm/ghi chú Kay nhập giữ nguyên. Định dạng: VI `Thứ Bảy, 14/11/2026 · 15:00 · 1.500.000 ₫`; EN `Sat, 14 Nov 2026 · 3:00 PM · VND 1,500,000`. Tiêu đề VI `XÁC NHẬN ĐẶT LỊCH`, EN `BOOKING CONFIRMATION`.

## Bảng giá theo dòng + vòng đời bản phát hành (CR-20260915-33) · thêm 15/09/2026

Chạy `schema/crm-migration-005-line-items-lifecycle.sql` (schema_version 1.4). **CR-31 Đ8 từ nay dùng 006 / 1.5.**

**Vì sao đổi.** BC-KK-260914-005-V1 in ra `NUMBER OF PEOPLE: 2` trong khi Total Fee 1.800.000đ (giá 1 người).
Nguyên nhân gốc: `pax` và `total_fee` là hai field rời, không có phép tính nào nối chúng lại, và
`buildSnapshot` còn fallback `booking.total_fee ?? lead.expected_revenue` — tức tổng tiền trên tài liệu
gửi khách có thể đến từ ước tính pipeline. Card ghi "details agreed at the time of issue" nên số sai
in ra là không đòi lại được.

**Tiền.** Tổng tiền của một Booking Confirmation CHỈ đến từ `booking_json.line_items`:

| trường | ý nghĩa |
|---|---|
| `type` | `service` (qty = pax, ảnh hưởng giá) · `fee` (phụ phí) · `discount` (giảm giá) |
| `label` | tên dòng khách nhìn thấy |
| `qty` | `service`: số khách. `fee`/`discount`: mặc định 1, renderer không in pax |
| `unit_price` | **luôn nhập dương**. Dấu do `type` quyết định, Kay không bao giờ gõ dấu trừ |
| `amount` | `sign(type) × qty × unit_price`. **Server luôn tự tính lại**, giá trị client gửi chỉ để đối chiếu (lệch → 422) |

- `Grand Total = Σ amount`. Không ngoại lệ, không ô Total nhập tay. Giảm giá và phụ phí là line item, không phải trường hợp riêng.
- `pax` hiển thị = Σ `qty` của các dòng `service`. Không còn là field rời → không còn đường để pax lệch khỏi tổng tiền.
- `expected_revenue` KHÔNG còn fallback vào BC. Ước tính pipeline ≠ số đã thoả thuận với khách.
- Cọc là **payment**, không phải dòng hàng: `amount_paid + balance_due = grand_total` là một identity riêng.
- `auditSnapshot()` trong `_lib.js` là cổng chặn cuối: server chạy nó **trước khi INSERT**, không đạt thì không phát hành.

**Vòng đời bản phát hành.** Cột mới trên `booking_confirmations`:
`status` (`active` | `superseded` | `voided`), `superseded_at`, `superseded_by_id`, `superseded_reason`, `status_set_by`.

- `active` → gửi / gửi lại được.
- `superseded` → server tự đặt khi phát hành bản mới, **trỏ thẳng** tới bản thay thế qua `superseded_by_id`.
  Mặc định không gửi; muốn gửi phải bấm mở khoá hai lần trong preview.
- `voided` → bản SAI DỮ KIỆN. Tuyệt đối không gửi, dưới mọi đường. Giữ lại để đối chiếu.
  Đặt tay qua `POST /api/crm/confirmations/:id` với `{status:'voided', reason:'...'}` (bắt buộc có lý do).

**KHÔNG suy ra trạng thái từ "version cao nhất"** — có thể tồn tại V4 nháp hoặc V4 voided trong khi V3 vẫn có hiệu lực.

**Snapshot đã phát hành là bất biến.** Migration không sửa nội dung bản cũ, chỉ thêm khả năng cho bản mới.
Bản không có `snapshot_version` (V1/V2) vẽ bằng nhánh cũ, **giữ nguyên cả nhãn cũ** — đổi nhãn là đổi hình ảnh
của một tài liệu đã gửi đi. Không back-derive: `pax=2 / total=1.8tr` không đủ thông tin để suy ra đơn giá thật,
chia ra 900k chỉ tạo một sự thật giả.

**Test.** `node tests/bc_line_items.mjs` — 30 assertion, gồm fuzz 4.000 snapshot canh đúng một luật:
không tồn tại đường nào tạo được BC V3 mà Grand Total không truy ngược 100% về line items.

## Xoá bản ghi + chống trùng khách · thêm 11/09/2026 (Tân yêu cầu)

Vấn đề: Kay gõ tay tên khách mỗi lần thêm job → cùng 1 người thành nhiều bản ghi rời, có thể nhập trùng 1 job 2 lần, và không có cách gỡ bản ghi sai (luật cũ "không xoá lead"). Luật cũ đổi thành:

- **Lost** = khách thật không chốt. Vẫn tính vào tỉ lệ chuyển đổi. Không xoá.
- **Xoá** = nhập trùng / nhập sai / test. Bản ghi rời khỏi mọi KPI ngay. Nút ở cuối trang chi tiết lead / đối tác, bắt chọn lý do.
- Xoá **chụp nguyên dòng** vào `lead_events` (`field='delete'`, `old_value` = JSON, `new_value` = lý do) rồi mới `DELETE`, trong 1 batch. Khôi phục giữ nguyên ID, không phụ thuộc Time Travel 7 ngày. **Không cần migration.**
- Chặn xoá: lead đã phát hành Booking Confirmation (khách đang cầm bản xác nhận → đổi Lost); đối tác còn khách gắn `partner_id`.
- Khôi phục: banner "Hoàn tác" ngay sau khi xoá, hoặc tab **Thêm → Đã xoá**.

Chống trùng:

- Chuẩn hoá tên: bỏ danh xưng đầu (Ms./Mrs./chị/cô/C.) trước khi bỏ dấu, rồi bỏ dấu, chữ thường. `Ms. Diễm` = `Ms Diem` = `chị diễm`. Chuẩn hoá contact: SĐT về dạng số (84 → 0), @handle / link IG về handle, bỏ giá trị giữ chỗ ("Not retained", "N/A"). Hàm ở `_lib.js` (`normName`, `normContact`) và bản sao y hệt trong `index.html`, sửa thì sửa cả hai.
- Mức: `same_job` (cùng khách + cùng ngày sự kiện + cùng dịch vụ) · `same_contact` · `same_name` · `similar_name` (tên này là đầu/cuối tên kia).
- Form **Thêm**: gõ tên/contact → hiện "Khách đã có trong CRM" + nút **Dùng thông tin khách này** (điền đúng tên, contact, kênh, nguồn cũ). Cùng ngày + dịch vụ → khung đỏ.
- `POST /api/crm/leads` trả **409** `code: duplicate` khi `same_job`; giao diện hỏi "Mở job cũ / Vẫn thêm (job khác)"; gửi lại với `force_duplicate: true`. Form web `/api/lead` KHÔNG chặn (khách gửi 2 lần thì Kay xoá bản thừa).
- Danh sách Khách: nhãn **Trùng?** (same_job) và **N job** (khách quen). Trang chi tiết: khung "Job khác của khách này" / "Có thể là bản nhập trùng của …".

API mới: `DELETE /api/crm/leads/:id` và `DELETE /api/crm/partners/:id` (body `{reason}`), `GET /api/crm/duplicates?customer_name=&contact=&event_date=&service=&exclude=`, `GET /api/crm/trash?entity=lead|partner`, `POST /api/crm/trash {entity,id}`. Tất cả đi qua cổng xác thực + `CRM_CUTOVER` như cũ.

Test 11/09 (sandbox, harness Node + SQLite 3.51 thay wrangler vì npm chặn gói wrangler): API 15/15 ca đúng (409 trùng job, force, 201 khách quen khác ngày, 409 chặn xoá có BC, 409 chặn xoá đối tác còn lead, xoá không body → lý do "Khác", 404 sau xoá, KPI giảm đúng, trash liệt kê, khôi phục nguyên dòng, khôi phục lần 2 → 409, xoá + khôi phục đối tác). Giao diện Playwright 390×844: nhãn Trùng?/N job, khung trùng trong chi tiết, sheet xoá (nút Xoá khoá tới khi chọn lý do), Hoàn tác, chặn BC hiện lỗi trong sheet, gợi ý khi gõ "chị diễm", Dùng thông tin, 409 sheet → Vẫn thêm, Đã xoá → Khôi phục. 0 lỗi JS.

---

## CR-20260916-34 · Chi tiết buổi làm + ảnh chụp tại chỗ + nhật ký gọn (16/09/2026)

Tân 16/09, ba câu, đúng ba lỗ hổng:

1. *"nhìn vô vẫn chưa biết job này chi tiết như thế nào"*
2. *"vẫn chưa có nút chụp hình khách"*
3. *"thể hiện log thông tin quá nhiều không biết để làm gì"*

### 1. Chi tiết buổi làm — khối mới ở đầu trang job

Dữ liệu vốn **đã có** trong `booking_json`. Vấn đề là trước nay chỉ luồng Booking Confirmation
đọc tới nó, nên mở job ra chỉ thấy đúng một dòng `Expected 1.800.000 ₫` — mà con số đó là
**ước tính pipeline**, không phải số đã chốt với khách.

Khối mới in: ngày + giờ có mặt · địa điểm · dịch vụ + số người · gồm gì · không gồm ·
dặn khách · bảng giá từng dòng · **Tổng chốt với khách** · cọc · còn lại.

Hai con số cố ý in tách hẳn, không bao giờ trộn:

| | Nguồn | Nghĩa |
|---|---|---|
| **Tổng chốt** | tổng `line_items` | số khách thấy trên bản xác nhận |
| **Expected** | `leads.expected_revenue` | ước tính nội bộ, chỉ để nhìn pipeline |

Chưa có bảng giá thì khối nói thẳng *"chưa có số nào đã chốt với khách"* thay vì mượn tạm
Expected. Đây là luật CR-33 áp cho màn hình.

### 2. Đường ghi MỚI: `PATCH /api/crm/leads/<id>/booking`

**Vì sao phải có, không dùng lại `/confirmations`:** trước đây cách DUY NHẤT để nhập giờ,
địa điểm, bảng giá là bấm *Tạo Booking Confirmation*. Hai hệ quả, cả hai đều sai:

- Job ở trạng thái `New` / `Contacted` / `Qualified` **không nhập được gì** (BC chặn theo
  trạng thái), trong khi Kay biết địa điểm và giờ từ lúc khách mới nhắn.
- Sửa một chữ trong địa điểm là **đẻ ra một bản xác nhận mới gửi khách**.

Nên tách hẳn:

- **Chi tiết buổi làm** = dữ liệu vận hành (Kay cần để đi làm) → `/booking`
- **Booking Confirmation** = tài liệu đối ngoại (khách cầm) → `/confirmations`

Nút **Sửa** trong khối mới dùng lại đúng sheet của BC nhưng ở chế độ `saveOnly`:
nút thành *"Lưu chi tiết"*, lưu xong không phát hành gì. Bảng giá được phép để trống khi chỉ
lưu (biết chỗ trước, chốt giá sau), nhưng **một dòng đã gõ mà thiếu số thì bị chặn** — nửa vời
sẽ đẻ ra tổng sai ở mọi chỗ đọc `line_items` về sau. `PATCH /booking` **không bao giờ** đụng
`expected_revenue` và không đụng snapshot đã phát hành.

### 3. Nút chụp ảnh → Cloudflare R2

**PHẢI LÀM TAY TRƯỚC KHI DÙNG ĐƯỢC** (Cloudflare dashboard, cùng account với D1
`kinkay-crm`, account id `d7c6360602e49fd4be27ef2942942d67`):

1. **R2 → Create bucket** → tên `kinkay-crm-media`, location Automatic.
   **KHÔNG bật Public access. KHÔNG tạo custom domain cho bucket này.**
2. **Pages → kinkay-site → Settings → Bindings → Add → R2 bucket**
   - Variable name: `CRM_MEDIA`
   - Bucket: `kinkay-crm-media`
   - Đặt cho **Production** (và Preview nếu muốn test trên nhánh)
3. **Retry deployment** để binding vào hiệu lực.

Chưa làm 3 bước này thì nút Chụp ảnh trả 503 kèm đúng câu hướng dẫn, không phải lỗi trắng.

Giá: R2 free tier 10GB lưu trữ + 1 triệu lượt ghi / tháng. Ảnh đã nén ~300KB → 10GB ≈ 33.000
ảnh. Không phát sinh phí egress vì ảnh đi qua Worker của chính mình.

**Luồng:** điện thoại mở camera (`capture="environment"`) → nén ở máy về 1600px / JPEG 0.75
(~250–400KB; ảnh gốc 4–8MB gửi qua 4G ở khách sạn là rớt) → `POST /leads/<id>/photo` body là
bytes thô → R2 key `jobs/<lead_id>/<ts>-<rand>.jpg` → metadata vào `media_json`.

**Ảnh KHÔNG public.** `/api/crm/media/*` đi qua `_middleware.js` như mọi đường CRM khác.
Vì trình duyệt không gắn header `Authorization` vào `<img src>`, giao diện phải tải bằng
`fetch` rồi dựng blob URL. Cố tình làm vậy: ảnh khách trong phòng thay đồ không được hở ra
chỉ vì ai đó đoán trúng đường dẫn.

`marketing_ok` **mặc định TẮT** cho ảnh chụp, y như link Drive. Chụp được không có nghĩa
được đăng.

**Xoá ảnh chụp = xoá luôn file trong R2** (có hỏi lại trước). Khác link Drive — link chỉ gỡ
liên kết. Lý do: file đó chỉ tồn tại vì dòng metadata này; gỡ dòng mà để file lại là sinh ra
ảnh khách nằm trong kho mà không ai còn biết của ai.

### 4. Nhật ký gọn

Mặc định **gấp lại**. Mở ra chỉ hiện các trường có trong `HIST_LABEL` (trạng thái, tiền,
ngày/giờ/địa điểm, bảng giá, phát hành BC, ảnh, xoá) và viết bằng tiếng người. Log kỹ thuật
(`booking_confirmation` hash, `contact_key`, cờ nội bộ) bị ẩn và đếm số dòng đã ẩn.

**Không xoá gì dưới database.** `lead_events` vẫn ghi đủ và vẫn xuất CSV để truy ngược.

`PATCH /booking` ghi nhật ký dạng tóm tắt — `booking.line_items: 3 dòng · 1.800.000` —
chứ không nhét nguyên mảng JSON vào cột, vì `lead_events` xuất được ra CSV.

### 5. `api()` không còn ném "Unexpected token '<'"

Khi Pages Function lỗi, Cloudflare trả **trang HTML**. Bản cũ gọi thẳng `r.json()` nên Kay
nhận đúng câu `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` — giấu mất nguyên
nhân thật. Giờ đọc text trước, parse sau, hỏng thì báo *"Máy chủ lỗi 500 — thường là thiếu
migration hoặc thiếu binding trên Cloudflare"*.

### File đụng tới

Mới: `functions/api/crm/leads/[id]/booking.js`, `functions/api/crm/leads/[id]/photo.js`,
`functions/api/crm/media/[[path]].js`, `tests/crm_job_detail.mjs`.
Sửa: `functions/api/crm/leads/[id].js` (GET trả kèm `booking` / `booking_missing` /
`booking_total` / `booking_pax`), `functions/api/crm/leads/[id]/media.js` (DELETE nhận key R2),
`static/admin/crm/index.html`.

**Không có migration.** Không đổi schema — `media_json` và `booking_json` đã có từ 004 / 002.

Test: `node tests/crm_job_detail.mjs` 12/12 · `node tests/bc_line_items.mjs` 30/30.

---

## CR-20260916-35 · Hồ sơ buổi làm + trang khách + link gửi khách (16/09/2026)

Tân 16/09: *"không có chỗ để xem hồ sơ lưu của khách kiểu bật lên là 1 hồ sơ báo cáo lần này
làm gì, hình ảnh ra sao. Để lần sau khách biết muốn làm i như vậy, hay thay đổi chỉnh sửa,
thử look mới."*

Duyệt: Tân 16/09, ngoại lệ HẸP của DEC-20260906-03 (P5 Freeze), chỉ cho CR-35.
Tân chọn: cả bản nội bộ **và** bản gửi khách · ghi 3 mục (tông+kiểu, khách thích/chê, lưu ý
da/tóc) · mở được từ **cả** trong job **và** trang khách.
**Không** làm mục "lần sau nên làm gì khác" — Tân không chọn.

### Quy tắc trung tâm: HAI LỚP, MỘT CỬA RA

| | Nội dung | Ai đọc được |
|---|---|---|
| **Đối ngoại** | `tone`, `share.note`, đúng ảnh trong `share.photos` | khách, qua `/xem/<token>` |
| **Nội bộ** | `liked` (khách chê gì), `care` (da dầu, tóc mỏng), và mọi cột khác của lead | chỉ trong CRM |

`publicLook()` trong `_lib.js` là **cửa ra duy nhất**. Danh sách trắng, không phải danh sách
đen: thêm field mới vào `look_json` thì field đó **không** tự lọt ra. Trang công khai không
được tự lọc field, không được đọc look thô.

Vì sao gắt: `liked` và `care` là chỗ Kay ghi thật lòng về một người thật. Ghi thật chỉ xảy ra
khi người ghi **chắc chắn** khách không đọc được. Rò một lần là từ đó không ai ghi thật nữa,
và cả trường dữ liệu này thành vô dụng. Giao diện in nhãn *chỉ nội bộ* / *khách xem được*
ngay cạnh từng ô lúc Kay **đang gõ**, không bắt đi đọc tài liệu.

### Hồ sơ gắn với BUỔI LÀM, không gắn với khách

Cùng nguyên tắc đã áp cho ảnh ở CR-32. "Lần trước làm tông gì" chỉ có nghĩa khi biết lần
trước là buổi **nào**: khách cưới tháng 11 và khách đi tiệc tháng 3 là hai look khác hẳn, hai
lưu ý khác hẳn, dù cùng một người.

Trang khách `#/khach/<lead_id>` chỉ **xếp** các hồ sơ cạnh nhau theo thời gian. Nó không sở
hữu dữ liệu và không đẻ ra "hồ sơ khách hàng" thứ hai. Gom theo **số liên hệ**, chưa xác nhận
cùng một người — câu cảnh báo của server vẫn bắt buộc in, y như luật đặt từ CR-32.

### Link gửi khách

`/xem/<token>` nằm **ngoài** cổng xác thực (khách không có tài khoản GitHub). Thứ duy nhất
đứng giữa ảnh khách và cả internet là token 32 hex từ `crypto.getRandomValues`.

Luật cứng, đừng nới:

- **Token không bao giờ tái sử dụng.** Mỗi `POST /share` sinh token mới. Gửi nhầm người thì
  POST lại là link cũ chết ngay.
- **Hai công tắc khác nhau.** `enabled=false` là tắt tạm, giữ danh sách ảnh đã tick.
  `DELETE /share` là dập cầu dao: `share_token = NULL`, link cũ chết vĩnh viễn.
- **Tạo link không tự chọn ảnh.** Mặc định 0 ảnh, Kay tick từng tấm. Cái giá của mặc định sai
  ở đây là ảnh khách lọt ra ngoài.
- Token sai và link đã thu hồi trả **404 y hệt nhau**. Nói "link này từng tồn tại" là đã cho
  người dò biết họ đoán gần trúng.
- Trang và ảnh đều `no-store` + `noindex, nofollow, noarchive, nosnippet` +
  `Referrer-Policy: no-referrer`. Không font ngoài, không analytics, không gì gọi ra internet
  từ trang đó — mỗi request bên ngoài là một chỗ token nằm trong Referer đi khỏi tầm tay.

Ảnh công khai đi qua **bốn cửa** ở `functions/xem/[token]/anh/[[path]].js`: token đúng hình
dạng → link đang bật → key nằm trong `share.photos` → key bắt đầu bằng `jobs/<đúng lead id>/`.
Cửa 3 và 4 chồng nhau có chủ ý: cửa 3 dựa vào dữ liệu Kay nhập, cửa 4 không dựa vào ai cả.

### Tắt gấp mọi link đã gửi, không cần deploy

```sql
UPDATE leads SET share_token = NULL;
```

### Migration 006 · schema_version 1.5

`leads.look_json` (TEXT) · `leads.share_token` (TEXT, UNIQUE index).

**Số 006 lấy cho CR-35, không phải cho CR-31 Đ8.** File 005 từng giữ chỗ 006 cho CR-31 Đ8,
nhưng việc đó tới giờ vẫn chưa duyệt, chưa build, chưa chạy. Luật chốt ở file 004 là *dãy số
phải phản ánh thứ tự chạy thật* — giữ chỗ không thắng được thứ tự thật.
**CR-31 Đ8 từ nay dùng 007 và schema_version 1.6.**

### File

Mới: `functions/api/crm/leads/[id]/look.js`, `functions/api/crm/leads/[id]/share.js`,
`functions/xem/[token].js`, `functions/xem/[token]/anh/[[path]].js`,
`schema/crm-migration-006-look-share.sql`, `tests/crm_look_share.mjs`.
Sửa: `_lib.js` (parseLook / normalizeLook / mergeLook / **publicLook** / shareIsLive /
newShareToken), `history.js` (trả kèm `look_json` + `booking_json`, thêm `?self=1`),
`static/admin/crm/index.html`.

Test: `node tests/crm_look_share.mjs` 18/18 · `crm_job_detail.mjs` 12/12 ·
`bc_line_items.mjs` 30/30.

Bẫy đã gặp: `functions/xem/[token]/anh/[[path]].js` sâu **ba** cấp so với `functions/`, import
`_lib` phải là `../../../api/crm/_lib.js`. Bản đầu viết hai chấm, test bắt được.

---

## CR-20260916-36 · Nút đánh dấu bản xác nhận SAI (16/09/2026)

CR-33 thiết kế ba trạng thái cho Booking Confirmation và `POST /api/crm/confirmations/<id>`
đã sống trên production từ đó. Nhưng giao diện **chưa bao giờ có nút bấm nó**.

Hệ quả thật, phát hiện 16/09: hai bản `BC-KK-260914-005-V1` và `V2` in sai phạm vi đã bán
(pax 2 · 1,8tr, trong khi thoả thuận là 1 khách × 1.800.000) vẫn nằm đó với nút *Xem / gửi
lại*, và cách duy nhất để chặn là gõ SQL thẳng vào database production.

**Thiết kế xong mà không có đường bấm thì coi như chưa làm.**

Giờ mỗi dòng version có thêm nút:

- **Đánh dấu sai** → sheet bắt ghi lý do → `status='voided'`. Bản đó không gửi lại được nữa,
  dưới mọi đường.
- **Bỏ đánh dấu** → về `active`. Chỉ hiện khi bản đó chưa bị bản khác thay thế (có
  `superseded_by_id` thì trạng thái đúng của nó là `superseded`, không phải `active`).

`superseded` vẫn **do server tự đặt** khi phát hành bản mới, không đặt tay được — đúng luật
CR-33 giữ nguyên.

Snapshot **không bị sửa**. Bản đã phát hành là bất biến kể cả khi nội dung sai: khách đã cầm
tờ đó trên tay rồi, sửa lại lịch sử là tự nói dối mình. Chỉ chặn đường gửi lại.

Lý do là **bắt buộc**, ghi vào `lead_events` dưới field `bc_status:<id>` — sau này mở ra phải
biết vì sao nó bị chặn, không phải đoán.

Sửa: `static/admin/crm/index.html` (bcMount + `bcVoidSheet`). Không migration, không API mới.

---

## CR-20260916-37 · Chặn bẫy "code lên trước migration" (16/09/2026)

Ngày 16/09 bẫy này sập **hai lần trong một ngày**:

- CR-33 push 15/09, migration 005 không chạy → Booking Confirmation chết trên production gần
  một ngày, không ai biết, cho tới khi Tân chụp màn hình gửi lên.
- CR-35 push 16/09, migration 006 chưa chạy → hồ sơ buổi làm, trang khách và link gửi khách
  chết cùng lúc. Tân bấm trúng giữa lúc đang làm việc.

Cả hai lần triệu chứng y hệt và vô dụng như nhau: Cloudflare trả trang HTML lỗi, giao diện
ném `Unexpected token '<'`. Không nói thiếu cái gì, không nói phải làm gì.

**Không thể bắt migration chạy tự động.** D1 không có runner, và chạy DDL tự động lúc có
request là cách hay nhất để hỏng database đúng giờ đông khách. Thứ đổi được là *khi thiếu thì
phải nói ra thiếu số mấy*.

### Ba lớp

**1. Dịch lỗi — một chỗ duy nhất.** `_middleware.js` bọc `next()`. Mọi đường `/api/crm/*` đi
qua đó, nên không phải vá từng file và không thể quên file nào. `migrationGapError()` trong
`_lib.js` đọc lỗi D1, tra bảng `COLUMN_MIGRATION` (cột → số migration), trả 503 kèm câu
*"Tính năng này cần migration 006 (cột `look_json`) mà database chưa chạy"* và mã
`migration_missing:006`.

Lỗi **khác** vẫn ném nguyên. Đổi một lỗi khó hiểu lấy một lỗi khó hiểu khác thì được gì.

**2. Biết trước khi Kay đụng phải.** `GET /api/crm/health` đọc `PRAGMA table_info` và so với
danh sách cột code cần. Giao diện gọi một lần lúc khởi động và treo băng đỏ **ngoài** `app`
nên chuyển trang nó vẫn còn đó. Cũng báo luôn khi thiếu binding R2 — cùng loại bệnh
"deploy xong còn thiếu một bước tay".

**3. Trang công khai không lộ.** `/xem/*` bọc try/catch riêng, lỗi database trả 404 trung
tính. Khách thấy đúng một câu như mọi trường hợp khác; chi tiết nằm ở `/health`, sau đăng nhập.

### Quy trình từ nay

Thêm cột trong migration mới thì **cùng lúc** cập nhật ba chỗ, không để lần sau:
`COLUMN_MIGRATION` trong `_lib.js` · `CAN_CO` trong `health.js` · `SCHEMA_VERSION_REQUIRED`.

Sau mỗi lần push có migration: mở CRM, nếu có băng đỏ thì chạy migration rồi tải lại.

Mới: `functions/api/crm/health.js`, `tests/crm_migration_guard.mjs`.
Sửa: `_lib.js`, `_middleware.js`, `functions/xem/[token].js`,
`functions/xem/[token]/anh/[[path]].js`, `static/admin/crm/index.html`.
Không migration.

Test: `crm_migration_guard.mjs` 11/11.
