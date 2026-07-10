export type VaultType = 'cash' | 'bank' | 'app';

export type VaultAccountRef = {
  id?: string;
  code?: string | null;
  nameAr?: string | null;
};

export type VaultRecord = {
  id: string;
  companyId?: string;
  accountId: string;
  nameAr: string;
  nameEn?: string;
  name?: string;
  type: VaultType;
  isActive?: boolean;
  isArchived?: boolean;
  isSalesChannel?: boolean;
  showAsPaymentMethod?: boolean;
  paymentMethod?: string | null;
  notes?: string | null;
  sortOrder?: number | null;
  totalIn?: number | string | null;
  totalOut?: number | string | null;
  balance?: number | string | null;
  account?: VaultAccountRef | null;
};

export type VaultCreatePayload = {
  companyId?: string;
  nameAr: string;
  nameEn?: string | null;
  type: VaultType;
  isSalesChannel?: boolean;
  showAsPaymentMethod?: boolean;
  paymentMethod?: string | null;
  notes?: string | null;
};

export type VaultUpdatePayload = Partial<Omit<VaultCreatePayload, 'companyId'>> & {
  sortOrder?: number;
};

export type VaultTransferPayload = {
  companyId: string;
  fromVaultId: string;
  toVaultId: string;
  amount: string;
  transactionDate: string;
  notes?: string;
  idempotencyKey?: string;
};

export type VaultTransferResult = {
  ledgerEntry?: unknown;
  referenceId?: string;
};

export type VaultTransactionRecord = {
  id: string;
  companyId?: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number | string;
  transactionDate: string;
  referenceType?: string | null;
  referenceId?: string | null;
  documentNumber?: string | null;
  operationNotes?: string | null;
  transferFromVaultId?: string | null;
  transferToVaultId?: string | null;
  transferFromVaultNameAr?: string | null;
  transferToVaultNameAr?: string | null;
  transferFromVaultNameEn?: string | null;
  transferToVaultNameEn?: string | null;
};

export type VaultTransactionViewRow = VaultTransactionRecord & {
  debit: number | null;
  credit: number | null;
  notesDisplay: string | null;
};

export type VaultTransactionsPage = {
  items: VaultTransactionRecord[];
  total: number;
  page: number;
  pageSize: number;
  periodTotalIn: number;
  periodTotalOut: number;
  periodBalance: number;
};

export type VaultWithTransactionsResult = {
  vault: VaultRecord;
  transactions: VaultTransactionsPage;
};

export type UseVaultsParams = {
  companyId: string;
  includeArchived?: boolean;
  startDate?: string | null;
  endDate?: string | null;
};
