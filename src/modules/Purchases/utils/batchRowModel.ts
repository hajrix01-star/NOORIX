import type {
  PurchaseBatchEntryRow,
  PurchaseBatchKind,
  PurchaseBatchSupplier,
  PurchaseBatchSupplierCategory,
  PurchaseBatchUpdateRowPatch,
} from '../batch/purchaseBatchTypes';

export function patchForSupplierChange(
  supplierId: string,
  suppliers: PurchaseBatchSupplier[],
  categories: PurchaseBatchSupplierCategory[],
): PurchaseBatchUpdateRowPatch {
  if (!supplierId) {
    return { supplierId: '', categoryId: '', debitAccountId: '', kind: 'purchase' };
  }

  const supplier = suppliers.find((candidate) => candidate.id === supplierId);
  if (!supplier) {
    return {
      supplierId,
      kind: 'purchase',
      categoryId: '',
      debitAccountId: '',
      isTaxable: true,
    };
  }

  const category =
    supplier.supplierCategory ??
    (supplier.supplierCategoryId
      ? categories.find((candidate) => candidate.id === supplier.supplierCategoryId)
      : null);
  const kind: PurchaseBatchKind = category?.type === 'expense' ? 'expense' : 'purchase';

  return {
    supplierId,
    kind,
    categoryId: category?.id ?? '',
    debitAccountId: category?.accountId || category?.account?.id || '',
    isTaxable: supplier.isTaxRegistered !== false,
  };
}

export function patchForCategoryChange(
  category: PurchaseBatchSupplierCategory | null,
  row: Pick<PurchaseBatchEntryRow, 'supplierId'>,
): PurchaseBatchUpdateRowPatch {
  if (!category) {
    return { categoryId: '', debitAccountId: '' };
  }

  const patch: PurchaseBatchUpdateRowPatch = {
    categoryId: category.id ?? '',
    debitAccountId: category.accountId || category.account?.id || '',
  };

  if (!row.supplierId) {
    patch.isTaxable = !(category.account?.taxExempt ?? false);
  }

  return patch;
}

export function isWarrantyFollowUpKind(kind: string | null | undefined): kind is PurchaseBatchKind {
  return kind === 'purchase' || kind === 'expense' || kind === 'fixed_expense';
}
