/**
 * InvoiceEditModal — نافذة تعديل الفاتورة
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    setSaving(true);
    try {
      const res = await updateInvoice(invoice.id, {
        supplierId: form.supplierId || undefined,
        supplierInvoiceNumber: form.supplierInvoiceNumber.trim(),
        kind: form.kind,
        totalAmount: total,
        netAmount: parseFloat(form.netAmount) || 0,
        taxAmount: parseFloat(form.taxAmount) || 0,
        transactionDate: form.transactionDate || undefined,
        notes: form.notes?.trim() || undefined,
      }, companyId);
      if (res.success) {
        onSaved?.();
        onClose?.();
      } else throw new Error(res.error || t('updateFailed'));
    } catch (e) {
      setError(e?.message || t('saveFailed'));
    } finally {
      setSaving(false);
    }
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
          <Button variant="primary" disabled={saving} onClick={handleSave}>
            {saving ? t('saving') : t('saveChanges')}
          </Button>
        </>
      }
    >
      <div className="invoice-edit-modal-body nx-flex nx-flex-col nx-gap-14">
        <p className="nx-text-sm nx-text-muted nx-m-0 nx-mb-4">
          {invoice.supplierInvoiceNumber || invoice.invoiceNumber}
        </p>

        {error && (
          <div className="nx-p-10 nx-rounded nx-text-base" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
            {error}
          </div>
        )}

        <div>
          <label className="nx-text-sm nx-font-600 nx-mb-4" style={{ display: 'block' }}>{t('supplier')}</label>
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
            <div className="nx-text-sm nx-text-muted nx-mt-4">
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
