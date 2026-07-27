/**
 * BatchRow - صف إدخال فاتورة واحدة
 * layout="table" (افتراضي) | layout="stack" - بطاقة للجوال
 * الحقول المشتركة: BatchRowParts + useBatchRowLogic
 */
import React, { memo, useMemo } from 'react';
import { Input, Button, Card, Checkbox, TransactionDatePicker, FileTrigger, FormRow, SearchableOptionsPicker, cn } from '../../../ui';
import { useBatchRowLogic, useBatchRowFieldIds } from './useBatchRowLogic';
import {
  BatchSupplierPickInner,
  BatchSupplierBookmarkButton,
  BatchNetTaxReadonly,
  BatchTaxToggleButton,
} from './BatchRowParts';
import { isWarrantyFollowUpKind } from '../utils/batchRowModel';
import { purchaseBatchCategoryLabel } from '../batch/purchaseBatchDisplayModel';
import type {
  PurchaseBatchEntryRow,
  PurchaseBatchKind,
  PurchaseBatchSupplier,
  PurchaseBatchSupplierCategory,
  PurchaseBatchUpdateRow,
} from '../batch/purchaseBatchTypes';

function dateErrorClass(maxInvoiceDate: string | undefined, invoiceDate: string) {
  return maxInvoiceDate && invoiceDate > maxInvoiceDate ? 'nx-batch-row-date-error' : '';
}

function toPurchaseBatchKind(value: string): PurchaseBatchKind {
  if (value === 'expense' || value === 'fixed_expense') return value;
  return 'purchase';
}

type BatchRowSharedProps = {
  row: PurchaseBatchEntryRow;
  index: number;
  suppliers: PurchaseBatchSupplier[];
  categories: PurchaseBatchSupplierCategory[];
  bookmarkedIds: string[];
  onUpdate: PurchaseBatchUpdateRow;
  onRemove: (index: number) => void;
  onBookmark: (id: string) => void;
  maxInvoiceDate?: string;
  vatRateDecimal?: number;
};

const BATCH_ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,.jpg,.jpeg,.png,.webp';

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
        <TransactionDatePicker
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
        />
      </td>

      <td style={cp}>
        <SearchableOptionsPicker
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
        />
      </td>

      <td className="text-center align-middle" style={cp}>
        {isWarrantyFollowUpKind(row.kind) ? (
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
        <SearchableOptionsPicker
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
        />
      </td>

      <td className="text-center" style={cp}>
        <BatchTaxToggleButton row={row} index={index} onUpdate={onUpdate} t={t} density="table" />
      </td>

      <td style={cp}>
        <Input
          value={row.notes || ''}
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

function BatchRowStack(props: BatchRowSharedProps) {
  const {
    row, index, suppliers, categories, bookmarkedIds, onUpdate, onRemove, onBookmark,
    maxInvoiceDate, vatRateDecimal,
  } = props;
  const ids = useBatchRowFieldIds();
  const {
    t, lang, net, tax, categoryOptions, handleCategoryChange, handleSupplierChange,
  } = useBatchRowLogic({
    row, index, suppliers, categories, onUpdate, maxInvoiceDate, vatRateDecimal,
  });

  const dateTitle = useMemo(
    () => (maxInvoiceDate ? `${t('date')} - <= ${maxInvoiceDate}` : undefined),
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
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, 'invoiceNumber', e.target.value)}
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
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, 'totalInclusive', e.target.value)}
            placeholder={t('amountPlaceholderZero')}
            className="font-bold w-full nx-font-numbers"
          />
        </FormRow>

        <BatchNetTaxReadonly net={net} tax={tax} variant="stack" t={t} />

        <TransactionDatePicker
          id={ids.invoiceDate}
          label={t('date')}
          size="sm"
          value={row.invoiceDate}
          max={maxInvoiceDate || undefined}
          onValueChange={(v) => {
            if (maxInvoiceDate && v > maxInvoiceDate) {
              onUpdate(index, 'invoiceDate', maxInvoiceDate);
            } else {
              onUpdate(index, 'invoiceDate', v);
            }
          }}
          className={cn('w-full', dateErrorClass(maxInvoiceDate, row.invoiceDate))}
          title={dateTitle}
        />

        <SearchableOptionsPicker
          id={ids.kind}
          label={t('type')}
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
        />

        {isWarrantyFollowUpKind(row.kind) ? (
          <Checkbox
            checked={!!row.warrantyFollowUp}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, 'warrantyFollowUp', e.target.checked)}
            className="h-5 w-5 shrink-0 rounded border-noorix-border accent-noorix-blue"
            label={t('warrantyFollowUpStack')}
            containerClassName="flex items-center gap-2 min-h-[44px] text-[13px] font-semibold text-noorix-text cursor-pointer"
          />
        ) : null}

        <SearchableOptionsPicker
          id={ids.category}
          label={t('category')}
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
        />

        <BatchTaxToggleButton row={row} index={index} onUpdate={onUpdate} t={t} density="stack" />

        <Input
          id={ids.notes}
          label={t('notes')}
          size="sm"
          value={row.notes || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, 'notes', e.target.value)}
          placeholder={(row.kind === 'fixed_expense' || !row.supplierId) ? t('batchNotesPlaceholderServiceName') : t('batchNotesPlaceholderEllipsis')}
          className="w-full"
          title={!row.supplierId ? (t('notesRequiredForNoSupplier') || '') : ''}
        />

        <div className="rounded-lg border border-noorix-border px-2 py-2 bg-noorix-bg-page">
          <div className="text-[11px] font-semibold text-noorix-muted mb-1">{t('invoiceReceiptAttachment')}</div>
          <FileTrigger
            accept={BATCH_ATTACHMENT_ACCEPT}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, 'attachmentFile', e.target.files?.[0] ?? null)}
            label={row.attachmentFile ? (t('fileSelected') || t('invoiceReceiptCol')) : t('invoiceReceiptChooseFile')}
            buttonProps={{
              variant: row.attachmentFile ? 'secondary' : 'ghost',
              size: 'sm',
              className: cn(
                'max-w-full truncate border font-bold',
                row.attachmentFile
                  ? 'border-noorix-green bg-[var(--noorix-green-8)] text-noorix-green'
                  : 'border-noorix-border bg-noorix-bg-page text-noorix-blue',
              ),
            }}
          />
          {row.attachmentFile ? (
            <span className="text-[11px] text-noorix-muted truncate block mt-1" title={row.attachmentFile.name}>
              {row.attachmentFile.name}
            </span>
          ) : null}
        </div>
      </div>
    </Card>
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
