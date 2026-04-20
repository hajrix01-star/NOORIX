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
 * يبني عنوان iframe مع الحفاظ على استعلام التشغيل (app_id، access_token، …).
 */
export function buildHajriTaxEmbeddedUrl(launchUrl, segment) {
  const u = new URL(launchUrl);
  const base = u.pathname.replace(/\/$/, '');
  u.pathname = `${base}/${segment}`;
  return u.toString();
}
