/**
 * استخراج أول كائن JSON من نص — يتعامل مع BOM وكتل markdown.
 * تُستبدل نسخاً مكررة في app.service / gemini.service.
 */
export function extractJson<T = Record<string, unknown>>(text: string): T | null {
  let t = String(text || '')
    .replace(/^\uFEFF/, '')
    .trim();
  if (!t) return null;

  const codeBlockMatch = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) t = codeBlockMatch[1].trim();

  const start = t.indexOf('{');
  if (start >= 0) {
    let depth = 0;
    for (let i = start; i < t.length; i++) {
      if (t[i] === '{') depth++;
      else if (t[i] === '}') {
        depth--;
        if (depth === 0) {
          const jsonStr = t.slice(start, i + 1);
          try {
            return JSON.parse(jsonStr) as T;
          } catch {
            try {
              const fixed = jsonStr.replace(/(\w+):\s*'([^']*)'/g, '"$1":"$2"');
              return JSON.parse(fixed) as T;
            } catch {
              break;
            }
          }
        }
      }
    }
  }
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}
