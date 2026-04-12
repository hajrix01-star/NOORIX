/**
 * BatchRow — صف إدخال فاتورة واحدة
 * النوع والفئة في عمودين مستقلين | جلب نوع وفئة المورد عند الاختيار
 * layout="table" (افتراضي) | layout="stack" — بطاقة للجوال
 */
import React, { memo } from 'react';
import { SupplierSelect } from '../../../components/common/SupplierSelect';
import { Input, Button, Card, FormRow } from '../../../ui';
import { useBatchRowLogic } from './useBatchRowLogic';

function BatchRowTable({
  row, index, suppliers, categories, bookmarkedIds, onUpdate, onRemove, onBookmark,
  maxInvoiceDate,
}) {
  const {
    t, lang, net, tax, categoryOptions, handleCategoryChange, handleSupplierChange, inputSm, cp,
  } = useBatchRowLogic({
    row, index, suppliers, categories, onUpdate, maxInvoiceDate,
  });

  return (
    <tr style={{ borderBottom: '1px solid var(--noorix-border)' }}>
      <td className="text-center text-[11px] text-noorix-muted font-semibold" style={cp}>
        {index + 1}
      </td>

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

      <td style={cp}>
        <Input
          value={row.invoiceNumber}
          onChange={(e) => onUpdate(index, 'invoiceNumber', e.target.value)}
          placeholder={t('invoiceNumberPlaceholder')}
          className="text-center w-full"
          style={inputSm}
        />
      </td>

      <td style={cp}>
        <Input
          type="number"
          min="0"
          step="0.1"
          value={row.totalInclusive}
          onChange={(e) => onUpdate(index, 'totalInclusive', e.target.value)}
          placeholder="0"
          className="font-bold text-[13px] w-full"
          style={{ ...inputSm, textAlign: 'right', fontFamily: 'var(--noorix-font-numbers)' }}
        />
      </td>

      <td className="text-[11px]" style={{ ...cp, fontFamily: 'var(--noorix-font-numbers)', lineHeight: 1.5 }}>
        <div className="text-noorix-muted">{net || '—'}</div>
        <div style={{ color: 'var(--noorix-accent-amber)' }}>{tax || '—'}</div>
      </td>

      <td style={cp}>
        <Input
          type="date"
          dir="ltr"
          value={row.invoiceDate}
          max={maxInvoiceDate || undefined}
          onChange={(e) => {
            const v = e.target.value;
            if (maxInvoiceDate && v > maxInvoiceDate) {
              onUpdate(index, 'invoiceDate', maxInvoiceDate);
            } else {
              onUpdate(index, 'invoiceDate', v);
            }
          }}
          className="text-center w-full"
          style={{
            ...inputSm,
            ...(maxInvoiceDate && row.invoiceDate > maxInvoiceDate
              ? { borderColor: 'var(--noorix-accent-red)', background: 'var(--noorix-red-8, #fef2f2)' }
              : {}),
          }}
          title={maxInvoiceDate ? `تاريخ الفاتورة يجب أن يكون ${maxInvoiceDate} أو أقدم` : undefined}
        />
      </td>

      <td style={cp}>
        <Input
          type="select"
          value={row.kind}
          onChange={(e) => {
            onUpdate(index, 'kind', e.target.value);
            onUpdate(index, { categoryId: '', debitAccountId: '' });
          }}
        >
          <option value="purchase">{t('purchaseType')}</option>
          <option value="expense">{t('expenseType')}</option>
          <option value="fixed_expense">{t('fixedExpenseType') || 'مصروف ثابت'}</option>
        </Input>
      </td>

      <td style={cp}>
        <Input
          type="select"
          value={row.categoryId || ''}
          onChange={(e) => {
            const cat = categoryOptions.find((c) => c.id === e.target.value);
            handleCategoryChange(cat || null);
          }}
        >
          <option value="">{t('categoryPlaceholder')}</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {(c.icon || '')} {lang === 'en' ? c.nameEn || c.nameAr : c.nameAr || c.nameEn}
            </option>
          ))}
        </Input>
      </td>

      <td className="text-center" style={cp}>
        <Button
          type="button"
          onClick={() => onUpdate(index, 'isTaxable', row.isTaxable !== false ? false : true)}
          className="w-full text-[11px] font-bold whitespace-nowrap"
          title={row.isTaxable === false ? '0% — انقر لتفعيل الضريبة' : '15% — انقر لإبطال الضريبة'}
          style={{
            padding: '5px 4px',
            borderRadius: 5,
            border: `1px solid ${row.isTaxable === false ? 'var(--noorix-border)' : 'var(--noorix-accent-amber)'}`,
            background: row.isTaxable === false ? 'var(--noorix-bg-page)' : 'var(--noorix-amber-8)',
            color: row.isTaxable === false ? 'var(--noorix-text-muted)' : 'var(--noorix-accent-amber)',
          }}
        >
          {row.isTaxable === false ? '⊘ إبطال' : '✓ 15%'}
        </Button>
      </td>

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
}

