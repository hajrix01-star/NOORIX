export type ExpenseLineKind = 'fixed_expense' | 'expense';

export type ExpenseCategoryRef = {
  id: string;
  nameAr?: string | null;
  nameEn?: string | null;
  accountId?: string | null;
  account?: {
    taxExempt?: boolean | null;
  } | null;
  children?: ExpenseCategoryRef[];
  type?: string | null;
};

export type ExpenseSupplierRef = {
  id?: string;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  phone?: string | null;
  isTaxRegistered?: boolean | null;
};

export type ExpenseLineRecord = {
  id: string;
  companyId?: string;
  nameAr: string;
  nameEn?: string | null;
  name?: string | null;
  kind: ExpenseLineKind;
  categoryId: string;
  supplierId: string;
  serviceNumber?: string | null;
  notes?: string | null;
  referenceAmount?: number | string | null;
  allowPaymentAmountOverride?: boolean | null;
  annualTotalAmount?: number | string | null;
  installmentIntervalMonths?: number | null;
  isActive?: boolean | null;
  category?: ExpenseCategoryRef | null;
  supplier?: ExpenseSupplierRef | null;
};

export type ExpenseLineCreatePayload = {
  companyId: string;
  nameAr: string;
  nameEn?: string;
  kind: ExpenseLineKind;
  categoryId: string;
  supplierId: string;
  serviceNumber?: string;
  notes?: string;
  referenceAmount?: number;
  allowPaymentAmountOverride?: boolean;
  annualTotalAmount?: number;
  installmentIntervalMonths?: number;
};

export type ExpenseLineUpdatePayload = Partial<Omit<ExpenseLineCreatePayload, 'companyId'>>;

export type ExpenseLinePaymentRecord = {
  id: string;
  invoiceNumber?: string | number | null;
  supplierInvoiceNumber?: string | number | null;
  transactionDate?: string | Date | null;
  totalAmount?: string | number | null;
  netAmount?: string | number | null;
  taxAmount?: string | number | null;
  status?: string | null;
  notes?: string | null;
  vaultName?: string | null;
  expenseCoverageYear?: number | null;
  expenseCoverageQuarter?: number | null;
  expenseCoverageMonthStart?: number | null;
  expenseMonthsCovered?: number | null;
  vault?: {
    name?: string | null;
    nameAr?: string | null;
    nameEn?: string | null;
  } | null;
  supplier?: ExpenseSupplierRef | null;
  expenseLine?: Pick<ExpenseLineRecord, 'id' | 'nameAr' | 'nameEn' | 'kind'> | null;
  hasInvoiceAttachment?: boolean | null;
  attachmentOriginalName?: string | null;
};

export type ExpenseLinePaymentSummary = {
  totalNet: number;
  totalTax: number;
  totalAmount: number;
  count: number;
};

export type ExpenseLinePaymentsPage = {
  expenseLine: ExpenseLineRecord;
  items: ExpenseLinePaymentRecord[];
  total: number;
  page: number;
  pageSize: number;
  periodSummary: ExpenseLinePaymentSummary;
};

export type ExpensePaymentCreatePayload = {
  companyId: string;
  expenseLineId: string;
  categoryId: string;
  supplierId: string;
  supplierInvoiceNumber: string;
  kind: ExpenseLineKind;
  totalAmount: number;
  isTaxable: boolean;
  transactionDate: string;
  notes?: string;
  warrantyFollowUp?: boolean;
  expenseCoverageYear?: number;
  expenseCoverageQuarter?: number;
  expenseCoverageMonthStart?: number;
  expenseMonthsCovered?: number;
  vaultId?: string;
  vaultSplits?: Array<{ vaultId: string; amount: number }>;
};

export type ExpenseBatchItemPayload = {
  expenseLineId: string;
  supplierInvoiceNumber?: string;
  kind: ExpenseLineKind;
  totalAmount: number;
  isTaxable: boolean;
  notes?: string;
  warrantyFollowUp?: boolean;
};

export type ExpenseBatchCreatePayload = {
  companyId: string;
  transactionDate: string;
  vaultId: string;
  idempotencyKey: string;
  items: ExpenseBatchItemPayload[];
};
