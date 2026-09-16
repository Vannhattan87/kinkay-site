// GET /api/crm/media/jobs/KK-260914-005/1758000000000-ab12cd34ef56.jpg
//
// CR-20260916-34 · 16/09/2026. Trả file ảnh từ R2 bucket CRM_MEDIA.
//
// ẢNH KHÔNG PUBLIC. Đường dẫn nằm dưới /api/crm/ nên _middleware.js chạy trước: không có
// token GitHub hợp lệ thì 401, y như mọi đường CRM khác. Đây là lý do thẻ <img src="..."> thẳng
// KHÔNG chạy được — trình duyệt không gắn header Authorization vào <img>. Giao diện phải tải
// bằng fetch rồi dựng blob URL. Cố tình làm vậy: ảnh khách trong phòng thay đồ không được để
// hở ra chỉ vì ai đó đoán trúng đường dẫn.
//
// Bucket KHÔNG bật public access. Không tạo custom domain cho bucket này.
import { err } from '../_lib.js';

export async function onRequestGet({ params, env, request }) {
  if (!env.CRM_MEDIA) return err('Chưa gắn kho ảnh CRM_MEDIA', 503, 'r2_missing');

  const parts = Array.isArray(params.path) ? params.path : [params.path];
  const key = parts.filter(Boolean).map(decodeURIComponent).join('/');
  // Chặn đi ngược cây thư mục. R2 là kho phẳng nên '..' không leo ra được, nhưng chặn sớm cho sạch.
  if (!key || key.includes('..') || !/^jobs\//.test(key)) return err('Đường dẫn ảnh không hợp lệ', 400);

  const obj = await env.CRM_MEDIA.get(key);
  if (!obj) return err('Không tìm thấy ảnh này', 404);

  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('etag', obj.httpEtag);
  // private: ảnh đã qua cổng xác thực, không cho proxy/CDN giữ bản dùng chung.
  h.set('cache-control', 'private, max-age=86400');
  h.set('x-content-type-options', 'nosniff');
  // Ảnh bị mở thẳng bằng link thì tải về, không render trong trang — tránh mọi trò nhét mã vào file ảnh.
  if (new URL(request.url).searchParams.get('dl') === '1') {
    h.set('content-disposition', 'attachment; filename="' + key.split('/').pop() + '"');
  }
  return new Response(obj.body, { headers: h });
}
