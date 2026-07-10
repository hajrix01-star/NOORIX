import { useCallback, useMemo, useState } from 'react';
import { useApiMutation } from './useApiMutation';
import { useApiQuery } from './useApiQuery';
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
import type {
  AnalysisCardId,
  BankReconciliationStats,
  BankSortConfig,
  BankSortKey,
  BankStatementLite,
  BankTransactionLite,
} from '../modules/Reports/bank/bankAnalysisTab.types';
import { BANK_ANALYSIS_CARDS_KEY } from '../constants/storageKeys';
import { readJsonStorage, writeJsonStorage } from '../utils/jsonStorage';
import { toYmd } from '../utils/saudiDate';
import { bankKeys } from '../services/queryKeys';

export const AVAILABLE_ANALYSIS_CARDS = [
  { id: 'cash_flow', nameKey: 'bankCardCashFlow', icon: '' },
  { id: 'alerts', nameKey: 'bankCardAlerts', icon: '!' },
  { id: 'pos_hint', nameKey: 'bankCardPosHint', icon: '' },
  { id: 'category_pie', nameKey: 'bankCardCategoryPie', icon: '' },
  { id: 'category_bar', nameKey: 'bankCardCategoryBar', icon: '' },
  { id: 'category_table', nameKey: 'bankCardCategoryTable', icon: '' },
  { id: 'deposits_table', nameKey: 'bankCardDepositsTable', icon: '' },
  { id: 'pos_terminals', nameKey: 'bankCardPosTerminals', icon: '' },
] as const;

export const DEFAULT_ACTIVE_CARDS: AnalysisCardId[] = ['cash_flow', 'alerts', 'category_pie', 'category_bar', 'category_table'];

type BankStatementResponse = BankStatementLite | { data?: BankStatementLite | null } | null;
type TranslationFn = (key: string) => string;
type UpdateCategoryVariables = { txId: string; categoryId: string | null };
type UpdateNoteVariables = { txId: string; note: string };

function loadSavedCards(): AnalysisCardId[] {
  const parsed: unknown = readJsonStorage(BANK_ANALYSIS_CARDS_KEY, null);
  if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_ACTIVE_CARDS;
  const allowed = new Set<AnalysisCardId>(AVAILABLE_ANALYSIS_CARDS.map((card) => card.id));
  const ids = parsed.filter((id): id is AnalysisCardId => typeof id === 'string' && allowed.has(id as AnalysisCardId));
  return ids.length ? ids : DEFAULT_ACTIVE_CARDS;
}

function saveCards(ids: readonly AnalysisCardId[]): void {
  writeJsonStorage(BANK_ANALYSIS_CARDS_KEY, ids);
}

function unwrapStatement(response: BankStatementResponse | undefined): BankStatementLite | null {
  const candidate = response && 'data' in response ? response.data : response;
  return candidate && 'id' in candidate && candidate.id ? candidate : null;
}

function compareTransactions(a: BankTransactionLite, b: BankTransactionLite, sortConfig: BankSortConfig): number {
  const multiplier = sortConfig.direction === 'desc' ? -1 : 1;
  if (sortConfig.key === 'txDate') return String(a.txDate || '').localeCompare(String(b.txDate || '')) * multiplier;
  if (sortConfig.key === 'debit' || sortConfig.key === 'credit' || sortConfig.key === 'balance') {
    return ((Number(a[sortConfig.key]) || 0) - (Number(b[sortConfig.key]) || 0)) * multiplier;
  }
  return String(a[sortConfig.key] || '').toLowerCase().localeCompare(String(b[sortConfig.key] || '').toLowerCase()) * multiplier;
}

