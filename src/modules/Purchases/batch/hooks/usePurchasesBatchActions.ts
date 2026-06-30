import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  buildPurchaseBatchIdempotencyKey,
  normalizePurchaseBatchLine,
} from '@noorix/finance-core';
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
import { isWarrantyFollowUpKind } from '../../utils/batchRowModel';
import { filterValidRowsForBatchSave } from '../utils/purchasesBatchGuards';
import { createEmptyPurchasesBatchRow } from '../constants';

export function usePurchasesBatchActions(options: {
  companyId: string;
  t: (key: string, ...args: any[]) => string;
  rows: any[];
  setRows: React.Dispatch<React.SetStateAction<any[]>>;
  setBatchNotes: (v: string) => void;
  batchNotes: string;
  batchDate: string;
  batchVaultId: string;
  prevBatchDateRef: React.MutableRefObject<string>;
  setBatchDate: (v: string) => void;
  dateFilter: { startDate: string; endDate: string };
  bookmarks: string[];
  setBatchActionLoading: (v: any) => void;
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
    async (row: any, setter: any) => {
      if (!companyId || !row?.batchId) return;
      setBatchActionLoading(row.batchId);
      try {
        const invoices = await fetchAllInvoicesForBatch(companyId, row.batchId, dateFilter.startDate, dateFilter.endDate);
        setter({ ...row, batchId: row.batchId, invoices });
      } catch (e: any) {
        showToast(e?.message || t('loadDataFailed'), 'error');
      } finally {
        setBatchActionLoading(null);
      }
    },
    [companyId, dateFilter.startDate, dateFilter.endDate, t, showToast, setBatchActionLoading],
  );

  const handleCancelBatch = useCallback(
    async (batch: any, setEditingBatch: (v: any) => void) => {
      let invoices = batch.invoices;
      if (!invoices?.length) {
        try {
          invoices = await fetchAllInvoicesForBatch(companyId, batch.batchId, dateFilter.startDate, dateFilter.endDate);
        } catch (e: any) {
          showToast(e?.message || t('loadDataFailed'), 'error');
          return;
        }
      }
      if (!confirm(t('cancelBatchConfirm', batch.batchId, invoices.length))) return;
      try {
        for (const inv of invoices) {
          if (inv.status === 'active') {
            const res = await updateInvoice(inv.id, { status: 'cancelled' }, companyId);
            throwIfApiFailed(res, t('cancelFailed'));
          }
        }
        invalidateOnFinancialMutation(queryClient);
        showToast(t('batchCancelled'), 'success');
        setEditingBatch(null);
      } catch (e: any) {
        showToast(e?.message || t('cancelFailed'), 'error');
      }
    },
    [companyId, dateFilter.startDate, dateFilter.endDate, queryClient, t, showToast],
  );

  const saveMutation = useApiMutation({
    mutationFn: async () => {
      const batchPart = batchNotes.trim();
      const valid = filterValidRowsForBatchSave(rows, batchPart);
      if (!valid.length) throw new Error(t('noValidRows'));
      const idempotencyKey = buildPurchaseBatchIdempotencyKey({
        companyId,
        cashAccountId: batchVaultId,
        operationDate: batchDate,
        batchNotes: batchPart,
        rows,
      });
      const res = await createInvoiceBatch({
        companyId,
        transactionDate: batchDate,
        vaultId: batchVaultId || undefined,
        batchNotes: batchPart || undefined,
        idempotencyKey,
        items: valid.map((r: any) => {
          const normalized = normalizePurchaseBatchLine(r);
          let notes = normalized.notes;
          if (normalized.kind === 'fixed_expense') {
            notes = notes ? `${t('fixedExpenseType')} — ${notes}` : t('fixedExpenseType');
          } else if (normalized.kind === 'expense') {
            notes = notes ? `${t('expenseType')} — ${notes}` : t('expenseType');
          }
          const kind = normalized.kind || 'purchase';
          return {
            supplierId: normalized.supplierId,
            expenseLineId: normalized.expenseLineId,
            invoiceNumber: normalized.invoiceNumber,
            supplierInvoiceNumber: normalized.supplierInvoiceNumber,
            kind,
            totalAmount: normalized.totalAmount,
            isTaxable: normalized.isTaxable,
            invoiceDate: normalized.invoiceDate,
            categoryId: normalized.categoryId,
            debitAccountId: normalized.debitAccountId,
            notes: notes || undefined,
            ...(isWarrantyFollowUpKind(kind) && r.warrantyFollowUp ? { warrantyFollowUp: true } : {}),
          };
        }),
      });
      throwIfApiFailed(res, t('saveFailed'));
      const payload = res.data ?? { batchId: 'B-' + Date.now(), count: valid.length };
      return { payload, uploadRows: valid };
    },
    rejectOnApiFailure: false,
    successToast: (data: any) => t('savedInvoicesCount', data.payload.count, data.payload.batchId),
    errorToast: (e: any) => e?.message || t('saveFailed'),
    onSuccess: async (data: any) => {
      const invoices = data.payload?.invoices || [];
      const rowsWithFiles = data.uploadRows || [];
      for (let i = 0; i < rowsWithFiles.length; i++) {
        const f = rowsWithFiles[i]?.attachmentFile;
        const invId = invoices[i]?.id;
        if (f && invId && companyId) {
          try {
            const up = await uploadInvoiceAttachment(invId, companyId, f);
            throwIfApiFailed(up);
          } catch {
            showToast(t('invoiceReceiptUploadFailed'), 'error');
            break;
          }
        }
      }
      invalidateOnFinancialMutation(queryClient);
      setRows([createEmptyPurchasesBatchRow(), createEmptyPurchasesBatchRow(), createEmptyPurchasesBatchRow()]);
      setBatchNotes('');
    },
  });

  const toggleBookmark = useCallback(
    async (id: any) => {
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

  async function saveInvoiceEdit(inv: any) {
    const payload = {
      supplierId: inv.supplierId,
      supplierInvoiceNumber: inv.supplierInvoiceNumber ?? inv.invoiceNumber,
      kind: inv.kind,
      totalAmount: inv.totalAmount,
      isTaxable: inv.isTaxable !== false,
      status: inv.status,
      ...(inv.transactionDate?.trim()
        ? { transactionDate: inv.transactionDate.trim().slice(0, 10) }
        : {}),
    };
    return updateInvoice(inv.id, payload, companyId);
  }

  const handleBatchDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newDate = e.target.value;
      const prevOp = prevBatchDateRef.current;
      setBatchDate(newDate);
      if (!newDate) return;
      setRows((prevRows: any) =>
        prevRows.map((r: any) => {
          let inv = r.invoiceDate;
          if (prevOp && newDate !== prevOp) {
            if (newDate < prevOp) {
              if (inv && inv > newDate) inv = newDate;
            } else if (newDate > prevOp) {
              if (inv === prevOp) inv = newDate;
            }
          }
          return { ...r, invoiceDate: inv };
        }),
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
