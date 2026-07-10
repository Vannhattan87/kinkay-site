// KINKAY site builder — chạy trên Netlify (npm run build)
// static/ -> site/ (copy nguyên trạng), rồi sinh gallery.js, blog/, bloglist.js từ content/
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const SITE = 'site';
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ---------- 1. copy static -> site ----------
fs.rmSync(SITE, { recursive: true, force: true });
fs.cpSync('static', SITE, { recursive: true });
console.log('copy static OK');

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

// ---------- 4. blog ----------
const CSS = fs.readFileSync('blog_theme.css', 'utf8');
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">'
 + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
 + '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Be+Vietnam+Pro:wght@300;400;500&display=swap" rel="stylesheet">';
const ICONS = '<link rel="icon" type="image/png" href="../favicon.png">';
const GA = '<script async src="https://www.googletagmanager.com/gtag/js?id=G-HMVQB181BH"></script>' +
  '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","G-HMVQB181BH");</script>';
const FOOT = '<footer>KINKAY · a beauty atelier · HCMC</footer>';
const bar = (back, label) => `<div class="bar"><a class="brand" href="../">KINKAY</a><a class="back" href="${back}">${label}</a></div>`;
const og = (title, desc, url, image, type) =>
  `<link rel="canonical" href="${url}"><meta property="og:type" content="${type}"><meta property="og:url" content="${url}">`
  + `<meta property="og:site_name" content="KINKAY"><meta property="og:title" content="${esc(title)}">`
  + `<meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${image}">`
  + `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}">`
  + `<meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${image}">`
  + '<meta name="theme-color" content="#1A0F08">';

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
  const url = `https://kinkay.vn/blog/${p.slug}.html`;
  const ogImg = `https://kinkay.vn/${p.cover}`;
  const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)} | KINKAY</title><meta name="description" content="${esc(p.excerpt)}">
${og(p.title, p.excerpt, url, ogImg, 'article')}${ICONS}${FONTS}${GA}<style>${CSS}</style></head><body>
${bar('./', '← Blog')}
<article class="post">
  <div class="date eyebrow">${p.date_display}</div>
  <h1>${esc(p.title)}</h1>
  <img class="cover" src="../${p.cover}" alt="${esc(p.title)}">
  ${p.html}
  <div class="cta-box">
    <p>Bạn muốn một look như vậy cho dịp của mình? Kể Kay nghe — Kay tư vấn trước khi book.</p>
    <a class="btn" href="https://www.instagram.com/kinkay.official/" id="bookCta">Nhắn Kay trên Instagram</a>
  </div>
</article>
${FOOT}
<script>
document.getElementById('bookCta').addEventListener('click',function(e){
  e.preventDefault();var t=Date.now();location.href='instagram://user?username=kinkay.official';
  setTimeout(function(){if(Date.now()-t<1600&&!document.hidden)location.href='https://www.instagram.com/kinkay.official/';},1200);
});
</script>
</body></html>`;
  fs.writeFileSync(path.join(blogDir, p.slug + '.html'), html);
}
console.log('blog:', posts.length, 'bài');

const cards = posts.map(p => `<a class="pcard" href="${p.slug}.html">
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
// ---------- 5. sitemap.xml ----------
const today = new Date().toISOString().slice(0, 10);
const urls = ['https://kinkay.vn/', 'https://kinkay.vn/blog/']
  .concat(posts.map(p => `https://kinkay.vn/blog/${p.slug}.html`));
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
  '\n</urlset>\n';
fs.writeFileSync(path.join(SITE, 'sitemap.xml'), sitemap);
console.log('sitemap.xml:', urls.length, 'url');
console.log('bloglist.js OK — BUILD XONG');
})();