export default function useBankStatementView(statementId: string | null | undefined, companyId: string | null | undefined, t: TranslationFn) {
  const safeStatementId = statementId || '';
  const safeCompanyId = companyId || '';
  const uncategorized = t('uncategorized');

  const [activeTab, setActiveTab] = useState('analysis');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState('');
  const [sortConfig, setSortConfig] = useState<BankSortConfig>({ key: 'txDate', direction: 'asc' });
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(() => new Set());
  const [activeCards, setActiveCards] = useState<AnalysisCardId[]>(loadSavedCards);
  const [cardToDelete, setCardToDelete] = useState<AnalysisCardId | null>(null);

  const { data: rawStatement, isLoading, refetch } = useApiQuery<BankStatementResponse>({
    queryKey: bankKeys.statement(safeCompanyId, safeStatementId),
    queryFn: () => bankStatementGet(safeCompanyId, safeStatementId),
    fallbackMessage: 'Failed to load bank statement',
    enabled: !!companyId && !!statementId,
  });

  const statement = useMemo(() => unwrapStatement(rawStatement), [rawStatement]);
  const reconStart = toYmd(statement?.startDate);
  const reconEnd = toYmd(statement?.endDate);

  const { data: reconRaw, isLoading: reconLoading } = useApiQuery<{ system_data?: BankReconciliationStats | null }>({
    queryKey: bankKeys.reconciliationStats(safeCompanyId, reconStart, reconEnd),
    queryFn: () => bankStatementReconciliationStats(safeCompanyId, reconStart, reconEnd),
    fallbackMessage: 'Failed to load reconciliation stats',
    enabled: !!companyId && !!reconStart && !!reconEnd && statement?.status === 'completed',
  });

  const reconciliationStats = reconRaw?.system_data ?? null;
  const transactions = useMemo<BankTransactionLite[]>(() => statement?.transactions ?? [], [statement?.transactions]);
  const summaryByCategory = useMemo(() => buildSummaryByCategory(transactions, uncategorized), [transactions, uncategorized]);
  const balanceVerification = useMemo(() => computeBalanceVerification(statement), [statement]);

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
        const name = tx.category?.nameAr || tx.category?.nameEn || uncategorized;
        return name === categoryFilter;
      });
    }
    if (typeFilter === 'debit') list = list.filter((tx) => Number(tx.debit) > 0);
    if (typeFilter === 'credit') list = list.filter((tx) => Number(tx.credit) > 0);
    return list.sort((a, b) => compareTransactions(a, b, sortConfig));
  }, [transactions, searchTerm, categoryFilter, typeFilter, sortConfig, uncategorized]);

  const columnTotals = useMemo(
    () => ({
      debit: filteredTransactions.reduce((sum, tx) => sum + (Number(tx.debit) || 0), 0),
      credit: filteredTransactions.reduce((sum, tx) => sum + (Number(tx.credit) || 0), 0),
    }),
    [filteredTransactions],
  );

  const categoryNames = useMemo(() => {
    const names = new Set<string>([uncategorized]);
    for (const tx of transactions) names.add(tx.category?.nameAr || tx.category?.nameEn || uncategorized);
    return [...names].sort();
  }, [transactions, uncategorized]);

  const handleSort = useCallback((key: string) => {
    setSortConfig((prev) => ({
      key: key as BankSortKey,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const bankInv = useMemo(
    () => [bankKeys.statement(safeCompanyId, safeStatementId), bankKeys.statementsList(), bankKeys.statementsSummary()],
    [safeCompanyId, safeStatementId],
  );

  const updateCategoryMutation = useApiMutation({
    mutationFn: ({ txId, categoryId }: UpdateCategoryVariables) => bankStatementUpdateTxCategory(safeStatementId, txId, safeCompanyId, categoryId),
    invalidateQueries: bankInv,
    showErrorToast: false,
  });

  const updateNoteMutation = useApiMutation({
    mutationFn: ({ txId, note }: UpdateNoteVariables) => bankStatementUpdateTxNote(safeStatementId, txId, safeCompanyId, note),
    invalidateQueries: bankInv,
    showErrorToast: false,
  });

  const reclassifyMutation = useApiMutation({
    mutationFn: () => bankStatementReclassify(safeCompanyId, safeStatementId),
    invalidateQueries: [...bankInv, { queryKey: bankKeys.reconciliationStatsByCompany(safeCompanyId) }],
    showErrorToast: false,
  });

  const handleCategoryChange = (txId: string, categoryId: string | null) => {
    updateCategoryMutation.mutate({ txId, categoryId });
    setEditingTxId(null);
  };

  const handleNoteChange = (txId: string) => {
    updateNoteMutation.mutate({ txId, note: editingNote });
    setEditingNoteId(null);
    setEditingNote('');
  };

  const toggleTxSelection = (tx: BankTransactionLite) => {
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
    const allSelected = keys.every((key) => selectedTxIds.has(key));
    setSelectedTxIds(() => (allSelected ? new Set() : new Set(keys)));
  };

  const selectedTransactions = filteredTransactions.filter((tx) => selectedTxIds.has(getTxKey(tx)));

  const addCard = (cardId: string) => {
    const id = cardId as AnalysisCardId;
    if (!activeCards.includes(id)) {
      const next = [...activeCards, id];
      setActiveCards(next);
      saveCards(next);
    }
  };

  const removeCard = (cardId: AnalysisCardId | null) => {
    if (!cardId) return;
    const next = activeCards.filter((id) => id !== cardId);
    setActiveCards(next);
    saveCards(next);
    setCardToDelete(null);
  };

  const isCardActive = (cardId: string) => activeCards.includes(cardId as AnalysisCardId);
  const availableToAdd = AVAILABLE_ANALYSIS_CARDS.filter((card) => !activeCards.includes(card.id));

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
