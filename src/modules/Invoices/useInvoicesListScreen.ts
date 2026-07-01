import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useApiQuery } from '../../hooks/useApiQuery';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { useApp } from '../../context/AppContext';
import { hasPermission, PERMISSIONS } from '../../constants/permissions';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useInvoices } from '../../hooks/useInvoices';
import { useSuppliers } from '../../hooks/useSuppliers';
import { useCategories } from '../../hooks/useCategories';
import { useVaults } from '../../hooks/useVaults';
import { fmt } from '../../utils/format';
import {
  getInvoices,
  deleteInvoice,
  getInvoiceCreatorFilterOptions,
  unwrapApiList,
} from '../../services/api';
import { useDateFilter } from '../../shared/components/DateFilterBar';
import { formatInvoiceForExport } from '../../utils/importTemplates';
import { buildActiveCancelledStatusMap, buildInvoiceKindBadgeMap } from '../../constants/badgeMaps';
import { PAGE_SIZE } from './invoicesListScreenHelpers';
import { invoiceKeys, ledgerKeys, vaultKeys } from '../../services/queryKeys';
import { buildInvoiceExportColumnDefs, invoiceToExportRow } from './invoicesListExportModel';
import {
  buildInvoiceListColumns,
  buildInvoiceListFooterRow,
  createInvoiceListMobileCardRenderer,
  createInvoiceCompactRowRenderer,
} from './invoicesListTableModel';
import { nextInvoiceSortState } from './invoicesListSort';
import { toYmd } from '../../utils/saudiDate';
import { useInvoicesListActions } from './useInvoicesListActions';

/**
 * منطق شاشة قائمة الفواتير — عرض فقط يبقى في InvoicesListScreen.jsx
 */
