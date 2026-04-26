/**
 * منطق تبديل فرز قائمة الفواتير — قابل للاختبار بدون React
 * @param {string} sortKey المفتاح الحالي
 * @param {'asc'|'desc'} sortDir
 * @param {string} clickedKey عمود تم النقر عليه
 */
export function nextInvoiceSortState(sortKey, sortDir, clickedKey) {
  if (sortKey === clickedKey) {
    return { sortKey, sortDir: sortDir === 'desc' ? 'asc' : 'desc' };
  }
  return { sortKey: clickedKey, sortDir: 'desc' };
}
