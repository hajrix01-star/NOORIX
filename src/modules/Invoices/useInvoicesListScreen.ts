import { useMemo, useState, useCallback } from 'react';
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
  deleteInvoice,
  getInvoiceCreatorFilterOptions,
} from '../../services/api';
import { useDateFilter } from '../../ui/date';
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
import { useInvoicesListActions } from './useInvoicesListActions';
import { useInvoicesListQueryState } from './useInvoicesListQueryState';
import { useInvoicesListImportExportHandlers } from './useInvoicesListImportExportHandlers';
import type { InvoiceViewSource } from './invoiceViewModel';
import type { InvoiceTableRow } from './invoiceTableRowModel';
import type { InvoiceExecutiveVaultFlowRow } from './invoiceExecutiveCardsModel';
import { buildInvoiceDeleteConfirmationMessage, canDeleteInvoiceRow } from './invoiceDeleteModel';
import {
  filterInvoiceSupplierCategories,
  filterVisibleInvoiceListItems,
  getInvoiceListErrorMessage,
  isInvoiceListRawInvoice,
  mapInvoicesToListTableRows,
  normalizeInvoiceCreatorFilterOptions,
  resolveInvoiceListCompanyDisplay,
  resolveInvoiceListVaultRowLabel,
  toInvoiceListViewSource,
  type InvoiceListCreatorFilterOptions,
  type InvoiceListCreatorFilterOptionsResponse,
  type InvoiceListRawInvoice,
} from './invoicesListScreenModel';

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
  const companyId = activeCompanyId ?? '';
  const {
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
  } = useInvoicesListQueryState(companyId);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [exportBusy, setExportBusy] = useState(false);
  const { companyName, logoUrl } = useMemo(
    () => resolveInvoiceListCompanyDisplay({ companies, activeCompanyId, lang }),
    [companies, activeCompanyId, lang],
  );
  const [editingInvoice, setEditingInvoice] = useState<InvoiceViewSource | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceViewSource | null>(null);
  const [showImportExport, setShowImportExport] = useState(false);
  const [dayCloseOpen, setDayCloseOpen] = useState(false);
  const [cashReportOpen, setCashReportOpen] = useState(false);

  const STATUS_MAP = useMemo(() => buildActiveCancelledStatusMap(t), [t]);
  const KIND_MAP = useMemo(() => buildInvoiceKindBadgeMap(t), [t]);

  const deleteInvoiceMut = useApiMutation({
    mutationFn: ({ id }: { id: string }) => deleteInvoice(id, companyId),
    invalidateQueries: [invoiceKeys.root(), vaultKeys.root(), ledgerKeys.root()],
    successToast: () => t('invoiceDeleted'),
    errorToast: (error: unknown) => getInvoiceListErrorMessage(error, t('deleteFailed')),
  });

  const confirmAndDeleteInvoice = useCallback(
    (r: InvoiceTableRow | InvoiceViewSource) => {
      if (!canDeleteInvoiceRow(r)) return;
      if (!confirm(buildInvoiceDeleteConfirmationMessage(t, r))) return;
      deleteInvoiceMut.mutate({ id: r.id });
    },
    [t, deleteInvoiceMut],
  );

  const { suppliers } = useSuppliers(companyId);
  const { flatCategories } = useCategories(companyId);
  const supplierCategories = useMemo(
    () => filterInvoiceSupplierCategories(flatCategories),
    [flatCategories],
  );
  const { data: creatorFilterOptions = { users: [] } } = useApiQuery<
    InvoiceListCreatorFilterOptionsResponse,
    InvoiceListCreatorFilterOptions
  >({
    queryKey: invoiceKeys.creatorFilterOptions(companyId),
    queryFn: () => getInvoiceCreatorFilterOptions(companyId),
    select: normalizeInvoiceCreatorFilterOptions,
    enabled: !!companyId,
    fallbackMessage: t('loadingError'),
  });
  const creatorUsersForFilter = creatorFilterOptions.users || [];
  const { vaultsList = [], paymentVaults = [] } = useVaults({ companyId });

  const { items, total, sums, inflowByVault, outflowSummary, isLoading, isFetching, isPlaceholderData, isError, error } = useInvoices({
    ...invoiceListFetchParams,
    page,
    pageSize: PAGE_SIZE,
  });

  const tableData = useMemo(() => {
    const visibleItems = filterVisibleInvoiceListItems({
      invoices: items.filter(isInvoiceListRawInvoice),
      showCancelled,
    });
    return mapInvoicesToListTableRows({ invoices: visibleItems, t, lang });
  }, [items, showCancelled, t, lang]);

  const displayedTotal = total || 0;

  const mapInvoiceToExportRow = useCallback(
    (inv: InvoiceListRawInvoice) => invoiceToExportRow(inv, { t, lang, kindMap: KIND_MAP, statusMap: STATUS_MAP }),
    [KIND_MAP, STATUS_MAP, t, lang],
  );

  const exportColumnDefs = useMemo(() => buildInvoiceExportColumnDefs(t), [t]);

  const serverAll = sums.all;
  const serverInflow = sums.inflow;
  const serverOutflow = sums.outflow;

  const { handleExportExcel, handlePrintInvoices, handlePrintSingleInvoice, printPreviewModal } = useInvoicesListActions({
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
    serverAll,
  });

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
        setViewingInvoice: (row) => setViewingInvoice(toInvoiceListViewSource(row)),
        setEditingInvoice: (row) => setEditingInvoice(toInvoiceListViewSource(row)),
        printInvoice: handlePrintSingleInvoice,
        confirmAndDeleteInvoice,
      }),
    [userRole, companyId, t, lang, STATUS_MAP, KIND_MAP, confirmAndDeleteInvoice, fmt, handlePrintSingleInvoice],
  );

  const handlePrintCashReport = useCallback(() => {
    setCashReportOpen(true);
  }, []);

  const vaultRowLabel = useCallback(
    (row: InvoiceExecutiveVaultFlowRow) =>
      resolveInvoiceListVaultRowLabel({
        row,
        lang,
        unassignedLabel: t('invoicesSalesUnassignedVault'),
      }),
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
        setEditingInvoice: (row) => setEditingInvoice(toInvoiceListViewSource(row)),
        printInvoice: handlePrintSingleInvoice,
        confirmAndDeleteInvoice,
      }),
    [KIND_MAP, STATUS_MAP, userRole, companyId, t, lang, confirmAndDeleteInvoice, handlePrintSingleInvoice],
  );

  const renderCompactRow = useMemo(
    () =>
      createInvoiceCompactRowRenderer({
        t,
        STATUS_MAP,
        KIND_MAP,
        userRole,
        companyId,
        setViewingInvoice: (row) => setViewingInvoice(toInvoiceListViewSource(row)),
        setEditingInvoice: (row) => setEditingInvoice(toInvoiceListViewSource(row)),
        printInvoice: handlePrintSingleInvoice,
        confirmAndDeleteInvoice,
      }),
    [KIND_MAP, STATUS_MAP, userRole, companyId, t, confirmAndDeleteInvoice, handlePrintSingleInvoice],
  );

  const clearEditingInvoice = useCallback(() => setEditingInvoice(null), []);
  const { importExportExportFetcher, onImportInvoicesSuccess, onInvoiceEditSaved } = useInvoicesListImportExportHandlers({
    companyId,
    startDate: dateFilter.startDate,
    endDate: dateFilter.endDate,
    filterKind,
    urlExtra,
    sortKey,
    sortDir,
    filterSupplierId,
    filterSupplierCategoryId,
    debouncedQ,
    showCancelled,
    filterHasNotesOnly,
    filterVaultId,
    invoiceBatchIdFromUrl,
    filterCreatedByUserId,
    t,
    queryClient,
    showToast,
    clearEditingInvoice,
  });

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
    handlePrintSingleInvoice,
    printPreviewModal,
    handlePrintCashReport,
    editingInvoice,
    setEditingInvoice,
    confirmAndDeleteInvoice,
    userRole,
    userPermissions,
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
