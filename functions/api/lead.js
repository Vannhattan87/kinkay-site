// KINKAY — nhận bản sao lead từ form "Kiểm tra ngày trống" (đợt A1, 12/08/2026).
//
// VÌ SAO CÓ FILE NÀY
// Form trên web đã copy tin nhắn + mở Zalo cho khách. Đó vẫn là đường chính, vì người Việt
// nhắn Zalo chứ không chờ email. Nhưng khách bấm gửi rồi không dán tin thì lead biến mất
// hoàn toàn — đúng cái lỗ đang làm site "0 chuyển đổi". File này giữ lại bản sao.
//
// THIẾT KẾ CÓ CHỦ Ý: KHÔNG lưu gì trên Cloudflare.
// Không dùng KV/D1 vì như vậy Tân phải vào dashboard mới đọc được lead — không ai làm thế
// hằng ngày. Thay vào đó đẩy sang một webhook do Tân chọn (Google Apps Script ghi vào Sheet,
// Zapier, Make, n8n...). Lead rơi thẳng vào chỗ Tân/Kay vốn đã mở hằng ngày.
//
// CÁCH BẬT (làm một lần, khoảng 5 phút — xem hướng dẫn trong file trên Drive):
//   Cloudflare Pages -> project kinkay-site -> Settings -> Environment variables
//   Thêm biến  LEAD_WEBHOOK = <URL webhook>   (Production, và Preview nếu muốn test)
//
// CHƯA CẤU HÌNH THÌ SAO: endpoint vẫn trả 204, form trên web chạy bình thường, chỉ là
// không có bản sao. Cố ý — thà im lặng còn hơn ném lỗi đỏ vào mặt khách đang đặt lịch.
//
// CẬP NHẬT 12/09/2026 — FORM ĐÃ HỎI LIÊN HỆ.
// Đoạn ghi chú bên trên viết hồi 12/08, khi form cố ý KHÔNG hỏi số điện thoại. Thực tế
// đã bác bỏ lựa chọn đó: vụ KK-260912-001/002, contact của khách chỉ tồn tại trong hộp
// Zalo cá nhân, một cú bấm nhầm là mất trắng. Từ nay form bắt buộc có một kênh liên hệ
// và endpoint này ghi nó vào D1 trước khi khách rời trang.
//
// Kèm theo đó là nghĩa vụ dữ liệu cá nhân: giờ có lưu số điện thoại / email / handle IG.
// /chinh-sach-du-lieu/ cần nói rõ điều này (VIỆC CÒN LẠI, chưa làm trong đợt này).
//
// Regex dưới đây phải khớp với bản trong static/assets/page.js. Sửa một bên là phải
// sửa cả hai — đúng cái bẫy đã dính với normName/normContact hôm 11/09.

const json = (obj, status) =>
  new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });

// Cắt chuỗi để một request cố tình gửi 5MB không đi tiếp được vào webhook.
const clean = (v, max) => String(v == null ? '' : v).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ').trim().slice(0, max || 300);

// Kênh liên hệ. `ch` là giá trị hợp lệ của cột contact_channel trong CRM — xem CHANNELS
// trong functions/api/crm/_lib.js. WhatsApp không có trong danh sách đó nên map về 'Phone';
// số vẫn giữ nguyên mã nước, Kay nhìn là biết gọi kiểu gì.
const CHANNELS = {
  // Cố ý nới hơn "chỉ đầu số di động": 2 = cố định (028/024...), 3/5/7/8/9 = di động.
  // Chặn nhầm một khách thật đắt hơn nhiều một dòng rác trong CRM.
  zalo:      { ch: 'Zalo',      re: /^0(?:2|3|5|7|8|9)\d{7,9}$/ },
  whatsapp:  { ch: 'Phone',     re: /^\+[1-9]\d{6,14}$/ },
  email:     { ch: 'Email',     re: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/ },
  instagram: { ch: 'Instagram', re: /^@[A-Za-z0-9._]{1,30}$/ }
};

