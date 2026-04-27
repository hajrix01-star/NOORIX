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
import { toYmd } from '../utils/saudiDate';

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

function saveCards(ids: any) {
  writeJsonStorage(BANK_ANALYSIS_CARDS_KEY, ids);
}

export default function useBankStatementView(statementId: any, companyId: any, t: any) {
  const uncategorized = t('uncategorized');

  const [activeTab, setActiveTab] = useState('analysis');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editingTxId, setEditingTxId] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<any>(null);
  const [editingNote, setEditingNote] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'txDate', direction: 'asc' });
  const [selectedTxIds, setSelectedTxIds] = useState(() => new Set());
  const [activeCards, setActiveCards] = useState(loadSavedCards);
  const [cardToDelete, setCardToDelete] = useState<any>(null);

  const { data: rawRes, isLoading, refetch } = useQuery({
    queryKey: ['bank-statement', companyId, statementId],
    queryFn: () => bankStatementGet(companyId, statementId),
    enabled: !!companyId && !!statementId,
  });

  const statement = useMemo(() => {
    const d = rawRes?.data ?? rawRes;
    return d && typeof d === 'object' && d.id ? d : null;
  }, [rawRes]);

  const reconStart = toYmd(statement?.startDate);
  const reconEnd = toYmd(statement?.endDate);

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
        (tx: any) =>
          String(tx.description || '').toLowerCase().includes(q) ||
          String(tx.reference || '').toLowerCase().includes(q) ||
          String(tx.txDate || '').includes(q),
      );
    }
    if (categoryFilter !== 'all') {
      list = list.filter((tx: any) => {
        const name =
          tx.category?.nameAr || tx.category?.nameEn || uncategorized;
        return name === categoryFilter;
      });
    }
    if (typeFilter === 'debit') list = list.filter((tx: any) => Number(tx.debit) > 0);
    if (typeFilter === 'credit') list = list.filter((tx: any) => Number(tx.credit) > 0);

    const { key, direction } = sortConfig;
    if (key) {
      const mul = direction === 'desc' ? -1 : 1;
      list.sort((a: any, b: any) => {
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
      debit: filteredTransactions.reduce((s: any, tx: any) => s + Number(tx.debit || 0), 0),
      credit: filteredTransactions.reduce((s: any, tx: any) => s + Number(tx.credit || 0), 0),
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

  const handleSort = useCallback((key: any) => {
    setSortConfig((prev: any) => ({
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
    mutationFn: ({ txId, categoryId }: any) =>
      bankStatementUpdateTxCategory(statementId, txId, companyId, categoryId),
    invalidateQueries: bankInv,
    showErrorToast: false,
  });

  const updateNoteMutation = useApiMutation({
    mutationFn: ({ txId, note }: any) =>
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

  const handleCategoryChange = (txId: any, categoryId: any) => {
    updateCategoryMutation.mutate({ txId, categoryId });
    setEditingTxId(null);
  };

  const handleNoteChange = (txId: any) => {
    updateNoteMutation.mutate({ txId, note: editingNote });
    setEditingNoteId(null);
    setEditingNote('');
  };

  const toggleTxSelection = (tx: any) => {
    const id = getTxKey(tx);
    setSelectedTxIds((prev: any) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    const keys = filteredTransactions.map((tx: any) => getTxKey(tx));
    const allSelected = keys.every((k: any) => selectedTxIds.has(k));
    setSelectedTxIds(() => {
      if (allSelected) return new Set();
      return new Set(keys);
    });
  };

  const selectedTransactions = filteredTransactions.filter((tx: any) =>
    selectedTxIds.has(getTxKey(tx)),
  );

  const addCard = (cardId: any) => {
    if (!activeCards.includes(cardId)) {
      const next = [...activeCards, cardId];
      setActiveCards(next);
      saveCards(next);
    }
  };

  const removeCard = (cardId: any) => {
    const next = activeCards.filter((id: any) => id !== cardId);
    setActiveCards(next);
    saveCards(next);
    setCardToDelete(null);
  };

  const isCardActive = (cardId: any) => activeCards.includes(cardId);
  const availableToAdd = AVAILABLE_ANALYSIS_CARDS.filter((c: any) => !activeCards.includes(c.id));

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
