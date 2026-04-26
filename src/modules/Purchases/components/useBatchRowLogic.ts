/**
 * منطق مشترك لصف إدخال دفعة المشتريات (جدول أو بطاقة جوال)
 */
import { useMemo, useId } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { calcReverseVat } from '../../../utils/format';
import { patchForCategoryChange, patchForSupplierChange } from '../utils/batchRowModel';

export const BATCH_ROW_INPUT_BASE = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid var(--noorix-border)',
  background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)',
  fontSize: 13,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

export function useBatchRowLogic({
  row,
  index,
  suppliers,
  categories = [],
  onUpdate,
  maxInvoiceDate,
}) {
  const { t, lang } = useTranslation();
  const { net, tax } = calcReverseVat(row.totalInclusive, row.isTaxable !== false);

  const accountCategories = categories.filter(
    (c) => (c.accountId || c.account) && (c.type === 'expense' || c.type === 'purchase'),
  );
  const filteredByKind = accountCategories.filter(
    (c) =>
      (row.kind === 'purchase' && c.type === 'purchase') ||
      ((row.kind === 'expense' || row.kind === 'fixed_expense') && c.type === 'expense'),
  );

  const categoryOptions = useMemo(() => {
    const opts = [...filteredByKind];
    if (row.categoryId && !opts.some((c) => c.id === row.categoryId)) {
      const extra = categories.find((c) => c.id === row.categoryId);
      if (extra) opts.unshift(extra);
    }
    return opts;
  }, [filteredByKind, row.categoryId, categories]);

  function handleCategoryChange(cat) {
    onUpdate(index, patchForCategoryChange(cat, row));
  }

  function handleSupplierChange(supplierId) {
    onUpdate(index, patchForSupplierChange(supplierId, suppliers, categories));
  }

  const inputSm = { ...BATCH_ROW_INPUT_BASE, padding: '6px 7px', fontSize: 12 };
  const cp = { padding: '6px 6px' };

  return {
    t,
    lang,
    net,
    tax,
    categoryOptions,
    handleCategoryChange,
    handleSupplierChange,
    inputSm,
    cp,
  };
}

/** معرفات فريدة لربط التسميات بالحقول في الوضع العمودي */
export function useBatchRowFieldIds() {
  const uid = useId();
  return useMemo(
    () => ({
      supplier: `${uid}-supplier`,
      invoiceNumber: `${uid}-invoice`,
      totalInclusive: `${uid}-total`,
      invoiceDate: `${uid}-invdate`,
      kind: `${uid}-kind`,
      category: `${uid}-category`,
      notes: `${uid}-notes`,
    }),
    [uid],
  );
}
