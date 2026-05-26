/** POST /api/v1/ocr/suppliers — الحقول المستخدمة في النماذج */
export type OcrSupplierMutationBody = {
  nameAr?: string;
  nameEn?: string;
  category?: string;
  vatNumber?: string;
  [key: string]: unknown;
};

/** POST /api/v1/ocr/items */
export type OcrItemMutationBody = {
  nameAr?: string;
  nameEn?: string;
  unit?: string;
  category?: string;
  [key: string]: unknown;
};

/** POST /api/v1/ocr/invoices — حفظ فاتورة OCR */
export type OcrInvoiceSaveBody = Record<string, unknown>;

export type OcrMutationResult = {
  id?: string;
  [key: string]: unknown;
};
