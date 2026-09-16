// GET  /api/crm/translate          → { ok, available, model }  — có binding AI chưa, model nào đang dùng
// GET  /api/crm/translate?probe=1  → thử từng model trong danh sách, báo model nào chạy được
// POST /api/crm/translate          { text, kind:'tone'|'note' } → { ok, text, model }
//
// CR-20260916-36 · 16/09/2026. Duyệt: Tân.
//
// VÌ SAO CÓ ĐƯỜNG NÀY: khách của KINKAY gần như 100% người nước ngoài, Kay không mạnh tiếng
// Anh. Bộ chọn look trong admin lo được đa số ca vì look lặp lại; đường này chỉ lo phần Kay gõ
// tay ngoài bộ chọn.
//
// BỐN ĐIỀU KHÔNG ĐƯỢC QUÊN
//   1. Thiếu binding AI thì trả 503 gọn, KHÔNG ném lỗi. Admin đọc /GET rồi tự ẩn nút — Kay
//      không bao giờ thấy một nút bấm vào là hỏng.
//   2. TUYỆT ĐỐI KHÔNG trả status 502. Cloudflare THAY response 502 của Pages Function bằng
//      trang HTML "502 Bad gateway" của chính nó, nên câu báo lỗi tiếng Việt viết công phu đến
//      mấy cũng không tới được Kay — giao diện chỉ nhận được `Unexpected token '<'`. Đã dính
//      đúng lỗi này lúc chạy thử 16/09. Dùng 503.
//   3. DANH SÁCH MODEL, KHÔNG PHẢI MỘT MODEL. Catalogue Workers AI có khai tử model:
//      `@cf/meta/llama-3.1-8b-instruct` viết ngày 16/09 đã không còn trong catalogue và
//      `env.AI.run` ném ngay lập tức. Chạy lần lượt cho tới khi có model chạy được, rồi nhớ
//      lại trong isolate. Ngày Cloudflare khai tử model kế tiếp, nút Dịch tự tụt xuống model
//      sau chứ không chết.
//   4. Chữ dịch ra KHÔNG tự ghi vào database. Nó đổ vào ô cho Kay đọc rồi tự bấm Lưu. Máy dịch
//      sai tên riêng hoặc bịa thêm ý là chuyện có thật; giữa nó và khách phải có một con mắt.
//
// CHỈ dịch `tone` và `note` — hai field khách đọc. `liked` và `care` là ghi chép nghề của Kay
// về một người thật, không có lý do gì đi qua một model bên ngoài.
import { json, err, cleanStr } from './_lib.js';

/* Xếp theo chất lượng dịch Việt → Anh, không theo giá. Kay gõ tay vài câu một ngày, không phải
   vài nghìn; hạn mức free 10k neuron/ngày thừa sức. Chất lượng câu mới là thứ khách đọc. */
const MODELS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/meta/llama-3.1-8b-instruct-fp8'
];

let WORKING = null;   // model chạy được gần nhất, nhớ trong isolate

const SYS = {
  // Mồi viết theo giọng KINKAY: gọn, sang, không hoa mỹ, không bán hàng.
  tone: 'You are a bilingual beauty editor for KINKAY MAKEUP & HAIR, a high-end bridal and event makeup studio in Ho Chi Minh City. ' +
        'Translate the Vietnamese makeup/hair description into ONE polished English sentence (two at most) as it would read in a luxury salon note to the client. ' +
        'Use correct professional makeup and hair vocabulary. Keep it warm, precise and understated. ' +
        'Do not add products, brands, prices, compliments or anything not in the source. Do not use emoji. ' +
        'Reply with the English text only, no quotes, no preamble.',
  note: 'You are writing for KINKAY MAKEUP & HAIR, a high-end bridal and event makeup studio in Ho Chi Minh City. ' +
        'Translate the Vietnamese thank-you note to the client into natural, warm English, at the same length. ' +
        'Keep the client name exactly as written. Do not add offers, discounts, emoji or anything not in the source. ' +
        'Reply with the English text only, no quotes, no preamble.'
};

function tidy(s) {
  let out = cleanStr(s, 1500);
  if (!out) return null;
  // Model hay bọc ngoặc kép hoặc mở đầu bằng "Sure, here is...". Cắt ở đây, không bắt Kay xoá tay.
  out = out.replace(/^["'“‘]+|["'”’]+$/g, '').trim();
  out = out.replace(/^(sure|here(?:'s| is)|translation)\b[^\n:]*:\s*/i, '').trim();
  return out || null;
}

async function runOne(env, model, kind, text) {
  const r = await env.AI.run(model, {
    messages: [{ role: 'system', content: SYS[kind] }, { role: 'user', content: text }],
    max_tokens: 400, temperature: 0.2
  });
  return tidy(r && (r.response || r.result || ''));
}

export async function onRequestGet({ request, env }) {
  if (!env.AI) return json({ ok: true, available: false, model: null });

  // ?probe=1 — công cụ chẩn đoán, chạy tay khi nghi Cloudflare vừa khai tử model.
  if (new URL(request.url).searchParams.get('probe') === '1') {
    const out = [];
    for (const m of MODELS) {
      try { const t = await runOne(env, m, 'tone', 'Mắt nâu khói, môi đỏ cổ điển.'); out.push({ model: m, ok: !!t, sample: t }); }
      catch (e) { out.push({ model: m, ok: false, error: String(e && e.message || e).slice(0, 200) }); }
    }
    return json({ ok: true, available: true, probe: out });
  }
  return json({ ok: true, available: true, model: WORKING || MODELS[0] });
}

export async function onRequestPost({ request, env }) {
  if (!env.AI) return err('Chưa bật binding AI trên Cloudflare Pages. Bộ chọn look vẫn dùng bình thường.', 503);

  let body; try { body = await request.json(); } catch (e) { return err('JSON không hợp lệ'); }
  const kind = body && body.kind === 'note' ? 'note' : 'tone';
  const text = cleanStr(body && body.text, 1500);
  if (!text) return err('Chưa có chữ để dịch');

  // Model đã chạy được lần trước xếp lên đầu, phần còn lại là dự phòng.
  const order = WORKING ? [WORKING].concat(MODELS.filter(m => m !== WORKING)) : MODELS.slice();
  const tried = [];
  for (const model of order) {
    try {
      const out = await runOne(env, model, kind, text);
      if (!out) { tried.push(model + ': rỗng'); continue; }
      WORKING = model;
      return json({ ok: true, text: out, kind, model });
    } catch (e) {
      tried.push(model + ': ' + String(e && e.message || e).slice(0, 120));
    }
  }
  /* 503 chứ không phải 502 — xem ghi chú 2 ở đầu file. `detail` in ra tận nơi vì màn hình này
     nằm sau cổng đăng nhập và người đọc nó là người sẽ sửa nó. */
  return err('Máy dịch không chạy được lúc này. Kay dùng bộ chọn look hoặc gõ tay giúp.', 503, tried);
}
