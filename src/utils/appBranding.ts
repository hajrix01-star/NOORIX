/**
 * appBranding — إدارة هوية التطبيق بدعم ثنائي اللغة (عربي / إنجليزي).
 * يُخزَّن في localStorage ويُطبَّق فوراً على:
 *   - عنوان تبويب المتصفح (document.title)
 *   - أيقونة التبويب (favicon + apple-touch-icon)
 *   - meta tags لـ PWA
 *   - Manifest ديناميكي (يدعم "أضف للشاشة الرئيسية")
 *
 * حل مشكلة الجوال:
 *   - blob: URLs غير مدعومة في متصفحات الجوال → نستخدم data: URL بدلاً منها
 *   - تحديث الـ favicon بإنشاء عناصر link جديدة بدلاً من تعديل الموجودة فقط
 *   - iOS: يعتمد على apple-touch-icon + apple-mobile-web-app-title
 */

const KEYS = {
  nameAr:      'noorix:appName:ar',
  nameEn:      'noorix:appName:en',
  taglineAr:   'noorix:appTagline:ar',
  taglineEn:   'noorix:appTagline:en',
  logo:        'noorix:appLogo',
  color:       'noorix:appColor',
  loginDomain: 'noorix:loginDomain',
};

const DEFAULTS = {
  nameAr:      'نووريكس',
  nameEn:      'Noorix',
  taglineAr:   'نظام إدارة متكامل',
  taglineEn:   'Business Management System',
  logo:        '',
  color:       '#0a1f44',
  loginDomain: 'hajrix.com',
};

type BrandingLanguage = 'ar' | 'en';

type BrandingInput = {
  nameAr?: string;
  nameEn?: string;
  taglineAr?: string;
  taglineEn?: string;
  logoUrl?: string;
  color?: string;
  loginDomain?: string;
};

type ManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
};

const normalizeLang = (lang: unknown): BrandingLanguage => (lang === 'en' ? 'en' : 'ar');

const get = (key: keyof typeof KEYS) => localStorage.getItem(KEYS[key]) || DEFAULTS[key];

export const getBrandNameAr    = () => get('nameAr');
export const getBrandNameEn    = () => get('nameEn');
export const getBrandTaglineAr = () => get('taglineAr');
export const getBrandTaglineEn = () => get('taglineEn');
export const getBrandLogo      = () => get('logo');
export const getBrandColor     = () => get('color');
export const getLoginDomain    = () => get('loginDomain');

/**
 * نطاق البريد عند إدخال اسم مستخدم بدون @.
 * يجب أن يطابق **دائماً** `OFFICIAL_EMAIL_DOMAIN` في الـ backend (عبر `VITE_OFFICIAL_EMAIL_DOMAIN` عند بناء الواجهة، أو الافتراضي hajrix.com).
 * لا نستخدم دوميناً من localStorage حتى يبقى البريد الناتج عن إنشاء المستخدم مطابقاً لتسجيل الدخول القصير.
 */
export function getResolvedLoginEmailDomain(): string {
  const fromEnv =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_OFFICIAL_EMAIL_DOMAIN
      ? String(import.meta.env.VITE_OFFICIAL_EMAIL_DOMAIN).trim().toLowerCase()
      : '';
  return fromEnv || 'hajrix.com';
}

/** يُرجع الاسم أو الجملة حسب اللغة الحالية */
export const getBrandName    = (lang: unknown = 'ar') => normalizeLang(lang) === 'en' ? getBrandNameEn()    : getBrandNameAr();
export const getBrandTagline = (lang: unknown = 'ar') => normalizeLang(lang) === 'en' ? getBrandTaglineEn() : getBrandTaglineAr();

