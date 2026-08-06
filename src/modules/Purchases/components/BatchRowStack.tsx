import React, { memo, useMemo } from 'react';
import { Badge, Button, Card, Checkbox, FileTrigger, FormRow, Input, SearchableOptionsPicker, TransactionDatePicker, cn } from '../../../ui';
import { isWarrantyFollowUpKind } from '../utils/batchRowModel';
import { purchaseBatchCategoryLabel } from '../batch/purchaseBatchDisplayModel';
import { BatchNetTaxReadonly, BatchSupplierBookmarkButton, BatchSupplierPickInner, BatchTaxToggleButton } from './BatchRowParts';
import { useBatchRowFieldIds, useBatchRowLogic } from './useBatchRowLogic';
import {
  BATCH_ATTACHMENT_ACCEPT,
  dateErrorClass,
  toPurchaseBatchKind,
  type BatchRowSharedProps,
} from './BatchRowShared';

export const BatchRowStack = memo(function BatchRowStack(props: BatchRowSharedProps) {
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
  const isImportedDebt = !!row.legacyDebtId;

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
    <Card padding="sm" className="min-w-0" aria-label={t('batchRowLineAriaLabel', index + 1)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="text-[13px] font-bold text-noorix-text">
          #{index + 1}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
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
          <label htmlFor={ids.supplier} className="mb-1 block text-[11px] font-semibold text-noorix-muted">
            {t('supplier')}
          </label>
          {isImportedDebt ? (
            <div className="flex min-h-[40px] items-center justify-between gap-2 rounded-lg border border-noorix-border bg-noorix-bg-muted px-3">
              <span className="truncate text-[13px] font-semibold">{row.legacyDebtSupplierName || row.supplierId}</span>
              <Badge size="sm" color="violet">{lang === 'en' ? 'Previous debt' : 'مديونية سابقة'}</Badge>
            </div>
          ) : <BatchSupplierPickInner
            suppliers={suppliers}
            row={row}
            bookmarkedIds={bookmarkedIds}
            onBookmark={onBookmark}
            handleSupplierChange={handleSupplierChange}
            t={t}
            bookmarkSize="none"
            supplierInputId={ids.supplier}
          />}
        </div>

        <FormRow cols={1} gap="sm">
          <Input
            id={ids.invoiceNumber}
            label={t('supplierInvoiceNumber')}
            size="sm"
            value={row.invoiceNumber}
            readOnly={isImportedDebt}
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
            readOnly={isImportedDebt}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, 'totalInclusive', e.target.value)}
            placeholder={t('amountPlaceholderZero')}
            className="w-full font-bold nx-font-numbers"
          />
        </FormRow>

        <BatchNetTaxReadonly net={net} tax={tax} variant="stack" t={t} />

        {isImportedDebt ? (
          <Input label={t('date')} value={row.invoiceDate} readOnly />
        ) : <TransactionDatePicker
          id={ids.invoiceDate}
          label={t('date')}
          size="sm"
          value={row.invoiceDate}
          max={maxInvoiceDate || undefined}
          onValueChange={(v) => onUpdate(index, 'invoiceDate', maxInvoiceDate && v > maxInvoiceDate ? maxInvoiceDate : v)}
          className={cn('w-full', dateErrorClass(maxInvoiceDate, row.invoiceDate))}
          title={dateTitle}
        />}

        {isImportedDebt ? (
          <Input label={t('type')} value={t('purchaseType')} readOnly />
        ) : <SearchableOptionsPicker
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
        />}

        {!isImportedDebt && isWarrantyFollowUpKind(row.kind) ? (
          <Checkbox
            checked={!!row.warrantyFollowUp}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, 'warrantyFollowUp', e.target.checked)}
            className="h-5 w-5 shrink-0 rounded border-noorix-border accent-noorix-blue"
            label={t('warrantyFollowUpStack')}
            containerClassName="flex min-h-[44px] cursor-pointer items-center gap-2 text-[13px] font-semibold text-noorix-text"
          />
        ) : null}

        {!isImportedDebt ? <SearchableOptionsPicker
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
        /> : null}

        {isImportedDebt ? (
          <Input label={t('taxPct')} value={row.isTaxable ? '15%' : '—'} readOnly />
        ) : <BatchTaxToggleButton row={row} index={index} onUpdate={onUpdate} t={t} density="stack" />}

        <Input
          id={ids.notes}
          label={t('notes')}
          size="sm"
          value={row.notes || ''}
          readOnly={isImportedDebt}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, 'notes', e.target.value)}
          placeholder={(row.kind === 'fixed_expense' || !row.supplierId) ? t('batchNotesPlaceholderServiceName') : t('batchNotesPlaceholderEllipsis')}
          className="w-full"
          title={!row.supplierId ? (t('notesRequiredForNoSupplier') || '') : ''}
        />

        <div className="rounded-lg border border-noorix-border bg-noorix-bg-page px-2 py-2">
          <div className="mb-1 text-[11px] font-semibold text-noorix-muted">{t('invoiceReceiptAttachment')}</div>
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
            <span className="mt-1 block truncate text-[11px] text-noorix-muted" title={row.attachmentFile.name}>
              {row.attachmentFile.name}
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
});
