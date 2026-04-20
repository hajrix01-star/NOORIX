/**
 * روابط تضمين تطبيق HAJRI TAX (tax-hajri) داخل نوركس.
 * مسارات SPA الضريبي تحت Vite base ‎/tax/‎ — انظر ‎tax-hajri/src/pages.config.js‎.
 *
 * مسارات **نوركس** للتضمين: ‎/hajri-tax/…‎ — لا تستخدم ‎/tax‎ حتى لا يتعارض مع استضافة tax-hajri على ‎/tax/‎ على نفس الدومين.
 */

/** مقاطع الصفحات في tax-hajri (مفاتيح ‎pages.config‎) */
export const TAX_HAJRI_SEGMENTS = {
  companies: 'Companies',
  form: 'TaxForm',
  reports: 'TaxReports',
};

const BASE = '/hajri-tax';

/**
 * يحدد مقطع tax-hajri من مسار نوركس ‎/hajri-tax/…‎
 */
export function resolveTaxHajriSegment(pathname) {
  const p = pathname.replace(/\/$/, '') || BASE;
  if (p === BASE) return TAX_HAJRI_SEGMENTS.companies;
  if (p.startsWith(`${BASE}/companies`)) return TAX_HAJRI_SEGMENTS.companies;
  if (p.startsWith(`${BASE}/form`)) return TAX_HAJRI_SEGMENTS.form;
  if (p.startsWith(`${BASE}/reports`)) return TAX_HAJRI_SEGMENTS.reports;
  return TAX_HAJRI_SEGMENTS.companies;
}

/**
 * أصل تطبيق الضرائب المنشور (مسار ‎/tax/‎ على الخادم) — يُبنى منه الـ iframe دائماً.
 * لا نستخدم pathname من رابط التشغيل لأن الخادم قد يعيد خطأً مثل ‎…/hajri-tax/‎ inُحمَّل نوريكس داخل الـ iframe.
 */
export function getHajriTaxAppPublicBase() {
  const raw = typeof import.meta !== 'undefined' && import.meta.env?.VITE_HAJRI_TAX_URL;
  return (raw ? String(raw) : 'https://hajrix.com/tax').replace(/\/$/, '');
}

/**
 * يبني عنوان iframe: المسار دائماً تحت ‎getHajriTaxAppBase()/segment‎ (مثل ‎/tax/Companies‎)،
 * ويُنسَخ فقط استعلام رابط التشغيل (app_id، access_token، app_base_url، …).
 */
export function buildHajriTaxEmbeddedUrl(launchUrl, segment) {
  const out = new URL(`${getHajriTaxAppPublicBase()}/${segment}`);
  try {
    const src = new URL(launchUrl);
    src.searchParams.forEach((value, key) => {
      out.searchParams.set(key, value);
    });
  } catch {
    /* إن فشل التحليل نُرجع العنوان بدون استعلام */
  }
  return out.toString();
}
