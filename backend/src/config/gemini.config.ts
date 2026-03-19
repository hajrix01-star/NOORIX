/**
 * Gemini API Configuration
 * يقرأ المفتاح من ملف البيئة بشكل آمن — لا يُعرض أبداً للواجهة
 *
 * الاستخدام: استيراد getGeminiApiKey() أو isGeminiAvailable()
 */

/** المفتاح للاستخدام الداخلي فقط — لا يُمرّر للعميل */
export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || typeof key !== 'string') return null;
  const trimmed = key.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** اسم النموذج — يمكن تخصيصه عبر GEMINI_MODEL في .env */
export function getGeminiModel(): string {
  const m = process.env.GEMINI_MODEL?.trim();
  return m && m.length > 0 ? m : 'gemini-2.5-flash';
}

/** هل خدمة Gemini متاحة (مفتاح مُعرّف)؟ */
export function isGeminiAvailable(): boolean {
  return !!getGeminiApiKey();
}

/** هل وضع الإجابة المفتوحة مفعّل؟ (للأسئلة خارج النظام) — افتراضي: true للتجربة */
export function isGeminiOpenModeEnabled(): boolean {
  const v = process.env.GEMINI_OPEN_MODE?.toLowerCase();
  return v !== 'false' && v !== '0' && v !== 'no';
}
