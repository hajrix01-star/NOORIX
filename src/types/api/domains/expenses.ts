export type ExpenseLineKind = 'fixed_expense' | 'expense';

export type LoanPaymentRecord = {
  id: string;
  amount: number | string;
  transactionDate: string;
  notes?: string | null;
  status: 'posted' | 'reversed' | string;
  reversalOfId?: string | null;
  reversedAt?: string | null;
  createdAt?: string;
  vault?: { nameAr?: string | null; nameEn?: string | null } | null;
  reversal?: { id: string; transactionDate: string; amount: number | string } | null;
};

export type LoanRecord = {
  id: string;
  nameAr: string;
  creditorName?: string | null;
  openingAmount: number | string;
  outstandingAmount: number | string;
  openingDate: string;
  dueDate?: string | null;
  notes?: string | null;
  historicalPaymentsCount?: number | null;
  historicalPaidAmount?: number | string | null;
  historicalPaidThroughDate?: string | null;
  isActive?: boolean;
  payments?: LoanPaymentRecord[];
};

export type LoanCreatePayload = {
  companyId: string;
  nameAr: string;
  creditorName?: string;
  amount: number;
  openingDate: string;
  dueDate?: string;
  notes?: string;
  historicalPaymentsCount?: number;
  historicalPaidAmount?: number;
  historicalPaidThroughDate?: string;
  idempotencyKey: string;
};

export type LoanPaymentCreatePayload = {
  companyId: string;
  vaultId: string;
  amount: number;
  transactionDate: string;
  notes?: string;
  idempotencyKey: string;
};

export type LoanPaymentReversePayload = {
  companyId: string;
  transactionDate: string;
  notes?: string;
  idempotencyKey: string;
};

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
