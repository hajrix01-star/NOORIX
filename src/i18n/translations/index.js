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
import shared from './shared';
import orders from './orders';
import dashboard from './dashboard';

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
  shared,
  orders,
  dashboard
);

/**
 * استرجاع النص حسب اللغة
 * @param {keyof typeof t} key - مفتاح الترجمة
 * @param {'ar'|'en'} lang - اللغة
 * @param {...string} replacements - قيم الاستبدال للنمط {0}, {1}, ...
 * @returns {string}
 */
export function getText(key, lang = 'ar', ...replacements) {
  const entry = t[key];
  let text = entry ? (entry[lang] ?? entry.ar ?? String(key)) : String(key);
  replacements.forEach((val, i) => {
    text = text.replace(new RegExp(`\\{${i}\\}`, 'g'), String(val ?? ''));
  });
  return text;
}

export { t };
