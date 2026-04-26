/**
 * استخراج JSON من نصوص نماذج مع “تفكير” طويل — نأخذ آخر JSON صالح (ليس نفس سلوك extractJson).
 * يُستخدم فقط في مسار فواتير OCR.
 */
export function extractJsonFromOcrLlmText<T = Record<string, unknown>>(
  text: string,
): T | null {
  const raw = (text || '').replace(/^\uFEFF/, '').trim();
  if (!raw) return null;

  const allJsonBlocks: string[] = [];
  const mdMatches = raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/g);
  for (const m of mdMatches) allJsonBlocks.push(m[1].trim());

  let i = 0;
  while (i < raw.length) {
    if (raw[i] === '{') {
      let depth = 0;
      let end = -1;
      for (let j = i; j < raw.length; j++) {
        if (raw[j] === '{') depth++;
        else if (raw[j] === '}') {
          depth--;
          if (depth === 0) {
            end = j;
            break;
          }
        }
      }
      if (end !== -1) {
        allJsonBlocks.push(raw.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }
    i++;
  }

  for (const block of [...allJsonBlocks].reverse()) {
    try {
      const parsed = JSON.parse(block) as T;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* try next */
    }
  }
  return null;
}
