/**
 * أشكال JSON للمصادقة — مُحاذاة لـ `AuthService.login` و`refreshAccessToken` في الـ backend
 * (`backend/src/auth/auth.service.ts`). عند تغيير الـ API حدّث هذا الملف معه.
 */

/** حقل `user` بعد تسجيل الدخول أو التجديد */
export interface AuthSessionUser {
  id: string;
  email: string;
  nameAr: string | null;
  nameEn: string | null;
  /** يُرسَل في login؛ قد يغيب في مسار التجديد */
  preferredLang?: string;
  role: string;
  roleNameAr: string | null;
  permissions: string[];
  tenantId: string;
  companyIds: string[];
}

export interface AuthTokenPair {
  access_token: string;
  refresh_token: string;
}

/** جسم الاستجابة بعد فك التغليف `data?.data ?? data` لمسارَي login و refresh */
export type AuthLoginRefreshPayload = AuthTokenPair & {
  user: AuthSessionUser;
};

export type RefreshAuthSessionResult =
  | { success: true; data: AuthLoginRefreshPayload }
  | { success: false; error: string };
