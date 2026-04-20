/**
 * روابط تضمين تطبيق HAJRI TAX (tax-hajri) داخل نوركس.
 * مسارات SPA الضريبي تحت Vite base ‎/tax/‎ — انظر ‎tax-hajri/src/pages.config.js‎.
 */

/** مقاطع الصفحات في tax-hajri (مفاتيح ‎pages.config‎) */
export const TAX_HAJRI_SEGMENTS = {
  companies: 'Companies',
  form: 'TaxForm',
  reports: 'TaxReports',
};

/**
 * يحدد مقطع tax-hajri من مسار نوركس ‎/tax/…‎
 */
export function resolveTaxHajriSegment(pathname) {
  const p = pathname.replace(/\/$/, '') || '/tax';
  if (p === '/tax') return TAX_HAJRI_SEGMENTS.companies;
  if (p.startsWith('/tax/companies')) return TAX_HAJRI_SEGMENTS.companies;
  if (p.startsWith('/tax/form')) return TAX_HAJRI_SEGMENTS.form;
  if (p.startsWith('/tax/reports')) return TAX_HAJRI_SEGMENTS.reports;
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
