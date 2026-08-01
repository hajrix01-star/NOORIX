/**
 * عميل HTTP الأساسي — Base URL، JWT، إعادة المحاولة، apiGet/Post/Patch/Put/Delete
 */
import { getAuthToken, getActiveCompanyId, getRefreshToken, setAuthToken, setRefreshToken } from '../authStore';
import type { ApiParsedResult, AuthLoginRefreshPayload, RefreshAuthSessionResult } from '../../types/api';

export type { ApiParsedResult } from '../../types/api';

export type ApiThrownError = Error & {
  code?: number;
  errorCode?: string;
  details?: unknown;
  isTransientServerError?: boolean;
  isNetworkError?: boolean;
};

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err ?? '');
}

// ── Base URL ديناميكي ─────────────────────────────────
function resolveBaseUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    if (port === '5173' || port === '5174' || port === '5175') {
      return `${protocol}//${hostname}:3000`;
    }
    return '';
  }
  return '';
}

const BASE_URL = resolveBaseUrl();

// ── معالج 401 عالمي ──────────────────────────────────
let _on401: (() => void) | null = null;
export function registerOn401Handler(fn: () => void) {
  _on401 = fn;
}
export function handleUnauthorized() {
  if (typeof _on401 === 'function') _on401();
}

// ── رؤوس الطلبات ─────────────────────────────────────
export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  const companyId = getActiveCompanyId();
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (companyId) h['x-company-id'] = String(companyId);
  return h;
}

// ── fetch مع timeout وإمساك أخطاء الشبكة ────────────
const TIMEOUT_MS = 12000;
export async function safeFetch(
  url: string,
  options: RequestInit = {},
  timeout: number = TIMEOUT_MS,
) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(tid);
    return res;
  } catch (err: unknown) {
    clearTimeout(tid);
    const msg =
      err instanceof Error && err.name === 'AbortError'
        ? 'انتهت مهلة الاتصال — جرّب مرة أخرى'
        : 'السيرفر غير متاح';
    throw Object.assign(new Error(msg), { isNetworkError: true });
  }
}

// ── Auto-refresh: محاولة تجديد التوكن عند 401 ───────
let _refreshPromise: Promise<boolean> | null = null;
async function tryRefreshToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const url = new URL('/api/v1/auth/refresh', getApiBaseUrl());
      const res = await safeFetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json().catch(() => null)) as Partial<AuthLoginRefreshPayload> | null;
      if (data?.access_token) {
        setAuthToken(data.access_token);
        if (data.refresh_token) setRefreshToken(data.refresh_token);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

/**
 * تجديد الجلسة من refresh_token — يعيد companyIds محدّثة من قاعدة البيانات (مثلاً بعد استيراد شركة).
 * يحدّث التوكن في التخزين؛ استدعِ setToken/setUser من AuthContext لمزامنة واجهة React.
 */
export async function refreshAuthSession(): Promise<RefreshAuthSessionResult> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return { success: false, error: 'لا يوجد رمز تجديد' };
  }
  try {
    const url = new URL('/api/v1/auth/refresh', getApiBaseUrl());
    const res = await safeFetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = Array.isArray(raw?.message)
        ? raw.message.join(', ')
        : (raw?.message || raw?.error || 'فشل تجديد الجلسة');
      return { success: false, error: String(msg) };
    }
    const payload = (raw?.data ?? raw) as AuthLoginRefreshPayload;
    if (payload?.access_token) {
      setAuthToken(payload.access_token);
      if (payload.refresh_token) setRefreshToken(payload.refresh_token);
    }
    return { success: true, data: payload };
  } catch (err: unknown) {
    return { success: false, error: errMessage(err) || 'خطأ في الاتصال' };
  }
}

const TRANSIENT_HTTP = new Set([502, 503, 504]);
const API_GET_TRANSIENT_ATTEMPTS = 3;

function sleepMs(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function parseResponse<T = unknown>(
  res: Response,
  retryFn?: () => Promise<unknown>,
): Promise<ApiParsedResult<T>> {
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && retryFn) {
    const refreshed = await tryRefreshToken();
    if (refreshed) return (await retryFn()) as ApiParsedResult<T>; // نفس شكل parseResponse
    handleUnauthorized();
    return { success: false, error: 'غير مصرح — يُرجى تسجيل الدخول', code: 401 };
  }
  if (res.status === 401) {
    handleUnauthorized();
    return { success: false, error: 'غير مصرح — يُرجى تسجيل الدخول', code: 401 };
  }
  if (TRANSIENT_HTTP.has(res.status)) {
    return {
      success: false,
      error:
        'الخادم لم يستجب مؤقتاً (البوابة أو السيرفر النائم). إن استمر الأمر، حدّث الصفحة أو غيّر الشركة ثم عد.',
      code: res.status,
      isTransientServerError: true,
    };
  }
  if (!res.ok) {
    const msg = Array.isArray(data?.message)
      ? data.message.join(', ')
      : (data?.message || data?.error || res.statusText);
    return {
      success: false,
      error: String(msg || 'خطأ'),
      code: res.status,
      errorCode: typeof data?.errorCode === 'string' ? data.errorCode : undefined,
      details: data?.details,
    };
  }
  return { success: true, data: (data?.data ?? data) as T };
}

export function throwIfApiFailed(res: unknown, fallbackMessage: string = 'طلب فشل'): void {
  const r = res as {
    success?: boolean;
    error?: string;
    message?: string;
    code?: number;
    errorCode?: string;
    details?: unknown;
    isTransientServerError?: boolean;
    isNetworkError?: boolean;
  };
  if (r?.success) return;
  const err = new Error(String(r?.error || r?.message || fallbackMessage)) as ApiThrownError;
  if (r?.code != null) err.code = r.code;
  if (r?.errorCode) err.errorCode = r.errorCode;
  if (r?.details !== undefined) err.details = r.details;
  if (r?.isTransientServerError) err.isTransientServerError = true;
  if (r?.isNetworkError) err.isNetworkError = true;
  throw err;
}

