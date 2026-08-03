/**
 * Noorix — فهرس الترجمات (دمج الوحدات)
 * مفتاح الترجمة → { ar, en }
 */
import common from './common';
import sales from './sales';
import suppliers from './suppliers';
import hr from './hr';
import invoices from './invoices';
import treasury from './treasury';
import settings from './settings';
import reports from './reports';
import dashboard from './dashboard';
import ordersV4 from './ordersV4';

const t = Object.assign(
  {},
  common,
  sales,
  suppliers,
  hr,
  invoices,
  treasury,
  settings,
  reports,
  dashboard,
  ordersV4
);

export type TranslationKey = keyof typeof t;
export type TranslationLanguage = 'ar' | 'en';
export type TranslationReplacement = unknown;
export type TranslationNamedReplacements = Record<string, TranslationReplacement>;

/**
 * استرجاع النص حسب اللغة
 * @param {keyof typeof t} key - مفتاح الترجمة
 * @param {'ar'|'en'} lang - اللغة
 * @param {...(string|Object)} replacements
 *   - إذا كان الأول object → استبدال مُسمّى:  t('key', lang, { count: 5 })  → {count}
 *   - وإلا → استبدال ترتيبي:               t('key', lang, 'أحمد', 3)    → {0} {1}
 * @returns {string}
 */
export function getText(
  key: TranslationKey | string,
  lang: TranslationLanguage = 'ar',
  ...replacements: Array<TranslationReplacement | TranslationNamedReplacements>
) : string {
  const entry = t[key];
  let text = entry ? (entry[lang] ?? entry.ar ?? String(key)) : String(key);

  if (
    replacements.length === 1 &&
    replacements[0] !== null &&
    typeof replacements[0] === 'object' &&
    !Array.isArray(replacements[0])
  ) {
    const vars = replacements[0] as TranslationNamedReplacements;
    text = text.replace(/\{(\w+)\}/g, (_match: string, k: string) => String(vars[k] ?? ''));
  } else {
    replacements.forEach((val, i) => {
      text = text.replace(new RegExp(`\\{${i}\\}`, 'g'), String(val ?? ''));
    });
  }
  return text;
}

export { t };
