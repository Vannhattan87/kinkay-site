/* KINKAY — JS dùng chung cho các trang con. 12/08/2026 (đợt A-B-C).
   Không phụ thuộc content.js (trang con chỉ có tiếng Việt, trừ /en/ vốn viết sẵn tiếng Anh).

   Gồm 4 việc:
     1. track()           — bọc gtag, an toàn khi GA chưa nạp hoặc bị chặn
     2. nav burger        — menu mobile
     3. reveal            — hiệu ứng hiện dần khi cuộn tới
     4. KINKAY.leadForm() — form "kiểm tra ngày trống" (đợt A1)
     5. KINKAY.beforeAfter() — vẽ lưới before/after từ window.BEFOREAFTER
*/
(function () {
  'use strict';

  var ZALO = 'https://zalo.me/0933953179';

  /* ---------- 0. Ô LIÊN HỆ (12/09, sửa lại 13/09) ----------
     VÌ SAO CÓ PHẦN NÀY. Trước 12/09 form KHÔNG hỏi liên hệ: lead vào CRM với contact
     rỗng, cách duy nhất gặp lại khách là chờ khách tự dán tin vào Zalo. Không dán là
     mất hẳn.

     BẢN 13/09 — MỘT Ô, TỰ NHẬN DẠNG. Bản 12/09 có hai ô (chọn kênh + điền giá trị) và
     tự sinh ra lỗi: khách gõ số vào ô Zalo rồi đổi kênh sang Email thì giá trị cũ nằm
     nguyên, bấm gửi báo "Email chưa đúng" trong khi khách không làm gì sai. Giờ chỉ còn
     MỘT ô, JS đoán kênh từ định dạng. Bớt một bước, xoá luôn lớp lỗi đó.

     Kênh suy ra ở client chỉ để soạn tin nhắn và bắn GA4. SERVER TỰ ĐOÁN LẠI và lấy
     kết quả của server làm chuẩn — client sửa được bằng console.

     Bảng regex + thứ tự nhận dạng phải khớp với functions/api/lead.js. Sửa một bên là
     phải sửa cả hai, đúng cái bẫy đã dính với normName/normContact hôm 11/09. */
  var CONTACT = {
    zalo: {
      // Cố ý nới hơn "chỉ đầu số di động": 2 = cố định (028/024...), 3/5/7/8/9 = di động.
      // Chặn nhầm một khách thật đắt hơn nhiều một dòng rác trong CRM.
      re: /^0(?:2|3|5|7|8|9)\d{7,9}$/,
      opt: { vi: 'Zalo', en: 'Zalo' }
    },
    whatsapp:  { re: /^\+[1-9]\d{6,14}$/,              opt: { vi: 'WhatsApp', en: 'WhatsApp' } },
    email:     { re: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,  opt: { vi: 'Email', en: 'Email' } },
    instagram: { re: /^@[A-Za-z0-9._]{1,30}$/,          opt: { vi: 'Instagram', en: 'Instagram' } }
  };

  function lang2() {
    return String(document.documentElement.lang || 'vi').slice(0, 2) === 'en' ? 'en' : 'vi';
  }

  // Bỏ khoảng trắng, dấu chấm, ngoặc và mọi loại gạch ngang (kể cả gạch dài kiểu Word).
  function stripSep(v) { return String(v || '').replace(/[\s.()\u2010-\u2015-]/g, ''); }

  /* Đoán kênh từ định dạng. THỨ TỰ QUAN TRỌNG:
     - "@kinkay.official" có cả @ lẫn dấu chấm nên phải xét Instagram TRƯỚC email,
       nếu không nó bị đọc thành email.
     - "+84..." là số Việt Nam viết kiểu quốc tế -> vẫn là Zalo, không phải WhatsApp.
     - "933953179" (thiếu số 0 đầu) rất hay gặp khi khách copy từ danh bạ -> Zalo. */
  function detectChannel(raw) {
    var v = String(raw == null ? '' : raw).trim();
    if (!v) return null;
    if (/instagram\.com/i.test(v)) return 'instagram';
    if (v.charAt(0) === '@') return 'instagram';
    if (v.indexOf('@') > 0) return 'email';
    var d = stripSep(v);
    if (/^(?:\+84|0084|84)\d{8,10}$/.test(d)) return 'zalo';
    if (/^0\d{8,10}$/.test(d)) return 'zalo';
    if (/^[3579]\d{8}$/.test(d)) return 'zalo';       // thiếu số 0 đầu
    if (/^(?:\+|00)\d{6,15}$/.test(d)) return 'whatsapp';
    if (/^\d{7,15}$/.test(d)) return 'whatsapp';
    return null;
  }

  /* Chuẩn hoá để "0933 953 179", "+84933953179", "+84 (0) 933 953 179" và "933953179"
     đều thành đúng một chuỗi trong CRM. Không thì chống trùng bên server nhìn thành
     bốn khách khác nhau. */
  function normContact(ch, v) {
    v = String(v == null ? '' : v).trim();
    if (!v) return '';
    if (ch === 'zalo') {
      v = stripSep(v).replace(/^0084/, '0').replace(/^\+?84/, '0');
      // "+84 (0) 933..." -> sau khi bỏ ngoặc thành "+840933..." -> "00933..." -> "0933..."
      // Đây là dạng in trên danh thiếp Việt Nam, bản 12/09 chặn oan nó.
      return v.replace(/^0{2,}(?=\d)/, '0').replace(/^([3579]\d{8})$/, '0$1');
    }
    if (ch === 'whatsapp') {
      v = stripSep(v).replace(/^00/, '+');
      return v.charAt(0) === '+' ? v : '+' + v;
    }
    if (ch === 'email') return v.toLowerCase();
    if (ch === 'instagram') {
      v = v.replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, '')
           .replace(/[\/?#].*$/, '').trim().replace(/^@+/, '');
      return v ? '@' + v : '';
    }
    return v;
  }

  /* ---------- 1. track ---------- */
  function track(name, params) {
    try { if (typeof gtag === 'function') gtag('event', name, params || {}); }
    catch (e) { /* GA bị chặn thì thôi, không được để gãy trang */ }
  }

  /* ---------- 2. nav + menu xổ (đợt D, 12/08/2026) ----------
     Desktop: rê chuột mở, bấm cũng mở (cho người dùng bàn phím và màn cảm ứng).
     Mobile (<=980px): menu xổ biến thành accordion trong ngăn kéo — CSS lo phần
     hiển thị, JS chỉ bật/tắt data-open. Một nguồn trạng thái duy nhất cho cả hai
     kích thước màn hình, nên không có chuyện desktop và mobile lệch nhau. */
  var navReady = false;
  function initNav() {
    // Goi hai lan la moi cu bam bi xu ly hai lan -> mo roi dong ngay -> nhin nhu menu chet.
    // Da dinh dung bay nay luc test 13/08, nen chot cua o day thay vi tin vao ky luat goi ham.
    if (navReady) return;
    navReady = true;

    var burger = document.getElementById('burger');
    var menu = document.getElementById('menu');
    var subs = [].slice.call(document.querySelectorAll('body>nav .has-sub'));

    function closeAll(except) {
      subs.forEach(function (li) {
        if (li === except) return;
        li.setAttribute('data-open', '0');
        var t = li.querySelector('.sub-t');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    }
    // Menu xo neo trai theo mac dinh. Muc nam sat mep phai se tran khoi man hinh va
    // de ra thanh cuon ngang — do truoc khi hien, tran thi neo ve phai (class .flip).
    // Do moi lan mo chu khong do mot lan luc tai trang: nguoi dung doi co cua so, phong to
    // chu, hay xoay dien thoai la ket qua do cu sai ngay.
    function fitPanel(li) {
      var p = li.querySelector('.navsub');
      if (!p) return;
      li.classList.remove('flip');
      var r = p.getBoundingClientRect();
      if (!r.width) return;                       // mobile: panel display:none, khong can lat
      if (r.right > document.documentElement.clientWidth - 8) li.classList.add('flip');
    }
    function setOpen(li, on) {
      if (on) fitPanel(li);
      li.setAttribute('data-open', on ? '1' : '0');
      var t = li.querySelector('.sub-t');
      if (t) t.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) closeAll(li);
    }

    subs.forEach(function (li) {
      var t = li.querySelector('.sub-t');
      if (!t) return;
      t.addEventListener('click', function (e) {
        e.preventDefault();
        setOpen(li, li.getAttribute('data-open') !== '1');
      });
      // Rê chuột chỉ áp dụng khi có chuột thật. Trên màn cảm ứng, hover giả
      // làm menu nhấp nháy rồi tự đóng — nên khoá lại bằng media query.
      if (window.matchMedia('(hover:hover) and (min-width:981px)').matches) {
        li.addEventListener('mouseenter', function () { setOpen(li, true); });
        li.addEventListener('mouseleave', function () { setOpen(li, false); });
      }
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('body>nav .has-sub')) closeAll(null);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeAll(null);
        if (menu) menu.classList.remove('open');
        if (burger) burger.setAttribute('aria-expanded', 'false');
      }
    });

    if (!burger || !menu) return;
    burger.addEventListener('click', function () {
      var on = menu.classList.toggle('open');
      burger.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (!on) closeAll(null);
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { menu.classList.remove('open'); closeAll(null); });
    });
  }

  /* ---------- 3. reveal ---------- */
  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: .12 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 4. FORM KIỂM TRA NGÀY TRỐNG (đợt A1) ----------
     Vấn đề đang chữa: trước đợt này 100% lead đi thẳng ra Zalo bằng một cú bấm.
     Hệ quả: (a) GA4 chỉ đếm được "có người bấm", không biết dịp gì, ngày nào, ngân sách bao nhiêu;
             (b) khách bấm rồi không nhắn thì mất hẳn, không còn dấu vết để nhắc lại.

     Cách làm ở đây, theo đúng thói quen người Việt (không ai chờ email trả lời):
       1. Khách điền 5 ô -> mình biết chất lượng lead TRƯỚC khi Kay mở máy.
       2. Bắn generate_lead kèm tham số -> GA4 đo được thật, chia được theo dịp/ngân sách.
       3. Soạn sẵn tin nhắn tiếng Việt, copy vào clipboard, mở Zalo -> khách chỉ việc dán.
       4. Gửi bản sao về /api/lead (Cloudflare Function) để có nhật ký lead, phòng khi khách
          không dán tin. Chưa cấu hình LEAD_WEBHOOK thì Function trả 204 và không lưu gì —
          form vẫn chạy đủ, không hỏng. Xem functions/api/lead.js.

     CSP: connect-src 'self' cho phép fetch('/api/lead'). Không gọi domain ngoài, cố ý.
  */
  function buildMessage(d) {
    var L = [];
    L.push('Chào Kay, mình muốn kiểm tra lịch trống ạ.');
    L.push('');
    L.push('• Tên: ' + d.name);
    // Nhãn kênh luôn tiếng Việt kể cả trên trang /en/ — tin này Kay đọc, không phải khách.
    if (d.contact) L.push('• ' + (CONTACT[d.channel] || CONTACT.zalo).opt.vi + ': ' + d.contact);
    L.push('• Dịp: ' + d.occasion);
    L.push('• Ngày: ' + (d.dateText || 'chưa chốt ngày'));
    if (d.place) L.push('• Địa điểm: ' + d.place);
    if (d.budget) L.push('• Ngân sách dự kiến: ' + d.budget);
    if (d.note) L.push('• Ghi chú: ' + d.note);
    L.push('');
    L.push('(Gửi từ kinkay.vn)');
    return L.join('\n');
  }

  function fmtDateVN(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    if (p.length !== 3) return iso;
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function daysAhead(iso) {
    if (!iso) return null;
    var t = new Date(iso + 'T00:00:00');
    if (isNaN(t.getTime())) return null;
    var now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((t - now) / 86400000);
  }

  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(txt).catch(function () { return legacyCopy(txt); });
    }
    return Promise.resolve(legacyCopy(txt));
  }
  function legacyCopy(txt) {
    var a = document.createElement('textarea');
    a.value = txt;
    a.style.cssText = 'position:fixed;top:-1000px;left:-1000px';
    document.body.appendChild(a); a.select();
    try { document.execCommand('copy'); } catch (e) { }
    a.remove();
  }

  /* Vẽ lại chữ của ô kênh + ô liên hệ theo ngôn ngữ đang bật và theo kênh đang chọn.
     Gọi lúc khởi động, mỗi lần khách đổi kênh, và mỗi lần <html lang> đổi (trang chủ
     có nút VI/EN gọi applyLang() đặt lại thuộc tính đó). */
  /* Chỉ còn đổi CHỮ theo ngôn ngữ. Không còn select nên không còn chuyện đổi kênh
     làm giá trị cũ mắc kẹt, và không còn chuyện đổi ngôn ngữ âm thầm đổi kênh của
     khách (lỗi bản 12/09 trên trang chủ). */
  var LF_T = {
    label: { vi: 'Kay liên hệ lại bạn bằng', en: 'How can Kay reach you?' },
    ph:    { vi: 'Số Zalo, email hoặc @instagram', en: 'Phone, email or @instagram' },
    hint:  { vi: 'Số điện thoại, email hay Instagram đều được. Kay chỉ dùng để trả lời bạn về lịch.',
             en: 'Phone, email or Instagram, whichever you prefer. Only used to reply to you about your date.' },
    bad:   { vi: 'Kay chưa đọc được liên hệ này. Bạn thử số điện thoại (0901234567), email, hoặc @instagram nhé.',
             en: 'Kay could not read that. Try a phone number with country code (+14155550123), an email, or @instagram.' }
  };

  function paintContact(form) {
    var inp = form.elements['contact'];
    if (!inp) return;
    var L = lang2();
    var lab = form.querySelector('[data-lf="contactLabel"]');
    if (lab) lab.textContent = LF_T.label[L];
    var hint = form.querySelector('[data-lf="contactHint"]');
    if (hint) hint.textContent = LF_T.hint[L];
    inp.placeholder = LF_T.ph[L];
  }

  function leadForm(opts) {
    opts = opts || {};
    var form = document.getElementById(opts.formId || 'leadForm');
    if (!form) return;
    var box = document.getElementById(opts.msgId || 'leadMsg');
    var source = opts.source || 'page';
    var btn = form.querySelector('button[type="submit"]');
    var btnText = btn ? btn.textContent : '';
    var sending = false;

    paintContact(form);
    // Trang chu doi ngon ngu bang applyLang() -> doi <html lang>. Theo doi thuoc tinh
    // do thay vi bat applyLang() phai biet toi form. Gio chi ve lai CHU, KHONG dung
    // vao gia tri khach da go (loi ban 12/09: doi ngon ngu lam kenh tu nhay).
    try {
      new MutationObserver(function () { paintContact(form); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    } catch (e) { }

    /* Ban 12/09 do moi loi vao #leadMsg o DAY form roi cuon xuong do, trong khi o sai
       nam cach 4-5 o phia tren, khong highlight, khong focus. Tren dien thoai la mot
       vong do tim va khach bo di. Gio dua con tro ve dung o sai. */
    function fail(html, field) {
      track('form_error', { error_field: field || 'unknown', click_source: source });
      var el = field ? form.elements[field] : null;
      if (el) {
        try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) { } }
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { }
      }
      if (!box) return;
      box.className = 'form-msg on form-err';
      box.innerHTML = html;
      if (!el) { try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { } }
    }

    // Khach cham vao form lan dau -> do duoc ti le bo do. Truoc 13/09 khuc giua phieu
    // mu hoan toan: khong biet co ai bat dau dien ma bo khong.
    var started = false;
    form.addEventListener('focusin', function () {
      if (started) return;
      started = true;
      track('form_start', { click_source: source, form_id: form.id || 'leadForm' });
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (sending) return;                       // chan bam hai lan -> hai lead y het nhau
      var L = lang2();
      var g = function (n) { var el = form.elements[n]; return el ? String(el.value || '').trim() : ''; };

      var d = {
        name: g('name'), contact: '', channel: null,
        occasion: g('occasion'), date: g('date'), place: g('place'),
        budget: g('budget'), note: g('note')
      };
      d.dateText = fmtDateVN(d.date);

      var rawContact = g('contact');
      d.channel = detectChannel(rawContact);
      d.contact = d.channel ? normContact(d.channel, rawContact) : '';
      var c = d.channel ? CONTACT[d.channel] : null;

      if (!d.name) return fail(L === 'en' ? 'Kay needs your <b>name</b>.'
                                          : 'Cho KINKAY xin <b>t\u00ean</b> b\u1ea1n nh\u00e9.', 'name');
      if (!d.occasion) return fail(L === 'en' ? 'Please pick the <b>occasion</b>.'
                                              : 'Ch\u1ecdn gi\u00fap <b>d\u1ecbp</b> b\u1ea1n c\u1ea7n nh\u00e9.', 'occasion');
      // Bat buoc co lien he. Tha mat mot form do dang con hon co mot lead ma khong
      // ai goi lai duoc.
      if (!rawContact) return fail(L === 'en'
        ? 'Please leave a contact so Kay can reply to you.'
        : 'B\u1ea1n \u0111\u1ec3 l\u1ea1i li\u00ean h\u1ec7 gi\u00fap Kay nh\u00e9, kh\u00f4ng c\u00f3 th\u00ec Kay kh\u00f4ng tr\u1ea3 l\u1eddi b\u1ea1n \u0111\u01b0\u1ee3c.', 'contact');
      if (!c || !c.re.test(d.contact)) return fail(escHtml(LF_T.bad[L]), 'contact');

      var msg = buildMessage(d);
      var da = daysAhead(d.date);
      var toZalo = d.channel === 'zalo';

      // Chi mo Zalo khi lien he cua khach CHINH LA Zalo. Mo NGAY trong nhip bam nut,
      // cham mot nhip la trinh duyet chan popup.
      var w = toZalo ? window.open(ZALO, '_blank', 'noopener') : null;
      if (toZalo) {
        // Cu cham Zalo co y dinh cao nhat tren site — khach vua de so vua sang Zalo.
        // Truoc 13/09 nhanh nay khong ban gi nen no vo hinh trong moi so sanh.
        track('booking_click', { method: 'zalo', click_source: source + '_form_handoff' });
        copyText(msg);
      }

      sending = true;
      if (btn) { btn.disabled = true; btn.textContent = (L === 'en' ? 'Sending...' : '\u0110ang g\u1eedi...'); }

      /* `stored` = server XAC NHAN da ghi vao CRM. Ban 12/09 ban generate_lead ngay luc
         bam nut, truoc ca khi fetch xong, nen no dem ca lead khong luu duoc va dem them
         mot lan nua moi khi khach bam gui lai. Tu 13/09: CHI ban khi stored === true. */
      var done = function (ok, res) {
        var stored = !!res.stored, duplicate = !!res.duplicate;
        if (!ok) {
          sending = false;
          if (btn) { btn.disabled = false; btn.textContent = btnText; }
          track('lead_send_failed', { click_source: source, contact_channel: d.channel });
          return fail(L === 'en'
            ? '<b>Could not send.</b> Please message Kay on Zalo <b>+84 933 953 179</b> or email <b>kinkay20t@gmail.com</b>.'
            : '<b>G\u1eedi kh\u00f4ng th\u00e0nh c\u00f4ng.</b> B\u1ea1n nh\u1eafn gi\u00fap Kay qua Zalo <b>0933 953 179</b> ho\u1eb7c email <b>kinkay20t@gmail.com</b> nh\u00e9.', null);
        }
        // Thanh cong thi KHONG mo khoa nut — tranh khach bam lan hai tao ban ghi trung.
        if (btn) btn.textContent = (L === 'en' ? 'Sent' : '\u0110\u00e3 g\u1eedi');
        // Luna QA 13/09: `generate_lead` = D1 XÁC NHẬN TẠO LEAD MỚI. Khách bấm gửi lại
        // thì server trả duplicate:true (đã ghi bổ sung vào lead cũ, không tạo dòng mới)
        // -> KHÔNG bắn lại, nếu không một khách bị đếm thành hai lead.
        // `form_submit_success` đếm mọi lần gửi được tiếp nhận, kể cả gửi bổ sung.
        if (stored) track('form_submit_success', {
          click_source: source, contact_channel: d.channel, is_duplicate: duplicate ? 'yes' : 'no'
        });
        if (stored && !duplicate) {
          track('generate_lead', {
            lead_type: 'booking_form',
            // 26/08/2026: KHONG duoc dat ten param la `source` (ten danh rieng cua GA4,
            // no ghi de attribution cua session -> kenh "Unassigned"). Dung `click_source`.
            click_source: source,
            contact_channel: d.channel,
            occasion: d.occasion,
            budget_band: d.budget || 'chua_chon',
            has_date: d.date ? 'yes' : 'no',
            // days_ahead la so thuc -> KHONG gui -1 khi khong co ngay, no keo tut trung binh.
            days_ahead: da === null ? undefined : da
          });
        }
        if (!box) return;
        box.className = 'form-msg on';

        // Cau tran an "Kay da co so cua ban" CHI duoc noi khi server xac nhan da luu.
        var saved = stored
          ? (L === 'en'
              ? 'Kay has your ' + escHtml(c.opt.en) + ' <b>' + escHtml(d.contact) + '</b> and will reply within the day.'
              : 'Kay \u0111\u00e3 nh\u1eadn ' + escHtml(c.opt.vi) + ' <b>' + escHtml(d.contact) + '</b> c\u1ee7a b\u1ea1n v\u00e0 s\u1ebd tr\u1ea3 l\u1eddi trong ng\u00e0y.')
          : (L === 'en'
              ? 'Please message Kay directly so your request does not get lost.'
              : 'B\u1ea1n nh\u1eafn th\u1eb3ng cho Kay gi\u00fap nh\u00e9, \u0111\u1ec3 y\u00eau c\u1ea7u c\u1ee7a b\u1ea1n kh\u00f4ng b\u1ecb th\u1ea5t l\u1ea1c.');

        if (toZalo) {
          box.innerHTML = (L === 'en'
            ? (w ? '<b>Kay\u2019s Zalo is open.</b> Your message is already copied \u2014 just paste it and send.'
                 : '<b>Got your details.</b> This browser blocked Zalo \u2014 please message Zalo <b>+84 933 953 179</b> and paste the copied message.')
            : (w ? '<b>\u0110\u00e3 m\u1edf Zalo c\u1ee7a Kay.</b> Tin nh\u1eafn \u0111\u00e3 \u0111\u01b0\u1ee3c copy s\u1eb5n \u2014 b\u1ea1n ch\u1ec9 c\u1ea7n d\u00e1n v\u00e0o khung chat r\u1ed3i g\u1eedi.'
                 : '<b>\u0110\u00e3 nh\u1eadn th\u00f4ng tin c\u1ee7a b\u1ea1n.</b> Tr\u00ecnh duy\u1ec7t n\u00e0y ch\u1eb7n m\u1edf Zalo t\u1ef1 \u0111\u1ed9ng \u2014 b\u1ea1n nh\u1eafn Zalo <b>0933 953 179</b> v\u00e0 d\u00e1n tin nh\u1eafn \u0111\u00e3 copy v\u00e0o gi\u00fap Kay nh\u00e9.')) +
            '<div style="margin-top:8px">' + saved + '</div>' +
            '<div style="margin-top:12px;font-size:13.5px;white-space:pre-line;color:var(--taupe);' +
            'border-left:2px solid var(--gold);padding-left:12px">' + escHtml(msg) + '</div>' +
            '<div style="margin-top:12px"><a class="btn-line" data-zalo-reopen href="' + ZALO + '" target="_blank" rel="noopener">' +
            (L === 'en' ? 'Open Zalo again' : 'M\u1edf l\u1ea1i Zalo') + '</a></div>';
          // Nut nay duoc chen SAU khi initCtaTracking da chay nen khong co listener.
          // Gan tay, neu khong cu bam Zalo de xay ra nhat lai la cu khong duoc dem.
          var re = box.querySelector('[data-zalo-reopen]');
          if (re) re.addEventListener('click', function () {
            track('booking_click', { method: 'zalo', click_source: source + '_reopen' });
          });
        } else {
          box.innerHTML = (L === 'en' ? '<b>Thank you, ' : '<b>C\u1ea3m \u01a1n b\u1ea1n ') +
            escHtml(d.name) + '.</b> ' + saved;
        }
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };

      // Mang rot giua chung thi promise treo hang phut, nut ket "Dang gui...", khach bo di.
      var settled = false;
      var finish = function (ok, res) { if (settled) return; settled = true; done(ok, res || {}); };
      setTimeout(function () { finish(false); }, 15000);

      try {
        fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: d.name, contact: d.contact, channel: d.channel,
            kk_hp: g('kk_hp'),          // bay bot — nguoi that luon de trong o nay
            occasion: d.occasion, date: d.date, place: d.place,
            budget: d.budget, note: d.note, source: source,
            page: location.pathname, ts: new Date().toISOString()
          })
        }).then(function (r) {
          if (!r || r.status >= 400) return finish(false);
          return r.json().then(function (j) { finish(true, j || {}); },
                               function () { finish(true, {}); });
        }).catch(function () { finish(false); });
      } catch (e) { finish(false); }
    });
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- 5. BEFORE / AFTER ----------
     Đọc window.BEFOREAFTER (build.js sinh ra beforeafter.js từ content/beforeafter.json).
     Chưa có cặp nào thì hiện dòng chữ thay thế chứ không để khoảng trống câm. */
  function beforeAfter(opts) {
    opts = opts || {};
    var g = document.getElementById(opts.gridId || 'baGrid');
    if (!g) return;
    var d = window.BEFOREAFTER || {};
    var items = (d.items || []).filter(function (p) { return p && p.before && p.after; });
    var empty = document.getElementById(opts.emptyId || 'baEmpty');

    if (!items.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    g.innerHTML = items.map(function (p) {
      return '<figure class="ba-w"><div class="ba" style="--x:50%">' +
        '<img src="' + escHtml(p.after) + '" alt="KINKAY — sau khi makeup' +
        (p.caption ? ' — ' + escHtml(p.caption) : '') + '" loading="lazy">' +
        '<img class="ba-top" src="' + escHtml(p.before) + '" alt="KINKAY — trước khi makeup" loading="lazy">' +
        '<span class="ba-bar"></span><span class="ba-knob">↔</span>' +
        '<span class="ba-lbl b">Before</span><span class="ba-lbl a">After</span>' +
        '<input type="range" min="0" max="100" value="50" aria-label="Kéo để so sánh before và after">' +
        '</div>' + (p.caption ? '<figcaption class="ba-cap">' + escHtml(p.caption) + '</figcaption>' : '') +
        '</figure>';
    }).join('');

    var tracked = false;
    g.querySelectorAll('.ba').forEach(function (el) {
      var r = el.querySelector('input');
      r.addEventListener('input', function () {
        el.style.setProperty('--x', r.value + '%');
        if (!tracked) { tracked = true; track('ba_drag', { click_source: opts.source || 'page' }); }
      });
    });
  }

  /* ---------- 6b. NÚT DẪN TỚI FORM (12/09/2026) ----------
     Trước đợt này nút "Đặt lịch" trên thanh nav mở thẳng zalo.me. Mỗi cú bấm đó là một
     khách rơi vào hộp Zalo cá nhân của Kay, vô hình với cả CRM lẫn GA4 — và nếu khách
     không nhắn thì mất hẳn (vụ KK-260912-001/002). Giờ nút dẫn tới form, nơi liên hệ
     được ghi vào D1 trước khi khách rời trang.

     Vẫn GIỮ Zalo trực tiếp ở: chân trang, dòng "Hoặc nhắn thẳng" ngay dưới form, dải
     cảnh báo trình duyệt trong app (chỗ đó zalo.me bị chặn nên chỉ còn cách copy số),
     nút hỏi nhanh ở /faq/ và nút vendor ở /doi-tac/. Bắt khách điền 5 ô chỉ để hỏi
     "có làm ở Bình Dương không" là mất khách.

     Bắn `booking_click` với method='form' — CÙNG tên event cũ để key event trong GA4
     không gãy, chỉ khác method, nên so được đường form với đường zalo. KHÔNG bắn
     generate_lead ở đây: bấm nút chưa phải là lead, lead là lúc submit.

     opts.track = false dùng cho trang chủ: ở đó ba nút CTA đã có handler GA riêng trong
     index.html, chạy thêm ở đây là đếm đôi. Trang chủ chỉ mượn phần cuộn + focus. */
  function initFormCta(opts) {
    if (typeof opts === 'string') opts = { source: opts };
    opts = opts || {};
    var source = opts.source || 'page';
    var doTrack = opts.track !== false;
    // Bắt cả link cùng trang (#form) lẫn link sang trang khác (/#booking): link sang
    // trang khác không có đích để cuộn, nhưng vẫn cần đếm cú bấm.
    var sel = 'a[href="#form"], a[href="#booking"], a[href$="/#booking"], a[href$="/#form"]';
    document.querySelectorAll(sel).forEach(function (a) {
      a.addEventListener('click', function (ev) {
        var h = a.getAttribute('href') || '';
        var id = h.slice(h.indexOf('#') + 1);
        var t = h.charAt(0) === '#' ? document.getElementById(id) : null;
        if (doTrack) track('booking_click', { method: 'form', click_source: source });
        if (!t) return;                       // link sang trang khác — để trình duyệt tự đi
        ev.preventDefault();
        try { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        catch (e) { t.scrollIntoView(); }
        // Đưa con trỏ vào ô đầu tiên, nhưng KHÔNG cuộn lần hai (preventScroll) kẻo
        // giật ngược lên giữa lúc đang cuộn mượt. Chờ một nhịp cho cuộn xong.
        setTimeout(function () {
          var f = document.getElementById('lfName');
          if (f) { try { f.focus({ preventScroll: true }); } catch (e) { } }
        }, 520);
      });
    });
  }

  /* ---------- 6. đo lượt bấm mọi link Zalo/IG trên trang ---------- */
  function initCtaTracking(source) {
    document.querySelectorAll('a[href*="zalo.me"]').forEach(function (a) {
      a.addEventListener('click', function () {
        track('booking_click', { method: 'zalo', click_source: source || 'page' });
      });
    });
    document.querySelectorAll('a[href*="instagram.com"]').forEach(function (a) {
      a.addEventListener('click', function () {
        track('booking_click', { method: 'instagram', click_source: source || 'page' });
      });
    });
  }

  /* ---------- 7. cảnh báo trình duyệt trong app (TikTok/IG/FB chặn zalo.me) ---------- */
  function initInAppBanner() {
    if (!/bytedancewebview|musical_ly|tiktok|FBAN|FBAV|Instagram/i.test(navigator.userAgent || '')) return;
    var b = document.createElement('div');
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:80;background:#1A0F08;color:#FAF7F2;' +
      'padding:11px 14px;font-size:13px;display:flex;gap:12px;align-items:center;justify-content:center;' +
      'flex-wrap:wrap;box-shadow:0 -4px 14px rgba(0,0,0,.3)';
    b.innerHTML = '<span>Zalo có thể không mở được trong app này — số của Kay: ' +
      '<b style="letter-spacing:.05em">0933 953 179</b></span>' +
      '<button id="iabCopy" style="background:#C4A882;border:none;color:#1A0F08;padding:7px 14px;font-size:12px;' +
      'letter-spacing:.1em;cursor:pointer;font-family:inherit">COPY SỐ</button>';
    document.body.appendChild(b);
    document.getElementById('iabCopy').addEventListener('click', function () {
      var btn = this;
      copyText('0933953179').then(function () {
        btn.textContent = 'ĐÃ COPY';
        // 13/09: copy số KHÔNG phải lead — không có gì vào D1. Đây là tương tác.
        track('booking_click', { method: 'phone_copy', click_source: 'inapp_banner' });
      });
    });
  }

  /* ---------- khởi động ---------- */
  window.KINKAY = {
    track: track,
    leadForm: leadForm,
    formCta: initFormCta,
    beforeAfter: beforeAfter,
    // Trang chu goi rieng nav() vi no da co reveal/banner in-app cua chinh no.
    nav: initNav,
    init: function (source) {
      initNav();
      initReveal();
      initCtaTracking(source);
      initFormCta(source);
      initInAppBanner();
    }
  };
})();
