/* ==========================================================================
   en-notice.js — 02/09/2026
   Nut EN o trang chu chi dich TAI CHO trang chu (data-t). Bam vao bat ky link nao
   la roi xuong trang tieng Viet, khach nuoc ngoai tuong web hong. Cum /en/ (6 trang)
   la he thong rieng, co URL that va hreflang — day moi la ban tieng Anh "chinh".

   File nay chay tren MOI trang tieng Viet (khong chay trong /en/):
   1. Doc ?lang=vi|en tren URL (link "Tieng Viet" trong /en/ tro ve /?lang=vi),
      luu vao localStorage roi xoa param khoi URL.
   2. Neu khach da chon EN (localStorage kk_lang = 'en') -> chen mot dai mong tren
      cung trang: "This page is in Vietnamese" + link sang trang /en/ tuong ung
      (neu co) hoac hub /en/. Nut "Continue in Vietnamese" doi lai kk_lang = 'vi'.

   Khong dung ten param 'source' cho GA4 (no ghi de attribution). Bar chen static
   (khong fixed) de khong de len nav cua tung trang.
   ========================================================================== */
(function () {
  try {
    var path = location.pathname;
    if (path.indexOf('/en/') === 0) return;

    var KEY = 'kk_lang';
    var TTL = 30 * 24 * 3600 * 1000; // 18/09/2026 — lua chon ngon ngu het han sau 30 ngay
    function getLang() {
      try {
        var v = localStorage.getItem(KEY);
        if (!v) return null;
        var at = parseInt(localStorage.getItem(KEY + "_at") || "0", 10);
        if (at && (Date.now() - at) > TTL) { localStorage.removeItem(KEY); localStorage.removeItem(KEY + "_at"); return null; }
        return v;
      } catch (e) { return null; }
    }
    function setLang(v) { try { localStorage.setItem(KEY, v); localStorage.setItem(KEY + "_at", String(Date.now())); } catch (e) {} }
    function ga(name, params) { if (typeof gtag === 'function') gtag('event', name, params || {}); }

    // (1) ?lang= tren URL thang moi thu, roi bien mat khoi URL.
    try {
      var u = new URL(location.href);
      var q = u.searchParams.get('lang');
      if (q === 'vi' || q === 'en') {
        setLang(q);
        u.searchParams.delete('lang');
        history.replaceState(null, '', u.pathname + u.search + u.hash);
      }
    } catch (e) {}

    if (getLang() !== 'en') return;
    if (path === '/' || path === '/index.html') return; // trang chu tu dich, khong can dai

    // (2) trang tieng Viet nao co ban /en/ tuong ung
    var MAP = {
      '/chinh-sach-du-lieu/': '/en/privacy/',
      '/makeup-co-dau/': '/en/bridal/',
      '/trang-diem-du-tiec/': '/en/events/',
      '/photoshoot-editorial/': '/en/ao-dai-photoshoot/',
      '/blog/gia-makeup-co-dau-tphcm': '/en/pricing/',
      '/blog/gia-makeup-co-dau-tphcm/': '/en/pricing/'
    };
    var target = MAP[path] || '/en/';
    if (path === '/photoshoot-editorial/' && location.hash === '#profile') target = '/en/headshots/';
    var exact = !!MAP[path];

    var bar = document.createElement('div');
    bar.id = 'enNotice';
    bar.setAttribute('lang', 'en');
    bar.style.cssText = 'background:#1A0F08;color:#FAF7F2;padding:10px 16px;font-size:13px;line-height:1.5;' +
      'display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap;text-align:center;' +
      'font-family:"Be Vietnam Pro",system-ui,sans-serif;letter-spacing:.02em';
    bar.innerHTML =
      '<span>This page is in Vietnamese.</span>' +
      '<a id="enNoticeGo" href="' + target + '" style="color:#C4A882;text-decoration:underline;text-underline-offset:3px">' +
        (exact ? 'Read it in English →' : 'English pages →') + '</a>' +
      '<button id="enNoticeVi" type="button" style="background:none;border:1px solid rgba(250,247,242,.35);color:#FAF7F2;' +
        'padding:4px 10px;font-size:12px;cursor:pointer;font-family:inherit;letter-spacing:.04em">Continue in Vietnamese</button>';

    function mount() {
      if (!document.body) return;
      document.body.insertBefore(bar, document.body.firstChild);
      ga('en_notice_shown', { page_path: path, has_en_page: exact ? 'yes' : 'no' });
      document.getElementById('enNoticeGo').addEventListener('click', function () {
        ga('en_entry_click', { click_source: 'en_notice', page_path: path });
      });
      document.getElementById('enNoticeVi').addEventListener('click', function () {
        setLang('vi');
        bar.parentNode && bar.parentNode.removeChild(bar);
        ga('lang_switch', { to_lang: 'vi', click_source: 'en_notice' });
      });
    }
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  } catch (e) { console.error('[KINKAY] en-notice loi:', e); }
})();
