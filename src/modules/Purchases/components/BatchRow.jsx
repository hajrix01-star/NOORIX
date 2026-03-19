/**
 * BatchRow — صف إدخال فاتورة واحدة
 * النوع والفئة في عمودين مستقلين | جلب نوع وفئة المورد عند الاختيار
 */
import React, { memo, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { SupplierSelect } from '../../../components/common/SupplierSelect';
import { calcReverseVat } from '../../../utils/format';

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
    // فئة المورد: من supplierCategory المضمنة أو من القائمة عبر supplierCategoryId
    const cat = supplier?.supplierCategory ?? (supplier?.supplierCategoryId ? categories.find((c) => c.id === supplier.supplierCategoryId) : null);
    const kind = cat?.type === 'expense' ? 'expense' : 'purchase';
    const taxExempt = cat?.account?.taxExempt ?? false;
    // تحديث واحد لتفادي مشاكل الـ batching
    onUpdate(index, {
      supplierId,
      kind,
      categoryId: cat ? cat.id : '',
      debitAccountId: cat ? (cat.accountId || cat.account?.id || '') : '',
      isTaxable: !taxExempt,
    });
  }

  /* padding موحّد لكل خلية — مدمج لحفظ ارتفاع الصف */
  const cp = { padding: '6px 6px' };
  const inputSm = { ...inputBase, padding: '6px 7px', fontSize: 12 };

  return (
    <tr style={{ borderBottom: '1px solid var(--noorix-border)' }}>
      {/* # */}
      <td style={{ ...cp, textAlign: 'center', fontSize: 11, color: 'var(--noorix-text-muted)', fontWeight: 600 }}>
        {index + 1}
      </td>

      {/* المورد + bookmark */}
      <td style={{ ...cp }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <SupplierSelect
              suppliers={suppliers}
              value={row.supplierId}
              onChange={handleSupplierChange}
              bookmarkedIds={bookmarkedIds}
              placeholder={t('selectSupplier')}
            />
          </div>
          {row.supplierId && (
            <button
              type="button"
              onClick={() => onBookmark(row.supplierId)}
              title={bookmarkedIds.includes(row.supplierId) ? t('removeFromShortcuts') : t('addToShortcuts')}
              style={{
                width: 26, height: 26, borderRadius: 5, border: '1px solid var(--noorix-border)',
                background: bookmarkedIds.includes(row.supplierId) ? 'rgba(245,158,11,0.15)' : 'var(--noorix-bg-page)',
                cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              {bookmarkedIds.includes(row.supplierId) ? '★' : '☆'}
            </button>
          )}
        </div>
      </td>

      {/* رقم الفاتورة */}
      <td style={cp}>
        <input
          value={row.invoiceNumber}
          onChange={(e) => onUpdate(index, 'invoiceNumber', e.target.value)}
          placeholder={t('invoiceNumberPlaceholder')}
          style={{ ...inputSm, textAlign: 'center', width: '100%' }}
        />
      </td>

      {/* الإجمالي شامل الضريبة */}
      <td style={cp}>
        <input
          type="number" min="0" step="0.1"
          value={row.totalInclusive}
          onChange={(e) => onUpdate(index, 'totalInclusive', e.target.value)}
          placeholder="0"
          style={{ ...inputSm, textAlign: 'right', fontFamily: 'var(--noorix-font-numbers)', fontWeight: 700, fontSize: 13, width: '100%' }}
        />
      </td>

      {/* صافي / ضريبة — خلية واحدة، سطران */}
      <td style={{ ...cp, fontFamily: 'var(--noorix-font-numbers)', fontSize: 11, lineHeight: 1.5 }}>
        <div style={{ color: 'var(--noorix-text-muted)' }}>{net || '—'}</div>
        <div style={{ color: '#d97706' }}>{tax || '—'}</div>
      </td>

      {/* تاريخ الفاتورة */}
      <td style={cp}>
        <input
          type="date"
          value={row.invoiceDate}
          onChange={(e) => onUpdate(index, 'invoiceDate', e.target.value)}
          style={{ ...inputSm, width: '100%', textAlign: 'center' }}
        />
      </td>

      {/* النوع */}
      <td style={cp}>
        <select
          value={row.kind}
          onChange={(e) => { onUpdate(index, 'kind', e.target.value); onUpdate(index, { categoryId: '', debitAccountId: '' }); }}
          style={{ ...inputSm, width: '100%' }}
        >
          <option value="purchase">{t('purchaseType')}</option>
          <option value="expense">{t('expenseType')}</option>
          <option value="fixed_expense">{t('fixedExpenseType') || 'مصروف ثابت'}</option>
        </select>
      </td>

      {/* الفئة */}
      <td style={cp}>
        <select
          value={row.categoryId || ''}
          onChange={(e) => { const cat = categoryOptions.find((c) => c.id === e.target.value); handleCategoryChange(cat || null); }}
          style={{ ...inputSm, width: '100%' }}
        >
          <option value="">{t('categoryPlaceholder')}</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>{(c.icon || '')} {c.nameAr}</option>
          ))}
        </select>
      </td>

      {/* زر الضريبة */}
      <td style={{ ...cp, textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => onUpdate(index, 'isTaxable', row.isTaxable !== false ? false : true)}
          style={{
            width: '100%', padding: '6px 2px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${row.isTaxable === false ? '#94a3b8' : '#d97706'}`,
            background: row.isTaxable === false ? 'var(--noorix-bg-page)' : 'rgba(217,119,6,0.08)',
            color: row.isTaxable === false ? '#64748b' : '#d97706',
          }}
        >
          {row.isTaxable === false ? '0%' : '15%'}
        </button>
      </td>

      {/* الملاحظات */}
      <td style={cp}>
        <input
          value={row.notes || ''}
          onChange={(e) => onUpdate(index, 'notes', e.target.value)}
          placeholder={(row.kind === 'fixed_expense' || !row.supplierId) ? 'اسم الخدمة*' : '...'}
          style={{ ...inputSm, width: '100%' }}
          title={!row.supplierId ? (t('notesRequiredForNoSupplier') || 'مطلوب بدون مورد') : ''}
        />
      </td>

      {/* حذف */}
      <td style={{ ...cp, textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => onRemove(index)}
          style={{
            width: 26, height: 26, borderRadius: 5, border: '1px solid #fecaca',
            background: 'rgba(239,68,68,0.06)', color: '#dc2626', cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
          }}
          title={t('delete')}
        >
          ×
        </button>
      </td>
    </tr>
  );
});

export default BatchRow;
