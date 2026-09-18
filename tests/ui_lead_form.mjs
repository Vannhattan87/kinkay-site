// AC-6 that: server tu choi -> giao dien KHONG bao thanh cong gia
// 18/09/2026 - go duong dan cung cua sandbox cu ('/home/claude/...') de test chay duoc
// tren CA hai may: sandbox dam may lan may cua Tan. Thu playwright cai san truoc,
// roi moi den duong dan npm-global cu.
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = (await import('/home/claude/.npm-global/lib/node_modules/playwright/index.js')).default); }
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const root = existsSync(resolve(here, '../static')) ? resolve(here, '../static') : '/home/claude/wR/static';
const srv = createServer((q, r) => {
  let p = q.url.split('?')[0];
  if (p.endsWith('/')) p += 'index.html';
  const f = root + p;
  if (!existsSync(f)) { r.writeHead(404); return r.end('nf'); }
  const ct = f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html';
  r.writeHead(200, { 'Content-Type': ct + '; charset=utf-8' });
  r.end(readFileSync(f));
}).listen(8733);

const b = await chromium.launch();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

async function run(label, status, body) {
  const pg = await b.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  let sent = null;
  await pg.route('**/api/lead', async route => {
    sent = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await pg.goto('http://127.0.0.1:8733/');
  await pg.waitForTimeout(700);
  await pg.selectOption('#lfOccasion', { index: 4 });        // "Tiệc / sự kiện"
  await pg.fill('#lfName', 'Test Khach');
  const ct = await pg.$('#lfContact'); if (ct) await ct.fill('0933953179');
  await pg.click('#leadForm button[type="submit"]').catch(() => pg.click('button[type="submit"]'));
  await pg.waitForTimeout(1500);
  // Chi doc VUNG THONG BAO CUA FORM, khong quet ca trang (chu marketing co the chua tu "thanh cong").
  const note = await pg.evaluate(() => {
    const f = document.querySelector('#leadForm') || document.querySelector('form');
    if (!f) return '';
    const box = f.parentElement || f;
    return (box.innerText || '').slice(0, 1200);
  });
  const btn = await pg.evaluate(() => {
    const b = document.querySelector('#leadForm button[type=submit]') || document.querySelector('button[type=submit]');
    return b ? { text: b.textContent.trim(), disabled: b.disabled } : null;
  });
  const txt = note + '\n[BTN]' + JSON.stringify(btn);
  await pg.close();
  return { sent, txt, errs };
}

console.log('\n1. Payload phai co occasion_key lay tu data-key');
{
  const { sent, errs } = await run('ok', 200, { ok: true, stored: true, duplicate: false });
  ok(errs.length === 0, 'loi JS: ' + errs.join('|'));
  ok(!!sent, 'form co goi /api/lead');
  ok(sent && sent.occasion_key === 'party_event', `occasion_key phai la party_event, nhan "${sent && sent.occasion_key}"`);
  ok(sent && sent.occasion === 'Tiệc / sự kiện', 'occasion (nhan hien thi) van gui nhu cu cho Zalo/GA4');
}

console.log('2. Server tra 400 unknown_occasion -> giao dien KHONG duoc bao thanh cong');
{
  const { txt, errs } = await run('400', 400, { ok: false, error: 'unknown_occasion' });
  ok(errs.length === 0, 'loi JS: ' + errs.join('|'));

  ok(/Gửi không thành công/i.test(txt), 'phai noi that: "Gửi không thành công"');
  ok(!/"text":"Đã gửi"/.test(txt), 'nut KHONG duoc doi thanh "Đã gửi" khi server tu choi');
  ok(/"disabled":false/.test(txt), 'nut phai mo khoa lai de khach thu lai duoc');
}

console.log('3. Server 500 -> cung khong duoc bao thanh cong');
{
  const { txt } = await run('500', 500, { ok: false, error: 'store_failed' });
  ok(/Gửi không thành công/i.test(txt) && !/"text":"Đã gửi"/.test(txt), 'khong bao thanh cong gia khi 500');
}

await b.close(); srv.close();
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
