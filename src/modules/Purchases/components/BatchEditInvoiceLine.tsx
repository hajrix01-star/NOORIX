import type { ChangeEvent } from 'react';
import { SupplierSelect } from '../../../components/common/SupplierSelect';
import { Button, TransactionDatePicker, EditableNumberCell, Input, FmtNum, Card, FormRow, SearchableOptionsPicker } from '../../../ui';
import { splitTaxFromTotalAsNumbers, TAX_RATE } from '@noorix/finance-core';
import { useBatchRowFieldIds } from './useBatchRowLogic';
import { purchaseBatchDisplayName } from '../batch/purchaseBatchDisplayModel';
import { toPurchaseBatchFiniteNumber, toPurchaseBatchPositiveNumber } from '../batch/purchaseBatchNumberModel';
import type {
  BatchTranslateFn,
  PurchaseBatchEditableInvoice,
  PurchaseBatchSupplier,
} from '../batch/purchaseBatchTypes';

type BatchEditInvoicePatch = Partial<PurchaseBatchEditableInvoice>;
type BatchEditInvoiceField = keyof PurchaseBatchEditableInvoice;
export type BatchEditInvoiceUpdater = (
  index: number,
  fieldOrPatch: BatchEditInvoiceField | BatchEditInvoicePatch,
  value?: PurchaseBatchEditableInvoice[BatchEditInvoiceField],
) => void;

export type BatchEditInvoiceLineProps = {
  inv: PurchaseBatchEditableInvoice;
  i: number;
  suppliers: PurchaseBatchSupplier[];
  lang: string;
  t: BatchTranslateFn;
  updateInv: BatchEditInvoiceUpdater;
  variant: 'card' | 'table';
  vatRateDecimal?: number;
};

function kindOptions(t: BatchTranslateFn) {
  return [
    { value: 'purchase', label: t('purchaseType') },
    { value: 'expense', label: t('expenseType') },
    { value: 'fixed_expense', label: t('fixedExpenseType') },
  ];
}

function kindLabel(kind: string | null | undefined, t: BatchTranslateFn) {
  if (kind === 'purchase') return t('purchaseType');
  if (kind === 'fixed_expense') return t('fixedExpenseType');
  return t('expenseType');
}

function amountPatch(value: string, rate: number): BatchEditInvoicePatch {
  const totalAmount = toPurchaseBatchPositiveNumber(value);
  if (totalAmount == null) {
    return { totalAmount: value, netAmount: 0, taxAmount: 0 };
  }

  const { net, tax } = splitTaxFromTotalAsNumbers(totalAmount, true, rate);
  return { totalAmount, netAmount: net, taxAmount: tax };
}

