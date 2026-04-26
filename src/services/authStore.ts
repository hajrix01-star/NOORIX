/**
 * authStore — مخزن آمن للمصادقة (بدون تعريض window).
 * يُستخدم من طبقة API لجلب التوكن و companyId دون التلوث العالمي.
 */
import type { AuthSessionUser } from '../types/api';

const TOKEN_KEY = 'noorix-auth-token';
const REFRESH_TOKEN_KEY = 'noorix-refresh-token';
const USER_KEY = 'noorix-auth-user';

let _token: string | null = null;
let _refreshToken: string | null = null;
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
export function setAuthToken(value: string | null | undefined) {
  _token = value || null;
  const storage = safeSessionStorage();
  if (storage) {
    if (value) storage.setItem(TOKEN_KEY, value);
    else storage.removeItem(TOKEN_KEY);
  }
}

/** جلب التوكن الحالي */
export function getAuthToken(): string | null {
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
export function setRefreshToken(value: string | null | undefined) {
  _refreshToken = value || null;
  const storage = safeSessionStorage();
  if (storage) {
    if (value) storage.setItem(REFRESH_TOKEN_KEY, value);
    else storage.removeItem(REFRESH_TOKEN_KEY);
  }
}

/** جلب Refresh Token */
export function getRefreshToken(): string | null {
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
export function setActiveCompanyId(value: string | null | undefined) {
  _companyId = value || '';
}

/** جلب الشركة النشطة */
export function getActiveCompanyId() {
  return _companyId;
}

/** تعيين المستخدم — localStorage (للعرض فقط، أقل حساسية).
 *  يُزيل حقول كلمة المرور تلقائياً قبل التخزين. */
export function setStoredUser(value: AuthSessionUser | null) {
  const storage = safeLocalStorage();
  if (storage) {
    if (value) {
      const src = value as AuthSessionUser & {
        password?: unknown;
        passwordHash?: unknown;
        hashedPassword?: unknown;
      };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, passwordHash, hashedPassword, ...safeUser } = src;
      storage.setItem(USER_KEY, JSON.stringify(safeUser));
    } else {
      storage.removeItem(USER_KEY);
    }
  }
}

/** جلب المستخدم المخزّن */
export function getStoredUser(): AuthSessionUser | null {
  try {
    const storage = safeLocalStorage();
    if (storage) {
      const raw = storage.getItem(USER_KEY);
      if (raw) return JSON.parse(raw) as AuthSessionUser;
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
  _token = null;
  _refreshToken = null;
  _companyId = '';
}
