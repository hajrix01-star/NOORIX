/**
 * أنواع مشتركة — سجل الأصول (واجهة)
 */

export const ASSET_SECTION_TAB_IDS = ['register', 'queue'] as const;

export type AssetSectionTabId = (typeof ASSET_SECTION_TAB_IDS)[number];

/** مورد في قائمة الاختيار */
export type SupplierOption = { id: string; nameAr?: string; nameEn?: string };

/** صف أصل من API القائمة / نموذج التعديل */
export type AssetRegisterListItem = {
  id?: string;
  nameAr?: string;
  nameEn?: string;
  serialNumber?: string | null;
  location?: string | null;
  purchaseDate?: unknown;
  acquisitionCost?: unknown;
  supplier?: { id?: string; nameAr?: string; nameEn?: string };
  warrantyEndDate?: unknown;
  warrantyStatus?: string;
  daysToWarrantyEnd?: number | null;
  warrantyDescription?: string | null;
  warrantyMonths?: number | null;
  warrantyStartDate?: unknown;
  notes?: string | null;
};

/** فاتورة في قائمة انتظار الضمان */
export type PendingWarrantyInvoiceRow = {
  id?: string;
  invoiceNumber?: string;
  kind?: string;
  supplierInvoiceNumber?: string | null;
  supplier?: { nameAr?: string; nameEn?: string };
  expenseLine?: { nameAr?: string; nameEn?: string };
  transactionDate?: unknown;
  totalAmount?: unknown;
  notes?: string | null;
};
