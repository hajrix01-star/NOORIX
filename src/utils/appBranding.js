/**
 * appBranding — إدارة هوية التطبيق بدعم ثنائي اللغة (عربي / إنجليزي).
 * يُخزَّن في localStorage ويُطبَّق فوراً على:
 *   - عنوان تبويب المتصفح (document.title)
 *   - أيقونة التبويب (favicon + apple-touch-icon)
 *   - meta tags لـ PWA
 *   - Manifest ديناميكي (يدعم "أضف للشاشة الرئيسية")
 */

const KEYS = {
  nameAr:    'noorix:appName:ar',
  nameEn:    'noorix:appName:en',
  taglineAr: 'noorix:appTagline:ar',
  taglineEn: 'noorix:appTagline:en',
  logo:      'noorix:appLogo',
  color:     'noorix:appColor',
};

const DEFAULTS = {
  nameAr:    'نووريكس',
  nameEn:    'Noorix',
  taglineAr: 'نظام إدارة متكامل',
  taglineEn: 'Business Management System',
  logo:      '',
  color:     '#0a1f44',
};

const get = (key) => localStorage.getItem(KEYS[key]) || DEFAULTS[key];

export const getBrandNameAr    = () => get('nameAr');
export const getBrandNameEn    = () => get('nameEn');
export const getBrandTaglineAr = () => get('taglineAr');
export const getBrandTaglineEn = () => get('taglineEn');
export const getBrandLogo      = () => get('logo');
export const getBrandColor     = () => get('color');

/** يُرجع الاسم أو الجملة حسب اللغة الحالية */
export const getBrandName    = (lang = 'ar') => lang === 'en' ? getBrandNameEn()    : getBrandNameAr();
export const getBrandTagline = (lang = 'ar') => lang === 'en' ? getBrandTaglineEn() : getBrandTaglineAr();

export function saveBranding({ nameAr, nameEn, taglineAr, taglineEn, logoUrl, color }) {
  const set = (key, val) =>
    val !== undefined && (val ? localStorage.setItem(KEYS[key], val) : localStorage.removeItem(KEYS[key]));

  set('nameAr',    nameAr);
  set('nameEn',    nameEn);
  set('taglineAr', taglineAr);
  set('taglineEn', taglineEn);
  set('logo',      logoUrl);
  set('color',     color);

  applyBranding();
  window.dispatchEvent(new CustomEvent('noorix:branding-changed'));
}

export function applyBranding(lang = 'ar') {
  const name  = getBrandName(lang);
  const logo  = getBrandLogo();
  const color = getBrandColor();

  document.title = name;

  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.content = color; });

  const setMeta = (sel, val) => { const m = document.querySelector(sel); if (m) m.content = val; };
  setMeta('meta[name="apple-mobile-web-app-title"]', name);
  setMeta('meta[name="application-name"]', name);

  if (logo) _setFavicon(logo);

  _injectDynamicManifest(name, getBrandName(lang === 'ar' ? 'en' : 'ar'), logo, color, lang);
}

function _setFavicon(url) {
  ['link[rel="icon"]', 'link[rel="alternate icon"]'].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.href = url;
  });
  const apple = document.querySelector('link[rel="apple-touch-icon"]');
  if (apple) apple.href = url;
}

let _manifestBlobUrl = null;

function _injectDynamicManifest(name, shortName, logo, color, lang) {
  try {
    const icons = logo
      ? [{ src: logo, sizes: 'any', type: 'image/png', purpose: 'any maskable' }]
      : [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ];

    const manifest = {
      name,
      short_name: shortName || name,
      description: `${name} — نظام إدارة متكامل`,
      theme_color: color,
      background_color: '#f4f6f9',
      display: 'standalone',
      orientation: 'any',
      scope: '/',
      start_url: '/',
      lang: lang === 'en' ? 'en' : 'ar',
      dir: lang === 'en' ? 'ltr' : 'rtl',
      icons,
    };

    if (_manifestBlobUrl) URL.revokeObjectURL(_manifestBlobUrl);
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    _manifestBlobUrl = URL.createObjectURL(blob);

    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.href = _manifestBlobUrl;
  } catch (_) {
    // Blob URLs غير مدعومة في بعض البيئات
  }
}