/** Returns response data after checking API success. */
export function unwrapApiData<T>(
  res: ApiParsedResult<T>,
  fallbackMessage = 'طلب فشل',
): T {
  throwIfApiFailed(res, fallbackMessage);
  if (res.data === undefined) {
    throw new Error(fallbackMessage);
  }
  return res.data;
}

/** مثل unwrapApiData لكن يعيد fallback عند غياب data (استعلامات مع placeholder) */
export function unwrapApiDataOr<T>(
  res: ApiParsedResult<T>,
  fallback: T,
  fallbackMessage = 'طلب فشل',
): T {
  throwIfApiFailed(res, fallbackMessage);
  return res.data ?? fallback;
}

type ListEnvelope<T> = {
  items?: T[];
  data?: T[] | { items?: T[] } | null;
} | T[] | null | undefined;

/** يقرأ قوائم الـ API من الأشكال الشائعة: [] أو { items } أو { data: [] } أو { data: { items } }. */
export function unwrapApiList<T>(
  res: ApiParsedResult<ListEnvelope<T>>,
  fallbackMessage = 'طلب فشل',
): T[] {
  const data = unwrapApiDataOr<ListEnvelope<T>>(res, [], fallbackMessage);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (data?.data && !Array.isArray(data.data) && Array.isArray(data.data.items)) return data.data.items;
  return [];
}

export function getApiBaseUrl() {
  return BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
}

export async function apiGet<T = unknown>(
  path: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
): Promise<ApiParsedResult<T>> {
  const url = new URL(path, getApiBaseUrl());
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  });

  let lastFailure: ApiParsedResult<T> = { success: false, error: 'خطأ في الاتصال' };

  for (let attempt = 0; attempt < API_GET_TRANSIENT_ATTEMPTS; attempt++) {
    const doFetch = async () => {
      const res = await safeFetch(url.toString(), { method: 'GET', headers: getAuthHeaders() });
      return parseResponse<T>(res);
    };
    try {
      const res = await safeFetch(url.toString(), { method: 'GET', headers: getAuthHeaders() });
      const parsed = await parseResponse<T>(res, doFetch);
      if (parsed.success) return parsed;
      lastFailure = parsed;
      const canRetry =
        attempt < API_GET_TRANSIENT_ATTEMPTS - 1 &&
        ((parsed.code != null && TRANSIENT_HTTP.has(parsed.code)) ||
          parsed.isTransientServerError ||
          parsed.isNetworkError);
      if (canRetry) {
        await sleepMs(550 + attempt * 450);
        continue;
      }
      return parsed;
    } catch (err: unknown) {
      lastFailure = { success: false, error: errMessage(err) || 'خطأ في الاتصال', isNetworkError: true };
      if (attempt < API_GET_TRANSIENT_ATTEMPTS - 1) {
        await sleepMs(550 + attempt * 450);
        continue;
      }
      return lastFailure;
    }
  }
  return lastFailure;
}

export async function apiPost<T = unknown>(
  path: string,
  body: unknown = {},
  opts: { timeout?: number } = {},
): Promise<ApiParsedResult<T>> {
  const timeout = opts.timeout ?? TIMEOUT_MS;
  const url = new URL(path, getApiBaseUrl());
  const fetchOpts = { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body) };
  const doFetch = async () => {
    const res = await safeFetch(url.toString(), fetchOpts, timeout);
    return parseResponse<T>(res);
  };
  try {
    const res = await safeFetch(url.toString(), fetchOpts, timeout);
    return parseResponse<T>(res, doFetch);
  } catch (err: unknown) {
    return { success: false, error: errMessage(err) || 'خطأ في الاتصال', isNetworkError: true };
  }
}

export async function apiPatch<T = unknown>(path: string, body: unknown = {}): Promise<ApiParsedResult<T>> {
  const url = new URL(path, getApiBaseUrl());
  const doFetch = async () => {
    const res = await safeFetch(url.toString(), {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    return parseResponse<T>(res);
  };
  try {
    const res = await safeFetch(url.toString(), {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    return parseResponse<T>(res, doFetch);
  } catch (err: unknown) {
    return { success: false, error: errMessage(err) || 'خطأ في الاتصال', isNetworkError: true };
  }
}

export async function apiPut<T = unknown>(path: string, body: unknown = {}): Promise<ApiParsedResult<T>> {
  const url = new URL(path, getApiBaseUrl());
  const doFetch = async () => {
    const res = await safeFetch(url.toString(), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    return parseResponse<T>(res);
  };
  try {
    const res = await safeFetch(url.toString(), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    return parseResponse<T>(res, doFetch);
  } catch (err: unknown) {
    return { success: false, error: errMessage(err) || 'خطأ في الاتصال', isNetworkError: true };
  }
}

export async function apiDelete<T = unknown>(path: string): Promise<ApiParsedResult<T>> {
  const url = new URL(path, getApiBaseUrl());
  const doFetch = async () => {
    const res = await safeFetch(url.toString(), { method: 'DELETE', headers: getAuthHeaders() });
    return parseResponse<T>(res);
  };
  try {
    const res = await safeFetch(url.toString(), { method: 'DELETE', headers: getAuthHeaders() });
    return parseResponse<T>(res, doFetch);
  } catch (err: unknown) {
    return { success: false, error: errMessage(err) || 'خطأ في الاتصال', isNetworkError: true };
  }
}
