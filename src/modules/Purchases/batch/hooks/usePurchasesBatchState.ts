import { useState, useRef, useCallback } from 'react';
import { useTabSearchParam } from '../../../../hooks/useTabSearchParam';
import { useDebouncedValue } from '../../../../ui';
import { PURCHASE_TAB_IDS, createEmptyPurchasesBatchRow } from '../constants';
import { getSaudiToday } from '../../../../utils/saudiDate';
import type {
  PurchaseBatchEntryRow,
  PurchaseBatchSummaryRow,
  PurchaseBatchUpdateRow,
} from '../purchaseBatchTypes';

export function usePurchasesBatchState() {
  const [batchDate, setBatchDate] = useState(getSaudiToday());
  const prevBatchDateRef = useRef(batchDate);
  const [batchVaultId, setBatchVaultId] = useState('');
  const [batchNotes, setBatchNotes] = useState('');
  const [rows, setRows] = useState<PurchaseBatchEntryRow[]>(() => [
    createEmptyPurchasesBatchRow(),
    createEmptyPurchasesBatchRow(),
    createEmptyPurchasesBatchRow(),
  ]);
  const [editingBatch, setEditingBatch] = useState<PurchaseBatchSummaryRow | null>(null);
  const [printingBatch, setPrintingBatch] = useState<PurchaseBatchSummaryRow | null>(null);
  const [cancellingBatch, setCancellingBatch] = useState<PurchaseBatchSummaryRow | null>(null);
  const [batchActionLoading, setBatchActionLoading] = useState<string | null>(null);

  const [batchSearchInput, setBatchSearchInput] = useState('');
  const [showCancelledBatches, setShowCancelledBatches] = useState(false);
  const debouncedBatchQ = useDebouncedValue(batchSearchInput.trim(), 300);

  const [activeTab, setActiveTab] = useTabSearchParam(PURCHASE_TAB_IDS, 'entry');

  const updateRow: PurchaseBatchUpdateRow = useCallback((i, fieldOrPatch, value) => {
    if (typeof fieldOrPatch === 'object' && fieldOrPatch !== null) {
      setRows((previousRows) => previousRows.map((row, idx) => (idx === i ? { ...row, ...fieldOrPatch } : row)));
    } else {
      setRows((previousRows) => previousRows.map((row, idx) => (idx === i ? { ...row, [fieldOrPatch]: value } : row)));
    }
  }, []);

  const addRow = useCallback(() => {
    setRows((previousRows) => [...previousRows, createEmptyPurchasesBatchRow()]);
  }, []);

  const removeRow = useCallback((i: number) => {
    setRows((previousRows) =>
      previousRows.length <= 1 ? [createEmptyPurchasesBatchRow()] : previousRows.filter((_, idx) => idx !== i),
    );
  }, []);

  return {
    batchDate,
    setBatchDate,
    prevBatchDateRef,
    batchVaultId,
    setBatchVaultId,
    batchNotes,
    setBatchNotes,
    rows,
    setRows,
    editingBatch,
    setEditingBatch,
    printingBatch,
    setPrintingBatch,
    cancellingBatch,
    setCancellingBatch,
    batchActionLoading,
    setBatchActionLoading,
    batchSearchInput,
    setBatchSearchInput,
    showCancelledBatches,
    setShowCancelledBatches,
    debouncedBatchQ,
    activeTab,
    setActiveTab,
    updateRow,
    addRow,
    removeRow,
  };
}
