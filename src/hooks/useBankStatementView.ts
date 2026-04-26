/**
 * حالة ومنطق عرض كشف بنكي واحد — مكيّف لـ API الحالي (Nest + Prisma)
 */
import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from './useApiMutation';
import {
  bankStatementGet,
  bankStatementUpdateTxCategory,
  bankStatementUpdateTxNote,
  bankStatementReclassify,
  bankStatementReconciliationStats,
} from '../services/api';
import {
  getTxKey,
  buildSummaryByCategory,
  computeBalanceVerification,
} from '../modules/Reports/bank/bankAnalysisUtils';
import { BANK_ANALYSIS_CARDS_KEY } from '../constants/storageKeys';
import { readJsonStorage, writeJsonStorage } from '../utils/jsonStorage';

export const AVAILABLE_ANALYSIS_CARDS = [
  { id: 'cash_flow', nameKey: 'bankCardCashFlow', icon: '' },
  { id: 'alerts', nameKey: 'bankCardAlerts', icon: '⚠' },
  { id: 'pos_hint', nameKey: 'bankCardPosHint', icon: '' },
  { id: 'category_pie', nameKey: 'bankCardCategoryPie', icon: '' },
  { id: 'category_bar', nameKey: 'bankCardCategoryBar', icon: '' },
  { id: 'category_table', nameKey: 'bankCardCategoryTable', icon: '' },
  { id: 'deposits_table', nameKey: 'bankCardDepositsTable', icon: '' },
  { id: 'pos_terminals', nameKey: 'bankCardPosTerminals', icon: '' },
];

export const DEFAULT_ACTIVE_CARDS = ['cash_flow', 'alerts', 'category_pie', 'category_bar', 'category_table'];

function loadSavedCards() {
  const parsed = readJsonStorage(BANK_ANALYSIS_CARDS_KEY, null);
  return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_ACTIVE_CARDS;
}

function saveCards(ids) {
  writeJsonStorage(BANK_ANALYSIS_CARDS_KEY, ids);
}

