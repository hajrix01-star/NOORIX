export type SupplierType = 'purchases' | 'expenses';
export type SupplierCategoryType = 'purchase' | 'expense' | string;

export type SupplierRecord = {
  id: string;
  companyId?: string | null;
  nameAr: string;
  nameEn?: string | null;
  taxNumber?: string | null;
  phone?: string | null;
  supplierCategoryId?: string | null;
  supplierType?: SupplierType | 'purchase' | 'expense' | null;
  isTaxRegistered?: boolean | null;
  isBookmarked?: boolean | null;
  isDeleted?: boolean | null;
};

export type SupplierCategoryRecord = {
  id: string;
  nameAr?: string | null;
  nameEn?: string | null;
  code?: string | null;
  type?: SupplierCategoryType | null;
  icon?: string | null;
  parentId?: string | null;
  account?: {
    code?: string | null;
    icon?: string | null;
  } | null;
};

export type SupplierFormState = {
  nameAr: string;
  nameEn: string;
  taxNumber: string;
  phone: string;
  supplierCategoryId: string;
  supplierType: SupplierType;
  isTaxRegistered: boolean;
};

export type SupplierCreatePayload = {
  companyId: string;
  nameAr: string;
  nameEn?: string;
  taxNumber?: string;
  phone?: string;
  supplierType: SupplierType;
  supplierCategoryId?: string;
  isTaxRegistered: boolean;
};

export type SupplierUpdatePayload = Omit<SupplierCreatePayload, 'companyId'>;

export type SupplierImportRow = Pick<
  SupplierCreatePayload,
  'nameAr' | 'nameEn' | 'taxNumber' | 'phone' | 'supplierType'
>;

export type SupplierInvoiceRecord = {
  id?: string;
  supplierInvoiceNumber?: string | number | null;
  invoiceNumber?: string | number | null;
  kind?: string | null;
  transactionDate?: string | Date | null;
  netAmount?: string | number | null;
  taxAmount?: string | number | null;
  totalAmount?: string | number | null;
};

export type SupplierProfileTotals = {
  net: string | number;
  tax: string | number;
  total: string | number;
  count: number;
};

export type TranslationFn = (key: string, ...args: string[]) => string;
export type SupplierLang = 'ar' | 'en' | string;
