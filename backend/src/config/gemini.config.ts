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
  // gemini-2.0-flash لم يعد متاحاً لمفاتيح/حسابات جديدة — الافتراضي 2.5-flash
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

/** شرح رؤى لوحة التحكم عبر LLM — افتراضي: معطّل (الرد الحتمي فقط) */
export function isSmartChatInsightsLlmExplanationEnabled(): boolean {
  const v = process.env.SMART_CHAT_INSIGHTS_LLM_EXPLANATION?.toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

/**
 * الحد الأدنى لثقة تصنيف النية (0–1) من Gemini.
 * دونه يُعامل الرد كـ unknown ويُستخدم مطابقة الكلمات (أو الإجابة العامة إن وُجدت).
 * يُضبط عبر GEMINI_INTENT_CONFIDENCE_MIN (افتراضي 0.55).
 */
export function getGeminiIntentConfidenceMin(): number {
  const raw = process.env.GEMINI_INTENT_CONFIDENCE_MIN?.trim();
  if (!raw) return 0.55;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0.55;
  return Math.min(1, Math.max(0, n));
}
