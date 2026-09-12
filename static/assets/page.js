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

  /* ---------- 0. Ô LIÊN HỆ (12/09/2026) ----------
     VÌ SAO CÓ PHẦN NÀY. Trước 12/09 form KHÔNG hỏi liên hệ. functions/api/lead.js ghi
     thẳng `contact: null` vào CRM, nên cách duy nhất để gặp lại khách là chờ khách tự
     dán tin nhắn vào Zalo. Khách không dán là mất hẳn — đúng vụ KK-260912-001/002.
     Luật mới: liên hệ phải nằm trong D1 TRƯỚC khi khách rời trang. Zalo là chỗ nói
     chuyện, không phải chỗ lưu khách.

     KHÔNG ép Zalo. Khách nước ngoài chọn WhatsApp / Email / Instagram vẫn gửi được.
     `value` của <option> là mã cố định (zalo/whatsapp/email/instagram) và KHÔNG đổi
     theo ngôn ngữ — cùng lý do đã ghi ở form 01/09: value chạy theo ngôn ngữ thì báo
     cáo GA4 tách làm hai bộ và server phải đoán khách chọn gì. Chỉ CHỮ HIỆN RA mới
     đổi, và JS vẽ lại (xem paintContact) thay vì nhân đôi chuỗi trong 13 file HTML.

     Regex ở đây phải khớp với bản trong functions/api/lead.js. Sửa một bên là phải sửa
     cả hai — đúng cái bẫy đã dính với normName/normContact hôm 11/09. */
  var CONTACT = {
    zalo: {
      // Cố ý nới hơn "chỉ đầu số di động": 2 = cố định (028/024...), 3/5/7/8/9 = di động.
      // Chặt quá thì một khách thật có số lạ bị chặn không gửi được form — mất khách
      // đắt hơn nhiều so với một dòng rác trong CRM. Chạy SAU normContact nên +84 đã
      // thành 0 rồi.
      re: /^0(?:2|3|5|7|8|9)\d{7,9}$/,
      type: 'tel', ac: 'tel',
      opt: { vi: 'Zalo / Số điện thoại', en: 'Zalo / phone number' },
      lb: { vi: 'Số Zalo của bạn', en: 'Your Zalo number' },
      ph: { vi: '0901234567', en: '0901234567' },
      er: { vi: 'Số điện thoại Việt Nam chưa đúng. Ví dụ: 0901234567.',
            en: 'That is not a valid Vietnamese number. Example: 0901234567.' }
    },
    whatsapp: {
      re: /^\+[1-9]\d{6,14}$/,
      type: 'tel', ac: 'tel',
      opt: { vi: 'WhatsApp (kèm mã nước)', en: 'WhatsApp (with country code)' },
      lb: { vi: 'Số WhatsApp của bạn', en: 'Your WhatsApp number' },
      ph: { vi: '+14155550123', en: '+14155550123' },
      er: { vi: 'WhatsApp phải có mã nước. Ví dụ: +14155550123.',
            en: 'WhatsApp needs the country code. Example: +14155550123.' }
    },
    email: {
      re: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
      type: 'email', ac: 'email',
      opt: { vi: 'Email', en: 'Email' },
      lb: { vi: 'Email của bạn', en: 'Your email' },
      ph: { vi: 'ban@email.com', en: 'you@email.com' },
      er: { vi: 'Email chưa đúng.', en: 'That email does not look right.' }
    },
    instagram: {
      re: /^@[A-Za-z0-9._]{1,30}$/,
      type: 'text', ac: 'off',
      opt: { vi: 'Instagram', en: 'Instagram' },
      lb: { vi: 'Instagram của bạn', en: 'Your Instagram' },
      ph: { vi: '@tenban', en: '@yourhandle' },
      er: { vi: 'Handle Instagram chưa đúng. Ví dụ: @kinkay.official.',
            en: 'That Instagram handle does not look right. Example: @kinkay.official.' }
    }
  };

  function lang2() {
    return String(document.documentElement.lang || 'vi').slice(0, 2) === 'en' ? 'en' : 'vi';
  }

  /* Chuẩn hoá TRƯỚC khi validate và trước khi gửi đi, để một khách gõ "0933 953 179",
     "+84933953179" hay "0084933953179" đều thành đúng một chuỗi trong CRM. Nếu không,
     chống trùng bên server nhìn ba chuỗi khác nhau và tạo ba khách. */
  function normContact(ch, v) {
    v = String(v == null ? '' : v).trim();
    if (!v) return '';
    if (ch === 'zalo') {
      v = v.replace(/[\s.()‐-―-]/g, '');
      v = v.replace(/^\+?84/, '0').replace(/^0084/, '0');
      return v;
    }
    if (ch === 'whatsapp') {
      v = v.replace(/[\s.()‐-―-]/g, '').replace(/^00/, '+');
      if (v.charAt(0) !== '+') v = '+' + v;
      return v;
    }
    if (ch === 'email') return v.toLowerCase();
    if (ch === 'instagram') {
      v = v.replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, '').replace(/[\/?#].*$/, '').trim();
      v = v.replace(/^@+/, '');
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
  function paintContact(form, forceDefault) {
    var sel = form.elements['channel'], inp = form.elements['contact'];
    if (!sel || !inp) return;
    var L = lang2();

    // Khách chưa tự chọn kênh thì mặc định đi theo ngôn ngữ: VI -> Zalo, EN -> Email.
    // Người nước ngoài không có Zalo, còn email thì Kay chắc chắn trả lời được.
    if (forceDefault && !sel.dataset.touched) sel.value = (L === 'en' ? 'email' : 'zalo');
    if (!CONTACT[sel.value]) sel.value = 'zalo';

    Array.prototype.forEach.call(sel.options, function (o) {
      if (CONTACT[o.value]) o.textContent = CONTACT[o.value].opt[L];
    });

    var c = CONTACT[sel.value];
    var lab = form.querySelector('[data-lf="contactLabel"]');
    if (lab) lab.textContent = c.lb[L];
    var clab = form.querySelector('[data-lf="channelLabel"]');
    if (clab) clab.textContent = (L === 'en' ? 'How should Kay reply to you?' : 'Kay liên hệ lại bạn bằng');
    inp.placeholder = c.ph[L];
    inp.setAttribute('autocomplete', c.ac);
    // type đổi theo kênh để điện thoại bật đúng bàn phím. Form có novalidate nên
    // type="email" không sinh thêm bong bóng lỗi của trình duyệt chồng lên lỗi của mình.
    try { inp.type = c.type; } catch (e) { }
  }

  function leadForm(opts) {
    opts = opts || {};
    var form = document.getElementById(opts.formId || 'leadForm');
    if (!form) return;
    var box = document.getElementById(opts.msgId || 'leadMsg');
    var source = opts.source || 'page';
    var chSel = form.elements['channel'];
    var btn = form.querySelector('button[type="submit"]');
    var btnText = btn ? btn.textContent : '';
    var sending = false;

    if (chSel) {
      chSel.addEventListener('change', function () {
        chSel.dataset.touched = '1';
        paintContact(form, false);
      });
      paintContact(form, true);
      // Trang chủ đổi ngôn ngữ bằng applyLang() -> đổi <html lang>. Theo dõi thuộc tính
      // đó thay vì bắt applyLang() phải biết tới form, để hai bên không dính vào nhau.
      try {
        new MutationObserver(function () { paintContact(form, true); })
          .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      } catch (e) { }
    }

    function fail(html) {
      if (!box) return;
      box.className = 'form-msg on form-err';
      box.innerHTML = html;
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (sending) return;                       // chặn bấm hai lần -> hai lead y hệt nhau
      var L = lang2();
      var g = function (n) { var el = form.elements[n]; return el ? String(el.value || '').trim() : ''; };

      var d = {
        name: g('name'),
        channel: g('channel') || 'zalo',
        contact: '',
        occasion: g('occasion'),
        date: g('date'),
        place: g('place'),
        budget: g('budget'),
        note: g('note')
      };
      var c = CONTACT[d.channel] || CONTACT.zalo;
      d.contact = normContact(d.channel, g('contact'));
      d.dateText = fmtDateVN(d.date);

      if (!d.name || !d.occasion) {
        return fail(L === 'en'
          ? 'Kay needs at least your <b>name</b> and the <b>occasion</b>.'
          : 'Kay cần ít nhất <b>tên</b> và <b>dịp</b> để kiểm tra lịch giúp bạn.');
      }
      // Bắt buộc có liên hệ. Đây là thay đổi chính của 12/09: thà mất một form
      // dở dang còn hơn có một lead mà không ai gọi lại được.
      if (!d.contact) {
        return fail(L === 'en'
          ? 'Please leave a contact so Kay can reply to you.'
          : 'Bạn để lại liên hệ giúp Kay nhé, không có thì Kay không trả lời bạn được.');
      }
      if (!c.re.test(d.contact)) return fail(escHtml(c.er[L]));

      var msg = buildMessage(d);
      var da = daysAhead(d.date);
      var toZalo = d.channel === 'zalo';

      // Chỉ mở Zalo khi khách chọn Zalo. Mở NGAY trong nhịp bấm nút — để chậm một
      // nhịp là trình duyệt chặn popup. Khách chọn kênh khác thì không mở gì cả:
      // liên hệ đã nằm trong CRM rồi, Kay chủ động nhắn lại.
      var w = toZalo ? window.open(ZALO, '_blank', 'noopener') : null;

      sending = true;
      if (btn) { btn.disabled = true; btn.textContent = (L === 'en' ? 'Sending...' : 'Đang gửi...'); }

      track('generate_lead', {
        lead_type: 'booking_form',
        // 26/08/2026: KHONG duoc dat ten param la `source`. Do la ten danh rieng cua GA4
        // (cung ho voi medium/campaign/term/content) — GA4 lay no ghi de attribution cua
        // session, sinh ra kenh "Unassigned" va thoi phong so session. Dung `click_source`.
        click_source: source,
        contact_channel: d.channel,
        occasion: d.occasion,
        budget_band: d.budget || 'chua_chon',
        has_date: d.date ? 'yes' : 'no',
        days_ahead: da === null ? -1 : da
      });

      // Gửi về server. Từ 12/09 đây KHÔNG còn là "bản sao" — nó là đường giữ khách
      // chính, vì nó là chỗ duy nhất có liên hệ của khách. Lỗi thì vẫn không được
      // làm hỏng trang, nhưng phải nói thật với khách là chưa gửi được.
      var done = function (ok) {
        sending = false;
        if (btn) { btn.disabled = false; btn.textContent = btnText; }
        if (!box) return;
        if (!ok) {
          return fail(L === 'en'
            ? '<b>Could not send.</b> Please message Kay on Zalo <b>+84 933 953 179</b> or ' +
              'email <b>kinkay20t@gmail.com</b> — sorry about this.'
            : '<b>Gửi không thành công.</b> Bạn nhắn giúp Kay qua Zalo <b>0933 953 179</b> ' +
              'hoặc email <b>kinkay20t@gmail.com</b> nhé.');
        }
        box.className = 'form-msg on';
        if (toZalo) {
          box.innerHTML =
            (w ? '<b>Đã mở Zalo của Kay.</b> Tin nhắn đã được copy sẵn — bạn chỉ cần dán vào khung chat rồi gửi.'
               : '<b>Đã nhận thông tin của bạn.</b> Trình duyệt này chặn mở Zalo tự động — ' +
                 'bạn nhắn Zalo <b>0933 953 179</b> và dán tin nhắn đã copy vào giúp Kay nhé.') +
            '<div style="margin-top:8px">Kay đã có số của bạn rồi, nếu bạn chưa kịp nhắn thì Kay chủ động gọi lại.</div>' +
            '<div style="margin-top:12px;font-size:13.5px;white-space:pre-line;color:var(--taupe);' +
            'border-left:2px solid var(--gold);padding-left:12px">' + escHtml(msg) + '</div>' +
            '<div style="margin-top:12px"><a class="btn-line" href="' + ZALO + '" target="_blank" rel="noopener">' +
            'Mở lại Zalo</a></div>';
        } else {
          box.innerHTML = L === 'en'
            ? '<b>Thank you, ' + escHtml(d.name) + '.</b> Kay has your ' + escHtml(c.opt.en) +
              ' <b>' + escHtml(d.contact) + '</b> and will reply within the day.'
            : '<b>Cảm ơn bạn ' + escHtml(d.name) + '.</b> Kay đã nhận ' + escHtml(c.opt.vi) +
              ' <b>' + escHtml(d.contact) + '</b> của bạn và sẽ trả lời trong ngày.';
        }
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };

      try {
        fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: d.name, channel: d.channel, contact: d.contact,
            kk_hp: g('kk_hp'),          // bẫy bot — người thật luôn để trống ô này
            occasion: d.occasion, date: d.date, place: d.place,
            budget: d.budget, note: d.note, source: source,
            page: location.pathname, ts: new Date().toISOString()
          })
        }).then(function (r) { done(r && r.status < 400); })
          .catch(function () { done(false); });
      } catch (e) { done(false); }

      // Khách chọn Zalo thì vẫn copy sẵn tin nhắn ngay, không chờ server.
      if (toZalo) copyText(msg);
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
        track('generate_lead', { lead_type: 'contact', contact_channel: 'phone_copy', click_source: 'inapp_banner' });
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
