import Decimal from 'decimal.js';

export type GroupKey = 'sales' | 'purchases' | 'expenses';
export type ReportRowKey = GroupKey | 'grossProfit' | 'netProfit';

export const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const INCLUDED_KINDS = ['sale', 'purchase', 'expense', 'fixed_expense', 'hr_expense', 'salary'] as const;

export const KIND_TO_GROUP: Record<string, GroupKey | null> = {
  sale: 'sales',
  purchase: 'purchases',
  expense: 'expenses',
  fixed_expense: 'expenses',
  hr_expense: 'expenses',
  salary: 'expenses',
  advance: null,
};

export const KIND_LABELS: Record<string, { ar: string; en: string }> = {
  sale: { ar: 'المبيعات', en: 'Sales' },
  purchase: { ar: 'المشتريات', en: 'Purchases' },
  expense: { ar: 'مصروفات متغيرة', en: 'Variable expenses' },
  fixed_expense: { ar: 'مصروفات ثابتة', en: 'Fixed expenses' },
  hr_expense: { ar: 'مصروفات الموارد البشرية', en: 'HR expenses' },
  salary: { ar: 'الرواتب', en: 'Salaries' },
  advance: { ar: 'سلفية', en: 'Advance' },
  transfer: { ar: 'تحويل', en: 'Transfer' },
};

export const GROUP_LABELS: Record<ReportRowKey, { ar: string; en: string }> = {
  sales: { ar: 'المبيعات', en: 'Sales' },
  purchases: { ar: 'المشتريات', en: 'Purchases' },
  expenses: { ar: 'المصاريف', en: 'Expenses' },
  grossProfit: { ar: 'الربح الإجمالي', en: 'Gross profit' },
  netProfit: { ar: 'الربح الصافي', en: 'Net profit' },
};

export type ReportInvoice = {
  id: string;
  invoiceNumber: string;
  supplierInvoiceNumber: string | null;
  kind: string;
  totalAmount: Decimal.Value;
  netAmount: Decimal.Value;
  taxAmount: Decimal.Value;
  transactionDate: Date;
  notes: string | null;
  categoryId: string | null;
  supplier: {
    nameAr?: string;
    nameEn?: string | null;
    /** فئة المورد — يُستخدم في P&L للمشتريات عندما تتجاوز/تكمّل فئة سطر الفاتورة */
    supplierCategoryId?: string | null;
  } | null;
  expenseLine: { id: string; nameAr: string; nameEn: string | null; categoryId: string } | null;
  dailySalesSummary: {
    summaryNumber: string;
    channels: Array<{
      amount: Decimal.Value;
      vault: { id: string; nameAr: string; nameEn: string | null };
    }>;
  } | null;
};

export type CategoryNode = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  parentId: string | null;
  sortOrder: number;
  type?: string;
  accountId?: string | null;
};

export type ExpenseLineNode = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  categoryId: string;
};

export type ItemMeta = {
  key: string;
  labelAr: string;
  labelEn: string;
  sortOrder: number;
};

export type AggregatedRow = {
  key: string;
  labelAr: string;
  labelEn: string;
  months: Decimal[];
  sortOrder: number;
  percentOfSalesMonths: Decimal[];
  percentOfSalesYear: Decimal;
};

export type AggregatedGroup = {
  key: GroupKey;
  labelAr: string;
  labelEn: string;
  months: Decimal[];
  items: Map<string, AggregatedRow>;
};

export type GeneralRowModel = {
  key: string;
  labelAr: string;
  labelEn: string;
  months: string[];
  total: string;
  percentOfSalesMonths: string[];
  percentOfSalesYear: string;
};

export type ExpenseTreeNode = GeneralRowModel & { children?: ExpenseTreeNode[] };

export type GeneralProfitLossModel = {
  months: Array<{ index: number; label: string }>;
  groups: Array<
    GeneralRowModel & {
      items: GeneralRowModel[] | ExpenseTreeNode[];
    }
  >;
  summaryRows: Array<GeneralRowModel>;
  cards: {
    sales: string;
    purchases: string;
    expenses: string;
    grossProfit: string;
    netProfit: string;
  };
};