export function useInvoicesListScreen() {
  const { activeCompanyId, userRole, userPermissions, companies } = useApp();
  const invoicesViewExecSummary = hasPermission(
    userRole,
    PERMISSIONS.INVOICES_VIEW_EXEC_SUMMARY,
    userPermissions,
  );
  const canFilterSaleInvoices = hasPermission(userRole, PERMISSIONS.VIEW_INVOICES, userPermissions);
  const { t, lang } = useTranslation();
  const [searchParams] = useSearchParams();
  const fromUrl = toYmd(searchParams.get('from'));
  const toUrl = toYmd(searchParams.get('to'));
  const invoiceBatchIdFromUrl = searchParams.get('batchId')?.trim() || '';
  const urlDrillKeyRef = useRef('');
  const companyId = activeCompanyId ?? '';
  const dateFilter = useDateFilter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [exportBusy, setExportBusy] = useState(false);
  const activeCo = companies?.find((c: any) => c.id === activeCompanyId);
  const companyName =
    (lang === 'en' ? activeCo?.nameEn || activeCo?.nameAr : activeCo?.nameAr || activeCo?.nameEn) || '';
  const logoUrl = activeCo?.logoUrl || '';
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const [filterKind, setFilterKind] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [filterSupplierCategoryId, setFilterSupplierCategoryId] = useState('');
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
  const [cashReportOpen, setCashReportOpen] = useState(false);
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
    const keys = ['from', 'to', 'kind', 'supplierId', 'supplierCategoryId', 'categoryId', 'expenseLineId', 'q', 'batchId'];
    const parts = keys.map((k: any) => searchParams.get(k) || '');
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
    const supplierCategoryId = searchParams.get('supplierCategoryId') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const expenseLineId = searchParams.get('expenseLineId') || '';
    const q = searchParams.get('q') || '';
    if (from && to) {
      dateFilter.setMode('range');
      dateFilter.setRangeStart(toYmd(from));
      dateFilter.setRangeEnd(toYmd(to));
    }
    if (kind) {
      if (kind.includes(',')) {
        setFilterKind('');
        setUrlExtra((p: any) => ({ ...p, kind }));
      } else {
        setFilterKind(kind);
        setUrlExtra((p: any) => ({ ...p, kind: '' }));
      }
    }
    if (supplierId) setFilterSupplierId(supplierId);
    if (supplierCategoryId) setFilterSupplierCategoryId(supplierCategoryId);
    if (categoryId) setUrlExtra((p: any) => ({ ...p, categoryId }));
    if (expenseLineId) setUrlExtra((p: any) => ({ ...p, expenseLineId }));
    if (q) {
      setSearchText(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- نقرأ فقط دوال فلتر التاريخ المستقرة
  }, [searchParams]);

  const STATUS_MAP = useMemo(() => buildActiveCancelledStatusMap(t), [t]);
  const KIND_MAP = useMemo(() => buildInvoiceKindBadgeMap(t), [t]);

  const deleteInvoiceMut = useApiMutation({
    mutationFn: ({ id }: any) => deleteInvoice(id, companyId),
    invalidateQueries: [invoiceKeys.root(), vaultKeys.root(), ledgerKeys.root()],
    successToast: () => t('invoiceDeleted'),
    errorToast: (e: any) => e?.message || t('deleteFailed'),
  });

  const confirmAndDeleteInvoice = useCallback(
    (r: any) => {
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
  const { flatCategories } = useCategories(companyId);
  const supplierCategories = useMemo(
    () =>
      (flatCategories || []).filter((c: any) => {
        const type = String(c?.type || '').toLowerCase();
        return type === 'purchase' || type === 'expense';
      }),
    [flatCategories],
  );
  const { data: creatorFilterOptions = { users: [] } } = useApiQuery<{ users: any[] }>({
    queryKey: invoiceKeys.creatorFilterOptions(companyId),
    queryFn: () => getInvoiceCreatorFilterOptions(companyId),
    enabled: !!companyId,
    fallbackMessage: t('loadingError'),
  });
  const creatorUsersForFilter = creatorFilterOptions.users || [];
  const { vaultsList = [], paymentVaults = [] } = useVaults({ companyId });

  const dayCloseDefaultYmd = useMemo(
    () => toYmd(dateFilter.endDate || dateFilter.startDate),
    [dateFilter.endDate, dateFilter.startDate],
  );

  const kindForApi = filterKind || urlExtra.kind || undefined;

  const { items, total, sums, inflowByVault, outflowSummary, isLoading, isFetching, isPlaceholderData, isError, error } = useInvoices({
    companyId,
    startDate: invoiceQueryStartDate,
    endDate: invoiceQueryEndDate,
    page,
    pageSize: PAGE_SIZE,
    kind: kindForApi,
    supplierId: filterSupplierId || undefined,
    supplierCategoryId: filterSupplierCategoryId || undefined,
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
      (items || []).map((inv: any) => ({
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
    (key: any) => {
      setPage(1);
      const next = nextInvoiceSortState(sortKey, sortDir, key);
      setSortKey(next.sortKey);
      setSortDir(next.sortDir);
    },
    [sortKey, sortDir],
  );

  const mapInvoiceToExportRow = useCallback(
    (inv: any) => invoiceToExportRow(inv, { t, lang, kindMap: KIND_MAP, statusMap: STATUS_MAP }),
    [KIND_MAP, STATUS_MAP, t, lang],
  );

  const exportColumnDefs = useMemo(() => buildInvoiceExportColumnDefs(t), [t]);

  const serverAll = sums.all;
  const serverInflow = sums.inflow;
  const serverOutflow = sums.outflow;

  const { handleExportExcel, handlePrintInvoices } = useInvoicesListActions({
    companyId,
    displayedTotal,
    invoiceQueryStartDate,
    invoiceQueryEndDate,
    dateFilterLabel: dateFilter.label,
    fromUrl,
    toUrl,
    kindForApi,
    sortKey,
    sortDir,
    filterSupplierId,
    filterSupplierCategoryId,
    debouncedQ,
    urlExtra,
    showCancelled,
    filterHasNotesOnly,
    filterVaultId,
    invoiceBatchIdFromUrl,
    filterCreatedByUserId,
    mapInvoiceToExportRow,
    exportColumnDefs,
    companyName,
    logoUrl,
    lang,
    t,
    fmt,
    showToast,
    setExportBusy,
    vaultsList,
    serverAll,
  });

  const handlePrintCashReport = useCallback(() => {
    setCashReportOpen(true);
  }, []);

  const vaultRowLabel = useCallback(
    (row: any) => {
      if (row.unassigned) return t('invoicesSalesUnassignedVault');
      const n = lang === 'en' ? row.nameEn || row.nameAr : row.nameAr || row.nameEn;
      return n || '—';
    },
    [t, lang],
  );

  const footerRow = useMemo(
    () => (invoicesViewExecSummary ? buildInvoiceListFooterRow({ t, serverAll, total }) : undefined),
    [invoicesViewExecSummary, t, serverAll, total],
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

  const renderCompactRow = useMemo(
    () =>
      createInvoiceCompactRowRenderer({
        t,
        STATUS_MAP,
        KIND_MAP,
        userRole,
        companyId,
        setViewingInvoice,
        setEditingInvoice,
        confirmAndDeleteInvoice,
      }),
    [KIND_MAP, STATUS_MAP, userRole, companyId, t, confirmAndDeleteInvoice],
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
      filterSupplierCategoryId || undefined,
      debouncedQ || undefined,
      urlExtra.categoryId || undefined,
      urlExtra.expenseLineId || undefined,
      true,
      filterHasNotesOnly || undefined,
      filterVaultId || undefined,
      filterCreatedByUserId || undefined,
    );
    return unwrapApiList<any>(res, t('exportFailed')).map(formatInvoiceForExport);
  }, [
    companyId,
    dateFilter.startDate,
    dateFilter.endDate,
    filterKind,
    urlExtra.kind,
    urlExtra.categoryId,
    urlExtra.expenseLineId,
    filterSupplierId,
    filterSupplierCategoryId,
    debouncedQ,
    filterHasNotesOnly,
    filterVaultId,
    filterCreatedByUserId,
    t,
  ]);

  const onImportInvoicesSuccess = useCallback(
    (count: any) => {
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
    handlePrintCashReport,
    editingInvoice,
    setEditingInvoice,
    viewingInvoice,
    setViewingInvoice,
    queryClient,
    suppliers,
    supplierCategories,
    paymentVaults,
    dayCloseDefaultYmd,
    dayCloseOpen,
    setDayCloseOpen,
    cashReportOpen,
    setCashReportOpen,
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
    filterSupplierCategoryId,
    setFilterSupplierCategoryId,
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
    isFetching,
    isPlaceholderData,
    isError,
    error,
    footerRow,
    searchText,
    setSearchText,
    sortKey,
    sortDir,
    toggleSort,
    renderMobileCard,
    renderCompactRow,
    showToast,
    PAGE_SIZE,
    invoicesViewExecSummary,
    canFilterSaleInvoices,
    invoiceQueryStartDate,
    invoiceQueryEndDate,
    dateFilterLabel: dateFilter.label,
    fromUrl,
    toUrl,
    companyName,
  };
}
