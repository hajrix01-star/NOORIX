/**
 * InvoiceEditModal — نافذة تعديل الفاتورة
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { SupplierSelect } from '../../../components/common/SupplierSelect';
import { splitTaxFromTotalAsNumbers } from '../../../utils/math-engine';
import { updateInvoice } from '../../../services/api';
import { fmt } from '../../../utils/format';
import { Button, Input, AdaptiveSheet } from '../../../ui';

export function InvoiceEditModal({ invoice, suppliers, companyId, onSaved, onClose }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    supplierId: '',
    supplierInvoiceNumber: '',
    kind: 'purchase',
    totalAmount: '',
    netAmount: '',
    taxAmount: '',
    transactionDate: '',
    notes: '',
  });
  const [error, setError] = useState('');

  const saveMutation = useApiMutation({
    mutationFn: ({ id, body }) => updateInvoice(id, body, companyId),
    showErrorToast: false,
    onSuccess: () => {
      onSaved?.();
      onClose?.();
    },
    onError: (e) => setError(e?.message || t('saveFailed')),
  });

  useEffect(() => {
    if (!invoice) return;
    const taxable = invoice.isTaxable !== false;
    const total = Number(invoice.totalAmount || 0);
    const { net, tax } = splitTaxFromTotalAsNumbers(total, taxable);
    setForm({
      supplierId: invoice.supplierId || '',
      supplierInvoiceNumber: invoice.supplierInvoiceNumber || invoice.invoiceNumber || '',
      kind: invoice.kind || 'purchase',
      totalAmount: total > 0 ? String(total) : '',
      netAmount: net > 0 ? net.toFixed(2) : '',
      taxAmount: tax > 0 ? tax.toFixed(2) : '',
      transactionDate: invoice.transactionDate ? new Date(invoice.transactionDate).toISOString().slice(0, 10) : '',
    });
  }, [invoice]);

  function updateField(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
    if (field === 'totalAmount' && value) {
      const v = parseFloat(value);
      if (!isNaN(v) && v > 0) {
        const { net, tax } = splitTaxFromTotalAsNumbers(v, true);
        setForm((p) => ({ ...p, netAmount: net.toFixed(2), taxAmount: tax.toFixed(2) }));
      }
    }
  }

  async function handleSave() {
    setError('');
    const total = parseFloat(form.totalAmount);
    if (!form.supplierInvoiceNumber?.trim()) {
      setError(t('invoiceNumberRequired'));
      return;
    }
    if (isNaN(total) || total <= 0) {
      setError(t('totalMustBePositiveShort'));
      return;
    }
    saveMutation.mutate({
      id: invoice.id,
      body: {
        supplierId: form.supplierId || undefined,
        supplierInvoiceNumber: form.supplierInvoiceNumber.trim(),
        kind: form.kind,
        totalAmount: total,
        netAmount: parseFloat(form.netAmount) || 0,
        taxAmount: parseFloat(form.taxAmount) || 0,
        transactionDate: form.transactionDate || undefined,
        notes: form.notes?.trim() || undefined,
      },
    });
  }

  if (!invoice) return null;

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={t('editInvoice')}
      size="md"
      side="start"
      className="invoice-edit-drawer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="primary" disabled={saveMutation.isPending} onClick={handleSave}>
            {saveMutation.isPending ? t('saving') : t('saveChanges')}
          </Button>
        </>
      }
    >
      <div className="invoice-edit-modal-body flex flex flex-col gap-3.5">
        <p className="text-[12px] text-noorix-muted m-0 mb-1">
          {invoice.supplierInvoiceNumber || invoice.invoiceNumber}
        </p>

        {error && (
          <div className="p-2.5 rounded-lg text-[13px]" style={{ background: 'var(--noorix-red-10)', color: 'var(--noorix-accent-red)' }}>
            {error}
          </div>
        )}

        <div>
          <label className="text-[12px] font-semibold mb-1 block">{t('supplier')}</label>
          <SupplierSelect
            suppliers={suppliers}
            value={form.supplierId}
            onChange={(v) => updateField('supplierId', v)}
            bookmarkedIds={[]}
            placeholder={t('selectSupplier')}
          />
        </div>

        <Input
          label={`${t('supplierInvoiceNumber')} *`}
          value={form.supplierInvoiceNumber}
          onChange={(e) => updateField('supplierInvoiceNumber', e.target.value)}
          placeholder={t('invoiceNumberPlaceholder')}
        />

        <Input
          type="select"
          label={t('kind')}
          value={form.kind}
          onChange={(e) => updateField('kind', e.target.value)}
        >
          <option value="purchase">{t('purchaseType')}</option>
          <option value="expense">{t('expenseType')}</option>
        </Input>

        <div>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            label={t('totalAmountInclTax') || 'الإجمالي (شامل الضريبة) *'}
            value={form.totalAmount}
            onChange={(e) => updateField('totalAmount', e.target.value)}
            style={{ fontFamily: 'var(--noorix-font-numbers)' }}
          />
          {form.totalAmount && parseFloat(form.totalAmount) > 0 && (
            <div className="text-[12px] text-noorix-muted mt-1">
              {t('netShort')}: {form.netAmount} | {t('tax')}: {form.taxAmount}
            </div>
          )}
        </div>

        <Input
          type="date"
          label={t('transactionDateLabel')}
          value={form.transactionDate}
          onChange={(e) => updateField('transactionDate', e.target.value)}
        />

        <Input
          label={t('notesLabel')}
          value={form.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder={t('invoiceNotesPlaceholder')}
        />
      </div>
    </AdaptiveSheet>
  );
}
