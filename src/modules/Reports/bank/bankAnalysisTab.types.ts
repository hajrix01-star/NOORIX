/**
 * أنواع تبويب تحليل الكشف — عرض فقط؛ عقود API كما في الأصل.
 */
import type { BankCategoryAgg } from './bankAnalysisUtils';

export type AnalysisCardId =
  | 'cash_flow'
  | 'alerts'
  | 'pos_hint'
  | 'category_pie'
  | 'category_bar'
  | 'category_table'
  | 'deposits_table'
  | 'pos_terminals';

export type PieDisplayMode = 'combined' | 'debit' | 'credit';

export type BankStatementLite = {
  transactions?: Array<Record<string, unknown>>;
};

export type AnalysisCardDef = {
  id: string;
  nameKey: string;
  icon: string;
};

export type BankStatementAnalysisCardsTabProps = {
  statement: BankStatementLite | null | undefined;
  summaryByCategory?: Record<string, BankCategoryAgg>;
  activeCards: string[];
  availableToAdd: AnalysisCardDef[];
  isCardActive: (id: string) => boolean;
  addCard: (id: string) => void;
  setCardToDelete: (id: AnalysisCardId | null) => void;
  setCategoryFilter: (name: string) => void;
  setTypeFilter: (t: string) => void;
  setActiveTab: (tab: string) => void;
  categories?: unknown[];
  showToast: (msg: string, type?: string) => void;
  onSaveTxCategory: (txId: string, categoryId: string | null) => void | Promise<void>;
};

export type PieSliceRow = {
  name: string;
  debit: number;
  credit: number;
  count?: number;
  value: number;
  percent: string;
};

export type BarRow = {
  fullName: string;
  name: string;
  value: number;
};

export type CategoryTableRow = {
  name: string;
  count: number;
  debit: number;
  credit: number;
  debitPct: number;
  creditPct: number;
};
