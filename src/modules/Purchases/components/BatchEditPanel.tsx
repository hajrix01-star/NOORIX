import { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt, sumAmounts } from '../../../utils/format';
import { DialogActions, AdaptiveSheet } from '../../../ui';
import { throwIfApiFailed } from '../../../services/api';
import { useIsNarrow700 } from '../../../ui';
import { toDateInputYmd } from '../../../utils/saudiDate';
import {
  BatchEditInvoiceLine,
  type BatchEditInvoiceUpdater,
} from './BatchEditInvoiceLine';
import { toPurchaseBatchFiniteNumber, toPurchaseBatchPositiveNumber } from '../batch/purchaseBatchNumberModel';
import type {
  PurchaseBatchEditableInvoice,
  PurchaseBatchInvoice,
  PurchaseBatchSupplier,
  PurchaseBatchSummaryRow,
} from '../batch/purchaseBatchTypes';

export type BatchEditPanelProps = {
  batch: PurchaseBatchSummaryRow;
  suppliers: PurchaseBatchSupplier[];
  companyId: string;
  vatRateDecimal?: number;
  onSaveInvoice: (invoice: PurchaseBatchInvoice) => Promise<unknown>;
  onClose: () => void;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function toEditableInvoice(invoice: PurchaseBatchInvoice): PurchaseBatchEditableInvoice {
  return {
    ...invoice,
    totalAmount: toPurchaseBatchFiniteNumber(invoice.totalAmount),
    netAmount: toPurchaseBatchFiniteNumber(invoice.netAmount),
    taxAmount: toPurchaseBatchFiniteNumber(invoice.taxAmount),
    transactionDate: toDateInputYmd(invoice.transactionDate) || '',
  };
}

export function BatchEditPanel({
  batch,
  suppliers,
  vatRateDecimal,
  onSaveInvoice,
  onClose,
}: BatchEditPanelProps) {
  const { t, lang } = useTranslation();
  const narrow = useIsNarrow700();
  const [invoices, setInvoices] = useState<PurchaseBatchEditableInvoice[]>(() =>
    batch.invoices.map(toEditableInvoice),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const batchId = batch.batchId || invoices[0]?.batchId;

  const updateInv: BatchEditInvoiceUpdater = (index, fieldOrPatch, value) => {
    setInvoices((previousInvoices) =>
      previousInvoices.map((invoice, invoiceIndex) =>
        invoiceIndex === index
          ? typeof fieldOrPatch === 'object'
            ? { ...invoice, ...fieldOrPatch }
            : { ...invoice, [fieldOrPatch]: value }
          : invoice,
      ),
    );
  };

  async function handleSave() {
    const invalidAmount = invoices.find(
      (invoice) => invoice.status !== 'cancelled' && toPurchaseBatchPositiveNumber(invoice.totalAmount) == null,
    );
    if (invalidAmount) {
      setError(t('purchaseBatchAmountMustBePositive'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      for (const invoice of invoices) {
        const result = await onSaveInvoice(invoice);
        throwIfApiFailed(result, t('saveFailed'));
      }
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError, t('saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  const activeInvoices = invoices.filter((invoice) => invoice.status !== 'cancelled');
  const total = sumAmounts(activeInvoices, 'totalAmount').toNumber();

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title={`${t('batchLabel', batchId)} - ${t('batchSummary', activeInvoices.length, fmt(total))}`}
      size="xl"
      side="start"
      className="batch-edit-drawer"
      footer={
        <DialogActions
          actions={[
            {
              key: 'save',
              label: saving ? t('saving') : t('saveChanges'),
              role: 'save',
              disabled: saving,
              onClick: handleSave,
            },
          ]}
        />
      }
    >
      {error ? (
        <div className="rounded-lg text-[13px] p-3 mb-3 bg-red-50 border border-red-200 text-noorix-red">
          {error}
        </div>
      ) : null}
      {narrow ? (
        <div className="flex flex-col gap-3 min-w-0">
          {invoices.map((invoice, index) => (
            <BatchEditInvoiceLine
              key={invoice.id || index}
              inv={invoice}
              i={index}
              suppliers={suppliers}
              lang={lang}
              t={t}
              updateInv={updateInv}
              variant="card"
              vatRateDecimal={vatRateDecimal}
            />
          ))}
        </div>
      ) : (
        <div className="noorix-table-frame overflow-auto">
          <table className="noorix-table">
            <thead>
              <tr className="bg-noorix-bg border-b-2 border-noorix-border">
                <th className="py-2 px-2.5 text-right w-9">#</th>
                <th className="py-2 px-2.5 text-right min-w-[140px]">{t('supplier')}</th>
                <th className="py-2 px-2.5 text-right w-[118px]">{t('batchEditInvoiceDate')}</th>
                <th className="py-2 px-2.5 text-right w-[90px]">{t('supplierInvoiceNumber')}</th>
                <th className="py-2 px-2.5 text-right w-[90px]">{t('total')}</th>
                <th className="py-2 px-2.5 text-right w-20">{t('kind')}</th>
                <th className="py-2 px-2.5 w-11" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice, index) => (
                <BatchEditInvoiceLine
                  key={invoice.id || index}
                  inv={invoice}
                  i={index}
                  suppliers={suppliers}
                  lang={lang}
                  t={t}
                  updateInv={updateInv}
                  variant="table"
                  vatRateDecimal={vatRateDecimal}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdaptiveSheet>
  );
}
