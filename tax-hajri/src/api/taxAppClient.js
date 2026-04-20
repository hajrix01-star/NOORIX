/**
 * عميل الواجهة الخلفية لتطبيق HAJRI TAX (كيانات، مصادقة، سجلات).
 * يُعاد بناء العميل عند تغيّر appId/token/appBaseUrl (مثلاً بعد فتح رابط يحمل access_token).
 */
import { createClient } from 'hajri-sdk';
import { getAppParams } from '@/lib/app-params';

let _cachedClient = null;
let _cacheKey = '';

function getUnderlyingClient() {
  const { appId, token, functionsVersion, appBaseUrl } = getAppParams();
  const key = `${appId ?? ''}\0${token ?? ''}\0${appBaseUrl ?? ''}`;
  if (_cachedClient && key === _cacheKey) return _cachedClient;
  _cacheKey = key;

  /**
   * الـ SDK (@base44/sdk) يضع طلبات entities/auth على `${serverUrl}/api` — وليس على appBaseUrl وحده.
   * كان serverUrl: '' فيُحوَّل إلى "/api" نسبي على hajrix.com فيفشل الاتصال بخادم Hajri.
   * عند ضبط appBaseUrl (من VITE_TAX_APP_BASE_URL أو رابط التشغيل) يجب تمريره كـ serverUrl.
   */
  const trimmed = typeof appBaseUrl === 'string' ? appBaseUrl.trim() : '';
  const serverUrl = trimmed ? trimmed.replace(/\/$/, '') : '';

  _cachedClient = createClient({
    appId,
    token,
    functionsVersion,
    serverUrl,
    requiresAuth: false,
    appBaseUrl: trimmed,
  });
  return _cachedClient;
}

export const taxAppClient = new Proxy(
  {},
  {
    get(_target, prop) {
      return getUnderlyingClient()[prop];
    },
  },
);
