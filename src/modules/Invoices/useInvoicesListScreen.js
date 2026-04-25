import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../hooks/useApiMutation';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useInvoices } from '../../hooks/useInvoices';
import { useSuppliers } from '../../hooks/useSuppliers';
import { useVaults } from '../../hooks/useVaults';
import { fmt } from '../../utils/format';
import {
  getInvoices,
  deleteInvoice,
  fetchAllInvoicesForExport,
  getInvoiceCreatorFilterOptions,
} from '../../services/api';
import { exportToExcel } from '../../utils/exportUtils';
import { openPrintWindow } from '../../utils/printUtils';
import { useDateFilter } from '../../shared/components/DateFilterBar';
import { formatInvoiceForExport } from '../../utils/importTemplates';
import { buildActiveCancelledStatusMap, buildInvoiceKindBadgeMap } from '../../constants/badgeMaps';
import { PAGE_SIZE, MAX_VAULT_SLOTS } from './invoicesListScreenHelpers';
import { buildInvoiceExportColumnDefs, invoiceToExportRow } from './invoicesListExportModel';
import {
  buildInvoiceListColumns,
  buildInvoiceListFooterRow,
  createInvoiceListMobileCardRenderer,
} from './invoicesListTableModel.jsx';
import { nextInvoiceSortState } from './invoicesListSort';

/**
 * منطق شاشة قائمة الفواتير — عرض فقط يبقى في InvoicesListScreen.jsx
 */
