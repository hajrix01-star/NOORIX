import { toYmd } from '../../../../utils/saudiDate';

export function validateOcrLinkedPurchaseInput(p: {
  language: string;
  createLinkedPurchase: boolean;
  finalizeOcrId: any;
  canCreatePurchase: boolean;
  accountingSupplierId: string;
  vaultId: string;
  transactionDate: string;
  isPurchaseTaxable: boolean;
  purchaseSupplierInvoiceNumber: string;
  extracted: any;
}): string | null {
  const {
    language,
    createLinkedPurchase,
    finalizeOcrId,
    canCreatePurchase,
    accountingSupplierId,
    vaultId,
    transactionDate,
    isPurchaseTaxable,
    purchaseSupplierInvoiceNumber,
    extracted,
  } = p;
  if (createLinkedPurchase && finalizeOcrId && canCreatePurchase) {
    if (!accountingSupplierId) {
      return language === 'ar' ? 'اختر مورد المحاسبة.' : 'Select an accounting supplier.';
    }
    if (!vaultId) {
      return language === 'ar' ? 'اختر الخزنة.' : 'Select a vault.';
    }
    if (!transactionDate?.trim()) {
      return language === 'ar' ? 'أدخل تاريخ العملية.' : 'Enter transaction date.';
    }
    if (
      isPurchaseTaxable &&
      !purchaseSupplierInvoiceNumber?.trim() &&
      !extracted?.invoiceNumber?.value &&
      !extracted?.invoiceNumber
    ) {
      return language === 'ar'
        ? 'رقم فاتورة المورد مطلوب للمشتريات الخاضعة للضريبة.'
        : 'Supplier invoice number is required for taxable purchases.';
    }
  }
  return null;
}

export function buildOcrSavePayload(p: {
  extracted: any;
  activeItems: any[];
  preview: any;
  finalizeOcrId: any;
  createLinkedPurchase: boolean;
  canCreatePurchase: boolean;
  accountingSupplierId: string;
  transactionDate: string;
  vaultId: string;
  isPurchaseTaxable: boolean;
  purchaseSupplierInvoiceNumber: string;
}): Record<string, unknown> {
  const {
    extracted,
    activeItems,
    preview,
    finalizeOcrId,
    createLinkedPurchase,
    canCreatePurchase,
    accountingSupplierId,
    transactionDate,
    vaultId,
    isPurchaseTaxable,
    purchaseSupplierInvoiceNumber,
  } = p;

  const lines = activeItems.map((item: any) => ({
    rawName: item.name || '',
    nameAr: item.nameAr || null,
    nameEn: item.nameEn || null,
    size: item.size || null,
    sizeUnit: item.sizeUnit || null,
    itemId: item.itemMatch?.id || null,
    quantity: item.quantity || null,
    unitPrice: item.unitPrice || null,
    totalPrice: item.totalPrice || null,
    confidence: item.confidence || 0,
    matchStatus: item.itemMatch?.status || 'pending',
  }));

  return {
    ...(finalizeOcrId ? { id: finalizeOcrId } : {}),
    supplierId: extracted.supplierMatch?.id || null,
    supplierName: !extracted.supplierMatch?.id ? extracted.supplier?.name || null : null,
    invoiceNumber: extracted.invoiceNumber?.value || null,
    invoiceDate: extracted.invoiceDate?.value || null,
    subtotalAmount: extracted.subtotalAmount?.value || null,
    totalAmount: extracted.totalAmount?.value || null,
    vatAmount: extracted.vatAmount?.value || null,
    imageUrl: preview && !String(preview).startsWith('blob:') ? preview : null,
    rawExtraction: extracted,
    lines,
    ...(createLinkedPurchase && finalizeOcrId && canCreatePurchase
      ? {
          purchase: {
            accountingSupplierId,
            transactionDate: toYmd(transactionDate),
            vaultId,
            isTaxable: isPurchaseTaxable,
            ...(purchaseSupplierInvoiceNumber.trim()
              ? { supplierInvoiceNumber: purchaseSupplierInvoiceNumber.trim() }
              : {}),
          },
        }
      : {}),
  };
}
