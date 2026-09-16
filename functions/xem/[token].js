// GET /xem/<token>   → trang khách xem lại buổi làm. NGOÀI cổng đăng nhập.
//
// CR-20260916-35 · 16/09/2026.
//
// ĐÂY LÀ TRANG DUY NHẤT CỦA CRM MÀ NGƯỜI LẠ MỞ ĐƯỢC. Mọi thứ dưới đây viết theo đúng một
// câu hỏi: nếu link này bị forward vào một group chat 200 người thì cái gì lọt ra?
//
//   · Nội dung lấy qua `publicLook()` — cửa ra duy nhất, danh sách trắng. Trang này KHÔNG
//     tự đọc field nào từ look thô, KHÔNG chạm vào `lead.notes`, tiền, trạng thái, đối tác,
//     `next_action`, hay bất cứ cột nội bộ nào. Thêm field mới vào hồ sơ cũng không lọt ra.
//   · `liked` (khách chê gì) và `care` (da dầu, tóc mỏng) TUYỆT ĐỐI không ra. Đó là ghi chép
//     nghề của Kay về một người thật.
//   · Ảnh chỉ hiện đúng các key trong `share.photos` — Kay tick từng tấm. Mặc định 0 ảnh.
//   · noindex + noarchive + nosnippet, và Referrer-Policy no-referrer. Link không được rơi
//     vào Google, và khách bấm link nào từ trang này cũng không mang token đi theo.
//   · Không phân biệt token sai với link đã thu hồi: cả hai đều 404 y hệt nhau. Nói "link
//     này từng tồn tại" là đã cho người dò biết họ đoán gần trúng.
//
// KHÔNG thêm analytics, không thêm font ngoài, không thêm gì gọi ra internet từ trang này.
// Mỗi request bên ngoài là một chỗ token nằm trong Referer đi ra khỏi tầm kiểm soát.
import { parseLook, parseBooking, publicLook, shareIsLive, SERVICE_DISPLAY } from '../api/crm/_lib.js';

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const T = {
  vi: { title: 'Buổi làm của bạn', by: 'KINKAY MAKEUP & HAIR', look: 'Look đã thực hiện',
        photos: 'Hình ảnh buổi này', again: 'Muốn làm lại đúng look này, hoặc thử một look khác cho dịp tới?',
        cta: 'Nhắn cho KINKAY', foot: 'Trang này chỉ dành riêng cho bạn. Vui lòng không chia sẻ công khai.' },
  en: { title: 'Your session', by: 'KINKAY MAKEUP & HAIR', look: 'The look we created',
        photos: 'Photos from this session', again: 'Want this exact look again, or something new next time?',
        cta: 'Message KINKAY', foot: 'This page was made just for you. Please keep the link private.' }
};