const stripSep = v => String(v || '').replace(/[\s.()\u2010-\u2015-]/g, '');

// 13/09/2026 (Luna QA vòng 2) — LOG THEO DANH SÁCH CHO PHÉP.
// Bản trước spread nguyên `lead` rồi chỉ che `contact`, nên `name` và `note` vẫn đổ
// nguyên vào log Cloudflare. `note` là ô khách tự gõ, có thể chứa bất cứ thứ gì.
// `/chinh-sach-du-lieu/` cam kết chỉ Kay + người quản trị đọc được thông tin khách,
// nên log chỉ được chứa thứ dùng để CHẨN ĐOÁN, không chứa nội dung form.
function diag(lead, extra) {
  return JSON.stringify({
    channel: lead.channel || null,
    has_contact: !!lead.contact,
    has_note: !!lead.note,
    occasion: lead.occasion || null,     // giá trị chọn sẵn, không phải khách tự gõ
    source: lead.source || null,
    page: lead.page || null,
    country: lead.country || null,
    ...(extra || {})
  });
}

// 13/09/2026: form chỉ còn MỘT ô liên hệ, kênh suy ra từ định dạng. Client cũng đoán
// (để soạn tin Zalo và bắn GA4) nhưng server KHÔNG tin client — client sửa được bằng
// console. Bản này là bản có thẩm quyền. Thứ tự xét phải khớp static/assets/page.js:
// Instagram TRƯỚC email (vì "@kinkay.official" có cả @ lẫn dấu chấm), và "+84..." là
// số Việt Nam viết kiểu quốc tế nên vẫn là Zalo chứ không phải WhatsApp.
function detectChannel(raw) {
  const v = String(raw == null ? '' : raw).trim();
  if (!v) return null;
  if (/instagram\.com/i.test(v)) return 'instagram';
  if (v.charAt(0) === '@') return 'instagram';
  if (v.indexOf('@') > 0) return 'email';
  const d = stripSep(v);
  if (/^(?:\+84|0084|84)\d{8,10}$/.test(d)) return 'zalo';
  if (/^0\d{8,10}$/.test(d)) return 'zalo';
  if (/^[3579]\d{8}$/.test(d)) return 'zalo';          // thiếu số 0 đầu
  if (/^(?:\+|00)\d{6,15}$/.test(d)) return 'whatsapp';
  if (/^\d{7,15}$/.test(d)) return 'whatsapp';
  return null;
}

