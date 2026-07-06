import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { buildPurchaseBatchIdempotencyKey } from '@noorix/finance-core';
import { useApiMutation } from '../../../../hooks/useApiMutation';
import { invalidateOnFinancialMutation } from '../../../../utils/queryInvalidation';
import { useToast } from '../../../../context/ToastContext';
import {
  createInvoiceBatch,
  updateInvoice,
  fetchAllInvoicesForBatch,
  setSupplierBookmark,
  throwIfApiFailed,
  uploadInvoiceAttachment,
} from '../../../../services/api';
import { supplierKeys } from '../../../../services/queryKeys';
import { filterValidRowsForBatchSave } from '../utils/purchasesBatchGuards';
import { createEmptyPurchasesBatchRow } from '../constants';
import {
  buildPurchaseBatchInvoiceUpdatePayload,
  buildPurchaseBatchItemPayload,
  normalizeFetchedPurchaseBatchInvoices,
  requirePurchaseBatchSaveResult,
  rowWithAdjustedInvoiceDate,
} from '../purchaseBatchActionModel';
import type { CreateInvoiceBatchResult } from '../../../../types/api';
import type {
  BatchTranslateFn,
  PurchaseBatchEntryRow,
  PurchaseBatchInvoice,
  PurchaseBatchSummaryRow,
} from '../purchaseBatchTypes';

type PurchasesBatchDateFilter = {
  startDate: string;
  endDate: string;
};

