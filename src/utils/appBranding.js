/**
 * appBranding — إدارة هوية التطبيق (الاسم والشعار).
 * يُخزَّن في localStorage ويُطبَّق فوراً على:
 *   - عنوان تبويب المتصفح (document.title)
 *   - أيقونة التبويب (favicon)
 *   - Apple Touch Icon وعنوان PWA
 *   - Manifest ديناميكي (يدعم "أضف للشاشة الرئيسية" مع الشعار المخصص)
 */

const KEY_NAME    = 'noorix:appName';
const KEY_LOGO    = 'noorix:appLogo';
const KEY_COLOR   = 'noorix:appColor';
const KEY_TAGLINE = 'noorix:appTagline';

const DEFAULT_NAME    = 'نووريكس';
const DEFAULT_COLOR   = '#0a1f44';
const DEFAULT_TAGLINE = 'نظام إدارة متكامل';

export function getBrandName()    { return localStorage.getItem(KEY_NAME)    || DEFAULT_NAME; }
export function getBrandLogo()    { return localStorage.getItem(KEY_LOGO)    || ''; }
export function getBrandColor()   { return localStorage.getItem(KEY_COLOR)   || DEFAULT_COLOR; }
export function getBrandTagline() { return localStorage.getItem(KEY_TAGLINE) || DEFAULT_TAGLINE; }

export function saveBranding({ name, logoUrl, color, tagline }) {
  if (name    !== undefined) name    ? localStorage.setItem(KEY_NAME,    name)    : localStorage.removeItem(KEY_NAME);
  if (logoUrl !== undefined) logoUrl ? localStorage.setItem(KEY_LOGO,    logoUrl) : localStorage.removeItem(KEY_LOGO);
  if (color   !== undefined) color   ? localStorage.setItem(KEY_COLOR,   color)   : localStorage.removeItem(KEY_COLOR);
  if (tagline !== undefined) tagline ? localStorage.setItem(KEY_TAGLINE, tagline) : localStorage.removeItem(KEY_TAGLINE);
  applyBranding();
  window.dispatchEvent(new CustomEvent('noorix:branding-changed'));
}

export function applyBranding() {
  const name  = getBrandName();
  const logo  = getBrandLogo();
  const color = getBrandColor();

  // عنوان التبويب
  document.title = name;

  // theme-color
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.content = color; });

  // PWA meta
  const setMeta = (sel, val) => { const m = document.querySelector(sel); if (m) m.content = val; };
  setMeta('meta[name="apple-mobile-web-app-title"]', name);
  setMeta('meta[name="application-name"]', name);

  // أيقونة المتصفح
  if (logo) _setFavicon(logo);

  // Manifest ديناميكي (يمكّن "أضف للشاشة الرئيسية" بالبيانات المحدّثة)
  _injectDynamicManifest(name, logo, color);
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

function _injectDynamicManifest(name, logo, color) {
  try {
    const icons = logo
      ? [{ src: logo, sizes: 'any', type: 'image/png', purpose: 'any maskable' }]
      : [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ];

    const manifest = {
      name,
      short_name: name,
      description: `${name} — نظام إدارة متكامل`,
      theme_color: color,
      background_color: '#f4f6f9',
      display: 'standalone',
      orientation: 'any',
      scope: '/',
      start_url: '/',
      lang: 'ar',
      dir: 'rtl',
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
    // Blob URLs غير مدعومة في بعض البيئات — نتجاهل الخطأ
  }
}
