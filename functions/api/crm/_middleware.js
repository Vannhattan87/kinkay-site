// KINKAY CRM · cổng xác thực cho MỌI request /api/crm/* · v1.0 · 06/09/2026 (CR-20260906-28)
//
// DÙNG LẠI ĐÚNG AUTH CỦA ADMIN, không thêm hệ đăng nhập mới:
//   Trang /admin/crm/ lấy GitHub token bằng chính popup OAuth của Sveltia (functions/auth.js + callback.js
//   trên kinkay-site.pages.dev). Token gửi lên đây trong header  Authorization: Bearer <token>.
//   Server hỏi GitHub "token này của ai, có quyền push repo Vannhattan87/kinkay-site không?".
//   Ai đăng bài được trên CMS thì dùng CRM được. Ai không có quyền repo thì 403. Không có allowlist
//   riêng phải nhớ, trừ khi Tân muốn siết thêm bằng biến CRM_ALLOWED_USERS (danh sách login, phẩy).
//
// KHÔNG lưu token. Kết quả xác thực cache trong bộ nhớ isolate 10 phút (theo hash SHA-256 của token)
// để không gọi GitHub mỗi lần Kay bấm.
//
// BIẾN MÔI TRƯỜNG (Cloudflare Pages → Settings):
//   CRM_DB              (D1 binding, BẮT BUỘC)   — database kinkay-crm
//   CRM_ALLOWED_USERS   (tuỳ chọn)               — "kinkay-official,Vannhattan87"; để trống = theo quyền repo
//   CRM_REPO            (tuỳ chọn)               — mặc định Vannhattan87/kinkay-site
//   CRM_CUTOVER         (BẮT BUỘC để ghi)         — "1" = D1 là master, cho POST/PATCH + form web ghi D1.
//                                                Chưa đặt / khác "1" = CHỈ ĐỌC (đối chiếu), Sheet vẫn master, form web đi đường cũ.
//   CRM_DEV_USER        (CHỈ local dev)          — bỏ qua GitHub, coi như user này. KHÔNG BAO GIỜ đặt ở Production.

import { err, isCutover } from './_lib.js';

const CACHE = new Map(); // tokenHash -> { login, exp }
const TTL_MS = 10 * 60 * 1000;

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyGitHub(token, env) {
  const repo = env.CRM_REPO || 'Vannhattan87/kinkay-site';
  const h = { Authorization: `Bearer ${token}`, 'User-Agent': 'kinkay-crm/1.0', Accept: 'application/vnd.github+json' };
  const u = await fetch('https://api.github.com/user', { headers: h });
  if (!u.ok) return { ok: false, why: 'token_invalid' };
  const user = await u.json();
  const login = user && user.login;
  if (!login) return { ok: false, why: 'no_login' };

  const allow = (env.CRM_ALLOWED_USERS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allow.length) {
    return allow.includes(login) ? { ok: true, login } : { ok: false, why: 'not_allowed', login };
  }
  const r = await fetch(`https://api.github.com/repos/${repo}`, { headers: h });
  if (!r.ok) return { ok: false, why: 'repo_unreachable', login };
  const info = await r.json();
  const canPush = !!(info && info.permissions && (info.permissions.push || info.permissions.admin || info.permissions.maintain));
  return canPush ? { ok: true, login } : { ok: false, why: 'no_repo_write', login };
}

export async function onRequest(context) {
  const { request, env, next, data } = context;

  if (!env.CRM_DB) return err('CRM_DB chưa được gắn (Cloudflare Pages → Settings → Bindings → D1 → CRM_DB).', 503);

  // QA 06/09 điểm 1: chưa cutover thì chặn mọi ghi (sau khi đã xác thực). Đọc/đối chiếu/export vẫn được.
  const gate = () => {
    if (!isCutover(env) && request.method !== 'GET' && request.method !== 'HEAD')
      return err('CRM đang ở chế độ CHỈ ĐỌC (đối chiếu). Sheet LIVE vẫn là nguồn duy nhất. Tân bật CRM_CUTOVER=1 khi đối chiếu xong.', 423, 'cutover_off');
    return next();
  };

  if (env.CRM_DEV_USER) {                     // local dev only
    data.user = env.CRM_DEV_USER;
    return gate();
  }

  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(\S+)$/i);
  if (!m) return err('Chưa đăng nhập', 401);
  const token = m[1];
  const key = await sha256(token);
  const now = Date.now();
  const hit = CACHE.get(key);
  if (hit && hit.exp > now) {
    data.user = hit.login;
    return gate();
  }
  let v;
  try { v = await verifyGitHub(token, env); } catch (e) { return err('Không kiểm tra được đăng nhập với GitHub', 502, e && e.message); }
  if (!v.ok) {
    CACHE.delete(key);
    const status = v.why === 'token_invalid' ? 401 : 403;
    return err(v.why === 'token_invalid' ? 'Phiên đăng nhập hết hạn, đăng nhập lại' : 'Tài khoản này không có quyền dùng CRM', status, v.why);
  }
  CACHE.set(key, { login: v.login, exp: now + TTL_MS });
  if (CACHE.size > 50) { for (const [k, val] of CACHE) if (val.exp <= now) CACHE.delete(k); }
  data.user = v.login;
  return gate();
}
