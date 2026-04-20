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

/** إن وُجد الجذر فقط على هذه النطاقات، تطبيق الضرائب الحقيقي تحت ‎/tax‎ وليس SPA نوريكس. */
const HAJRIX_TAX_ROOT_HOSTS = new Set(['hajrix.com', 'www.hajrix.com']);

const DEFAULT_HAJRI_TAX_BASE = 'https://hajrix.com/tax';

/**
 * يصلح ضبطاً شائعاً: ‎VITE_HAJRI_TAX_URL=https://hajrix.com‎ فيفتح ‎/Companies‎ على نوريكس → 404 داخل الإطار.
 * لا يغيّر مساراً صريحاً غير الجذر (مثلاً ‎/tax‎ أو استضافة مخصصة).
 */
function applyHajrixDomainRootToTaxPath(url) {
  try {
    const p = url.pathname.replace(/\/$/, '') || '';
    if (p && p !== '/') return;
    if (HAJRIX_TAX_ROOT_HOSTS.has(url.hostname)) {
      url.pathname = '/tax';
    }
  } catch {
    /* ignore */
  }
}

/**
 * أصل تطبيق الضرائب المنشور (مسار ‎/tax/‎ على الخادم) — يُبنى منه الـ iframe دائماً.
 * لا نستخدم pathname من رابط التشغيل لأن الخادم قد يعيد خطأً مثل ‎…/hajri-tax/‎ inُحمَّل نوريكس داخل الـ iframe.
 */
export function getHajriTaxAppPublicBase() {
  const raw = typeof import.meta !== 'undefined' && import.meta.env?.VITE_HAJRI_TAX_URL;
  const initial = (raw != null && String(raw).trim() !== '' ? String(raw).trim() : DEFAULT_HAJRI_TAX_BASE);

  try {
    if (initial.startsWith('/') && !initial.startsWith('//')) {
      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'https://hajrix.com';
      const path = initial.endsWith('/') ? initial : `${initial}/`;
      const u = new URL(path, origin);
      applyHajrixDomainRootToTaxPath(u);
      return u.toString().replace(/\/$/, '');
    }

    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(initial);
    const u = new URL(hasScheme ? initial : `https://${initial}`);
    applyHajrixDomainRootToTaxPath(u);
    return u.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_HAJRI_TAX_BASE;
  }
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
