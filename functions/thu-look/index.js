// /thu-look/ — trang "Thử look của Kay" ĐÃ GỠ 09/08/2026 (quyết định của Tân).
//
// 10/08/2026. Vì sao 410 chứ không phải 301 về trang chủ:
// Trang này bị gỡ hôm 09/08 nhưng vẫn nằm trong index của Google, và tệ hơn — nó là kết quả
// kinkay.vn ĐẦU TIÊN cho truy vấn thương hiệu "KINKAY", đứng trên cả trang chủ, với snippet
// hứa một dịch vụ không còn tồn tại. Khách gõ đúng tên thương hiệu, bấm kết quả đầu, vào
// trang chết.
//
// 301 về trang chủ không giải quyết được: Google coi đó là "trang vẫn sống, chỉ đổi chỗ",
// giữ URL cũ trong index thêm nhiều tuần và tiếp tục hiển thị snippet cũ.
// 410 Gone là tín hiệu dứt khoát "trang này đã chết, gỡ khỏi index" — Google xử lý 410
// nhanh hơn 404 và nhanh hơn nhiều so với 301.
//
// Khi nào xoá file này: sau khi `site:kinkay.vn thu-look` không còn kết quả nào
// (kiểm lại ở lần health check sau). Lúc đó 404.html chung sẽ lo phần còn lại.

const BODY = `<!DOCTYPE html>
<html lang="vi"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Trang không còn tồn tại | KINKAY</title>
<meta name="robots" content="noindex, follow">
<style>
body{font-family:-apple-system,'Segoe UI',sans-serif;font-weight:300;background:#FAF7F2;color:#2C1810;
  line-height:1.8;text-align:center;padding:80px 22px}
h1{font-family:'Times New Roman',serif;font-weight:500;font-size:32px;margin:0 0 16px}
p{color:#8B6B52;margin:0 0 30px}
a.cta{display:inline-block;background:#1A0F08;color:#E8DDD0;text-decoration:none;padding:15px 30px;
  font-size:13px;letter-spacing:.16em;text-transform:uppercase;margin:0 6px 12px}
a.alt{background:transparent;color:#2C1810;border:1px solid rgba(139,107,82,.45)}
</style>
</head><body>
<h1>Trang này không còn nữa</h1>
<p>Công cụ thử look đã được gỡ. Kay tư vấn trực tiếp sẽ nhanh và đúng hơn.</p>
<a class="cta" href="https://zalo.me/0933953179">Nhắn Zalo cho Kay</a>
<a class="cta alt" href="https://kinkay.vn/">Về trang chủ</a>
</body></html>`;

export async function onRequest() {
  return new Response(BODY, {
    status: 410,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'x-robots-tag': 'noindex',
    },
  });
}