function dmy(iso, lang) {
  if (!iso) return '';
  const p = String(iso).slice(0, 10).split('-');
  if (p.length !== 3) return '';
  if (lang === 'en') {
    const m = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${+p[2]} ${m[+p[1] - 1]} ${p[0]}`;
  }
  return `${p[2]}/${p[1]}/${p[0]}`;
}

const notFound = () => new Response(
  '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex,nofollow">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Không tìm thấy</title>' +
  '<body style="font-family:system-ui,sans-serif;background:#faf7f2;color:#4a4036;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">' +
  '<div><p style="font-size:17px">Link này không còn hiệu lực.</p>' +
  '<p style="color:#8a7d6d;font-size:14px">Bạn hỏi lại KINKAY để nhận link mới nhé.</p></div>',
  { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store' } }
);

async function _impl({ params, env }) {
  if (!env.CRM_DB) return notFound();
  const token = String(params.token || '').trim();
  // Chặn hình dạng trước khi chạm database: token thật luôn là 32 ký tự hex.
  if (!/^[0-9a-f]{32}$/.test(token)) return notFound();

  const lead = await env.CRM_DB
    .prepare('SELECT id, customer_name, service, event_date, look_json, booking_json, share_token FROM leads WHERE share_token = ?')
    .bind(token).first();
  if (!lead) return notFound();

  const look = parseLook(lead);
  if (!shareIsLive(lead, look)) return notFound();   // tắt tạm cũng 404, không hé lộ gì thêm

  const booking = parseBooking(lead);
  const lang = booking.preferred_language === 'en' ? 'en' : 'vi';
  const t = T[lang];
  const pub = publicLook(look, lang);                // ← cửa ra duy nhất
  const svc = (SERVICE_DISPLAY[lang] || {})[lead.service] || lead.service || '';
  const when = dmy(lead.event_date, lang);

  const photos = pub.photos.map((k, i) =>
    `<figure><img src="/xem/${esc(token)}/anh/${k.split('/').map(encodeURIComponent).join('/')}" alt="" loading="${i < 2 ? 'eager' : 'lazy'}"></figure>`
  ).join('');

  const html = `<!doctype html><html lang="${lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
<meta name="referrer" content="no-referrer">
<title>${esc(t.title)} · KINKAY</title>
<style>
 :root{--bg:#faf7f2;--card:#fff;--ink:#3d342b;--mute:#8a7d6d;--line:#eadfd0;--gold:#b08d3f}
 *{box-sizing:border-box}
 body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;
      -webkit-font-smoothing:antialiased}
 .wrap{max-width:640px;margin:0 auto;padding:28px 16px 56px}
 .brand{text-align:center;letter-spacing:.22em;font-size:12px;color:var(--gold);text-transform:uppercase;margin-bottom:22px}
 h1{font-size:25px;font-weight:600;margin:0 0 6px;letter-spacing:.01em}
 .meta{color:var(--mute);font-size:14px;margin-bottom:24px}
 .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:16px}
 h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);margin:0 0 10px;font-weight:600}
 .tone{white-space:pre-wrap;margin:0}
 .note{white-space:pre-wrap;margin:0;font-style:italic;color:#5c5044}
 .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0}
 @media(max-width:420px){.grid{grid-template-columns:1fr}}
 figure{margin:0}
 img{width:100%;display:block;border-radius:10px;background:#efe9e2;aspect-ratio:3/4;object-fit:cover}
 .cta{text-align:center;margin-top:30px}
 .cta p{color:var(--mute);font-size:15px;margin:0 0 14px}
 .btn{display:inline-block;background:var(--ink);color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-size:15px}
 footer{text-align:center;color:var(--mute);font-size:12px;margin-top:34px;line-height:1.7}
 footer a{color:var(--mute)}
</style></head><body><div class="wrap">
<div class="brand">${esc(t.by)}</div>
<h1>${esc(lead.customer_name || '')}</h1>
<div class="meta">${esc([svc, when].filter(Boolean).join(' · '))}</div>
${pub.note ? `<div class="card"><p class="note">${esc(pub.note)}</p></div>` : ''}
${pub.tone ? `<div class="card"><h2>${esc(t.look)}</h2><p class="tone">${esc(pub.tone)}</p></div>` : ''}
${photos ? `<div class="card"><h2>${esc(t.photos)}</h2><div class="grid">${photos}</div></div>` : ''}
<div class="cta"><p>${esc(t.again)}</p><a class="btn" href="https://kinkay.vn/lien-he/" rel="noopener noreferrer">${esc(t.cta)}</a></div>
<footer>${esc(t.foot)}<br><a href="https://kinkay.vn/">kinkay.vn</a></footer>
</div></body></html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow, noarchive, nosnippet',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      // no-store: Kay thu hồi link là khách bấm lại thấy chết ngay, không có bản cache sống sót.
      'cache-control': 'no-store, private'
    }
  });
}

/* Boc ngoai: loi database (ke ca thieu migration) KHONG duoc lo ra cho nguoi la.
   Khach chi thay dung mot cau nhu moi truong hop khac. Chi tiet nam o /api/crm/health,
   sau cong dang nhap. */
export async function onRequestGet(ctx) {
  try { return await _impl(ctx); } catch (e) { return notFound(); }
}
