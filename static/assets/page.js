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
    function setOpen(li, on) {
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

  function leadForm(opts) {
    opts = opts || {};
    var form = document.getElementById(opts.formId || 'leadForm');
    if (!form) return;
    var box = document.getElementById(opts.msgId || 'leadMsg');
    var source = opts.source || 'page';

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var g = function (n) { var el = form.elements[n]; return el ? String(el.value || '').trim() : ''; };

      var d = {
        name: g('name'),
        occasion: g('occasion'),
        date: g('date'),
        place: g('place'),
        budget: g('budget'),
        note: g('note')
      };
      d.dateText = fmtDateVN(d.date);

      if (!d.name || !d.occasion) {
        if (box) {
          box.className = 'form-msg on form-err';
          box.innerHTML = 'Kay cần ít nhất <b>tên</b> và <b>dịp</b> để kiểm tra lịch giúp bạn.';
        }
        return;
      }

      var msg = buildMessage(d);
      var da = daysAhead(d.date);

      // Mở Zalo NGAY trong nhịp bấm nút — để chậm một nhịp là trình duyệt chặn popup.
      var w = window.open(ZALO, '_blank', 'noopener');

      track('generate_lead', {
        lead_type: 'booking_form',
        source: source,
        occasion: d.occasion,
        budget_band: d.budget || 'chua_chon',
        has_date: d.date ? 'yes' : 'no',
        days_ahead: da === null ? -1 : da
      });

      // Bản sao về server (không chặn trải nghiệm — lỗi thì bỏ qua).
      try {
        fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: d.name, occasion: d.occasion, date: d.date, place: d.place,
            budget: d.budget, note: d.note, source: source,
            page: location.pathname, ts: new Date().toISOString()
          }),
          keepalive: true
        }).catch(function () { });
      } catch (e) { }

      copyText(msg).then(function () {
        if (!box) return;
        box.className = 'form-msg on';
        box.innerHTML =
          '<b>Đã mở Zalo của Kay.</b> Tin nhắn đã được copy sẵn — bạn chỉ cần dán vào khung chat rồi gửi.' +
          '<div style="margin-top:12px;font-size:13.5px;white-space:pre-line;color:var(--taupe);' +
          'border-left:2px solid var(--gold);padding-left:12px">' + escHtml(msg) + '</div>' +
          '<div style="margin-top:12px"><a class="btn-line" href="' + ZALO + '" target="_blank" rel="noopener">' +
          'Mở lại Zalo</a></div>';
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      if (!w) {
        // Popup bị chặn (hay gặp trong trình duyệt trong app TikTok/IG).
        if (box) {
          box.className = 'form-msg on';
          box.innerHTML =
            '<b>Tin nhắn đã được copy.</b> Trình duyệt này chặn mở Zalo tự động — ' +
            'bạn nhắn Zalo <b>0933 953 179</b> rồi dán tin nhắn vào giúp Kay nhé.';
        }
      }
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
        if (!tracked) { tracked = true; track('ba_drag', { source: opts.source || 'page' }); }
      });
    });
  }

  /* ---------- 6. đo lượt bấm mọi link Zalo/IG trên trang ---------- */
  function initCtaTracking(source) {
    document.querySelectorAll('a[href*="zalo.me"]').forEach(function (a) {
      a.addEventListener('click', function () {
        track('booking_click', { method: 'zalo', source: source || 'page' });
      });
    });
    document.querySelectorAll('a[href*="instagram.com"]').forEach(function (a) {
      a.addEventListener('click', function () {
        track('booking_click', { method: 'instagram', source: source || 'page' });
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
        track('generate_lead', { lead_type: 'contact', contact_channel: 'phone_copy', source: 'inapp_banner' });
      });
    });
  }

  /* ---------- khởi động ---------- */
  window.KINKAY = {
    track: track,
    leadForm: leadForm,
    beforeAfter: beforeAfter,
    // Trang chu goi rieng nav() vi no da co reveal/banner in-app cua chinh no.
    nav: initNav,
    init: function (source) {
      initNav();
      initReveal();
      initCtaTracking(source);
      initInAppBanner();
    }
  };
})();
