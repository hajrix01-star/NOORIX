/**
 * BatchRow — صف إدخال فاتورة واحدة
 * النوع والفئة في عمودين مستقلين | جلب نوع وفئة المورد عند الاختيار
 */
import React, { memo, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { SupplierSelect } from '../../../components/common/SupplierSelect';
import { calcReverseVat } from '../../../utils/format';
import { Input, Button } from '../../../ui';

const inputBase = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
};

export const BatchRow = memo(function BatchRow({
  row, index, suppliers, categories = [], bookmarkedIds, onUpdate, onRemove, onBookmark,
}) {
  const { t } = useTranslation();
  const { net, tax } = calcReverseVat(row.totalInclusive, row.isTaxable !== false);
  const accountCategories = categories.filter(
    (c) => (c.accountId || c.account) && (c.type === 'expense' || c.type === 'purchase'),
  );
  const filteredByKind = accountCategories.filter(
    (c) =>
      (row.kind === 'purchase' && c.type === 'purchase') ||
      ((row.kind === 'expense' || row.kind === 'fixed_expense') && c.type === 'expense'),
  );
  // إضافة فئة المورد إذا كانت محددّة لكن غير موجودة في القائمة (مثلاً فئة بدون حساب)
  const categoryOptions = useMemo(() => {
    const opts = [...filteredByKind];
    if (row.categoryId && !opts.some((c) => c.id === row.categoryId)) {
      const extra = categories.find((c) => c.id === row.categoryId);
      if (extra) opts.unshift(extra);
    }
    return opts;
  }, [filteredByKind, row.categoryId, categories]);

  function handleCategoryChange(cat) {
    if (!cat) {
      onUpdate(index, { categoryId: '', debitAccountId: '' });
      return;
    }
    const taxExempt = cat.account?.taxExempt ?? false;
    onUpdate(index, {
      categoryId: cat.id,
      debitAccountId: cat.accountId || cat.account?.id,
      isTaxable: !taxExempt,
    });
  }

  function handleSupplierChange(supplierId) {
    if (!supplierId) {
      onUpdate(index, { supplierId: '', categoryId: '', debitAccountId: '', kind: 'purchase' });
      return;
    }
    const supplier = suppliers.find((s) => s.id === supplierId);
    const cat = supplier?.supplierCategory ?? (supplier?.supplierCategoryId ? categories.find((c) => c.id === supplier.supplierCategoryId) : null);
    const kind = cat?.type === 'expense' ? 'expense' : 'purchase';

    // الأولوية: isTaxRegistered على المورد ← taxExempt على الفئة ← افتراضي (ضريبي)
    let isTaxable;
    if (supplier?.isTaxRegistered === true)  isTaxable = true;
    else if (supplier?.isTaxRegistered === false) isTaxable = false;
    else isTaxable = !(cat?.account?.taxExempt ?? false);

    onUpdate(index, {
      supplierId,
      kind,
      categoryId:      cat ? cat.id : '',
      debitAccountId:  cat ? (cat.accountId || cat.account?.id || '') : '',
      isTaxable,
    });
  }

  /* padding موحّد لكل خلية — مدمج لحفظ ارتفاع الصف */
  const cp = { padding: '6px 6px' };
  const inputSm = { ...inputBase, padding: '6px 7px', fontSize: 12 };

  return (
    <tr style={{ borderBottom: '1px solid var(--noorix-border)' }}>
      {/* # */}
      <td className="text-center text-[11px] text-noorix-muted font-semibold" style={cp}>
        {index + 1}
      </td>

      {/* المورد + bookmark */}
      <td style={{ ...cp }}>
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <SupplierSelect
              suppliers={suppliers}
              value={row.supplierId}
              onChange={handleSupplierChange}
              bookmarkedIds={bookmarkedIds}
              placeholder={t('selectSupplier')}
            />
          </div>
          {row.supplierId && (
            <Button
              type="button"
              onClick={() => onBookmark(row.supplierId)}
              title={bookmarkedIds.includes(row.supplierId) ? t('removeFromShortcuts') : t('addToShortcuts')}
            className="text-[14px] w-8 h-8 min-w-8 min-h-8 rounded-md shrink-0"
            style={{
              background: bookmarkedIds.includes(row.supplierId) ? 'var(--noorix-yellow-15)' : 'var(--noorix-bg-page)',
            }}
            >
              {bookmarkedIds.includes(row.supplierId) ? '★' : '☆'}
            </Button>
          )}
        </div>
      </td>

      {/* رقم الفاتورة */}
      <td style={cp}>
        <Input
          value={row.invoiceNumber}
          onChange={(e) => onUpdate(index, 'invoiceNumber', e.target.value)}
          placeholder={t('invoiceNumberPlaceholder')}
          className="text-center w-full"
          style={inputSm}
        />
      </td>

      {/* الإجمالي شامل الضريبة */}
      <td style={cp}>
        <Input
          type="number" min="0" step="0.1"
          value={row.totalInclusive}
          onChange={(e) => onUpdate(index, 'totalInclusive', e.target.value)}
          placeholder="0"
          className="font-bold text-[13px] w-full"
          style={{ ...inputSm, textAlign: 'right', fontFamily: 'var(--noorix-font-numbers)' }}
        />
      </td>

      {/* صافي / ضريبة — خلية واحدة، سطران */}
      <td className="text-[11px]" style={{ ...cp, fontFamily: 'var(--noorix-font-numbers)', lineHeight: 1.5 }}>
        <div className="text-noorix-muted">{net || '—'}</div>
        <div style={{ color: 'var(--noorix-accent-amber)' }}>{tax || '—'}</div>
      </td>

      {/* تاريخ الفاتورة */}
      <td style={cp}>
        <Input
          type="date"
          dir="ltr"
          value={row.invoiceDate}
          onChange={(e) => onUpdate(index, 'invoiceDate', e.target.value)}
          className="text-center w-full"
          style={inputSm}
        />
      </td>

      {/* النوع */}
      <td style={cp}>
        <Input
          type="select"
          value={row.kind}
          onChange={(e) => { onUpdate(index, 'kind', e.target.value); onUpdate(index, { categoryId: '', debitAccountId: '' }); }}
        >
          <option value="purchase">{t('purchaseType')}</option>
          <option value="expense">{t('expenseType')}</option>
          <option value="fixed_expense">{t('fixedExpenseType') || 'مصروف ثابت'}</option>
        </Input>
      </td>

      {/* الفئة */}
      <td style={cp}>
        <Input
          type="select"
          value={row.categoryId || ''}
          onChange={(e) => { const cat = categoryOptions.find((c) => c.id === e.target.value); handleCategoryChange(cat || null); }}
        >
          <option value="">{t('categoryPlaceholder')}</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>{(c.icon || '')} {c.nameAr}</option>
          ))}
        </Input>
      </td>

      {/* زر الضريبة */}
      <td className="text-center" style={cp}>
        <Button
          type="button"
          onClick={() => onUpdate(index, 'isTaxable', row.isTaxable !== false ? false : true)}
          className="w-full text-[11px] font-bold"
          style={{
            padding: '6px 2px', borderRadius: 5,
            border: `1px solid ${row.isTaxable === false ? 'var(--noorix-text-muted-2)' : 'var(--noorix-accent-amber)'}`,
            background: row.isTaxable === false ? 'var(--noorix-bg-page)' : 'var(--noorix-amber-8)',
            color: row.isTaxable === false ? 'var(--noorix-text-muted)' : 'var(--noorix-accent-amber)',
          }}
        >
          {row.isTaxable === false ? '0%' : '15%'}
        </Button>
      </td>

      {/* الملاحظات */}
      <td style={cp}>
        <Input
          value={row.notes || ''}
          onChange={(e) => onUpdate(index, 'notes', e.target.value)}
          placeholder={(row.kind === 'fixed_expense' || !row.supplierId) ? 'اسم الخدمة*' : '...'}
          className="w-full"
          style={inputSm}
          title={!row.supplierId ? (t('notesRequiredForNoSupplier') || 'مطلوب بدون مورد') : ''}
        />
      </td>

      {/* حذف */}
      <td className="text-center" style={cp}>
        <Button
          type="button"
          variant="danger"
          onClick={() => onRemove(index)}
          className="flex items-center justify-center text-[15px] w-8 h-8 min-w-8 min-h-8 rounded-md mx-auto"
          title={t('delete')}
        >
          ×
        </Button>
      </td>
    </tr>
  );
});

export default BatchRow;
