import { STORAGE_KEYS } from '../constants/storageKeys';

/**
 * يقرأ اللغة المحفوظة ويهاجر من المفتاح القديم `noorix:language` إلى `noorix-lang` عند الحاجة.
 * @returns {'ar'|'en'|null}
 */
export function readStoredLanguage() {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
    if (v === 'ar' || v === 'en') return v;
    const leg = localStorage.getItem(STORAGE_KEYS.LANGUAGE_LEGACY);
    if (leg === 'ar' || leg === 'en') {
      localStorage.setItem(STORAGE_KEYS.LANGUAGE, leg);
      try {
        localStorage.removeItem(STORAGE_KEYS.LANGUAGE_LEGACY);
      } catch {
        /* ignore */
      }
      return leg;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredLanguage(lang) {
  if (lang !== 'ar' && lang !== 'en') return;
  try {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
    try {
      localStorage.removeItem(STORAGE_KEYS.LANGUAGE_LEGACY);
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}
