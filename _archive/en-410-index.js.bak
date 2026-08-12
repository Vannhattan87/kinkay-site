// /en/ — trang tiếng Anh GỠ khỏi xuất bản 12/08/2026 (quyết định của Tân, đợt D).
//
// Vì sao 410 chứ không phải 301 về trang chủ: đúng bài học của /thu-look/ hôm 10/08.
// URL này vừa được khai trong sitemap ngày 12/08 nên Google đã hoặc sắp đưa vào index.
// 301 sẽ giữ nó nằm trong index nhiều tuần và có thể chiếm chỗ trên SERP thương hiệu.
// 410 Gone là tín hiệu dứt khoát, Google xử lý nhanh nhất.
//
// BẬT LẠI: xoá file này, xoá dòng fs.rmSync(SITE/'en') trong build.js, khai lại URL
// trong sitemap và trả hreflang vào <head> của static/index.html. File static/en/index.html
// vẫn nguyên trong repo, không mất gì.

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
</style></head><body>
<h1>Trang này không còn nữa</h1>
<p>This page is no longer available. KINKAY's website is in Vietnamese —<br>
message Kay on Zalo at 0933 953 179, she replies in English.</p>
<a class="cta" href="/">Về trang chủ</a>
<a class="cta" href="https://zalo.me/0933953179">Message Kay</a>
</body></html>`;

export async function onRequest() {
  return new Response(BODY, {
    status: 410,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