export function useInvoicesListScreen() {
  const { activeCompanyId, userRole, companies } = useApp();
  const { t, lang } = useTranslation();
  const [searchParams] = useSearchParams();
  const fromUrl = searchParams.get('from')?.slice(0, 10) || '';
  const toUrl = searchParams.get('to')?.slice(0, 10) || '';
  const invoiceBatchIdFromUrl = searchParams.get('batchId')?.trim() || '';
  const urlDrillKeyRef = useRef('');
  const companyId = activeCompanyId ?? '';
  const dateFilter = useDateFilter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [exportBusy, setExportBusy] = useState(false);
  const activeCo = companies?.find((c) => c.id === activeCompanyId);
  const companyName =
    (lang === 'en' ? activeCo?.nameEn || activeCo?.nameAr : activeCo?.nameAr || activeCo?.nameEn) || '';
  const logoUrl = activeCo?.logoUrl || '';
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [filterKind, setFilterKind] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [filterCreatedByUserId, setFilterCreatedByUserId] = useState('');
  const [filterVaultId, setFilterVaultId] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [filterHasNotesOnly, setFilterHasNotesOnly] = useState(false);
  const [urlExtra, setUrlExtra] = useState({ kind: '', categoryId: '', expenseLineId: '' });
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('transactionDate');
  const [sortDir, setSortDir] = useState('desc');
  const [showImportExport, setShowImportExport] = useState(false);
  const [dayCloseOpen, setDayCloseOpen] = useState(false);
  const [dayCloseOpenV2, setDayCloseOpenV2] = useState(false);
  const qInit = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('q') || '' : '';
  const [searchText, setSearchText] = useState(qInit);
  const debouncedQ = useDebouncedValue((searchText || '').trim(), 300);

  const invoiceQueryStartDate = useMemo(
    () => (fromUrl && toUrl ? fromUrl : dateFilter.startDate),
    [fromUrl, toUrl, dateFilter.startDate],
  );
  const invoiceQueryEndDate = useMemo(
    () => (fromUrl && toUrl ? toUrl : dateFilter.endDate),
    [fromUrl, toUrl, dateFilter.endDate],
  );

  useEffect(() => {
    setPage(1);
  }, [
    debouncedQ,
    dateFilter.startDate,
    dateFilter.endDate,
    filterKind,
    filterSupplierId,
    filterCreatedByUserId,
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
    const keys = ['from', 'to', 'kind', 'supplierId', 'categoryId', 'expenseLineId', 'q', 'batchId'];
    const parts = keys.map((k) => searchParams.get(k) || '');
    const drillKey = parts.join('\u001f');
    if (!parts.some(Boolean)) {
      urlDrillKeyRef.current = '';
      return;
    }
    if (urlDrillKeyRef.current === drillKey) return;
    urlDrillKeyRef.current = drillKey;

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const kind = searchParams.get('kind') || '';
    const supplierId = searchParams.get('supplierId') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const expenseLineId = searchParams.get('expenseLineId') || '';
    const q = searchParams.get('q') || '';
    if (from && to) {
      dateFilter.setMode('range');
      dateFilter.setRangeStart(from.slice(0, 10));
      dateFilter.setRangeEnd(to.slice(0, 10));
    }
    if (kind) {
      if (kind.includes(',')) {
        setFilterKind('');
        setUrlExtra((p) => ({ ...p, kind }));
      } else {
        setFilterKind(kind);
        setUrlExtra((p) => ({ ...p, kind: '' }));
      }
    }
    if (supplierId) setFilterSupplierId(supplierId);
    if (categoryId) setUrlExtra((p) => ({ ...p, categoryId }));
    if (expenseLineId) setUrlExtra((p) => ({ ...p, expenseLineId }));
    if (q) {
      setSearchText(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- نقرأ فقط دوال فلتر التاريخ المستقرة
  }, [searchParams]);

  const STATUS_MAP = useMemo(() => buildActiveCancelledStatusMap(t), [t]);
  const KIND_MAP = useMemo(() => buildInvoiceKindBadgeMap(t), [t]);

  const deleteInvoiceMut = useApiMutation({
    mutationFn: ({ id }) => deleteInvoice(id, companyId),
    invalidateQueries: [['invoices'], ['vaults'], ['ledger']],
    successToast: () => t('invoiceDeleted'),
    errorToast: (e) => e?.message || t('deleteFailed'),
  });

  const confirmAndDeleteInvoice = useCallback(
    (r) => {
      if (!confirm(t('deleteInvoiceConfirm', r.invoiceNumber || ''))) return;
      deleteInvoiceMut.mutate({ id: r.id });
    },
    [t, deleteInvoiceMut],
  );

  const columns = useMemo(
    () =>
      buildInvoiceListColumns({
        t,
        lang,
        fmt,
        STATUS_MAP,
        KIND_MAP,
        userRole,
        companyId,
        setViewingInvoice,
        setEditingInvoice,
        confirmAndDeleteInvoice,
      }),
    [userRole, companyId, t, lang, STATUS_MAP, KIND_MAP, confirmAndDeleteInvoice, fmt],
  );

  const { suppliers } = useSuppliers(companyId);
  const { data: creatorFilterOptions = { users: [] } } = useQuery({
    queryKey: ['invoice-creator-filter-options', companyId],
    queryFn: async () => {
      const res = await getInvoiceCreatorFilterOptions(companyId);
      return res.success ? { users: res.users } : { users: [] };
    },
    enabled: !!companyId,
  });
  const creatorUsersForFilter = creatorFilterOptions.users || [];
  const { vaultsList = [], paymentVaults = [] } = useVaults({ companyId });

  const dayCloseDefaultYmd = useMemo(
    () => (dateFilter.endDate || dateFilter.startDate || '').slice(0, 10),
    [dateFilter.endDate, dateFilter.startDate],
  );

  const kindForApi = filterKind || urlExtra.kind || undefined;

  const { items, total, sums, inflowByVault, outflowSummary, isLoading, isError, error } = useInvoices({
    companyId,
    startDate: invoiceQueryStartDate,
    endDate: invoiceQueryEndDate,
    page,
    pageSize: PAGE_SIZE,
    kind: kindForApi,
    supplierId: filterSupplierId || undefined,
    sortBy: sortKey,
    sortDir,
    q: debouncedQ || undefined,
    categoryId: urlExtra.categoryId || undefined,
    expenseLineId: urlExtra.expenseLineId || undefined,
    includeCancelled: showCancelled,
    hasNotes: filterHasNotesOnly || undefined,
    vaultId: filterVaultId || undefined,
    batchId: invoiceBatchIdFromUrl || undefined,
    createdByUserId: filterCreatedByUserId || undefined,
  });

  const tableData = useMemo(
    () =>
      (items || []).map((inv) => ({
        ...inv,
        supplierName:
          inv.kind === 'sale'
            ? t('categoryTypeSale') || 'مبيعات'
            : lang === 'en'
              ? inv.supplier?.nameEn || inv.supplier?.nameAr || ''
              : inv.supplier?.nameAr || inv.supplier?.nameEn || '',
        createdByDisplayName: inv.createdByUser
          ? lang === 'en'
            ? inv.createdByUser.nameEn ||
              inv.createdByUser.nameAr ||
              inv.createdByUser.email ||
              ''
            : inv.createdByUser.nameAr ||
              inv.createdByUser.nameEn ||
              inv.createdByUser.email ||
              ''
          : '',
        notesOrEmployee: inv.notes || '',
      })),
    [items, t, lang],
  );

  const displayedTotal = total || 0;

  const toggleSort = useCallback(
    (key) => {
      setPage(1);
      const next = nextInvoiceSortState(sortKey, sortDir, key);
      setSortKey(next.sortKey);
      setSortDir(next.sortDir);
    },
    [sortKey, sortDir],
  );

  const mapInvoiceToExportRow = useCallback(
    (inv) => invoiceToExportRow(inv, { t, lang, kindMap: KIND_MAP, statusMap: STATUS_MAP }),
    [KIND_MAP, STATUS_MAP, t, lang],
  );

  const exportColumnDefs = useMemo(() => buildInvoiceExportColumnDefs(t), [t]);

  const handleExportExcel = useCallback(async () => {
    if (!companyId || displayedTotal === 0) return;
    setExportBusy(true);
    try {
      const all = await fetchAllInvoicesForExport({
        companyId,
        startDate: invoiceQueryStartDate,
        endDate: invoiceQueryEndDate,
        kind: kindForApi,
        sortBy: sortKey,
        sortDir,
        supplierId: filterSupplierId || undefined,
        q: debouncedQ || undefined,
        categoryId: urlExtra.categoryId || undefined,
        expenseLineId: urlExtra.expenseLineId || undefined,
        includeCancelled: showCancelled,
        hasNotes: filterHasNotesOnly || undefined,
        vaultId: filterVaultId || undefined,
        batchId: invoiceBatchIdFromUrl || undefined,
        createdByUserId: filterCreatedByUserId || undefined,
      });
      const rows = all.map(mapInvoiceToExportRow);
      const safeStart = String(invoiceQueryStartDate || '').slice(0, 10).replace(/[^\d-]/g, '') || 'start';
      const safeEnd = String(invoiceQueryEndDate || '').slice(0, 10).replace(/[^\d-]/g, '') || 'end';
      await exportToExcel({
        data: rows,
        filename: `invoices-${safeStart}_${safeEnd}.xlsx`,
        title: `${t('invoicesTitle')} — ${dateFilter.label || ''}`,
        companyName,
        sheetName: lang === 'en' ? 'Invoices' : 'فواتير',
        columns: exportColumnDefs,
        rtl: true,
      });
      showToast(t('exportSuccess') || 'تم التصدير', 'success');
    } catch (e) {
      showToast(e?.message || t('exportFailed'), 'error');
    } finally {
      setExportBusy(false);
    }
  }, [
    companyId,
    displayedTotal,
    invoiceQueryStartDate,
    invoiceQueryEndDate,
    dateFilter.label,
    kindForApi,
    sortKey,
    sortDir,
    filterSupplierId,
    debouncedQ,
    urlExtra.categoryId,
    urlExtra.expenseLineId,
    showCancelled,
    mapInvoiceToExportRow,
    exportColumnDefs,
    companyName,
    t,
    lang,
    showToast,
    filterHasNotesOnly,
    filterVaultId,
    invoiceBatchIdFromUrl,
    filterCreatedByUserId,
  ]);

  const serverAll = sums.all;
  const serverInflow = sums.inflow;
  const serverOutflow = sums.outflow;

  const handlePrintInvoices = useCallback(async () => {
    if (!companyId || displayedTotal === 0) return;
    setExportBusy(true);
    try {
      const all = await fetchAllInvoicesForExport({
        companyId,
        startDate: invoiceQueryStartDate,
        endDate: invoiceQueryEndDate,
        kind: kindForApi,
        sortBy: sortKey,
        sortDir,
        supplierId: filterSupplierId || undefined,
        q: debouncedQ || undefined,
        categoryId: urlExtra.categoryId || undefined,
        expenseLineId: urlExtra.expenseLineId || undefined,
        includeCancelled: showCancelled,
        hasNotes: filterHasNotesOnly || undefined,
        vaultId: filterVaultId || undefined,
        batchId: invoiceBatchIdFromUrl || undefined,
        createdByUserId: filterCreatedByUserId || undefined,
      });
      const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const rowsHtml = all
        .map((inv) => {
          const r = mapInvoiceToExportRow(inv);
          return `<tr>${exportColumnDefs.map((c) => `<td>${esc(r[c.key])}</td>`).join('')}</tr>`;
        })
        .join('');
      const head = `<tr>${exportColumnDefs.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr>`;
      const nc = exportColumnDefs.length;
      const baseMetaCols = 6;
      const vaultBlockCols = MAX_VAULT_SLOTS * 3;
      const foot = `<tr><td colspan="${baseMetaCols}">${esc(t('totalInvoices', serverAll.count))}</td><td colspan="${vaultBlockCols}"></td><td>${esc(fmt(Number(serverAll.net)))} SR</td><td>${esc(fmt(Number(serverAll.tax)))} SR</td><td>${esc(fmt(Number(serverAll.total)))} SR</td><td colspan="2"></td></tr>`;
      const table = `<table><thead>${head}</thead><tbody>${rowsHtml || `<tr><td colspan="${nc}">${esc(t('noInvoicesInPeriod'))}</td></tr>`}</tbody><tfoot>${foot}</tfoot></table>`;
      openPrintWindow({
        title: t('invoicesTitle'),
        companyName,
        subtitle: `${t('invoicesTitle')} — ${(fromUrl && toUrl ? `${fromUrl} — ${toUrl}` : dateFilter.label) || ''}`,
        logoUrl,
        landscape: true,
        body: table,
      });
    } catch (e) {
      showToast(e?.message || t('exportFailed'), 'error');
    } finally {
      setExportBusy(false);
    }
  }, [
    companyId,
    displayedTotal,
    invoiceQueryStartDate,
    invoiceQueryEndDate,
    fromUrl,
    toUrl,
    dateFilter.label,
    kindForApi,
    sortKey,
    sortDir,
    filterSupplierId,
    debouncedQ,
    urlExtra.categoryId,
    urlExtra.expenseLineId,
    showCancelled,
    mapInvoiceToExportRow,
    exportColumnDefs,
    t,
    companyName,
    logoUrl,
    serverAll,
    fmt,
    showToast,
    filterHasNotesOnly,
    filterVaultId,
    invoiceBatchIdFromUrl,
    filterCreatedByUserId,
  ]);

  const vaultRowLabel = useCallback(
    (row) => {
      if (row.unassigned) return t('invoicesSalesUnassignedVault');
      const n = lang === 'en' ? row.nameEn || row.nameAr : row.nameAr || row.nameEn;
      return n || '—';
    },
    [t, lang],
  );

  const footerRow = useMemo(
    () => buildInvoiceListFooterRow({ t, serverAll, total }),
    [t, serverAll, total],
  );

  const renderMobileCard = useMemo(
    () =>
      createInvoiceListMobileCardRenderer({
        t,
        lang,
        STATUS_MAP,
        KIND_MAP,
        userRole,
        companyId,
        setEditingInvoice,
        confirmAndDeleteInvoice,
      }),
    [KIND_MAP, STATUS_MAP, userRole, companyId, t, lang, confirmAndDeleteInvoice],
  );

  const importExportExportFetcher = useCallback(async () => {
    const kindForExport = filterKind || (urlExtra.kind ? urlExtra.kind.split(',')[0] : '');
    const res = await getInvoices(
      companyId,
      dateFilter.startDate,
      dateFilter.endDate,
      1,
      2000,
      undefined,
      undefined,
      kindForExport || undefined,
      undefined,
      undefined,
      filterSupplierId || undefined,
      debouncedQ || undefined,
      urlExtra.categoryId || undefined,
      urlExtra.expenseLineId || undefined,
      true,
      filterHasNotesOnly || undefined,
      filterVaultId || undefined,
      filterCreatedByUserId || undefined,
    );
    return (res?.data?.items ?? []).map(formatInvoiceForExport);
  }, [
    companyId,
    dateFilter.startDate,
    dateFilter.endDate,
    filterKind,
    urlExtra.kind,
    urlExtra.categoryId,
    urlExtra.expenseLineId,
    filterSupplierId,
    debouncedQ,
    filterHasNotesOnly,
    filterVaultId,
    filterCreatedByUserId,
  ]);

  const onImportInvoicesSuccess = useCallback(
    (count) => {
      invalidateOnFinancialMutation(queryClient);
      showToast(`تم استيراد ${count} فاتورة بنجاح`, 'success');
    },
    [queryClient, showToast],
  );

  const onInvoiceEditSaved = useCallback(() => {
    invalidateOnFinancialMutation(queryClient);
    setEditingInvoice(null);
  }, [queryClient]);

  return {
    t,
    lang,
    fmt,
    companyId,
    dateFilter,
    exportBusy,
    displayedTotal,
    handleExportExcel,
    handlePrintInvoices,
    editingInvoice,
    setEditingInvoice,
    viewingInvoice,
    setViewingInvoice,
    queryClient,
    suppliers,
    paymentVaults,
    dayCloseDefaultYmd,
    dayCloseOpen,
    setDayCloseOpen,
    dayCloseOpenV2,
    setDayCloseOpenV2,
    showImportExport,
    setShowImportExport,
    importExportExportFetcher,
    onImportInvoicesSuccess,
    onInvoiceEditSaved,
    urlExtra,
    setUrlExtra,
    setPage,
    filterHasNotesOnly,
    setFilterHasNotesOnly,
    showCancelled,
    setShowCancelled,
    filterKind,
    setFilterKind,
    filterSupplierId,
    setFilterSupplierId,
    filterCreatedByUserId,
    setFilterCreatedByUserId,
    filterVaultId,
    setFilterVaultId,
    creatorUsersForFilter,
    vaultsList,
    serverInflow,
    serverOutflow,
    inflowByVault,
    outflowSummary,
    vaultRowLabel,
    columns,
    tableData,
    page,
    isLoading,
    isError,
    error,
    footerRow,
    searchText,
    setSearchText,
    sortKey,
    sortDir,
    toggleSort,
    renderMobileCard,
    showToast,
    PAGE_SIZE,
  };
}
