// Cloudflare Pages Function — chạy trước mọi request.
//
// 08/08/2026. Vấn đề: kinkay-site.pages.dev đang phục vụ đầy đủ bản sao của site.
// Canonical trỏ về kinkay.vn nên Google không phạt, nhưng đó vẫn là một bản site thứ hai
// mà không ai để ý tới, và mọi link nội bộ trên đó lại trỏ lẫn nhau trong pages.dev —
// khách đi lạc vào thì ở luôn trong đó.
//
// Xử lý: 301 mọi thứ trên pages.dev về kinkay.vn, GIỮ NGUYÊN đường dẫn và query string.
//
// TRỪ /auth và /callback. Đây là bắt buộc, không phải tùy chọn:
// static/admin/config.yml khai base_url: https://kinkay-site.pages.dev, và GitHub OAuth App
// đăng ký callback URL trỏ vào pages.dev. Redirect hai đường dẫn đó là CMS chết ngay,
// không đăng bài được nữa.
//
// Nếu sau này chuyển base_url và callback URL của OAuth App sang kinkay.vn thì xoá được
// phần miễn trừ này. Đổi cả ba chỗ cùng lúc, đừng đổi lẻ.

const CANONICAL_HOST = 'kinkay.vn';

// CHỈ chặn đúng alias production. Không dùng endsWith('.pages.dev') vì mỗi lần deploy nhánh
// khác, Cloudflare sinh ra bản preview kiểu abc123.kinkay-site.pages.dev — chặn hết là mất
// luôn khả năng xem thử trước khi merge.
const REDIRECT_HOST = 'kinkay-site.pages.dev';

// Đường dẫn bắt buộc phải sống trên pages.dev. Đừng thêm gì vào đây trừ khi hiểu vì sao.
const BYPASS = ['/auth', '/callback'];

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  const isPagesDev = url.hostname === REDIRECT_HOST;
  const isBypassed = BYPASS.some((p) => url.pathname === p || url.pathname.startsWith(p + '/'));

  if (isPagesDev && !isBypassed) {
    url.hostname = CANONICAL_HOST;
    url.port = '';
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  }

  return next();
}
