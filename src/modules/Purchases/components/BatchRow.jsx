/**
 * BatchRow — صف إدخال فاتورة واحدة
 * layout="table" (افتراضي) | layout="stack" — بطاقة للجوال
 * الحقول المشتركة: BatchRowParts + useBatchRowLogic
 */
import React, { memo, useMemo } from 'react';
import { Input, Button, Card, FormRow } from '../../../ui';
import { useBatchRowLogic, useBatchRowFieldIds } from './useBatchRowLogic';
import {
  BatchSupplierPickInner,
  BatchSupplierBookmarkButton,
  BatchNetTaxReadonly,
  BatchTaxToggleButton,
  BatchKindOptions,
} from './BatchRowParts';
import { isWarrantyFollowUpKind } from '../utils/batchRowModel';

function dateErrorStyle(maxInvoiceDate, invoiceDate) {
  return maxInvoiceDate && invoiceDate > maxInvoiceDate
    ? { borderColor: 'var(--noorix-accent-red)', background: 'var(--noorix-red-8, #fef2f2)' }
    : {};
}

function BatchRowTable({
  row, index, suppliers, categories, bookmarkedIds, onUpdate, onRemove, onBookmark,
  maxInvoiceDate,
}) {
  const {
    t, lang, net, tax, categoryOptions, handleCategoryChange, handleSupplierChange, inputSm, cp,
  } = useBatchRowLogic({
    row, index, suppliers, categories, onUpdate, maxInvoiceDate,
  });

  const dateTitle = useMemo(
    () => (maxInvoiceDate ? `${t('date')} — ${maxInvoiceDate}` : undefined),
    [maxInvoiceDate, t],
  );

  return (
    <tr style={{ borderBottom: '1px solid var(--noorix-border)' }}>
      <td className="text-center text-[11px] text-noorix-muted font-semibold" style={cp}>
        {index + 1}
      </td>

      <td style={{ ...cp }}>
        <BatchSupplierPickInner
          suppliers={suppliers}
          row={row}
          bookmarkedIds={bookmarkedIds}
          onBookmark={onBookmark}
          handleSupplierChange={handleSupplierChange}
          t={t}
          bookmarkSize="compact"
        />
      </td>

      <td style={cp}>
        <Input
          value={row.invoiceNumber}
          onChange={(e) => onUpdate(index, 'invoiceNumber', e.target.value)}
          placeholder={t('invoiceNumberPlaceholder')}
          className="text-center w-full"
          style={inputSm}
          aria-label={`${t('supplierInvoiceNumber')} — ${t('batchRowLineAriaLabel', index + 1)}`}
        />
      </td>

      <td style={cp}>
        <Input
          type="number"
          min="0"
          step="0.1"
          value={row.totalInclusive}
          onChange={(e) => onUpdate(index, 'totalInclusive', e.target.value)}
          placeholder={t('amountPlaceholderZero')}
          className="font-bold text-[13px] w-full"
          style={{ ...inputSm, textAlign: 'right', fontFamily: 'var(--noorix-font-numbers)' }}
          aria-label={`${t('total')} — ${t('batchRowLineAriaLabel', index + 1)}`}
        />
      </td>

      <td className="text-[11px]" style={{ ...cp, fontFamily: 'var(--noorix-font-numbers)', lineHeight: 1.5 }}>
        <BatchNetTaxReadonly net={net} tax={tax} variant="table" t={t} />
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
            ...dateErrorStyle(maxInvoiceDate, row.invoiceDate),
          }}
          title={dateTitle}
          aria-label={`${t('date')} — ${t('batchRowLineAriaLabel', index + 1)}`}
        />
      </td>

      <td style={cp}>
        <Input
          type="select"
          value={row.kind}
          onChange={(e) => {
            const kind = e.target.value;
            onUpdate(index, {
              kind,
              categoryId: '',
              debitAccountId: '',
              warrantyFollowUp: isWarrantyFollowUpKind(kind) ? !!row.warrantyFollowUp : false,
            });
          }}
          aria-label={`${t('type')} — ${t('batchRowLineAriaLabel', index + 1)}`}
        >
          <BatchKindOptions t={t} />
        </Input>
      </td>

      <td className="text-center align-middle" style={cp}>
        {isWarrantyFollowUpKind(row.kind) ? (
          <label className="inline-flex items-center justify-center gap-1.5 cursor-pointer text-[11px] font-semibold text-noorix-muted">
            <input
              type="checkbox"
              checked={!!row.warrantyFollowUp}
              onChange={(e) => onUpdate(index, 'warrantyFollowUp', e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-noorix-border accent-noorix-blue"
              aria-label={`${t('warrantyFollowUpCol')} — ${t('batchRowLineAriaLabel', index + 1)}`}
            />
            <span className="hidden xl:inline">{t('warrantyFollowUpShort')}</span>
          </label>
        ) : (
          <span className="text-noorix-muted">—</span>
        )}
      </td>

      <td style={cp}>
        <Input
          type="select"
          value={row.categoryId || ''}
          onChange={(e) => {
            const cat = categoryOptions.find((c) => c.id === e.target.value);
            handleCategoryChange(cat || null);
          }}
          aria-label={`${t('category')} — ${t('batchRowLineAriaLabel', index + 1)}`}
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
        <BatchTaxToggleButton row={row} index={index} onUpdate={onUpdate} t={t} density="table" />
      </td>

      <td style={cp}>
        <Input
          value={row.notes || ''}
          onChange={(e) => onUpdate(index, 'notes', e.target.value)}
          placeholder={(row.kind === 'fixed_expense' || !row.supplierId) ? t('batchNotesPlaceholderServiceName') : t('batchNotesPlaceholderEllipsis')}
          className="w-full"
          style={inputSm}
          title={!row.supplierId ? (t('notesRequiredForNoSupplier') || '') : ''}
          aria-label={`${t('notes')} — ${t('batchRowLineAriaLabel', index + 1)}`}
        />
      </td>

      <td className="text-center align-middle p-1" style={cp} title={t('invoiceReceiptAttachment')}>
        <div className="flex flex-col items-center gap-0.5 min-h-[36px] justify-center">
          {row.attachmentFile ? (
            <span className="text-[10px] font-bold leading-none" style={{ color: 'var(--noorix-accent-green)' }}>✓</span>
          ) : (
            <span className="text-[10px] text-noorix-muted leading-none">·</span>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
            className="w-full max-w-[96px] text-[9px] file:mr-1"
            aria-label={`${t('invoiceReceiptAttachment')} — ${t('batchRowLineAriaLabel', index + 1)}`}
            onChange={(e) => onUpdate(index, 'attachmentFile', e.target.files?.[0] ?? null)}
          />
        </div>
      </td>

      <td className="text-center" style={cp}>
        <Button
          type="button"
          variant="danger"
          onClick={() => onRemove(index)}
          className="flex items-center justify-center text-[15px] w-8 h-8 min-w-8 min-h-8 rounded-md mx-auto"
          title={t('delete')}
          aria-label={`${t('delete')} — ${t('batchRowLineAriaLabel', index + 1)}`}
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
  const ids = useBatchRowFieldIds();
  const {
    t, lang, net, tax, categoryOptions, handleCategoryChange, handleSupplierChange,
  } = useBatchRowLogic({
    row, index, suppliers, categories, onUpdate, maxInvoiceDate,
  });

  const dateTitle = useMemo(
    () => (maxInvoiceDate ? `${t('date')} — ≤ ${maxInvoiceDate}` : undefined),
    [maxInvoiceDate, t],
  );

  return (
    <Card
      padding="sm"
      className="min-w-0"
      aria-label={t('batchRowLineAriaLabel', index + 1)}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-[13px] font-bold text-noorix-text">
          #{index + 1}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <BatchSupplierBookmarkButton
            row={row}
            bookmarkedIds={bookmarkedIds}
            onBookmark={onBookmark}
            t={t}
            size="touch"
          />
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => onRemove(index)}
            className="min-h-[40px] min-w-[40px]"
            title={t('delete')}
            aria-label={t('delete')}
          >
            ×
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor={ids.supplier} className="text-[11px] font-semibold text-noorix-muted mb-1 block">
            {t('supplier')}
          </label>
          <BatchSupplierPickInner
            suppliers={suppliers}
            row={row}
            bookmarkedIds={bookmarkedIds}
            onBookmark={onBookmark}
            handleSupplierChange={handleSupplierChange}
            t={t}
            bookmarkSize="none"
            supplierInputId={ids.supplier}
          />
        </div>

        <FormRow cols={1} gap="sm">
          <Input
            id={ids.invoiceNumber}
            label={t('supplierInvoiceNumber')}
            size="sm"
            value={row.invoiceNumber}
            onChange={(e) => onUpdate(index, 'invoiceNumber', e.target.value)}
            placeholder={t('invoiceNumberPlaceholder')}
            className="w-full"
          />
          <Input
            id={ids.totalInclusive}
            label={t('total')}
            type="number"
            min="0"
            step="0.1"
            size="sm"
            value={row.totalInclusive}
            onChange={(e) => onUpdate(index, 'totalInclusive', e.target.value)}
            placeholder={t('amountPlaceholderZero')}
            className="font-bold w-full nx-font-numbers"
          />
        </FormRow>

        <BatchNetTaxReadonly net={net} tax={tax} variant="stack" t={t} />

        <Input
          id={ids.invoiceDate}
          label={t('date')}
          type="date"
          size="sm"
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
            ...dateErrorStyle(maxInvoiceDate, row.invoiceDate),
          }}
          title={dateTitle}
        />

        <Input
          id={ids.kind}
          label={t('type')}
          type="select"
          size="sm"
          value={row.kind}
          onChange={(e) => {
            const kind = e.target.value;
            onUpdate(index, {
              kind,
              categoryId: '',
              debitAccountId: '',
              warrantyFollowUp: isWarrantyFollowUpKind(kind) ? !!row.warrantyFollowUp : false,
            });
          }}
        >
          <BatchKindOptions t={t} />
        </Input>

        {isWarrantyFollowUpKind(row.kind) ? (
          <label className="flex items-center gap-2 min-h-[44px] text-[13px] font-semibold text-noorix-text cursor-pointer">
            <input
              type="checkbox"
              checked={!!row.warrantyFollowUp}
              onChange={(e) => onUpdate(index, 'warrantyFollowUp', e.target.checked)}
              className="h-5 w-5 shrink-0 rounded border-noorix-border accent-noorix-blue"
            />
            <span>{t('warrantyFollowUpStack')}</span>
          </label>
        ) : null}

        <Input
          id={ids.category}
          label={t('category')}
          type="select"
          size="sm"
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

        <BatchTaxToggleButton row={row} index={index} onUpdate={onUpdate} t={t} density="stack" />

        <Input
          id={ids.notes}
          label={t('notes')}
          size="sm"
          value={row.notes || ''}
          onChange={(e) => onUpdate(index, 'notes', e.target.value)}
          placeholder={(row.kind === 'fixed_expense' || !row.supplierId) ? t('batchNotesPlaceholderServiceName') : t('batchNotesPlaceholderEllipsis')}
          className="w-full"
          title={!row.supplierId ? (t('notesRequiredForNoSupplier') || '') : ''}
        />

        <div className="rounded-lg border border-noorix-border border-dashed px-2 py-2 bg-noorix-bg-muted/30">
          <div className="text-[11px] font-semibold text-noorix-muted mb-1">{t('invoiceReceiptAttachment')}</div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
            className="text-[12px] max-w-full"
            onChange={(e) => onUpdate(index, 'attachmentFile', e.target.files?.[0] ?? null)}
          />
          {row.attachmentFile ? (
            <span className="text-[10px] text-noorix-muted truncate block mt-1" title={row.attachmentFile.name}>
              {row.attachmentFile.name}
            </span>
          ) : null}
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
