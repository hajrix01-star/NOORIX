import { useState, useRef, useCallback } from 'react';
import { useTabSearchParam } from '../../../../hooks/useTabSearchParam';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';
import { PURCHASE_TAB_IDS, createEmptyPurchasesBatchRow } from '../constants';
import { getSaudiToday } from '../../../../utils/saudiDate';

export function usePurchasesBatchState() {
  const [batchDate, setBatchDate] = useState(getSaudiToday());
  const prevBatchDateRef = useRef(batchDate);
  const [batchVaultId, setBatchVaultId] = useState('');
  const [batchNotes, setBatchNotes] = useState('');
  const [rows, setRows] = useState(() => [
    createEmptyPurchasesBatchRow(),
    createEmptyPurchasesBatchRow(),
    createEmptyPurchasesBatchRow(),
  ]);
  const [editingBatch, setEditingBatch] = useState<any>(null);
  const [printingBatch, setPrintingBatch] = useState<any>(null);
  const [batchActionLoading, setBatchActionLoading] = useState<any>(null);

  const [batchSearchInput, setBatchSearchInput] = useState('');
  const [showCancelledBatches, setShowCancelledBatches] = useState(false);
  const debouncedBatchQ = useDebouncedValue(batchSearchInput.trim(), 300);

  const [activeTab, setActiveTab] = useTabSearchParam(PURCHASE_TAB_IDS, 'entry');

  const updateRow = useCallback((i: number, f: any, v?: any) => {
    if (typeof f === 'object' && f !== null) {
      setRows((p: any[]) => p.map((r, idx) => (idx === i ? { ...r, ...f } : r)));
    } else {
      setRows((p: any[]) => p.map((r, idx) => (idx === i ? { ...r, [f]: v } : r)));
    }
  }, []);

  const addRow = useCallback(() => {
    setRows((p: any[]) => [...p, createEmptyPurchasesBatchRow()]);
  }, []);

  const removeRow = useCallback((i: number) => {
    setRows((p: any[]) => (p.length <= 1 ? [createEmptyPurchasesBatchRow()] : p.filter((_, idx) => idx !== i)));
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
