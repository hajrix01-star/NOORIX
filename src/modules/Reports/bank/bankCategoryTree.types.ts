export type BankTreeClassificationDraft = {
  name: string;
  keywords: string[];
};

export type BankTreeCategory = {
  id?: string;
  companyId?: string;
  name?: string;
  isActive?: boolean;
  sortOrder?: number;
  transactionType?: string | null;
  transactionSide?: string;
  parentKeywords?: unknown;
  classifications?: unknown;
};

export type BankClassificationRule = {
  isActive?: boolean;
  categoryName?: string;
  transactionType?: string | null;
  transactionSide?: string;
  keyword?: string;
};

export type BankTreeCategoryPayload = {
  companyId: string;
  name: string;
  sortOrder: number;
  transactionSide: string;
  transactionType: string | null;
  parentKeywords: string[];
  classifications: BankTreeClassificationDraft[];
};

export type BankTreeCategoryPatch = Partial<BankTreeCategoryPayload> & {
  isActive?: boolean;
};
