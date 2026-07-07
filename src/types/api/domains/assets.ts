export type AssetWarrantyStatus = 'none' | 'active' | 'expiring' | 'expired';

export type AssetWarrantyFilter = 'all' | AssetWarrantyStatus | 'expiring90';

export type AssetSupplierRef = {
  id: string;
  nameAr?: string | null;
  nameEn?: string | null;
};

export type AssetInvoiceRef = {
  id: string;
  invoiceNumber?: string | number | null;
  supplierInvoiceNumber?: string | number | null;
};

export type AssetWarrantyLine = {
  id?: string;
  nameAr: string;
  nameEn?: string | null;
  serialNumber?: string | null;
  quantity?: string | number | null;
  notes?: string | null;
  sortOrder?: number | null;
};

export type AssetRegisterItem = {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  serialNumber?: string | null;
  location?: string | null;
  purchaseDate?: string | Date | null;
  acquisitionCost?: string | number | null;
  supplier?: AssetSupplierRef | null;
  invoice?: AssetInvoiceRef | null;
  warrantyDescription?: string | null;
  warrantyMonths?: number | null;
  warrantyStartDate?: string | Date | null;
  warrantyEndDate?: string | Date | null;
  warrantyStatus: AssetWarrantyStatus;
  daysToWarrantyEnd?: number | null;
  warrantyLinesCount?: number | null;
  warrantyLines?: AssetWarrantyLine[];
  notes?: string | null;
};

export type AssetRegisterPage = {
  items: AssetRegisterItem[];
  total: number;
  page: number;
  pageSize: number;
  sumAcquisitionCostFiltered: string;
  sumAcquisitionCostAll: string;
};

export type PendingWarrantyInvoiceRow = {
  id: string;
  invoiceNumber: string | number;
  kind: 'purchase' | 'expense' | 'fixed_expense' | string;
  supplierInvoiceNumber?: string | number | null;
  supplier?: AssetSupplierRef | null;
  expenseLine?: {
    nameAr?: string | null;
    nameEn?: string | null;
  } | null;
  transactionDate?: string | Date | null;
  totalAmount: string | number;
  netAmount?: string | number | null;
  taxAmount?: string | number | null;
  notes?: string | null;
};

export type AssetWarrantyLinePayload = {
  nameAr: string;
  nameEn?: string;
  serialNumber?: string;
  quantity?: number;
  notes?: string;
};

export type AssetCreatePayload = {
  companyId: string;
  nameAr: string;
  nameEn?: string;
  serialNumber?: string;
  location?: string;
  purchaseDate?: string;
  acquisitionCost?: number;
  supplierId?: string;
  invoiceId?: string;
  warrantyDescription?: string;
  warrantyMonths?: number;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  notes?: string;
  warrantyLines?: AssetWarrantyLinePayload[];
};

export type AssetUpdatePayload = Partial<Omit<AssetCreatePayload, 'companyId'>>;

export type AssetCompleteFromInvoicePayload = AssetCreatePayload & {
  invoiceId: string;
  markInvoiceDone?: boolean;
};
