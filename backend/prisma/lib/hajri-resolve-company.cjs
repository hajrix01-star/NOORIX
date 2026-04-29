/**
 * مطابقة شركة لزرع/إصلاح HAJRI — يُفضَّل دائماً النشط عن المؤرشف عند تكرار الاسم.
 * مشترك بين seed-vat-planning-history.js و repair-hajri-vat-active-company.js
 */

/** @param {{ nameAr?: string|null; nameEn?: string|null; isArchived?: boolean }} c */
function scoreCompany(rowKey, c) {
  const na = (s) => (s || '').trim();
  let s = 0;
  if (!c.isArchived) s += 10000;

  if (rowKey === 'ARZ') {
    if (/\bARZ\b/i.test(na(c.nameEn))) s += 800;
    if (na(c.nameAr).includes('ARZ')) s += 400;
    return s;
  }

  const needle = rowKey;
  if (na(c.nameAr) === needle) s += 2000;
  else if (na(c.nameAr).includes(needle)) s += 500;
  if (na(c.nameEn) === needle) s += 1500;
  else if (na(c.nameEn).includes(needle)) s += 300;

  return s;
}

/** هل تُعد هذه الشركة مرشّحاً لمفتاح الصف؟ */
function companyMatchesKey(rowKey, c) {
  const na = (s) => (s || '').trim();
  if (rowKey === 'ARZ') {
    return /\bARZ\b/i.test(na(c.nameEn)) || na(c.nameAr).includes('ARZ');
  }
  const needle = rowKey;
  return na(c.nameAr).includes(needle) || na(c.nameEn).includes(needle);
}

/**
 * يختار أفضل شركة لمفتاح مرجعي من قائمة كاملة (يشمل المؤرشفة).
 * @param {string} rowKey
 * @param {Array<{ id: string; tenantId: string; nameAr?: string|null; nameEn?: string|null; isArchived?: boolean }>} companies
 */
function pickCompanyForHajriKey(rowKey, companies) {
  const candidates = companies.filter((c) => companyMatchesKey(rowKey, c));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => scoreCompany(rowKey, b) - scoreCompany(rowKey, a));
  return candidates[0];
}

module.exports = {
  scoreCompany,
  companyMatchesKey,
  pickCompanyForHajriKey,
};
