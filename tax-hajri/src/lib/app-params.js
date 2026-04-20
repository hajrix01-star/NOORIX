const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const toSnakeCase = (str) => {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
};

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
  if (isNode) {
    return defaultValue;
  }
  const storageKey = `hajri_tax_${toSnakeCase(paramName)}`;
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get(paramName);
  if (removeFromUrl) {
    urlParams.delete(paramName);
    const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}`
      : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  }
  if (searchParam) {
    storage.setItem(storageKey, searchParam);
    return searchParam;
  }
  if (defaultValue) {
    storage.setItem(storageKey, defaultValue);
    return defaultValue;
  }
  const storedValue = storage.getItem(storageKey);
  if (storedValue) {
    return storedValue;
  }
  return null;
};

/**
 * يقرأ معاملات التطبيق من الرابط ثم localStorage (للتوافق مع روابط التشغيل من نوركس).
 * يُستدعى عند الحاجة وليس مرة واحدة فقط — مهم عند تمرير access_token في الاستعلام.
 */
export function getAppParams() {
  if (getAppParamValue('clear_access_token') === 'true') {
    storage.removeItem('hajri_tax_access_token');
    storage.removeItem('token');
    storage.removeItem('base44_access_token');
  }
  const token = getAppParamValue('access_token', { removeFromUrl: true });
  // يتوقع hajri-sdk (@base44) المفتاح base44_access_token في getAccessToken() الافتراضي
  if (token && !isNode) {
    try {
      storage.setItem('base44_access_token', token);
      storage.setItem('token', token);
    } catch {
      /* ignore quota */
    }
  }
  return {
    appId: getAppParamValue('app_id', { defaultValue: import.meta.env.VITE_TAX_APP_ID }),
    token,
    fromUrl: getAppParamValue('from_url', {
      defaultValue: typeof window !== 'undefined' ? window.location.href : '',
    }),
    functionsVersion: getAppParamValue('functions_version', { defaultValue: import.meta.env.VITE_TAX_FUNCTIONS_VERSION }),
    appBaseUrl: getAppParamValue('app_base_url', { defaultValue: import.meta.env.VITE_TAX_APP_BASE_URL }),
  };
}

/** لقطعة أول تحميل — يُفضّل استخدام getAppParams() داخل التدفقات */
export const appParams = getAppParams();