// Chuẩn hoá để "0933 953 179", "+84933953179", "+84 (0) 933 953 179" và "933953179"
// đều thành đúng một chuỗi trong CRM. Không thì findSimilarLeads nhìn thành bốn khách.
function normContact(channel, v) {
  v = String(v == null ? '' : v).trim();
  if (!v) return '';
  if (channel === 'zalo') {
    v = stripSep(v).replace(/^0084/, '0').replace(/^\+?84/, '0');
    // "+84 (0) 933..." bỏ ngoặc thành "+840933..." -> "00933..." -> "0933...".
    // Đây là dạng in trên danh thiếp Việt Nam, bản 12/09 chặn oan nó.
    return v.replace(/^0{2,}(?=\d)/, '0').replace(/^([3579]\d{8})$/, '0$1');
  }
  if (channel === 'whatsapp') {
    v = stripSep(v).replace(/^00/, '+');
    return v.charAt(0) === '+' ? v : '+' + v;
  }
  if (channel === 'email') return v.toLowerCase();
  if (channel === 'instagram') {
    v = v.replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, '')
         .replace(/[\/?#].*$/, '').trim().replace(/^@+/, '');
    return v ? '@' + v : '';
  }
  return v;
}

/* Webhook dự phòng. Ba điểm Luna QA vòng 2 nêu, đã xử:
   1. TIMEOUT: webhook chậm không được treo phản hồi cho khách. AbortController 4 giây.
   2. KHÔNG CHẶN: khi D1 đã lưu xong thì webhook chỉ là bản sao — đẩy sang waitUntil,
      khách nhận phản hồi ngay. Chỉ AWAIT khi D1 HỎNG, vì lúc đó nó là đường duy nhất.
   3. KHÔNG log nội dung form.
   CẢNH BÁO THẬT (Control Room 12/09): `LEAD_WEBHOOK` HIỆN CHƯA ĐƯỢC CẤU HÌNH trên
   Cloudflare. Chừng nào chưa có, D1 hỏng = MẤT LEAD, không có phao nào cả. Đừng đọc
   hàm này là "đã có dự phòng". Cần Tân đặt biến môi trường. */
async function fireWebhook(env, lead) {
  const hook = env && env.LEAD_WEBHOOK;
  if (!hook) {
    console.log('[KINKAY lead] KHONG co LEAD_WEBHOOK — khong co duong du phong:', diag(lead));
    return false;
  }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
      signal: ctl.signal
    });
    if (!r.ok) console.log('[KINKAY lead] webhook tra ve', r.status, diag(lead));
    return r.ok;
  } catch (e) {
    console.log('[KINKAY lead] webhook loi:', e && e.name, diag(lead));
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function onRequestPost({ request, env, waitUntil }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  // 12/09/2026 — BẪY BOT. `kk_hp` là ô ẩn trong form, người thật không thấy và không
  // tab tới được. Có chữ trong đó nghĩa là bot quét DOM rồi điền hết. Nuốt im lặng,
  // vẫn trả 200 để bot không học được là mình bị chặn — nhưng `stored:false` nên
  // client KHÔNG nói với khách câu "Kay đã có số của bạn rồi".
  // Log đủ payload: nếu bẫy nuốt nhầm khách thật thì đây là chỗ duy nhất còn dấu vết.
  if (clean(body.kk_hp, 100)) {
    console.log('[KINKAY lead] honeypot — bo qua:', JSON.stringify({
      country: clean(request.headers.get('cf-ipcountry'), 8),
      ua: clean(request.headers.get('user-agent'), 160),
      hp_len: clean(body.kk_hp, 100).length
    }));
    return json({ ok: true, stored: false });
  }

  // 13/09/2026: kênh do SERVER đoán từ chính chuỗi liên hệ. `body.channel` của client
  // chỉ là gợi ý, không dùng — client sửa được bằng console.
  const rawContact = clean(body.contact, 120);
  const channel = detectChannel(rawContact);
  const lead = {
    name: clean(body.name, 120),
    occasion: clean(body.occasion, 80),
    date: clean(body.date, 20),
    place: clean(body.place, 160),
    budget: clean(body.budget, 80),
    note: clean(body.note, 800),
    channel,
    contact: channel ? normContact(channel, rawContact) : '',
    source: clean(body.source, 60),
    page: clean(body.page, 160),
    ts: clean(body.ts, 40) || new Date().toISOString(),
    // Hữu ích khi soi lead rác: quốc gia và loại thiết bị, không phải IP.
    country: clean(request.headers.get('cf-ipcountry'), 8),
    ua: clean(request.headers.get('user-agent'), 200)
  };

  if (!lead.name || !lead.occasion) return json({ ok: false, error: 'missing_fields' }, 400);

  // LIÊN HỆ LÀ BẮT BUỘC. Không có liên hệ thì lead vô dụng — đó đúng là trạng thái đã
  // sinh ra KK-260912-001/002. Chặn ở server chứ không chỉ ở client.
  if (!rawContact) return json({ ok: false, error: 'missing_contact' }, 400);
  const chDef = CHANNELS[channel];
  if (!chDef) return json({ ok: false, error: 'bad_contact' }, 400);
  if (!chDef.re.test(lead.contact)) return json({ ok: false, error: 'bad_contact' }, 400);

  // 06/09/2026 (CR-20260906-28): có CRM trong admin (D1 binding CRM_DB) thì ghi thẳng lead
  // vào CRM, Status = New, Source = Website Form. Đây là NGUỒN DUY NHẤT (thay Sheet).
  // Chỉ ghi khi CRM_CUTOVER=1 (QA 06/09: không có cửa sổ hai master).
  let crmTried = false, crmOk = false, duplicate = false, dupId = null;
  if (env && env.CRM_DB && String(env.CRM_CUTOVER || '').trim() === '1') {
    crmTried = true;
    try {
      const { insertLead, cleanDate, findSimilarLeads, logDiff } = await import('./crm/_lib.js');

      // 13/09/2026 — CHỐNG TRÙNG. `/api/crm/leads` (nhập tay) đã chặn trùng từ 11/09
      // nhưng form web thì không, nên khách bấm gửi lại sau khi thấy lỗi mạng là tạo
      // hai dòng y hệt nhau. Cùng người, cùng ngày, cùng dịch vụ thì coi như một.
      try {
        const sim = await findSimilarLeads(env.CRM_DB, {
          customer_name: lead.name, contact: lead.contact,
          event_date: cleanDate(lead.date), service: lead.occasion
        });
        // `same_job` của _lib.js đòi TRÙNG CẢ NGÀY. Khách không chọn ngày thì không
        // bao giờ khớp, nên bổ sung nhánh: cùng liên hệ + cùng dịp + cả hai đều chưa
        // có ngày cũng là trùng. Đây đúng là kiểu trùng do bấm gửi hai lần.
        const hit = (Array.isArray(sim) ? sim : []).find(x => {
          if (!x || !x.lead) return false;
          if (x.level === 'same_job') return true;
          const sameContact = Array.isArray(x.reasons) && x.reasons.indexOf('contact') >= 0;
          const sameSvc = !!(x.lead.service && lead.occasion && x.lead.service === lead.occasion);
          const noDates = !cleanDate(lead.date) && !x.lead.event_date;
          return sameContact && sameSvc && noDates;
        });
        if (hit && hit.lead) { duplicate = true; dupId = hit.lead.id; }
      } catch (e) {
        // Dò trùng hỏng thì vẫn ghi — thà một dòng trùng còn hơn mất khách.
        console.log('[KINKAY lead] do trung loi:', e && e.message);
      }

      const noteParts = [];
        if (lead.place) noteParts.push('Địa điểm: ' + lead.place);
        if (lead.budget) noteParts.push('Ngân sách: ' + lead.budget);
        if (lead.note) noteParts.push('Ghi chú khách: ' + lead.note);
      noteParts.push('Từ form kinkay.vn' + (lead.page ? ' ' + lead.page : '') + (lead.source ? ' (' + lead.source + ')' : '') + (lead.country ? ' · ' + lead.country : ''));

      if (duplicate) {
        /* 13/09/2026 (Luna QA — BLOCKER dữ liệu). Bản trước chỉ `if (!duplicate)` rồi
           bỏ qua, nghĩa là khách hỏi lần hai với NỘI DUNG KHÁC (đổi địa điểm, thêm ghi
           chú, đổi ngân sách) thì phần mới bị nuốt im lặng mà vẫn báo thành công.
           Giờ: không tạo dòng mới, nhưng ghi bổ sung vào đúng lead cũ và để lại vết
           trong lead_events để Kay biết khách đã hỏi lại. */
        const add = '[' + new Date().toISOString().slice(0, 16).replace('T', ' ') +
          ' khách gửi lại từ form] ' + noteParts.join(' · ');
        /* 13/09 (Luna QA vòng 2) — APPEND ATOMIC, không đọc-rồi-ghi-đè.
           Bản trước đọc `notes` cũ ở bước dò trùng rồi ghi đè bằng chuỗi đã nối. Hai lần
           bổ sung gần nhau thì lần sau ghi đè lần trước, mất một phần ghi chú của khách.
           Nối ngay trong câu UPDATE nên D1 tự giữ thứ tự, không có cửa sổ đọc-ghi. */
        /* BẪY 13/09: `last_touch` là cột của bảng PARTNERS, KHÔNG phải leads. Bản đầu
           dùng nhầm nên nhánh này ném "no such column: last_touch" và trả 500 cho khách
           dù lead đã có sẵn. Bảng leads dùng `last_updated` + `updated_by`. */
        await env.CRM_DB.prepare(
          'UPDATE leads SET notes = CASE WHEN COALESCE(notes, \'\') = \'\' THEN ? ' +
          'ELSE notes || char(10) || ? END, last_updated = ?, updated_by = ? WHERE id = ?'
        ).bind(add, add, new Date().toISOString(), 'website-form', dupId).run();
        // Ghi vết chỉ phần THÊM VÀO. Không khai `old_value` vì không đọc lại notes hiện tại.
        await logDiff(env.CRM_DB, 'lead', dupId, 'website-form', {}, { notes_appended: add });
        crmOk = true;
      } else {
        await insertLead(env.CRM_DB, 'website-form', {
          customer_name: lead.name,
          // Liên hệ thật, không còn null. `source` vẫn là 'Website Form' để báo cáo kênh
          // không đổi; `contact_channel` là kênh khách dùng, vì đó mới là thứ Kay cần biết.
          contact: lead.contact,
          contact_channel: chDef.ch,
          service: lead.occasion,
          event_date: cleanDate(lead.date),
          source: 'Website Form',
          segment: 'B2C',
          status: 'New',
          next_action: 'Trả lời khách qua ' + chDef.ch + ': ' + lead.contact,
          next_followup: new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10),
          notes: noteParts.join(' · ')
        });
        crmOk = true;
      }
    } catch (e) {
      // Log NGUYÊN payload, không chỉ e.message. Nếu D1 chết thì đây là dấu vết cuối
      // cùng còn lại của số khách — bản 12/09 chỉ log message nên mất sạch.
      // Log chỉ để chẩn đoán, KHÔNG phải nơi giữ lead. Đường giữ lead là webhook.
      console.log('[KINKAY lead] ghi CRM loi:', e && e.message, '|', diag(lead));
    }
  }

  /* Webhook. Bản 12/09 đặt `return 500` phía TRÊN khối này nên đúng lúc cần phao nhất
     thì phao không chạy — đó là lỗi chặn nặng nhất của vòng 1.
     13/09 (Luna QA vòng 2): D1 lưu xong rồi thì webhook chỉ là bản sao, không được bắt
     khách chờ nó — đẩy sang waitUntil. D1 HỎNG thì nó là đường duy nhất, phải await. */
  if (crmTried && !crmOk) {
    await fireWebhook(env, lead);
    return json({ ok: false, error: 'store_failed' }, 500);
  }
  if (typeof waitUntil === 'function') waitUntil(fireWebhook(env, lead));
  else await fireWebhook(env, lead);

  // `stored` = liên hệ đã nằm trong CRM (khách được hứa đúng sự thật).
  // `duplicate` = KHÔNG tạo lead mới, chỉ ghi bổ sung vào lead có sẵn. Client phải đọc
  // CẢ HAI: generate_lead chỉ được bắn khi stored && !duplicate, nếu không thì một
  // khách bấm gửi lại bị đếm thành hai lead (Luna QA 13/09).
  return json({ ok: true, stored: crmOk, duplicate });
}

// Gọi bằng GET (ví dụ ai đó mở thẳng URL trên trình duyệt) thì nói rõ, đừng để 404 khó hiểu.
export async function onRequestGet() {
  return json({ ok: true, note: 'KINKAY lead endpoint — chi nhan POST.' });
}
