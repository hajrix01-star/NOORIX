/**
 * منطق نقي لصف دفعة المشتريات — مصدر واحد للاختبارات ولـ useBatchRowLogic
 */

/**
 * @param {string} supplierId
 * @param {Array<object>} suppliers
 * @param {Array<object>} categories
 * @returns {object} كائن التحديث الكامل للصف
 */
export function patchForSupplierChange(supplierId, suppliers, categories) {
  if (!supplierId) {
    return { supplierId: '', categoryId: '', debitAccountId: '', kind: 'purchase' };
  }
  const supplier = suppliers.find((s) => s.id === supplierId);
  if (!supplier) {
    return {
      supplierId,
      kind: 'purchase',
      categoryId: '',
      debitAccountId: '',
      isTaxable: true,
    };
  }
  const cat =
    supplier?.supplierCategory ??
    (supplier?.supplierCategoryId ? categories.find((c) => c.id === supplier.supplierCategoryId) : null);
  const kind = cat?.type === 'expense' ? 'expense' : 'purchase';
  const isTaxable = supplier?.isTaxRegistered !== false;

  return {
    supplierId,
    kind,
    categoryId: cat ? cat.id : '',
    debitAccountId: cat ? cat.accountId || cat.account?.id || '' : '',
    isTaxable,
  };
}

/**
 * @param {object|null} cat فئة محاسبية أو null لمسح الحقل
 * @param {object} row صف الفاتورة الحالي
 * @returns {object}
 */
export function patchForCategoryChange(cat, row) {
  if (!cat) {
    return { categoryId: '', debitAccountId: '' };
  }
  const patch: Record<string, unknown> = {
    categoryId: cat.id,
    debitAccountId: cat.accountId || cat.account?.id,
  };
  if (!row.supplierId) {
    patch.isTaxable = !(cat.account?.taxExempt ?? false);
  }
  return patch;
}

/** أنواع السطر التي تدعم «متابعة ضمان» في دفعة الموردين (مشتريات / مصروفات / مصروف ثابت) */
export function isWarrantyFollowUpKind(kind) {
  return kind === 'purchase' || kind === 'expense' || kind === 'fixed_expense';
}
