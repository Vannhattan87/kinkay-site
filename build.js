// KINKAY site builder — chạy trên Cloudflare Pages (npm run build)
// static/ -> site/ (copy nguyên trạng), rồi sinh gallery.js, blog/, bloglist.js từ content/
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const SITE = 'site';
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ---------- 1. copy static -> site ----------
fs.rmSync(SITE, { recursive: true, force: true });
fs.cpSync('static', SITE, { recursive: true });
// 09/08/2026: /thu-look/ da GO khoi site (quyet dinh cua Tan — cong cu AR kho dung, khong hieu qua,
// thay bang muc Before/After tren trang chu). Thu muc static/thu-look co the van con trong repo
// (sandbox khong xoa duoc file tren mount) nhung KHONG duoc len production. _redirects 301 ve /.
fs.rmSync(path.join(SITE, 'thu-look'), { recursive: true, force: true });
console.log('copy static OK (da loai thu-look)');

// ---------- 2. resize ảnh upload quá lớn (sharp, optional) ----------
(async () => {
let sharp = null;
try { sharp = require('sharp'); } catch (e) { console.log('sharp không có — bỏ qua resize'); }
const upDir = path.join(SITE, 'assets', 'uploads');
if (sharp && fs.existsSync(upDir)) {
  for (const f of fs.readdirSync(upDir)) {
    const fp = path.join(upDir, f);
    if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
    try {
      const meta = await sharp(fp).metadata();
      if (Math.max(meta.width || 0, meta.height || 0) > 1600) {
        const buf = await sharp(fp).rotate().resize(1600, 1600, { fit: 'inside' }).jpeg({ quality: 82 }).toBuffer();
        fs.writeFileSync(fp, buf);
        console.log('resize:', f);
      }
    } catch (e) { console.log('resize lỗi (bỏ qua):', f, e.message); }
  }
}

// ---------- 2b. KIEM TRA: anh/video duoc tham chieu co thuc su ton tai khong ----------
// Ly do: 15/07/2026 phat hien gallery.json tro toi 5 anh Concept chua tung duoc commit
// -> live site hien anh vo ma khong ai biet. Tha build fail (Cloudflare giu ban deploy cu,
// khach van xem duoc web binh thuong) con hon day anh vo len production.
const errs = [];

const checkRef = (src, where) => {
  const s = String(src || '').trim();
  if (!s) return;
  if (/^https?:\/\//i.test(s)) return;              // link ngoai - khong kiem tra duoc
  const rel = decodeURIComponent(s.split(/[?#]/)[0]).replace(/^\/+/, '');
  if (!fs.existsSync(path.join(SITE, rel))) errs.push(where + ': KHONG co file "' + s + '"');
};

// 2b-1. anh trong gallery.json
const galRaw = JSON.parse(fs.readFileSync('content/gallery.json', 'utf8'));
for (const c of galRaw.categories || [])
  for (const src of c.images || []) checkRef(src, 'gallery.json [' + c.slug + ']');

// 2b-2. video trong videos.json
try {
  const vjRaw = JSON.parse(fs.readFileSync('content/videos.json', 'utf8'));
  for (const v of vjRaw.videos || [])
    checkRef(typeof v === 'string' ? v : (v && v.url), 'videos.json');
} catch (e) { /* khong co videos.json - muc 3b xu ly */ }

// 2b-3. anh cover cua bai blog
for (const f of (fs.existsSync('content/blog') ? fs.readdirSync('content/blog') : [])) {
  if (!/\.md$/i.test(f)) continue;
  const m = fs.readFileSync(path.join('content/blog', f), 'utf8').match(/^cover:\s*["']?(.+?)["']?\s*$/m);
  if (m) checkRef(m[1], 'blog/' + f);
}

// 2b-5. anh before/after (09/08/2026)
try {
  const baRaw = JSON.parse(fs.readFileSync('content/beforeafter.json', 'utf8'));
  for (const p of baRaw.items || []) {
    checkRef(p && p.before, 'beforeafter.json (before)');
    checkRef(p && p.after, 'beforeafter.json (after)');
  }
} catch (e) { /* chua co beforeafter.json - muc 3d xu ly */ }

// 2b-4. hai file chi khac nhau hoa/thuong -> Windows chi giu duoc 1 ban, repo dirty vinh vien
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const seen = new Map();
for (const f of walk(SITE)) {
  const k = f.toLowerCase();
  if (seen.has(k)) errs.push('TRUNG TEN hoa/thuong: "' + seen.get(k) + '" vs "' + f + '"');
  else seen.set(k, f);
}

if (errs.length) {
  console.error('\n=========== BUILD DUNG: ' + errs.length + ' loi tham chieu file ===========');
  errs.forEach(e => console.error('  - ' + e));
  console.error('\nCach xu ly: vao trang admin, xoa muc tro toi file thieu roi upload lai anh/video do.');
  console.error('Web dang chay KHONG bi anh huong - Cloudflare giu nguyen ban deploy gan nhat.\n');
  process.exit(1);
}
console.log('kiem tra tham chieu OK:', seen.size, 'file');

// ---------- 3. gallery.json -> gallery.js ----------
const gal = JSON.parse(fs.readFileSync('content/gallery.json', 'utf8'));
const G = { categories: gal.categories
  .filter(c => (c.images || []).length > 0)
  .map(c => ({ slug: c.slug, label_vi: c.label_vi, label_en: c.label_en,
               items: c.images.map(src => ({ src })) })) };
fs.writeFileSync(path.join(SITE, 'gallery.js'), 'window.GALLERY=' + JSON.stringify(G) + ';');
console.log('gallery.js:', G.categories.length, 'nhóm');

// ---------- 3b. videos.json -> videos.js ----------
let VID = [];
try {
  const vj = JSON.parse(fs.readFileSync('content/videos.json', 'utf8'));
  VID = (vj.videos || []).map(v => (typeof v === 'string' ? v : (v && v.url) || '')).map(u => String(u).trim()).filter(Boolean);
} catch (e) { console.log('videos.json không có — bỏ qua'); }
fs.writeFileSync(path.join(SITE, 'videos.js'), 'window.VIDEOS=' + JSON.stringify(VID) + ';');
console.log('videos.js:', VID.length, 'video');

// ---------- 3c. services.json -> services.js ----------
// Bảng giá và danh sách dịch vụ sửa được từ trang admin, không cần đụng code.
// show_prices=false thì mọi dòng giá biến mất khỏi web (quyết định thương mại, không phải kỹ thuật).
let SVC = { show_prices: false, items: [] };
try {
  SVC = JSON.parse(fs.readFileSync('content/services.json', 'utf8'));
  SVC.items = (SVC.items || []).filter(i => i && i.name);
} catch (e) { console.log('services.json không có — bỏ qua'); }
fs.writeFileSync(path.join(SITE, 'services.js'), 'window.SERVICES=' + JSON.stringify(SVC) + ';');
console.log('services.js:', SVC.items.length, 'dịch vụ · hiện giá:', !!SVC.show_prices);

// ---------- 3d. beforeafter.json -> beforeafter.js ----------
// 09/08/2026: muc Before/After tren trang chu (thay vai tro cua /thu-look/ da go).
// Chua co cap anh nao thi section tu an — Kay them cap dau tien qua admin la tu xuat hien.
let BA = { items: [] };
try {
  BA = JSON.parse(fs.readFileSync('content/beforeafter.json', 'utf8'));
  BA.items = (BA.items || []).filter(p => p && p.before && p.after);
} catch (e) { console.log('beforeafter.json không có — bỏ qua'); }
fs.writeFileSync(path.join(SITE, 'beforeafter.js'), 'window.BEFOREAFTER=' + JSON.stringify(BA) + ';');
console.log('beforeafter.js:', BA.items.length, 'cặp ảnh');

// ---------- 4. blog ----------
const CSS = fs.readFileSync('blog_theme.css', 'utf8');
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">'
 + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
 + '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Be+Vietnam+Pro:wght@300;400;500&display=swap" rel="stylesheet">';
const ICONS = '<link rel="icon" type="image/png" href="../favicon.png">';
const GA = '<script async src="https://www.googletagmanager.com/gtag/js?id=G-HMVQB181BH"></script>' +
  '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","G-HMVQB181BH");</script>';
// 08/08/2026: footer bài blog phải có thông tin chủ sở hữu (NĐ 52/2013 Điều 27) và link
// tới chính sách dữ liệu + điều khoản. Style inline vì blog_theme.css dùng chung cho cả
// trang index blog, không muốn đụng vào file css chỉ để thêm ba dòng.
// Tân cung cấp 08/08/2026: Thạch Bé Trâm. Dấu tiếng Việt do em thêm — Tân đối chiếu CCCD, khác thì sửa.
const FOOT = '<footer>KINKAY · a beauty atelier · HCMC'
  + '<div style="margin-top:14px;font-size:11px;line-height:1.9;opacity:.8;text-transform:none;letter-spacing:.04em">'
  + 'Chủ sở hữu website: Thạch Bé Trâm · Studio: Phường Tân Hưng, TP.HCM · 0933 953 179 · kinkay20t@gmail.com</div>'
  + '<div style="margin-top:10px;font-size:11.5px;text-transform:none;letter-spacing:.1em">'
  + '<a href="/chinh-sach-du-lieu/">Chính sách dữ liệu</a> · <a href="/dieu-khoan/">Điều khoản dịch vụ</a></div>'
  + '</footer>';
const bar = (back, label) => `<div class="bar"><a class="brand" href="../">KINKAY</a><a class="back" href="${back}">${label}</a></div>`;
const og = (title, desc, url, image, type) =>
  `<link rel="canonical" href="${url}"><meta property="og:type" content="${type}"><meta property="og:url" content="${url}">`
  + `<meta property="og:site_name" content="KINKAY"><meta property="og:title" content="${esc(title)}">`
  + `<meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${image}">`
  + `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}">`
  + `<meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${image}">`
  + '<meta name="theme-color" content="#1A0F08">';

const blogSchema = (p, url, ogImg) => '<script type="application/ld+json">' + JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": p.title,
  "description": p.excerpt,
  "image": ogImg,
  "datePublished": p.date,
  "dateModified": p.date,
  "inLanguage": "vi-VN",
  "author": { "@type": "Person", "name": "Kay", "url": "https://kinkay.vn/#kay" },
  "publisher": { "@type": "Organization", "name": "KINKAY", "logo": { "@type": "ImageObject", "url": "https://kinkay.vn/apple-touch-icon.png" } },
  "mainEntityOfPage": { "@type": "WebPage", "@id": url }
}) + '</script>';

function frontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const meta = {};
  if (!m) return { meta, body: raw };
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    meta[line.slice(0, i).trim()] = v;
  }
  return { meta, body: m[2] };
}
const monthVN = d => { const [y, mo] = d.split('-'); return `Tháng ${parseInt(mo)}, ${y}`; };

const posts = [];
for (const f of fs.readdirSync('content/blog')) {
  if (!f.endsWith('.md')) continue;
  const { meta, body } = frontmatter(fs.readFileSync(path.join('content/blog', f), 'utf8'));
  if (!meta.title || !meta.date) { console.log('bỏ qua (thiếu title/date):', f); continue; }
  posts.push({
    slug: f.replace(/\.md$/, ''),
    title: meta.title, date: meta.date, date_display: monthVN(meta.date),
    cover: meta.cover ? meta.cover.replace(/^\//, '') : 'assets/img/og_cover.jpg',
    excerpt: meta.excerpt || '', html: marked.parse(body)
  });
}
posts.sort((a, b) => b.date.localeCompare(a.date));

const blogDir = path.join(SITE, 'blog');
fs.rmSync(blogDir, { recursive: true, force: true });
fs.mkdirSync(blogDir, { recursive: true });

for (const p of posts) {
  const url = `https://kinkay.vn/blog/${encodeURI(p.slug)}`;
  const ogImg = `https://kinkay.vn/${p.cover}`;
  const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)} | KINKAY</title><meta name="description" content="${esc(p.excerpt)}">
${og(p.title, p.excerpt, url, ogImg, 'article')}${blogSchema(p, url, ogImg)}${ICONS}${FONTS}${GA}<style>${CSS}</style></head><body>
${bar('./', '← Blog')}
<article class="post">
  <div class="date eyebrow">${p.date_display}</div>
  <h1>${esc(p.title)}</h1>
  <img class="cover" src="../${p.cover}" alt="${esc(p.title)}">
  ${p.html}
  <div class="cta-box">
    <p>Bạn muốn một look như vậy cho dịp của mình? Kể Kay nghe — Kay tư vấn trước khi book.</p>
    <a class="btn" href="https://zalo.me/0933953179" id="bookCta" target="_blank" rel="noopener">Nhắn Zalo cho Kay</a>
    <p class="cta-alt"><a href="https://www.instagram.com/kinkay.official/" id="bookCtaIg" rel="noopener">Hoặc nhắn Instagram</a></p>
  </div>
</article>
${FOOT}
<script>
function track(n,p){ if(typeof gtag==='function') gtag('event',n,p||{}); }
document.getElementById('bookCta').addEventListener('click',function(){
  track('booking_click',{method:'zalo',source:'blog'});
});
document.getElementById('bookCtaIg').addEventListener('click',function(e){
  track('booking_click',{method:'instagram',source:'blog'});
  e.preventDefault();var t=Date.now();location.href='instagram://user?username=kinkay.official';
  setTimeout(function(){if(Date.now()-t<1600&&!document.hidden)location.href='https://www.instagram.com/kinkay.official/';},1200);
});
</script>
</body></html>`;
  fs.writeFileSync(path.join(blogDir, p.slug + '.html'), html);
}
console.log('blog:', posts.length, 'bài');

const cards = posts.map(p => `<a class="pcard" href="${encodeURI(p.slug)}">
  <img src="../${p.cover}" alt="${esc(p.title)}" loading="lazy">
  <div class="in"><div class="date">${p.date_display}</div><h2>${esc(p.title)}</h2><p>${esc(p.excerpt)}</p></div>
</a>`).join('\n');
const index = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Blog | KINKAY — a beauty atelier</title>
<meta name="description" content="Blog KINKAY — bí quyết makeup, hậu trường show và pageant, guide cho cô dâu từ Kay.">
${og('Blog | KINKAY', 'Bí quyết makeup, hậu trường show và guide cô dâu từ Kay.', 'https://kinkay.vn/blog/', 'https://kinkay.vn/assets/img/og_cover.jpg', 'website')}${ICONS}${FONTS}${GA}<style>${CSS}</style></head><body>
${bar('../', '← kinkay.vn')}
<div class="blog-head"><div class="eyebrow">KINKAY Journal</div><h1>Blog</h1></div>
<div class="cards">${cards}</div>
${FOOT}
</body></html>`;
fs.writeFileSync(path.join(blogDir, 'index.html'), index);

const mini = posts.slice(0, 3).map(p => ({ slug: p.slug, title: p.title, date: p.date_display, cover: p.cover, excerpt: p.excerpt }));
fs.writeFileSync(path.join(SITE, 'bloglist.js'), 'window.BLOG=' + JSON.stringify(mini) + ';');

// ---------- 4b. sinh lai khoi Journal (#jGrid) trong site/index.html ----------
// 08/08/2026. Van de: <div id="jGrid"> trong static/index.html chua 3 the <a> GO TAY,
// dong bang tu thang 6-7/2026. Ham renderJournal() o cuoi trang co ghi de khoi nay, nhung
// do la JavaScript chay khi trang da mo. Googlebot doc HTML tho TRUOC — no chi thay 3 bai cu.
// He qua: trang chu la trang manh nhat cua site (gan het impression), nhung khong truyen
// link noi bo cho bai nao moi, ke ca /blog/gia-makeup-co-dau-tphcm la bai duy nhat dang
// an query thuong mai. Cang viet bai moi, lo hong cang to.
// Day dung la loai loi da dinh hoi 01/08 voi link .html: sua JS ma quen ban pre-render la vo nghia.
//
// Cach lam: sau khi co posts, ghi de thang phan trong #jGrid cua site/index.html bang markup
// sinh tu 3 bai moi nhat. Giu nguyen cau truc the hien tai de khong dung toi CSS.
// Class co "in" (khac ban JS chi co "reveal") vi ban pre-render phai hien san khi chua co JS.
const idxPath = path.join(SITE, 'index.html');
let idxHtml = fs.readFileSync(idxPath, 'utf8');
// 08/08/2026 (dot 3): khoi Journal doi tu luoi anh sang danh sach chu (.jlist/.jrow)
// de cat chieu cao trang chu. Van giu link noi bo toi bai blog — day moi la thu dang can.
const JGRID_RE = /(<div class="jlist" id="jGrid">)[\s\S]*?<\/a>\s*<\/div>/;
if (!JGRID_RE.test(idxHtml)) {
  // Fail to chu khong im lang. Neu ai do doi markup #jGrid ma build van chay, trang chu se
  // am tham quay lai trang thai dong bang cu va khong ai biet trong nhieu tuan.
  console.error('\n=========== BUILD DUNG ===========');
  console.error('Khong tim thay khoi <div class="jgrid" id="jGrid">...</a></div> trong static/index.html.');
  console.error('Ai do da doi markup muc Journal. Sua lai JGRID_RE trong build.js cho khop,');
  console.error('dung bo qua — bo qua la trang chu quay ve trang thai hardcode cu.\n');
  process.exit(1);
}
const jcards = posts.slice(0, 3).map(p =>
  `\n    <a class="jrow" href="blog/${encodeURI(p.slug)}">` +
  `<span class="jd">${p.date_display}</span>` +
  `<span class="jt">${esc(p.title)}</span></a>`).join('');
idxHtml = idxHtml.replace(JGRID_RE, (m, open) => open + jcards + '</div>');

// ---------- 4b-2. pre-render gia dich vu vao #svcGrid ----------
// 10/08/2026. Cung dung loai loi voi jGrid, chi khac cho: gia 1.200.000d / 1.800.000d /
// 3.000.000-6.000.000d nam trong content/services.json va CHI duoc renderServices() gan vao
// khi JavaScript chay. HTML tho ma Googlebot doc khong he co mot con so nao.
// He qua do duoc: GSC tuan nay chi con DUNG 1 query thuong mai (tuan truoc 5), va 4/4 truy van
// kieu "gia makeup co dau" khong ra kinkay.vn. Trang chu la trang co 43 view — nhieu nhat site —
// nhung khach vao do khong thay gia; chi 4 nguoi mo bai blog gia.
// Cach lam: sinh lai the <div class="svc"> tu content.js (thu tu + text) ghep gia tu services.json,
// dung dung logic cua renderServices() de ban pre-render va ban JS khong lech nhau.
if (SVC && SVC.show_prices) {
  const SVCGRID_RE = /(<div class="svc-grid" id="svcGrid">)[\s\S]*?<\/div><\/div>/;
  if (!SVCGRID_RE.test(idxHtml)) {
    console.error('\n=========== BUILD DUNG ===========');
    console.error('Khong tim thay khoi <div class="svc-grid" id="svcGrid">...</div></div> trong static/index.html.');
    console.error('Ai do da doi markup muc Dich vu. Sua SVCGRID_RE trong build.js cho khop —');
    console.error('bo qua la gia bien mat khoi HTML tho va Google lai khong thay gia nua.\n');
    process.exit(1);
  }
  // Nap content.js bang sandbox nho. Khong dung require vi file viet cho trinh duyet (window.CONTENT).
  const win = {};
  new Function('window', fs.readFileSync(path.join(SITE, 'content.js'), 'utf8'))(win);
  const svcItems = ((win.CONTENT || {}).services || {}).items || [];
  if (!svcItems.length) {
    console.error('\n=========== BUILD DUNG ===========');
    console.error('content.js khong co CONTENT.services.items — khong pre-render duoc gia.\n');
    process.exit(1);
  }
  const byName = {};
  (SVC.items || []).forEach(it => { if (it && it.name) byName[String(it.name).trim().toLowerCase()] = it.price || ''; });
  const svcCards = svcItems.map((s, i) => {
    const key = String((s.title && (s.title.en || s.title.vi)) || '').trim().toLowerCase();
    const price = byName[key] || '';
    return `\n    <div class="svc reveal in" style="transition-delay:${i * 100}ms">` +
      `\n      <h3>${esc(s.title.vi)}</h3>` +
      `\n      <p>${esc(s.desc.vi)}</p>` +
      (price ? `\n      <div class="svc-price">${esc(price)}</div>` : '') +
      `\n    </div>`;
  }).join('');
  idxHtml = idxHtml.replace(SVCGRID_RE, (m, open) => open + svcCards + '</div>');
  const missing = svcItems.filter(s => !byName[String((s.title && (s.title.en || s.title.vi)) || '').trim().toLowerCase()]);
  console.log('svcGrid trang chu: pre-render', svcItems.length, 'dich vu · thieu gia:', missing.length);
} else {
  console.log('svcGrid trang chu: show_prices = false — khong pre-render gia (dung y do)');
}

fs.writeFileSync(idxPath, idxHtml);
console.log('jGrid trang chu:', posts.slice(0, 3).map(p => p.slug).join(', '));
// ---------- 4c. gan van ban (?v=hash) cho cac file du lieu ----------
// 08/08/2026. Su co that: sau khi deploy, trinh duyet nap index.html MOI nhung van dung
// content.js CU trong cache. Ban cu thieu key credits.caption -> renderCredits() nem loi,
// va vi no la ham DAU TIEN trong applyLang() nen moi thu phia sau chet theo: gia dich vu,
// portfolio, testimonial, journal deu khong render. Trang khong trang, chi degrade am tham.
//
// Cach chua goc: gan hash noi dung vao URL. index.html moi se tro toi content.js?v=<hash moi>,
// khong bao gio ghep duoc voi ban cu nua. Doi file -> doi hash -> trinh duyet bat buoc tai lai.
const crypto = require('crypto');
const DATA_JS = ['content.js', 'gallery.js', 'videos.js', 'services.js', 'bloglist.js', 'beforeafter.js'];
let idx2 = fs.readFileSync(idxPath, 'utf8');
for (const f of DATA_JS) {
  const fp = path.join(SITE, f);
  if (!fs.existsSync(fp)) continue;
  const h = crypto.createHash('sha1').update(fs.readFileSync(fp)).digest('hex').slice(0, 8);
  const re = new RegExp('src="' + f.replace('.', '\\.') + '(\\?v=[a-f0-9]+)?"', 'g');
  if (!re.test(idx2)) { console.log('  (bo qua, trang chu khong nap ' + f + ')'); continue; }
  idx2 = idx2.replace(re, 'src="' + f + '?v=' + h + '"');
}
fs.writeFileSync(idxPath, idx2);
console.log('gan ?v=hash cho', DATA_JS.length, 'file du lieu');

// ---------- 5. sitemap.xml ----------
// lastmod phải là ngày sửa THẬT của từng trang. Trước đây gán ngày build cho tất cả,
// nên mỗi lần deploy là khai "vừa sửa hết" — Google học được là lastmod của site này
// không đáng tin rồi bỏ qua luôn. Bài blog lấy date trong frontmatter, trang tĩnh lấy mtime file.
const mtime = f => {
  try { return fs.statSync(f).mtime.toISOString().slice(0, 10); }
  catch (e) { return new Date().toISOString().slice(0, 10); }
};
// URL không có đuôi .html: site bật pretty URL nên /blog/abc.html bị 301 sang /blog/abc.
// Sitemap và canonical phải khai đích cuối, không khai URL bị chuyển hướng.
const entries = [
  { loc: 'https://kinkay.vn/',            lastmod: mtime('static/index.html') },
  // 09/08/2026: /thu-look/ da go khoi sitemap — trang bi xoa, _redirects 301 ve trang chu.
  { loc: 'https://kinkay.vn/lich-cuoi/',   lastmod: mtime('static/lich-cuoi/index.html') },
  { loc: 'https://kinkay.vn/masterclass/', lastmod: mtime('static/masterclass/index.html') },
  // 08/08/2026: bổ sung hai trang pháp lý mới.
  // KHÔNG khai /danh-gia/ ở đây. Trang đó cố ý mang <meta name="robots" content="noindex">
  // (nó chỉ là bước đệm chuyển hướng khách sang form đánh giá Google). Khai một URL noindex
  // trong sitemap là tự mâu thuẫn — Search Console sẽ báo "Submitted URL marked noindex"
  // và làm bẩn thêm báo cáo Coverage vốn đã khó đọc của site này.
  { loc: 'https://kinkay.vn/chinh-sach-du-lieu/', lastmod: mtime('static/chinh-sach-du-lieu/index.html') },
  { loc: 'https://kinkay.vn/dieu-khoan/',  lastmod: mtime('static/dieu-khoan/index.html') },
  { loc: 'https://kinkay.vn/blog/',        lastmod: posts.length ? posts[0].date : mtime('static/index.html') }
].concat(posts.map(p => ({ loc: `https://kinkay.vn/blog/${encodeURI(p.slug)}`, lastmod: p.date })));
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  entries.map(e => `  <url><loc>${e.loc}</loc><lastmod>${e.lastmod}</lastmod></url>`).join('\n') +
  '\n</urlset>\n';
fs.writeFileSync(path.join(SITE, 'sitemap.xml'), sitemap);
console.log('sitemap.xml:', entries.length, 'url');
console.log('bloglist.js OK — BUILD XONG');
})();