export function BatchEditInvoiceLine({
  inv,
  i,
  suppliers,
  lang,
  t,
  updateInv,
  variant,
  vatRateDecimal,
}: BatchEditInvoiceLineProps) {
  const rate = vatRateDecimal ?? TAX_RATE;
  const ids = useBatchRowFieldIds();
  const cancelled = inv.status === 'cancelled';
  const options = kindOptions(t);

  function handleAmountChange(event: ChangeEvent<HTMLInputElement>) {
    updateInv(i, amountPatch(event.target.value, rate));
  }

  if (variant === 'card') {
    return (
      <Card
        padding="sm"
        className={`min-w-0 ${cancelled ? 'opacity-60 bg-noorix-bg' : ''}`}
        aria-label={t('batchRowLineAriaLabel', i + 1)}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className="text-[13px] font-bold text-noorix-text">#{i + 1}</span>
          {cancelled ? (
            <span className="text-[12px] font-semibold text-noorix-red">{t('cancelled')}</span>
          ) : (
            <Button
              size="sm"
              variant="danger"
              className="min-h-[40px]"
              onClick={() => updateInv(i, 'status', 'cancelled')}
            >
              {t('cancel')}
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor={ids.supplier} className="text-[11px] font-semibold text-noorix-muted mb-1 block">
              {t('supplier')}
            </label>
            {cancelled ? (
              <span className="nx-cell-muted text-[13px]">
                {purchaseBatchDisplayName(inv.supplier, lang)}
              </span>
            ) : (
              <SupplierSelect
                id={ids.supplier}
                suppliers={suppliers}
                value={inv.supplierId || ''}
                onChange={(value) => updateInv(i, 'supplierId', value)}
                bookmarkedIds={[]}
                placeholder={t('selectSupplierPlaceholder')}
              />
            )}
          </div>

          <div>
            <label htmlFor={ids.invoiceDate} className="text-[11px] font-semibold text-noorix-muted mb-1 block">
              {t('batchEditInvoiceDate')}
            </label>
            {cancelled ? (
              <span className="nx-cell-muted text-[13px] nx-font-numbers">{inv.transactionDate || '-'}</span>
            ) : (
              <TransactionDatePicker
                id={ids.invoiceDate}
                size="sm"
                value={inv.transactionDate}
                onValueChange={(value) => updateInv(i, 'transactionDate', value)}
                className="nx-font-numbers"
              />
            )}
          </div>

          <FormRow cols={1} gap="sm">
            {cancelled ? (
              <>
                <div>
                  <span className="text-[11px] font-semibold text-noorix-muted mb-1 block">{t('supplierInvoiceNumber')}</span>
                  <span className="nx-cell-muted">{inv.supplierInvoiceNumber || inv.invoiceNumber}</span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-noorix-muted mb-1 block">{t('total')}</span>
                  <FmtNum n={toPurchaseBatchFiniteNumber(inv.totalAmount)} className="nx-cell-num" />
                </div>
              </>
            ) : (
              <>
                <Input
                  id={ids.invoiceNumber}
                  label={t('supplierInvoiceNumber')}
                  size="sm"
                  value={inv.supplierInvoiceNumber ?? inv.invoiceNumber ?? ''}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateInv(i, 'supplierInvoiceNumber', event.target.value)
                  }
                />
                <Input
                  id={ids.totalInclusive}
                  label={t('total')}
                  type="number"
                  min="0"
                  step="0.1"
                  size="sm"
                  value={inv.totalAmount}
                  onChange={handleAmountChange}
                  className="nx-font-numbers"
                />
              </>
            )}
          </FormRow>

          {cancelled ? (
            <div>
              <span className="text-[11px] font-semibold text-noorix-muted mb-1 block">{t('kind')}</span>
              <span className="nx-cell-muted-sm">{kindLabel(inv.kind, t)}</span>
            </div>
          ) : (
            <SearchableOptionsPicker
              id={ids.kind}
              label={t('kind')}
              mode="single"
              value={inv.kind || 'purchase'}
              onChange={(value: string) => updateInv(i, 'kind', value)}
              options={options}
              size="sm"
            />
          )}
        </div>
      </Card>
    );
  }

  return (
    <tr className={`border-b border-noorix-border ${cancelled ? 'opacity-50 bg-noorix-bg' : ''}`}>
      <td className="text-center text-noorix-muted font-semibold p-1.5">{i + 1}</td>
      <td className="p-1.5">
        {cancelled ? (
          <span className="nx-cell-muted">{purchaseBatchDisplayName(inv.supplier, lang)}</span>
        ) : (
          <SupplierSelect
            suppliers={suppliers}
            value={inv.supplierId || ''}
            onChange={(value) => updateInv(i, 'supplierId', value)}
            bookmarkedIds={[]}
            placeholder={t('selectSupplierPlaceholder')}
          />
        )}
      </td>
      <td className="p-1.5">
        {cancelled ? (
          <span className="nx-cell-muted nx-font-numbers">{inv.transactionDate || '-'}</span>
        ) : (
          <TransactionDatePicker
            size="sm"
            value={inv.transactionDate}
            onValueChange={(value) => updateInv(i, 'transactionDate', value)}
            className="w-full nx-font-numbers"
            aria-label={`${t('batchEditInvoiceDate')} - ${t('batchRowLineAriaLabel', i + 1)}`}
          />
        )}
      </td>
      <td className="p-1.5">
        {cancelled ? (
          <span className="nx-cell-muted">{inv.supplierInvoiceNumber || inv.invoiceNumber}</span>
        ) : (
          <Input
            size="sm"
            value={inv.supplierInvoiceNumber ?? inv.invoiceNumber ?? ''}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              updateInv(i, 'supplierInvoiceNumber', event.target.value)
            }
            className="w-full"
            aria-label={`${t('supplierInvoiceNumber')} - ${t('batchRowLineAriaLabel', i + 1)}`}
          />
        )}
      </td>
      <td className="p-1.5">
        {cancelled ? (
          <FmtNum n={toPurchaseBatchFiniteNumber(inv.totalAmount)} className="nx-cell-num" />
        ) : (
          <EditableNumberCell
            step="0.1"
            value={inv.totalAmount}
            onChange={handleAmountChange}
            className="w-full nx-font-numbers text-end"
            aria-label={`${t('total')} - ${t('batchRowLineAriaLabel', i + 1)}`}
          />
        )}
      </td>
      <td className="p-1.5">
        {cancelled ? (
          <span className="nx-cell-muted-sm">{kindLabel(inv.kind, t)}</span>
        ) : (
          <SearchableOptionsPicker
            mode="single"
            size="sm"
            value={inv.kind || 'purchase'}
            onChange={(value: string) => updateInv(i, 'kind', value)}
            options={options}
            className="w-full"
            aria-label={`${t('kind')} - ${t('batchRowLineAriaLabel', i + 1)}`}
          />
        )}
      </td>
      <td className="p-1.5">
        {cancelled ? (
          <span className="text-[12px] font-semibold text-noorix-red">{t('cancelled')}</span>
        ) : (
          <Button
            size="sm"
            variant="danger"
            onClick={() => updateInv(i, 'status', 'cancelled')}
            aria-label={`${t('cancel')} - ${t('batchRowLineAriaLabel', i + 1)}`}
          >
            {t('cancel')}
          </Button>
        )}
      </td>
    </tr>
  );
}
