/**
 * قراءة/كتابة JSON في localStorage مع معالجة أخطاء موحّدة.
 */
export function readJsonStorage(key: any, fallback: any) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === '') return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJsonStorage(key: any, value: any) {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** إزالة مفتاح JSON من التخزين المحلي */
export function removeJsonStorage(key: any) {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
