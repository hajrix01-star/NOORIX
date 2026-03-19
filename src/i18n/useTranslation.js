/**
 * useTranslation — Hook للترجمة يعتمد على لغة التطبيق من AppContext
 */
import { useApp } from '../context/AppContext';
import { getText } from './translations';

/**
 * @returns {{ t: (key: string, ...replacements: string[]) => string, lang: 'ar'|'en' }}
 */
export function useTranslation() {
  const { language } = useApp();
  return {
    t: (key, ...replacements) => getText(key, language, ...replacements),
    lang: language,
  };
}
