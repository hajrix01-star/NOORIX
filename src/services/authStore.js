/**
 * authStore — مخزن آمن للمصادقة (بدون تعريض window).
 * يُستخدم من api.js لجلب التوكن و companyId دون التلوث العالمي.
 */
const TOKEN_KEY = 'noorix-auth-token';
const REFRESH_TOKEN_KEY = 'noorix-refresh-token';
const USER_KEY = 'noorix-auth-user';

let _token = null;
let _refreshToken = null;
let _companyId = '';

function safeSessionStorage() {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function safeLocalStorage() {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** تعيين التوكن — يُخزَّن في sessionStorage (ينتهي عند إغلاق التبويب) */
export function setAuthToken(value) {
  _token = value || null;
  const storage = safeSessionStorage();
  if (storage) {
    if (value) storage.setItem(TOKEN_KEY, value);
    else storage.removeItem(TOKEN_KEY);
  }
}

/** جلب التوكن الحالي */
export function getAuthToken() {
  if (_token !== null) return _token;
  const storage = safeSessionStorage();
  if (storage) {
    const v = storage.getItem(TOKEN_KEY);
    _token = v || null;
    return _token;
  }
  return null;
}

/** تعيين Refresh Token — يُخزَّن في sessionStorage */
export function setRefreshToken(value) {
  _refreshToken = value || null;
  const storage = safeSessionStorage();
  if (storage) {
    if (value) storage.setItem(REFRESH_TOKEN_KEY, value);
    else storage.removeItem(REFRESH_TOKEN_KEY);
  }
}

/** جلب Refresh Token */
export function getRefreshToken() {
  if (_refreshToken !== null) return _refreshToken;
  const storage = safeSessionStorage();
  if (storage) {
    const v = storage.getItem(REFRESH_TOKEN_KEY);
    _refreshToken = v || null;
    return _refreshToken;
  }
  return null;
}

/** تعيين الشركة النشطة */
export function setActiveCompanyId(value) {
  _companyId = value || '';
}

/** جلب الشركة النشطة */
export function getActiveCompanyId() {
  return _companyId;
}

/** تعيين المستخدم — localStorage (للعرض فقط، أقل حساسية) */
export function setStoredUser(value) {
  const storage = safeLocalStorage();
  if (storage) {
    if (value) storage.setItem(USER_KEY, JSON.stringify(value));
    else storage.removeItem(USER_KEY);
  }
}

/** جلب المستخدم المخزّن */
export function getStoredUser() {
  try {
    const storage = safeLocalStorage();
    if (storage) {
      const raw = storage.getItem(USER_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (_) {}
  return null;
}

/** مسح كل بيانات المصادقة */
export function clearAuth() {
  setAuthToken(null);
  setRefreshToken(null);
  setStoredUser(null);
  setActiveCompanyId('');
}
