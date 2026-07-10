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

export type BankCategoryLite = {
  id?: string;
  nameAr?: string | null;
  nameEn?: string | null;
  transactionSide?: BankTransactionSide | null;
};

export type BankTransactionSide = 'any' | 'debit' | 'credit';
export type BankTransactionType = 'contains' | 'starts_with' | 'equals' | 'regex';

export type BankTransactionLite = {
  id?: string | null;
  txDate?: string | null;
  description?: string | null;
  reference?: string | null;
  debit?: string | number | null;
  credit?: string | number | null;
  balance?: string | number | null;
  categoryId?: string | null;
  category?: BankCategoryLite | null;
  note?: string | null;
  notes?: string | null;
};

export type BankStatementLite = {
  id?: string;
  bankName?: string | null;
  companyName?: string | null;
  fileName?: string | null;
  accountName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  totalDeposits?: string | number | null;
  totalWithdrawals?: string | number | null;
  transactionCount?: string | number | null;
  status?: string | null;
  transactions?: BankTransactionLite[];
};

export type BankColumnTotals = {
  debit: number;
  credit: number;
};

export type BankSortKey = 'txDate' | 'description' | 'debit' | 'credit' | 'balance';
export type BankSortDirection = 'asc' | 'desc';
export type BankSortConfig = {
  key: BankSortKey;
  direction: BankSortDirection;
};

export type BankReconciliationStats = {
  sales_bank_total?: number | string | null;
  cash_deposits_total?: number | string | null;
  expected_credits?: number | string | null;
  sale_invoice_count?: number | string | null;
};

export type BankCategoryOption = {
  id: string;
  label: string;
};

export type BankCreateCategoryBody = {
  nameAr: string;
  nameEn: string;
};

export type TranslationFn = (key: string, ...args: string[]) => string;

export type BankTemplateColumn = {
  index?: number | null;
};

export type BankTemplate = {
  id: string;
  bankName?: string | null;
  customerName?: string | null;
  columnsJson?: Record<string, BankTemplateColumn> | null;
  headerRow?: number | null;
  dataStartRow?: number | null;
  usageCount?: number | null;
  lastUsedAt?: string | Date | null;
  isActive?: boolean | null;
};

export type BankBalanceError = {
  index: number;
  date?: string | null;
  expected: number;
  actual: number;
  diff: number;
};

export type BankBalanceVerification = {
  totalDeposits: number;
  totalWithdrawals: number;
  stmtDeposits: number;
  stmtWithdrawals: number;
  depositsDiff: number;
  withdrawalsDiff: number;
  aggregatesMatch: boolean;
  balanceSequenceValid: boolean;
  balanceErrors: BankBalanceError[];
  transactionCount: number;
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
  categories?: BankCategoryLite[];
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
