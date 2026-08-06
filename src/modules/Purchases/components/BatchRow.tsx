/**
 * BatchRow - صف إدخال فاتورة واحدة
 * layout="table" (افتراضي) | layout="stack" - بطاقة للجوال
 * الحقول المشتركة: BatchRowParts + useBatchRowLogic
 */
import React, { memo, useMemo } from 'react';
import { Input, Button, Checkbox, TransactionDatePicker, FileTrigger, SearchableOptionsPicker, Badge, cn } from '../../../ui';
import { useBatchRowLogic } from './useBatchRowLogic';
import {
  BatchSupplierPickInner,
  BatchSupplierBookmarkButton,
  BatchNetTaxReadonly,
  BatchTaxToggleButton,
} from './BatchRowParts';
import { isWarrantyFollowUpKind } from '../utils/batchRowModel';
import { purchaseBatchCategoryLabel } from '../batch/purchaseBatchDisplayModel';
import { BatchRowStack } from './BatchRowStack';
import {
  BATCH_ATTACHMENT_ACCEPT,
  dateErrorClass,
  toPurchaseBatchKind,
  type BatchRowSharedProps,
} from './BatchRowShared';

function BatchRowTable(props: BatchRowSharedProps) {
  const {
    row, index, suppliers, categories, bookmarkedIds, onUpdate, onRemove, onBookmark,
    maxInvoiceDate, vatRateDecimal,
  } = props;
  const {
    t, lang, net, tax, categoryOptions, handleCategoryChange, handleSupplierChange, inputSm, cp,
  } = useBatchRowLogic({
    row, index, suppliers, categories, onUpdate, maxInvoiceDate, vatRateDecimal,
  });
  const isImportedDebt = !!row.legacyDebtId;

  const dateTitle = useMemo(
    () => (maxInvoiceDate ? `${t('date')} - ${maxInvoiceDate}` : undefined),
    [maxInvoiceDate, t],
  );
  const kindOptions = useMemo(
    () => [
      { value: 'purchase', label: t('purchaseType') },
      { value: 'expense', label: t('expenseType') },
      { value: 'fixed_expense', label: t('fixedExpenseType') },
    ],
    [t],
  );
  const categoryPickerOptions = useMemo(
    () =>
      categoryOptions.map((c) => ({
        value: c.id || '',
        label: purchaseBatchCategoryLabel(c, lang),
      })).filter((option) => option.value),
    [categoryOptions, lang],
  );

  return (
    <tr className="border-b border-noorix-border">
      <td className="text-center text-[11px] text-noorix-muted font-semibold" style={cp}>
        {index + 1}
      </td>

      <td style={cp}>
        {isImportedDebt ? (
          <div className="flex flex-col gap-1">
            <span className="truncate text-[12px] font-semibold">{row.legacyDebtSupplierName || row.supplierId}</span>
            <Badge size="sm" color="violet">{lang === 'en' ? 'Previous debt' : 'مديونية سابقة'}</Badge>
          </div>
        ) : <BatchSupplierPickInner
          suppliers={suppliers}
          row={row}
          bookmarkedIds={bookmarkedIds}
          onBookmark={onBookmark}
          handleSupplierChange={handleSupplierChange}
          t={t}
          bookmarkSize="compact"
        />}
      </td>

      <td style={cp}>
        <Input
          value={row.invoiceNumber}
          readOnly={isImportedDebt}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, 'invoiceNumber', e.target.value)}
          placeholder={t('invoiceNumberPlaceholder')}
          className="text-center w-full"
          style={inputSm}
          aria-label={`${t('supplierInvoiceNumber')} - ${t('batchRowLineAriaLabel', index + 1)}`}
        />
      </td>

      <td style={cp}>
        <Input
          type="number"
          min="0"
          step="0.1"
          value={row.totalInclusive}
          readOnly={isImportedDebt}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, 'totalInclusive', e.target.value)}
          placeholder={t('amountPlaceholderZero')}
          className="font-bold text-[13px] w-full text-right nx-font-numbers"
          style={inputSm}
          aria-label={`${t('total')} - ${t('batchRowLineAriaLabel', index + 1)}`}
        />
      </td>

      <td className="text-[11px] nx-font-numbers leading-[1.5]" style={cp}>
        <BatchNetTaxReadonly net={net} tax={tax} variant="table" t={t} />
      </td>

      <td style={cp}>
        {isImportedDebt ? <span className="block text-center text-[12px] nx-font-numbers">{row.invoiceDate}</span> : <TransactionDatePicker
          dir="ltr"
          value={row.invoiceDate}
          max={maxInvoiceDate || undefined}
          onValueChange={(v) => {
            if (maxInvoiceDate && v > maxInvoiceDate) {
              onUpdate(index, 'invoiceDate', maxInvoiceDate);
            } else {
              onUpdate(index, 'invoiceDate', v);
            }
          }}
          className={cn('text-center w-full', dateErrorClass(maxInvoiceDate, row.invoiceDate))}
          style={inputSm}
          title={dateTitle}
          aria-label={`${t('date')} - ${t('batchRowLineAriaLabel', index + 1)}`}
        />}
      </td>

      <td style={cp}>
        {isImportedDebt ? <Badge color="blue">{t('purchaseType')}</Badge> : <SearchableOptionsPicker
          mode="single"
          value={row.kind}
          onChange={(value: string) => {
            const kind = toPurchaseBatchKind(value);
            onUpdate(index, {
              kind,
              categoryId: '',
              debitAccountId: '',
              warrantyFollowUp: isWarrantyFollowUpKind(kind) ? !!row.warrantyFollowUp : false,
            });
          }}
          options={kindOptions}
          size="sm"
          aria-label={`${t('type')} - ${t('batchRowLineAriaLabel', index + 1)}`}
        />}
      </td>

      <td className="text-center align-middle" style={cp}>
        {!isImportedDebt && isWarrantyFollowUpKind(row.kind) ? (
          <Checkbox
            checked={!!row.warrantyFollowUp}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, 'warrantyFollowUp', e.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-noorix-border accent-noorix-blue"
            aria-label={`${t('warrantyFollowUpCol')} - ${t('batchRowLineAriaLabel', index + 1)}`}
            label={<span className="hidden xl:inline">{t('warrantyFollowUpShort')}</span>}
            containerClassName="inline-flex items-center justify-center gap-1.5 cursor-pointer text-[11px] font-semibold text-noorix-muted"
          />
        ) : (
          <span className="text-noorix-muted">-</span>
        )}
      </td>

      <td style={cp}>
        {isImportedDebt ? <span className="text-noorix-muted">—</span> : <SearchableOptionsPicker
          mode="single"
          value={row.categoryId || ''}
          onChange={(value: string) => {
            const cat = categoryOptions.find((c) => c.id === value);
            handleCategoryChange(cat || null);
          }}
          options={categoryPickerOptions}
          allowEmpty
          emptyValue=""
          emptyLabel={t('categoryPlaceholder')}
          size="sm"
          aria-label={`${t('category')} - ${t('batchRowLineAriaLabel', index + 1)}`}
        />}
      </td>

      <td className="text-center" style={cp}>
        {isImportedDebt
          ? <Badge color={row.isTaxable ? 'amber' : 'gray'}>{row.isTaxable ? '15%' : '—'}</Badge>
          : <BatchTaxToggleButton row={row} index={index} onUpdate={onUpdate} t={t} density="table" />}
      </td>

      <td style={cp}>
        <Input
          value={row.notes || ''}
          readOnly={isImportedDebt}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, 'notes', e.target.value)}
          placeholder={(row.kind === 'fixed_expense' || !row.supplierId) ? t('batchNotesPlaceholderServiceName') : t('batchNotesPlaceholderEllipsis')}
          className="w-full"
          style={inputSm}
          title={!row.supplierId ? (t('notesRequiredForNoSupplier') || '') : ''}
          aria-label={`${t('notes')} - ${t('batchRowLineAriaLabel', index + 1)}`}
        />
      </td>

      <td className="text-center align-middle p-1" style={cp} title={t('invoiceReceiptAttachment')}>
        <div className="flex flex-col items-center gap-0.5 min-h-[36px] justify-center">
          {row.attachmentFile ? (
            <span className="text-[11px] font-bold leading-none text-noorix-green">✓</span>
          ) : (
            <span className="text-[11px] text-noorix-muted leading-none">·</span>
          )}
          <FileTrigger
            accept={BATCH_ATTACHMENT_ACCEPT}
            aria-label={`${t('invoiceReceiptAttachment')} - ${t('batchRowLineAriaLabel', index + 1)}`}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, 'attachmentFile', e.target.files?.[0] ?? null)}
            label={row.attachmentFile ? (t('fileSelected') || t('invoiceReceiptCol')) : t('invoiceReceiptCol')}
            buttonProps={{
              variant: row.attachmentFile ? 'secondary' : 'ghost',
              size: 'sm',
              className: cn(
                'h-6 min-h-6 max-w-[88px] truncate border px-1.5 text-[11px] font-bold',
                row.attachmentFile
                  ? 'border-noorix-green bg-[var(--noorix-green-8)] text-noorix-green'
                  : 'border-noorix-border bg-noorix-bg-page text-noorix-blue',
              ),
            }}
          />
          {row.attachmentFile ? (
            <span className="block max-w-[88px] truncate text-[11px] font-semibold text-noorix-text" title={row.attachmentFile.name}>
              {row.attachmentFile.name}
            </span>
          ) : null}
        </div>
      </td>

      <td className="text-center" style={cp}>
        <Button
          type="button"
          variant="danger"
          onClick={() => onRemove(index)}
          className="flex items-center justify-center text-[15px] w-8 h-8 min-w-8 min-h-8 rounded-md mx-auto"
          title={t('delete')}
          aria-label={`${t('delete')} - ${t('batchRowLineAriaLabel', index + 1)}`}
        >
          ×
        </Button>
      </td>
    </tr>
  );
}

export type BatchRowProps = BatchRowSharedProps & { layout?: 'table' | 'stack' };

export const BatchRow = memo(function BatchRow({ layout = 'table', ...rest }: BatchRowProps) {
  if (layout === 'stack') {
    return <BatchRowStack {...rest} />;
  }
  return <BatchRowTable {...rest} />;
});

export default BatchRow;
