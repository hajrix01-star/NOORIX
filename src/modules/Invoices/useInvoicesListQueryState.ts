import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedValue } from '../../ui';
import { useDateFilter } from '../../ui/date';
import { toYmd } from '../../utils/saudiDate';
import { nextInvoiceSortState } from './invoicesListSort';
import { buildInvoiceListFetchParams } from './invoicesListQueryModel';
import {
  EMPTY_INVOICE_LIST_URL_EXTRA,
  applyInvoiceListKindDrill,
  parseInvoiceListUrlState,
  resolveInvoiceListDateRange,
  resolveInvoiceListKindForApi,
} from './invoicesListUrlModel';
import type { InvoiceListSortDir } from './invoicesListQueryModel';

export function useInvoicesListQueryState(companyId: string) {
  const [searchParams] = useSearchParams();
  const urlState = useMemo(() => parseInvoiceListUrlState(searchParams), [searchParams]);
  const fromUrl = urlState.from;
  const toUrl = urlState.to;
  const invoiceBatchIdFromUrl = urlState.batchId;
  const urlDrillKeyRef = useRef('');
  const dateFilter = useDateFilter();
  const {
    setMode: setDateFilterMode,
    setRangeStart: setDateFilterRangeStart,
    setRangeEnd: setDateFilterRangeEnd,
  } = dateFilter;

  const [filterKind, setFilterKind] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [filterSupplierCategoryId, setFilterSupplierCategoryId] = useState('');
  const [filterCreatedByUserId, setFilterCreatedByUserId] = useState('');
  const [filterVaultId, setFilterVaultId] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [filterHasNotesOnly, setFilterHasNotesOnly] = useState(false);
  const [urlExtra, setUrlExtra] = useState(EMPTY_INVOICE_LIST_URL_EXTRA);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('transactionDate');
  const [sortDir, setSortDir] = useState<InvoiceListSortDir>('desc');
  const [searchText, setSearchText] = useState(urlState.q);
  const debouncedQ = useDebouncedValue((searchText || '').trim(), 300);

  const invoiceQueryDateRange = useMemo(
    () =>
      resolveInvoiceListDateRange({
        fromUrl,
        toUrl,
        fallbackStartDate: dateFilter.startDate,
        fallbackEndDate: dateFilter.endDate,
      }),
    [fromUrl, toUrl, dateFilter.startDate, dateFilter.endDate],
  );
  const invoiceQueryStartDate = invoiceQueryDateRange.startDate;
  const invoiceQueryEndDate = invoiceQueryDateRange.endDate;

  useEffect(() => {
    setPage(1);
  }, [
    debouncedQ,
    dateFilter.startDate,
    dateFilter.endDate,
    filterKind,
    filterSupplierId,
    filterSupplierCategoryId,
    filterCreatedByUserId,
    filterVaultId,
    showCancelled,
    filterHasNotesOnly,
    urlExtra.kind,
    urlExtra.categoryId,
    urlExtra.expenseLineId,
    invoiceBatchIdFromUrl,
    fromUrl,
    toUrl,
  ]);

  useEffect(() => {
    if (!urlState.hasDrillValues) {
      urlDrillKeyRef.current = '';
      return;
    }
    if (urlDrillKeyRef.current === urlState.drillKey) return;
    urlDrillKeyRef.current = urlState.drillKey;

    if (urlState.from && urlState.to) {
      setDateFilterMode('range');
      setDateFilterRangeStart(urlState.from);
      setDateFilterRangeEnd(urlState.to);
    }
    if (urlState.kind) {
      const kindDrill = applyInvoiceListKindDrill(urlState.kind);
      setFilterKind(kindDrill.filterKind);
      setUrlExtra((prev) => ({ ...prev, kind: kindDrill.kind }));
    }
    if (urlState.supplierId) setFilterSupplierId(urlState.supplierId);
    if (urlState.supplierCategoryId) setFilterSupplierCategoryId(urlState.supplierCategoryId);
    if (urlState.categoryId) setUrlExtra((prev) => ({ ...prev, categoryId: urlState.categoryId }));
    if (urlState.expenseLineId) setUrlExtra((prev) => ({ ...prev, expenseLineId: urlState.expenseLineId }));
    if (urlState.q) setSearchText(urlState.q);
  }, [setDateFilterMode, setDateFilterRangeEnd, setDateFilterRangeStart, urlState]);

  const kindForApi = resolveInvoiceListKindForApi(filterKind, urlExtra.kind);

  const invoiceListFetchParams = useMemo(
    () =>
      buildInvoiceListFetchParams({
        companyId,
        startDate: invoiceQueryStartDate,
        endDate: invoiceQueryEndDate,
        kind: kindForApi,
        sortBy: sortKey,
        sortDir,
        supplierId: filterSupplierId,
        supplierCategoryId: filterSupplierCategoryId,
        q: debouncedQ,
        categoryId: urlExtra.categoryId,
        expenseLineId: urlExtra.expenseLineId,
        includeCancelled: showCancelled,
        hasNotes: filterHasNotesOnly,
        vaultId: filterVaultId,
        batchId: invoiceBatchIdFromUrl,
        createdByUserId: filterCreatedByUserId,
      }),
    [
      companyId,
      invoiceQueryStartDate,
      invoiceQueryEndDate,
      kindForApi,
      sortKey,
      sortDir,
      filterSupplierId,
      filterSupplierCategoryId,
      debouncedQ,
      urlExtra.categoryId,
      urlExtra.expenseLineId,
      showCancelled,
      filterHasNotesOnly,
      filterVaultId,
      invoiceBatchIdFromUrl,
      filterCreatedByUserId,
    ],
  );

  const toggleSort = useCallback(
    (key: string) => {
      setPage(1);
      const next = nextInvoiceSortState(sortKey, sortDir, key);
      setSortKey(next.sortKey);
      setSortDir(next.sortDir);
    },
    [sortKey, sortDir],
  );

  const dayCloseDefaultYmd = useMemo(
    () => toYmd(dateFilter.endDate || dateFilter.startDate),
    [dateFilter.endDate, dateFilter.startDate],
  );

  return {
    dateFilter,
    fromUrl,
    toUrl,
    invoiceBatchIdFromUrl,
    filterKind,
    setFilterKind,
    filterSupplierId,
    setFilterSupplierId,
    filterSupplierCategoryId,
    setFilterSupplierCategoryId,
    filterCreatedByUserId,
    setFilterCreatedByUserId,
    filterVaultId,
    setFilterVaultId,
    showCancelled,
    setShowCancelled,
    filterHasNotesOnly,
    setFilterHasNotesOnly,
    urlExtra,
    setUrlExtra,
    page,
    setPage,
    sortKey,
    sortDir,
    searchText,
    setSearchText,
    debouncedQ,
    invoiceQueryStartDate,
    invoiceQueryEndDate,
    kindForApi,
    invoiceListFetchParams,
    toggleSort,
    dayCloseDefaultYmd,
  };
}
