/* tools/fetch-fonts.js — CHAY MOT LAN, khong phai moi lan build.
 *
 * Muc dich: go bo phu thuoc fonts.googleapis.com.
 * Do 13/08/2026: sau khi sua LCP (commit 0f50fe4) thi LCP mobile con 3,8s nhung
 * FCP van dung o 3,3s. Tai nguyen chan render duy nhat con lai la the <link> font
 * tro sang fonts.googleapis.com — mot domain thu ba, ton tron mot vong DNS + TLS
 * + request TRUOC KHI trinh duyet duoc phep ve bat cu thu gi.
 *
 * Script nay tai woff2 ve may, chi lay subset latin + vietnamese (bo latin-ext,
 * cyrillic, greek... vi site khong dung), roi sinh san khoi @font-face tro toi
 * duong dan noi bo.
 *
 * Chay:  node tools/fetch-fonts.js
 * Ket qua:
 *   static/assets/fonts/*.woff2
 *   static/assets/fonts/fonts.css        (de tham khao)
 *   static/assets/fonts/_inline-block.html  (khoi de dan vao <head>)
 */

const fs = require('fs');
const path = require('path');

const CSS_URL = 'https://fonts.googleapis.com/css2'
  + '?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400'
  + '&family=Be+Vietnam+Pro:wght@300;400;500'
  + '&display=swap';

// Google tra ve woff2 chi khi User-Agent la trinh duyet doi moi.
// De trong thi no tra ve ttf, nang gap 3 lan.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const KEEP = ['latin', 'vietnamese'];   // subset can giu
const OUT  = path.join('static', 'assets', 'fonts');

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

(async () => {
  console.log('Tai CSS tu Google Fonts...');
  const css = await fetch(CSS_URL, { headers: { 'User-Agent': UA } }).then(r => {
    if (!r.ok) throw new Error('CSS loi HTTP ' + r.status);
    return r.text();
  });

  // Google dat comment /* subset */ NGAY TRUOC moi khoi @font-face.
  // Phai bat theo cap comment+block, khong duoc tach roi — tach roi la lech mot nhip
  // va gan sai subset cho tung file (da dinh loi nay khi do bang tay).
  const re = /\/\*\s*([a-z0-9\-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g;
  const faces = [];
  let m;
  while ((m = re.exec(css)) !== null) {
    const subset = m[1];
    const body   = m[2];
    if (!KEEP.includes(subset)) continue;
    const family = (body.match(/font-family:\s*'([^']+)'/) || [])[1];
    const weight = (body.match(/font-weight:\s*(\d+)/) || [])[1] || '400';
    const style  = (body.match(/font-style:\s*(\w+)/) || [])[1] || 'normal';
    const url    = (body.match(/url\(([^)]+)\)\s*format\('woff2'\)/) || [])[1];
    const range  = (body.match(/unicode-range:\s*([^;]+);/) || [])[1];
    if (!family || !url) continue;
    faces.push({ family, weight, style, subset, url, range: (range || '').trim() });
  }

  if (!faces.length) throw new Error('Khong doc duoc @font-face nao — Google doi format CSS?');
  console.log('Tim thay ' + faces.length + ' font face (subset: ' + KEEP.join(', ') + ')');

  fs.mkdirSync(OUT, { recursive: true });

  let total = 0;
  const rules = [];
  for (const f of faces) {
    const name = slug(f.family) + '-' + f.weight + (f.style === 'italic' ? 'i' : '') + '-' + f.subset + '.woff2';
    const dest = path.join(OUT, name);
    const buf = Buffer.from(await fetch(f.url, { headers: { 'User-Agent': UA } }).then(r => r.arrayBuffer()));
    fs.writeFileSync(dest, buf);
    total += buf.length;
    console.log('  ' + name.padEnd(42) + (buf.length / 1024).toFixed(1) + ' KB');
    rules.push(
      '@font-face{font-family:\'' + f.family + '\';font-style:' + f.style + ';font-weight:' + f.weight + ';'
      + 'font-display:swap;src:url(/assets/fonts/' + name + ') format(\'woff2\');'
      + (f.range ? 'unicode-range:' + f.range + ';' : '') + '}'
    );
  }

  const cssOut = '/* Sinh boi tools/fetch-fonts.js — dung sua tay. Chay lai script de cap nhat. */\n'
    + rules.join('\n') + '\n';
  fs.writeFileSync(path.join(OUT, 'fonts.css'), cssOut);
  fs.writeFileSync(path.join(OUT, '_inline-block.html'), '<style>' + rules.join('') + '</style>\n');

  console.log('\nTONG: ' + faces.length + ' file, ' + (total / 1024).toFixed(1) + ' KB');
  console.log('Da ghi: ' + OUT + '/fonts.css va _inline-block.html');
  console.log('\nXONG. Nhan cho Claude de thay the the <link> font trong 25 file HTML.');
})().catch(e => { console.error('LOI:', e.message); process.exit(1); });
