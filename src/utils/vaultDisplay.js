/**
 * vaultDisplay — عرض أسماء الخزائن حسب لغة الواجهة
 */

/**
 * اسم الخزينة للعرض حسب اللغة
 * @param {object} vault - كائن الخزينة { nameAr, nameEn }
 * @param {string} lang - 'ar' | 'en'
 * @returns {string}
 */
export function vaultDisplayName(vault, lang) {
  if (!vault) return '—';
  return lang === 'en' ? (vault.nameEn || vault.nameAr || '—') : (vault.nameAr || vault.nameEn || '—');
}
