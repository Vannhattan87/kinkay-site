// GET /xem/<token>/anh/jobs/<lead>/<file>.jpg   → 1 tấm ảnh cho trang khách xem. NGOÀI đăng nhập.
//
// CR-20260916-35 · 16/09/2026.
//
// Đường ảnh công khai KHÔNG dùng lại /api/crm/media/* — đường kia sống sau cổng xác thực và
// phải giữ nguyên như vậy. Ở đây token vừa là chìa khoá vừa là giới hạn phạm vi, và mọi
// request phải qua ĐỦ BỐN cửa:
//
//   1. token đúng hình dạng 32 hex                → chặn dò rác trước khi chạm database
//   2. token khớp một job, và link đang BẬT       → thu hồi là ảnh chết theo ngay
//   3. key nằm trong share.photos của JOB ĐÓ      → ảnh Kay chưa tick thì không ai xem được,
//                                                    kể cả người có link
//   4. key bắt đầu bằng jobs/<đúng lead id>/      → token của job A không mở được ảnh job B,
//                                                    kể cả khi ai đó ghi nhầm key vào share.photos
//
// Cửa 3 và 4 chồng nhau có chủ ý. Cửa 3 dựa vào dữ liệu Kay nhập; cửa 4 không dựa vào ai cả.
// Chỗ này mà sai thì sai theo kiểu ảnh khách này lọt sang link khách khác.
import { parseLook, shareIsLive } from '../../../api/crm/_lib.js';

const deny = () => new Response('', {
  status: 404,
  headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' }
});

async function _impl({ params, env }) {
  if (!env.CRM_DB || !env.CRM_MEDIA) return deny();

  const token = String(params.token || '').trim();
  if (!/^[0-9a-f]{32}$/.test(token)) return deny();                       // cửa 1

  const parts = Array.isArray(params.path) ? params.path : [params.path];
  const key = parts.filter(Boolean).map(decodeURIComponent).join('/');
  if (!key || key.includes('..') || !/^jobs\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(key)) return deny();

  const lead = await env.CRM_DB.prepare('SELECT id, look_json, share_token FROM leads WHERE share_token = ?')
    .bind(token).first();
  if (!lead) return deny();

  const look = parseLook(lead);
  if (!shareIsLive(lead, look)) return deny();                            // cửa 2

  const allowed = (look.share && Array.isArray(look.share.photos)) ? look.share.photos : [];
  if (!allowed.includes(key)) return deny();                              // cửa 3

  const prefix = 'jobs/' + String(lead.id).replace(/[^A-Za-z0-9_-]/g, '') + '/';
  if (!key.startsWith(prefix)) return deny();                             // cửa 4

  const obj = await env.CRM_MEDIA.get(key);
  if (!obj) return deny();

  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('etag', obj.httpEtag);
  h.set('x-content-type-options', 'nosniff');
  h.set('x-robots-tag', 'noindex, nofollow, noimageindex');
  h.set('referrer-policy', 'no-referrer');
  // no-store để Kay bỏ tick một tấm là tấm đó biến mất ngay, không còn bản cache sống sót
  // ở trình duyệt khách hay ở CDN.
  h.set('cache-control', 'no-store, private');
  return new Response(obj.body, { headers: h });
}

/* Boc ngoai: loi database (ke ca thieu migration) KHONG duoc lo ra cho nguoi la.
   Khach chi thay dung mot cau nhu moi truong hop khac. Chi tiet nam o /api/crm/health,
   sau cong dang nhap. */
export async function onRequestGet(ctx) {
  try { return await _impl(ctx); } catch (e) { return deny(); }
}