export function saveBranding({ nameAr, nameEn, taglineAr, taglineEn, logoUrl, color, loginDomain }: BrandingInput) {
  const set = (key: keyof typeof KEYS, val: string | undefined) =>
    val !== undefined && (val ? localStorage.setItem(KEYS[key], val) : localStorage.removeItem(KEYS[key]));

  set('nameAr',      nameAr);
  set('nameEn',      nameEn);
  set('taglineAr',   taglineAr);
  set('taglineEn',   taglineEn);
  set('logo',        logoUrl);
  set('color',       color);
  set('loginDomain', loginDomain);

  applyBranding();
  window.dispatchEvent(new CustomEvent('noorix:branding-changed'));
}

export function applyBranding(lang: unknown = 'ar') {
  const name  = getBrandName(lang);
  const logo  = getBrandLogo();
  const color = getBrandColor();

  document.title = name;

  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = color;
  });

  const setMeta = (sel: string, val: string) => {
    const m = document.querySelector(sel) as HTMLMetaElement | null;
    if (m) m.content = val;
  };
  setMeta('meta[name="apple-mobile-web-app-title"]', name);
  setMeta('meta[name="application-name"]', name);

  if (logo) {
    _setFavicon(logo);
  }

  _injectDynamicManifest(name, getBrandName(lang === 'ar' ? 'en' : 'ar'), logo, color, lang);
}

/**
 * تحديث الـ favicon — يعمل على الكمبيوتر والجوال.
 * ينشئ عناصر link جديدة بدلاً من الاكتفاء بتعديل الموجودة.
 */
function _setFavicon(url: string) {
  // ابنِ PNG بحجم 64×64 بالـ canvas من الصورة المخصصة
  // هذا يضمن توافق أوسع بدلاً من استخدام data: URLs الطويلة مباشرةً
  _buildSquarePng(url, 64).then((pngUrl) => {
    const relTypes = ['icon', 'shortcut icon', 'alternate icon'];
    relTypes.forEach((rel) => {
      // أزل العنصر القديم إن وُجد
      const old = document.querySelector(`link[rel="${rel}"]`);
      if (old) old.remove();
      // أنشئ عنصراً جديداً
      const link = document.createElement('link');
      link.rel = rel;
      link.type = 'image/png';
      (link as HTMLLinkElement).href = pngUrl;
      document.head.appendChild(link);
    });

    // apple-touch-icon — مهم لـ iOS "Add to Home Screen"
    const oldApple = document.querySelector('link[rel="apple-touch-icon"]');
    if (oldApple) oldApple.remove();
    const apple = document.createElement('link');
    apple.rel = 'apple-touch-icon';
    apple.sizes = '180x180';
    (apple as HTMLLinkElement).href = pngUrl;
    document.head.appendChild(apple);
  }).catch(() => {
    // fallback: تعديل العناصر الموجودة مباشرة
    document
      .querySelectorAll('link[rel="icon"], link[rel="alternate icon"], link[rel="apple-touch-icon"]')
      .forEach((el) => {
        (el as HTMLLinkElement).href = url;
      });
  });
}

/**
 * يرسم الصورة في Canvas بشكل مربع ويعيد PNG data URL.
 * يحل مشكلة أن الصور المستطيلة لا تناسب أيقونات PWA.
 */
function _buildSquarePng(src: string, size: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas'));
          return;
        }
        ctx.clearRect(0, 0, size, size);
        const ratio = Math.min(size / img.width, size / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = (size - w) / 2;
        const y = (size - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Manifest ديناميكي:
 * - يستخدم data: URL بدلاً من blob: URL لأن blob: غير مدعوم في متصفحات الجوال
 * - data: URL يعمل في Chrome Android وعدد من المتصفحات الأخرى
 * - iOS يعتمد على apple meta tags المُعيَّنة في applyBranding() وليس الـ manifest
 */
function _injectDynamicManifest(name: string, shortName: string, logo: string, color: string, lang: unknown) {
  try {
    const icons: ManifestIcon[] = logo
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

    const json = JSON.stringify(manifest);

    // data: URL — أوسع دعماً على الجوال من blob:
    const dataUrl = 'data:application/manifest+json,' + encodeURIComponent(json);

    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.href = dataUrl;
  } catch {
    // تجاهل الأخطاء
  }
}
