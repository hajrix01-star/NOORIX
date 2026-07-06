import { useMemo, useId, type CSSProperties } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { splitTaxFromTotalAsNumbers, TAX_RATE } from '@noorix/finance-core';
import { patchForCategoryChange, patchForSupplierChange } from '../utils/batchRowModel';
import { toPurchaseBatchPositiveNumber } from '../batch/purchaseBatchNumberModel';
import type {
  PurchaseBatchEntryRow,
  PurchaseBatchSupplier,
  PurchaseBatchSupplierCategory,
  PurchaseBatchUpdateRow,
} from '../batch/purchaseBatchTypes';

export const BATCH_ROW_INPUT_BASE: CSSProperties = {
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

type UseBatchRowLogicOptions = {
  row: PurchaseBatchEntryRow;
  index: number;
  suppliers: PurchaseBatchSupplier[];
  categories?: PurchaseBatchSupplierCategory[];
  onUpdate: PurchaseBatchUpdateRow;
  maxInvoiceDate?: string;
  vatRateDecimal?: number;
};

export function useBatchRowLogic({
  row,
  index,
  suppliers,
  categories = [],
  onUpdate,
  vatRateDecimal,
}: UseBatchRowLogicOptions) {
  const { t, lang } = useTranslation();
  const rate = vatRateDecimal ?? TAX_RATE;
  const { net, tax } = useMemo(() => {
    const total = toPurchaseBatchPositiveNumber(row.totalInclusive);
    if (total == null || row.isTaxable === false) {
      return { net: '', tax: '' };
    }
    const split = splitTaxFromTotalAsNumbers(total, true, rate);
    return { net: fmt(split.net), tax: fmt(split.tax) };
  }, [row.totalInclusive, row.isTaxable, rate]);

  const accountCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          (category.accountId || category.account) &&
          (category.type === 'expense' || category.type === 'purchase'),
      ),
    [categories],
  );

  const filteredByKind = useMemo(
    () =>
      accountCategories.filter(
        (category) =>
          (row.kind === 'purchase' && category.type === 'purchase') ||
          ((row.kind === 'expense' || row.kind === 'fixed_expense') && category.type === 'expense'),
      ),
    [accountCategories, row.kind],
  );

  const categoryOptions = useMemo(() => {
    const options = [...filteredByKind];
    if (row.categoryId && !options.some((category) => category.id === row.categoryId)) {
      const extra = categories.find((category) => category.id === row.categoryId);
      if (extra) options.unshift(extra);
    }
    return options;
  }, [filteredByKind, row.categoryId, categories]);

  function handleCategoryChange(category: PurchaseBatchSupplierCategory | null) {
    onUpdate(index, patchForCategoryChange(category, row));
  }

  function handleSupplierChange(supplierId: string) {
    onUpdate(index, patchForSupplierChange(supplierId, suppliers, categories));
  }

  const inputSm: CSSProperties = { ...BATCH_ROW_INPUT_BASE, padding: '6px 7px', fontSize: 12 };
  const cp: CSSProperties = { padding: '6px 6px' };

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
