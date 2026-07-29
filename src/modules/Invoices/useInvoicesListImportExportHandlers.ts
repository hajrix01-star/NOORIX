import { useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { fetchInvoicesForImportExportExport } from './invoicesListImportExportModel';
import { buildInvoiceImportSuccessMessage } from './invoicesListScreenModel';
import type { InvoiceListUrlExtra } from './invoicesListUrlModel';
import type { InvoiceListSortDir } from './invoicesListQueryModel';

type Translate = (key: string, ...args: unknown[]) => string;
type ToastFn = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

export function useInvoicesListImportExportHandlers({
  companyId,
  startDate,
  endDate,
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
}: {
  companyId: string;
  startDate: string;
  endDate: string;
  filterKind: string;
  urlExtra: InvoiceListUrlExtra;
  sortKey: string;
  sortDir: InvoiceListSortDir;
  filterSupplierId: string;
  filterSupplierCategoryId: string;
  debouncedQ: string;
  showCancelled: boolean;
  filterHasNotesOnly: boolean;
  filterVaultId: string;
  invoiceBatchIdFromUrl: string;
  filterCreatedByUserId: string;
  t: Translate;
  queryClient: QueryClient;
  showToast: ToastFn;
  clearEditingInvoice: () => void;
}) {
  const importExportExportFetcher = useCallback(async () => {
    return fetchInvoicesForImportExportExport({
      companyId,
      startDate,
      endDate,
      filterKind,
      urlExtra,
      sortBy: sortKey,
      sortDir,
      supplierId: filterSupplierId,
      supplierCategoryId: filterSupplierCategoryId,
      q: debouncedQ,
      includeCancelled: showCancelled,
      hasNotes: filterHasNotesOnly,
      vaultId: filterVaultId,
      batchId: invoiceBatchIdFromUrl,
      createdByUserId: filterCreatedByUserId,
      exportFailedMessage: t('exportFailed'),
    });
  }, [
    companyId,
    startDate,
    endDate,
    sortKey,
    sortDir,
    filterKind,
    urlExtra.kind,
    urlExtra.categoryId,
    urlExtra.expenseLineId,
    filterSupplierId,
    filterSupplierCategoryId,
    debouncedQ,
    showCancelled,
    filterHasNotesOnly,
    filterVaultId,
    invoiceBatchIdFromUrl,
    filterCreatedByUserId,
    t,
  ]);

  const onImportInvoicesSuccess = useCallback(
    (count: number) => {
      invalidateOnFinancialMutation(queryClient);
      showToast(buildInvoiceImportSuccessMessage(count), 'success');
    },
    [queryClient, showToast],
  );

  const onInvoiceEditSaved = useCallback(() => {
    invalidateOnFinancialMutation(queryClient);
    clearEditingInvoice();
  }, [queryClient, clearEditingInvoice]);

  return {
    importExportExportFetcher,
    onImportInvoicesSuccess,
    onInvoiceEditSaved,
  };
}
