import { ALLOWANCE_NAME_EN_MAP } from '../constants';

export function translateAllowanceToEnglish(nameAr: string | number | undefined | null = '') {
  const normalized = String(nameAr || '').trim();
  if (!normalized) return 'Allowance';
  if (ALLOWANCE_NAME_EN_MAP[normalized]) return ALLOWANCE_NAME_EN_MAP[normalized];
  const compact = normalized.replace(/\s+/g, ' ');
  if (ALLOWANCE_NAME_EN_MAP[compact]) return ALLOWANCE_NAME_EN_MAP[compact];
  return 'Custom Allowance';
}

export function isMostlyArabicScript(text: unknown) {
  if (!text || typeof text !== 'string') return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/** عمود إنجليزي: إن كان المسمى عربياً فقط نعرض — حتى لا يتكرر العربي في العمود الإنجليزي */
export function displayJobTitleEn(employee: Record<string, unknown>) {
  const jt = String(employee?.jobTitle || '').trim();
  if (!jt) return '—';
  return isMostlyArabicScript(jt) ? '—' : jt;
}
