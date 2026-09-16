// GET  /api/crm/translate   → { ok, available }   — có binding AI hay chưa
// POST /api/crm/translate   { text, kind:'tone'|'note' } → { ok, text }
//
// CR-20260916-36 · 16/09/2026. Duyệt: Tân.
//
// VÌ SAO CÓ ĐƯỜNG NÀY: khách của KINKAY gần như 100% người nước ngoài, Kay không mạnh tiếng
// Anh. Bộ chọn look trong admin lo được đa số ca vì look lặp lại; đường này chỉ lo phần Kay gõ
// tay ngoài bộ chọn.
//
// BA ĐIỀU KHÔNG ĐƯỢC QUÊN
//   1. Thiếu binding AI thì trả 501 gọn, KHÔNG ném lỗi 500. Admin đọc /GET rồi tự ẩn nút —
//      Kay không bao giờ thấy một nút bấm vào là hỏng.
//   2. Chữ dịch ra KHÔNG tự ghi vào database. Nó đổ vào ô cho Kay đọc rồi tự bấm Lưu. Máy dịch
//      sai tên riêng hoặc bịa thêm ý là chuyện có thật; giữa nó và khách phải có một con mắt.
//   3. CHỈ dịch `tone` và `note` — hai field khách đọc. `liked` và `care` là ghi chép nghề của
//      Kay về một người thật, không có lý do gì đi qua một model bên ngoài.
import { json, err, cleanStr } from './_lib.js';

const MODEL = '@cf/meta/llama-3.1-8b-instruct';

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

export async function onRequestGet({ env }) {
  return json({ ok: true, available: !!env.AI, model: env.AI ? MODEL : null });
}

export async function onRequestPost({ request, env }) {
  if (!env.AI) return err('Chưa bật binding AI trên Cloudflare Pages. Bộ chọn look vẫn dùng bình thường.', 501);

  let body; try { body = await request.json(); } catch (e) { return err('JSON không hợp lệ'); }
  const kind = body && body.kind === 'note' ? 'note' : 'tone';
  const text = cleanStr(body && body.text, 1500);
  if (!text) return err('Chưa có chữ để dịch');

  let out = null;
  try {
    const r = await env.AI.run(MODEL, {
      messages: [{ role: 'system', content: SYS[kind] }, { role: 'user', content: text }],
      max_tokens: 400, temperature: 0.2
    });
    out = cleanStr(r && (r.response || r.result || ''), 1500);
  } catch (e) {
    // Model hết hạn mức / quá tải là chuyện thường. Nói thật để Kay biết gõ tay, đừng bấm lại 10 lần.
    return err('Máy dịch không trả lời được lúc này. Kay dùng bộ chọn look hoặc gõ tay giúp.', 502);
  }
  if (!out) return err('Máy dịch trả về rỗng. Thử rút ngắn câu tiếng Việt rồi dịch lại.', 502);

  // Model hay bọc ngoặc kép hoặc mở đầu bằng "Sure, here is...". Cắt ở đây, không bắt Kay xoá tay.
  out = out.replace(/^["'“‘]+|["'”’]+$/g, '').trim();
  out = out.replace(/^(sure|here(?:'s| is)|translation)\b[^\n:]*:\s*/i, '').trim();

  return json({ ok: true, text: out, kind });
}
