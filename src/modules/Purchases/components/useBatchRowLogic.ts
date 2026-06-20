/**
 * منطق مشترك لصف إدخال دفعة المشتريات (جدول أو بطاقة جوال)
 */
import { useMemo, useId } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { splitTaxFromTotalAsNumbers, TAX_RATE } from '../../../utils/math-engine';
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
  vatRateDecimal,
}: any) {
  const { t, lang } = useTranslation();
  const rate = vatRateDecimal ?? TAX_RATE;
  const { net, tax } = useMemo(() => {
    const total = parseFloat(String(row.totalInclusive ?? '').replace(/,/g, ''));
    if (!Number.isFinite(total) || total <= 0 || row.isTaxable === false) {
      return { net: '', tax: '' };
    }
    const { net: n, tax: tx } = splitTaxFromTotalAsNumbers(total, true, rate);
    return { net: fmt(n), tax: fmt(tx) };
  }, [row.totalInclusive, row.isTaxable, rate]);

  const accountCategories = categories.filter(
    (c: any) => (c.accountId || c.account) && (c.type === 'expense' || c.type === 'purchase'),
  );
  const filteredByKind = accountCategories.filter(
    (c: any) =>
      (row.kind === 'purchase' && c.type === 'purchase') ||
      ((row.kind === 'expense' || row.kind === 'fixed_expense') && c.type === 'expense'),
  );

  const categoryOptions = useMemo(() => {
    const opts = [...filteredByKind];
    if (row.categoryId && !opts.some((c: any) => c.id === row.categoryId)) {
      const extra = categories.find((c: any) => c.id === row.categoryId);
      if (extra) opts.unshift(extra);
    }
    return opts;
  }, [filteredByKind, row.categoryId, categories]);

  function handleCategoryChange(cat: any) {
    onUpdate(index, patchForCategoryChange(cat, row));
  }

  function handleSupplierChange(supplierId: any) {
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
