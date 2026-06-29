/**
 * useTranslation — Hook للترجمة يعتمد على لغة التطبيق من AppContext
 */
import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getText } from './translations';

/**
 * @returns {{
 *   t: (key: string, vars?: Object|string, ...rest: string[]) => string,
 *   lang: 'ar'|'en'
 * }}
 *
 * الاستخدام:
 *   t('save')                          → 'حفظ'
 *   t('batchLabel', '5')               → 'دفعة 5'     (استبدال ترتيبي)
 *   t('pageLabel', { 0: 2, 1: 10 })   → 'صفحة 2 / 10'
 *   t('total', { count: 5 })           → يعمل إذا النص يحتوي {count}
 */
export function useTranslation() {
  const { language } = useApp();
  /** مرجع ثابت بين الرندرات — وضع `t` في deps لـ useEffect كان يعيد تشغيل التأثيرات بلا حد (مثلاً prefill flows) */
  const t = useCallback((key: any, ...replacements: any[]) => getText(key, language, ...replacements), [language]);
  return { t, lang: language };
}