function BatchRowStack({
  row, index, suppliers, categories, bookmarkedIds, onUpdate, onRemove, onBookmark,
  maxInvoiceDate,
}) {
  const {
    t, lang, net, tax, categoryOptions, handleCategoryChange, handleSupplierChange, inputSm,
  } = useBatchRowLogic({
    row, index, suppliers, categories, onUpdate, maxInvoiceDate,
  });

  const labelCls = 'text-[11px] font-semibold text-noorix-muted mb-1';

  return (
    <Card padding="sm" className="min-w-0">
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-[13px] font-bold text-noorix-text">
          #{index + 1}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {row.supplierId && (
            <Button
              type="button"
              size="sm"
              onClick={() => onBookmark(row.supplierId)}
              title={bookmarkedIds.includes(row.supplierId) ? t('removeFromShortcuts') : t('addToShortcuts')}
              className="min-h-[40px] min-w-[40px]"
              style={{
                background: bookmarkedIds.includes(row.supplierId) ? 'var(--noorix-yellow-15)' : 'var(--noorix-bg-page)',
              }}
            >
              {bookmarkedIds.includes(row.supplierId) ? '★' : '☆'}
            </Button>
          )}
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => onRemove(index)}
            className="min-h-[40px] min-w-[40px]"
            title={t('delete')}
          >
            ×
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <div className={labelCls}>{t('supplier')}</div>
          <SupplierSelect
            suppliers={suppliers}
            value={row.supplierId}
            onChange={handleSupplierChange}
            bookmarkedIds={bookmarkedIds}
            placeholder={t('selectSupplier')}
          />
        </div>

        <FormRow cols={1} gap="sm">
          <div>
            <div className={labelCls}>{t('supplierInvoiceNumber')}</div>
            <Input
              value={row.invoiceNumber}
              onChange={(e) => onUpdate(index, 'invoiceNumber', e.target.value)}
              placeholder={t('invoiceNumberPlaceholder')}
              className="w-full"
              style={inputSm}
            />
          </div>
          <div>
            <div className={labelCls}>{t('total')}</div>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={row.totalInclusive}
              onChange={(e) => onUpdate(index, 'totalInclusive', e.target.value)}
              placeholder="0"
              className="font-bold w-full"
              style={{ ...inputSm, fontFamily: 'var(--noorix-font-numbers)' }}
            />
          </div>
        </FormRow>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-noorix-bg py-2 px-2.5">
          <div>
            <div className="text-[10px] text-noorix-muted mb-0.5">{t('net')}</div>
            <div className="text-[13px] font-semibold text-noorix-text" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>
              {net || '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-noorix-muted mb-0.5">{t('tax')}</div>
            <div className="text-[13px] font-semibold text-noorix-amber" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>
              {tax || '—'}
            </div>
          </div>
        </div>

        <div>
          <div className={labelCls}>{t('date')}</div>
          <Input
            type="date"
            dir="ltr"
            value={row.invoiceDate}
            max={maxInvoiceDate || undefined}
            onChange={(e) => {
              const v = e.target.value;
              if (maxInvoiceDate && v > maxInvoiceDate) {
                onUpdate(index, 'invoiceDate', maxInvoiceDate);
              } else {
                onUpdate(index, 'invoiceDate', v);
              }
            }}
            className="w-full"
            style={{
              ...inputSm,
              ...(maxInvoiceDate && row.invoiceDate > maxInvoiceDate
                ? { borderColor: 'var(--noorix-accent-red)', background: 'var(--noorix-red-8, #fef2f2)' }
                : {}),
            }}
            title={maxInvoiceDate ? `تاريخ الفاتورة يجب أن يكون ${maxInvoiceDate} أو أقدم` : undefined}
          />
        </div>

        <div>
          <div className={labelCls}>{t('type')}</div>
          <Input
            type="select"
            value={row.kind}
            onChange={(e) => {
              onUpdate(index, 'kind', e.target.value);
              onUpdate(index, { categoryId: '', debitAccountId: '' });
            }}
          >
            <option value="purchase">{t('purchaseType')}</option>
            <option value="expense">{t('expenseType')}</option>
            <option value="fixed_expense">{t('fixedExpenseType') || 'مصروف ثابت'}</option>
          </Input>
        </div>

        <div>
          <div className={labelCls}>{t('category')}</div>
          <Input
            type="select"
            value={row.categoryId || ''}
            onChange={(e) => {
              const cat = categoryOptions.find((c) => c.id === e.target.value);
              handleCategoryChange(cat || null);
            }}
          >
            <option value="">{t('categoryPlaceholder')}</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {(c.icon || '')} {lang === 'en' ? c.nameEn || c.nameAr : c.nameAr || c.nameEn}
              </option>
            ))}
          </Input>
        </div>

        <div>
          <div className={labelCls}>{t('taxPct')}</div>
          <Button
            type="button"
            variant="raw"
            onClick={() => onUpdate(index, 'isTaxable', row.isTaxable !== false ? false : true)}
            className="w-full min-h-[44px] text-[12px] font-bold"
            title={row.isTaxable === false ? '0% — انقر لتفعيل الضريبة' : '15% — انقر لإبطال الضريبة'}
            style={{
              borderRadius: 8,
              border: `1px solid ${row.isTaxable === false ? 'var(--noorix-border)' : 'var(--noorix-accent-amber)'}`,
              background: row.isTaxable === false ? 'var(--noorix-bg-page)' : 'var(--noorix-amber-8)',
              color: row.isTaxable === false ? 'var(--noorix-text-muted)' : 'var(--noorix-accent-amber)',
            }}
          >
            {row.isTaxable === false ? '⊘ إبطال' : '✓ 15%'}
          </Button>
        </div>

        <div>
          <div className={labelCls}>{t('notes')}</div>
          <Input
            value={row.notes || ''}
            onChange={(e) => onUpdate(index, 'notes', e.target.value)}
            placeholder={(row.kind === 'fixed_expense' || !row.supplierId) ? 'اسم الخدمة*' : '...'}
            className="w-full"
            style={inputSm}
            title={!row.supplierId ? (t('notesRequiredForNoSupplier') || 'مطلوب بدون مورد') : ''}
          />
        </div>
      </div>
    </Card>
  );
}

export const BatchRow = memo(function BatchRow({ layout = 'table', ...rest }) {
  if (layout === 'stack') {
    return <BatchRowStack {...rest} />;
  }
  return <BatchRowTable {...rest} />;
});

export default BatchRow;
