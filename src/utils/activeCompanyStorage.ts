/**
 * تذكّر آخر شركة نشطة لكل مستخدم — يبقى بعد تسجيل الخروج
 * (قنوات البيع والخزائن مرتبطة بـ companyId؛ لا نعتمد على الجلسة فقط).
 */
import { STORAGE_KEYS } from '../constants/storageKeys';

export function lastCompanyStorageKey(userId: string) {
  return `noorix-last-company:${String(userId || '').trim()}`;
}

export function readLastCompanyForUser(userId: string | null | undefined): string {
  const id = String(userId || '').trim();
  if (!id) return '';
  try {
    return localStorage.getItem(lastCompanyStorageKey(id)) || '';
  } catch {
    return '';
  }
}

export function saveLastCompanyForUser(userId: string | null | undefined, companyId: string) {
  const uid = String(userId || '').trim();
  const cid = String(companyId || '').trim();
  if (!uid || !cid) return;
  try {
    localStorage.setItem(lastCompanyStorageKey(uid), cid);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_COMPANY, cid);
  } catch {
    /* ignore quota */
  }
}

/** أولوية الاستعادة بعد الدخول: آخر شركة للمستخدم ثم المفتاح العام */
export function resolvePreferredCompanyId(
  userId: string | null | undefined,
  allowedCompanyIds: string[],
): string {
  const allowed = new Set((allowedCompanyIds || []).map((x) => String(x)));
  if (!allowed.size) return '';

  const candidates = [
    readLastCompanyForUser(userId),
    (() => {
      try {
        return localStorage.getItem(STORAGE_KEYS.ACTIVE_COMPANY) || '';
      } catch {
        return '';
      }
    })(),
  ];

  for (const cid of candidates) {
    if (cid && allowed.has(cid)) return cid;
  }
  return [...allowed][0] || '';
}