export default function useBankStatementView(statementId, companyId, t) {
  const uncategorized = t('uncategorized');

  const [activeTab, setActiveTab] = useState('analysis');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editingTxId, setEditingTxId] = useState(null);
  const [editingCategory, setEditingCategory] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNote, setEditingNote] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'txDate', direction: 'asc' });
  const [selectedTxIds, setSelectedTxIds] = useState(() => new Set());
  const [activeCards, setActiveCards] = useState(loadSavedCards);
  const [cardToDelete, setCardToDelete] = useState(null);

  const { data: rawRes, isLoading, refetch } = useQuery({
    queryKey: ['bank-statement', companyId, statementId],
    queryFn: () => bankStatementGet(companyId, statementId),
    enabled: !!companyId && !!statementId,
  });

  const statement = useMemo(() => {
    const d = rawRes?.data ?? rawRes;
    return d && typeof d === 'object' && d.id ? d : null;
  }, [rawRes]);

  const reconStart = statement?.startDate?.slice(0, 10);
  const reconEnd = statement?.endDate?.slice(0, 10);

  const { data: reconRaw, isLoading: reconLoading } = useQuery({
    queryKey: ['bank-reconciliation-stats', companyId, reconStart, reconEnd],
    queryFn: async () => {
      const r = await bankStatementReconciliationStats(companyId, reconStart, reconEnd);
      if (!r.success) throw new Error(r.error || 'recon');
      return r.data ?? r;
    },
    enabled: !!companyId && !!reconStart && !!reconEnd && statement?.status === 'completed',
  });

  const reconciliationStats = reconRaw?.system_data ?? null;

  const transactions = statement?.transactions ?? [];

  const summaryByCategory = useMemo(
    () => buildSummaryByCategory(transactions, uncategorized),
    [transactions, uncategorized],
  );

  const balanceVerification = useMemo(
    () => computeBalanceVerification(statement),
    [statement],
  );

  const filteredTransactions = useMemo(() => {
    let list = [...transactions];
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (tx) =>
          String(tx.description || '').toLowerCase().includes(q) ||
          String(tx.reference || '').toLowerCase().includes(q) ||
          String(tx.txDate || '').includes(q),
      );
    }
    if (categoryFilter !== 'all') {
      list = list.filter((tx) => {
        const name =
          tx.category?.nameAr || tx.category?.nameEn || uncategorized;
        return name === categoryFilter;
      });
    }
    if (typeFilter === 'debit') list = list.filter((tx) => Number(tx.debit) > 0);
    if (typeFilter === 'credit') list = list.filter((tx) => Number(tx.credit) > 0);

    const { key, direction } = sortConfig;
    if (key) {
      const mul = direction === 'desc' ? -1 : 1;
      list.sort((a, b) => {
        let va;
        let vb;
        if (key === 'txDate') {
          va = String(a.txDate || '');
          vb = String(b.txDate || '');
          return va.localeCompare(vb) * mul;
        }
        if (key === 'debit' || key === 'credit' || key === 'balance') {
          va = Number(a[key]) || 0;
          vb = Number(b[key]) || 0;
          return (va - vb) * mul;
        }
        va = String(a[key] || '').toLowerCase();
        vb = String(b[key] || '').toLowerCase();
        return va.localeCompare(vb) * mul;
      });
    }
    return list;
  }, [transactions, searchTerm, categoryFilter, typeFilter, sortConfig, uncategorized]);

  const columnTotals = useMemo(
    () => ({
      debit: filteredTransactions.reduce((s, tx) => s + Number(tx.debit || 0), 0),
      credit: filteredTransactions.reduce((s, tx) => s + Number(tx.credit || 0), 0),
    }),
    [filteredTransactions],
  );

  const categoryNames = useMemo(() => {
    const s = new Set([uncategorized]);
    for (const tx of transactions) {
      s.add(tx.category?.nameAr || tx.category?.nameEn || uncategorized);
    }
    return [...s].sort();
  }, [transactions, uncategorized]);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const bankInv = useMemo(
    () => [
      ['bank-statement', companyId, statementId],
      ['bank-statements'],
      ['bank-statements-summary'],
    ],
    [companyId, statementId],
  );

  const updateCategoryMutation = useApiMutation({
    mutationFn: ({ txId, categoryId }) =>
      bankStatementUpdateTxCategory(statementId, txId, companyId, categoryId),
    invalidateQueries: bankInv,
    showErrorToast: false,
  });

  const updateNoteMutation = useApiMutation({
    mutationFn: ({ txId, note }) =>
      bankStatementUpdateTxNote(statementId, txId, companyId, note),
    invalidateQueries: bankInv,
    showErrorToast: false,
  });

  const reclassifyMutation = useApiMutation({
    mutationFn: () => bankStatementReclassify(companyId, statementId),
    invalidateQueries: [
      ...bankInv,
      { queryKey: ['bank-reconciliation-stats', companyId] },
    ],
    showErrorToast: false,
  });

  const handleCategoryChange = (txId, categoryId) => {
    updateCategoryMutation.mutate({ txId, categoryId });
    setEditingTxId(null);
  };

  const handleNoteChange = (txId) => {
    updateNoteMutation.mutate({ txId, note: editingNote });
    setEditingNoteId(null);
    setEditingNote('');
  };

  const toggleTxSelection = (tx) => {
    const id = getTxKey(tx);
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    const keys = filteredTransactions.map((tx) => getTxKey(tx));
    const allSelected = keys.every((k) => selectedTxIds.has(k));
    setSelectedTxIds(() => {
      if (allSelected) return new Set();
      return new Set(keys);
    });
  };

  const selectedTransactions = filteredTransactions.filter((tx) =>
    selectedTxIds.has(getTxKey(tx)),
  );

  const addCard = (cardId) => {
    if (!activeCards.includes(cardId)) {
      const next = [...activeCards, cardId];
      setActiveCards(next);
      saveCards(next);
    }
  };

  const removeCard = (cardId) => {
    const next = activeCards.filter((id) => id !== cardId);
    setActiveCards(next);
    saveCards(next);
    setCardToDelete(null);
  };

  const isCardActive = (cardId) => activeCards.includes(cardId);
  const availableToAdd = AVAILABLE_ANALYSIS_CARDS.filter((c) => !activeCards.includes(c.id));

  return {
    statement,
    isLoading,
    refetch,
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    typeFilter,
    setTypeFilter,
    editingTxId,
    setEditingTxId,
    editingCategory,
    setEditingCategory,
    editingNoteId,
    setEditingNoteId,
    editingNote,
    setEditingNote,
    sortConfig,
    handleSort,
    selectedTxIds,
    selectedTransactions,
    toggleTxSelection,
    toggleAllFiltered,
    handleCategoryChange,
    handleNoteChange,
    updateCategoryMutation,
    updateNoteMutation,
    filteredTransactions,
    columnTotals,
    summaryByCategory,
    balanceVerification,
    categoryNames,
    activeCards,
    availableToAdd,
    addCard,
    removeCard,
    isCardActive,
    cardToDelete,
    setCardToDelete,
    reconciliationStats,
    reconLoading,
    reclassifyMutation,
  };
}