type PurchaseBatchSaveResult = {
  payload: CreateInvoiceBatchResult;
  uploadRows: PurchaseBatchEntryRow[];
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function createInitialRows() {
  return [
    createEmptyPurchasesBatchRow(),
    createEmptyPurchasesBatchRow(),
    createEmptyPurchasesBatchRow(),
  ];
}

export function usePurchasesBatchActions(options: {
  companyId: string;
  t: BatchTranslateFn;
  rows: PurchaseBatchEntryRow[];
  setRows: Dispatch<SetStateAction<PurchaseBatchEntryRow[]>>;
  setBatchNotes: (value: string) => void;
  batchNotes: string;
  batchDate: string;
  batchVaultId: string;
  prevBatchDateRef: MutableRefObject<string>;
  setBatchDate: (value: string) => void;
  dateFilter: PurchasesBatchDateFilter;
  bookmarks: string[];
  setBatchActionLoading: (value: string | null) => void;
}) {
  const {
    companyId,
    t,
    rows,
    setRows,
    setBatchNotes,
    batchNotes,
    batchDate,
    batchVaultId,
    prevBatchDateRef,
    setBatchDate,
    dateFilter,
    bookmarks,
    setBatchActionLoading,
  } = options;

  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const openBatchWithInvoices = useCallback(
    async (
      row: PurchaseBatchSummaryRow,
      setter: Dispatch<SetStateAction<PurchaseBatchSummaryRow | null>>,
    ) => {
      if (!companyId || !row.batchId) return;
      setBatchActionLoading(row.batchId);
      try {
        const invoices = normalizeFetchedPurchaseBatchInvoices(
          await fetchAllInvoicesForBatch(companyId, row.batchId, dateFilter.startDate, dateFilter.endDate),
        );
        setter({ ...row, batchId: row.batchId, invoices });
      } catch (error) {
        showToast(errorMessage(error, t('loadDataFailed')), 'error');
      } finally {
        setBatchActionLoading(null);
      }
    },
    [companyId, dateFilter.startDate, dateFilter.endDate, t, showToast, setBatchActionLoading],
  );

  const handleCancelBatch = useCallback(
    async (
      batch: PurchaseBatchSummaryRow,
      setEditingBatch: Dispatch<SetStateAction<PurchaseBatchSummaryRow | null>>,
    ) => {
      let invoices = batch.invoices;
      if (!invoices.length) {
        try {
          invoices = normalizeFetchedPurchaseBatchInvoices(
            await fetchAllInvoicesForBatch(companyId, batch.batchId, dateFilter.startDate, dateFilter.endDate),
          );
        } catch (error) {
          showToast(errorMessage(error, t('loadDataFailed')), 'error');
          return;
        }
      }

      try {
        for (const invoice of invoices) {
          if (invoice.status === 'active') {
            const result = await updateInvoice(invoice.id, { status: 'cancelled' }, companyId);
            throwIfApiFailed(result, t('cancelFailed'));
          }
        }
        invalidateOnFinancialMutation(queryClient);
        showToast(t('batchCancelled'), 'success');
        setEditingBatch(null);
      } catch (error) {
        showToast(errorMessage(error, t('cancelFailed')), 'error');
      }
    },
    [companyId, dateFilter.startDate, dateFilter.endDate, queryClient, t, showToast],
  );

  const saveMutation = useApiMutation({
    mutationFn: async (): Promise<PurchaseBatchSaveResult> => {
      const batchPart = batchNotes.trim();
      const validRows = filterValidRowsForBatchSave(rows, batchPart);
      if (!validRows.length) throw new Error(t('noValidRows'));

      const idempotencyKey = buildPurchaseBatchIdempotencyKey({
        companyId,
        cashAccountId: batchVaultId,
        operationDate: batchDate,
        batchNotes: batchPart,
        rows,
      });

      const result = await createInvoiceBatch({
        companyId,
        transactionDate: batchDate,
        vaultId: batchVaultId || undefined,
        batchNotes: batchPart || undefined,
        idempotencyKey,
        items: validRows.map((row) => buildPurchaseBatchItemPayload(row, t)),
      });
      throwIfApiFailed(result, t('saveFailed'));

      return {
        payload: requirePurchaseBatchSaveResult(result.data, t('saveFailed')),
        uploadRows: validRows,
      };
    },
    rejectOnApiFailure: false,
    successToast: (data: PurchaseBatchSaveResult) =>
      t('savedInvoicesCount', data.payload.count, data.payload.batchId),
    errorToast: (error: unknown) => errorMessage(error, t('saveFailed')),
    onSuccess: async (data: PurchaseBatchSaveResult) => {
      const invoices = data.payload.invoices ?? [];
      for (let index = 0; index < data.uploadRows.length; index += 1) {
        const file = data.uploadRows[index]?.attachmentFile;
        const invoiceId = invoices[index]?.id;
        if (file && invoiceId && companyId) {
          try {
            const uploadResult = await uploadInvoiceAttachment(invoiceId, companyId, file);
            throwIfApiFailed(uploadResult);
          } catch {
            showToast(t('invoiceReceiptUploadFailed'), 'error');
            break;
          }
        }
      }
      invalidateOnFinancialMutation(queryClient);
      setRows(createInitialRows());
      setBatchNotes('');
    },
  });

  const toggleBookmark = useCallback(
    async (id: string) => {
      const current = bookmarks.includes(id);
      try {
        await setSupplierBookmark(id, !current);
        queryClient.invalidateQueries({ queryKey: supplierKeys.byCompany(companyId) });
      } catch {
        showToast(t('bookmarkUpdateFailed'), 'error');
      }
    },
    [bookmarks, companyId, queryClient, showToast, t],
  );

  async function saveInvoiceEdit(invoice: PurchaseBatchInvoice) {
    return updateInvoice(invoice.id, buildPurchaseBatchInvoiceUpdatePayload(invoice), companyId);
  }

  const handleBatchDateChange = useCallback(
    (newDate: string) => {
      const previousDate = prevBatchDateRef.current;
      setBatchDate(newDate);
      if (!newDate) return;
      setRows((previousRows) =>
        previousRows.map((row) => rowWithAdjustedInvoiceDate(row, previousDate, newDate)),
      );
      prevBatchDateRef.current = newDate;
    },
    [prevBatchDateRef, setBatchDate, setRows],
  );

  return {
    saveMutation,
    openBatchWithInvoices,
    handleCancelBatch,
    toggleBookmark,
    saveInvoiceEdit,
    handleBatchDateChange,
  };
}
