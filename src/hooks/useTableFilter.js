/**
 * useTableFilter — Hook مركزي لفلاتر الجداول
 *
 * يوفر:
 *   - searchText: نص البحث العام (client-side filter)
 *   - filteredData: البيانات بعد تطبيق البحث
 *   - page / setPage
 *   - sortKey / sortDir / toggleSort
 *   - reset()
 *
 * استخدام:
 *   const { searchText, setSearch, filteredData, page, setPage, totalPages,
 *           sortKey, sortDir, toggleSort } = useTableFilter(data, {
 *     searchKeys: ['nameAr', 'invoiceNumber'],
 *     pageSize: 50,
 *   });
 */
import { useState, useMemo, useCallback } from 'react';

/**
 * @param {Array}  data
 * @param {Object} opts
 * @param {string[]} opts.searchKeys  - حقول البحث (دعم عربي/إنجليزي)
 * @param {number}   [opts.pageSize=50]
 * @param {string}   [opts.defaultSortKey]
 * @param {'asc'|'desc'} [opts.defaultSortDir='asc']
 * @param {string[]} [opts.dateKeys]  - حقول التاريخ (مقارنة timestamp)
 */
export function useTableFilter(data = [], {
  searchKeys        = [],
  pageSize          = 50,
  defaultSortKey    = null,
  defaultSortDir    = 'asc',
  dateKeys          = [],
} = {}) {
  const [searchText, setSearch]  = useState('');
  const [page, setPage]          = useState(1);
  const [sortKey, setSortKey]    = useState(defaultSortKey);
  const [sortDir, setSortDir]    = useState(defaultSortDir);

  // ── البحث ────────────────────────────────────────────────
  const searched = useMemo(() => {
    const q = (searchText || '').trim().toLowerCase();
    if (!q || searchKeys.length === 0) return data;
    return data.filter((row) =>
      searchKeys.some((key) => {
        const val = row[key];
        return val != null && String(val).toLowerCase().includes(q);
      }),
    );
  }, [data, searchText, searchKeys]);

  // ── الترتيب ───────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortKey) return searched;
    return [...searched].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp;
      if (dateKeys.includes(sortKey) && (av || bv)) {
        const ta = av ? new Date(av).getTime() : 0;
        const tb = bv ? new Date(bv).getTime() : 0;
        cmp = ta - tb;
      } else if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'ar');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [searched, sortKey, sortDir, dateKeys]);

  // ── التصفح ───────────────────────────────────────────────
  const totalFiltered = sorted.length;
  const totalPages    = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage      = Math.min(Math.max(1, page), totalPages);

  const paged = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  // ── تبديل الترتيب ─────────────────────────────────────────
  const toggleSort = useCallback((key) => {
    setSortKey((prev) => {
      if (prev === key) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return key; }
      setSortDir('asc');
      return key;
    });
    setPage(1);
  }, []);

  // ── تغيير البحث ───────────────────────────────────────────
  const handleSearch = useCallback((val) => {
    setSearch(val);
    setPage(1);
  }, []);

  // ── إعادة الضبط ───────────────────────────────────────────
  const reset = useCallback(() => {
    setSearch('');
    setPage(1);
    setSortKey(defaultSortKey);
    setSortDir(defaultSortDir);
  }, [defaultSortKey, defaultSortDir]);

  return {
    searchText,
    setSearch: handleSearch,
    filteredData:   paged,
    allFilteredData: sorted,
    total:          totalFiltered,
    page:           safePage,
    setPage,
    totalPages,
    sortKey,
    sortDir,
    toggleSort,
    reset,
  };
}
