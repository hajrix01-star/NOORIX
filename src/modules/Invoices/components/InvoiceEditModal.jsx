/**
 * InvoiceEditModal — نافذة تعديل الفاتورة
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { SupplierSelect } from '../../../components/common/SupplierSelect';
import { splitTaxFromTotalAsNumbers } from '../../../utils/math-engine';
import { updateInvoice } from '../../../services/api';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { Button, Input, AdaptiveSheet } from '../../../ui';

// بلا مورد نهائياً (رواتب وسلف — فواتير نظام داخلية)
const NO_SUPPLIER_KINDS = new Set(['salary', 'advance']);
// مورد اختياري (مصاريف ثابتة وHR)
const OPTIONAL_SUPPLIER_KINDS = new Set(['fixed_expense', 'hr_expense']);

export function InvoiceEditModal({ invoice, suppliers, companyId, vaultsList = [], onSaved, onClose }) {
  const { t, lang } = useTranslation();
  const [form, setForm] = useState({
    supplierId: '',
    supplierInvoiceNumber: '',
    kind: 'purchase',
    totalAmount: '',
    netAmount: '',
    taxAmount: '',
    transactionDate: '',
    notes: '',
    vaultId: '',
  });
  const [error, setError] = useState('');

  const kind = invoice?.kind;
  const hasSupplier = !NO_SUPPLIER_KINDS.has(kind);           // purchase, expense, fixed_expense, hr_expense
  const supplierRequired = !NO_SUPPLIER_KINDS.has(kind) && !OPTIONAL_SUPPLIER_KINDS.has(kind); // purchase, expense فقط

  const initialVaultKey = useMemo(() => {
    if (!invoice) return '';
    const allocs = invoice.vaultAllocations;
    if (allocs?.length >= 1) return allocs[0].vaultId || '';
    return invoice.vaultId || '';
  }, [invoice]);

  const isMultiVault = (invoice?.vaultAllocations?.length || 0) > 1;

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
    const resolvedVaultId =
      invoice.vaultAllocations?.length >= 1
        ? invoice.vaultAllocations[0].vaultId
        : invoice.vaultId || '';
    setForm({
      supplierId: invoice.supplierId || '',
      supplierInvoiceNumber: invoice.supplierInvoiceNumber || invoice.invoiceNumber || '',
      kind: invoice.kind || 'purchase',
      totalAmount: total > 0 ? String(total) : '',
      netAmount: net > 0 ? net.toFixed(2) : '',
      taxAmount: tax > 0 ? tax.toFixed(2) : '',
      transactionDate: invoice.transactionDate ? new Date(invoice.transactionDate).toISOString().slice(0, 10) : '',
      notes: invoice.notes || '',
      vaultId: resolvedVaultId || '',
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
    if (supplierRequired && !form.supplierInvoiceNumber?.trim()) {
      setError(t('invoiceNumberRequired'));
      return;
    }
    if (isNaN(total) || total <= 0) {
      setError(t('totalMustBePositiveShort'));
      return;
    }
    if (vaultsList.length > 0 && !String(form.vaultId || '').trim()) {
      setError(t('selectVault'));
      return;
    }
    const body = {
      totalAmount: total,
      transactionDate: form.transactionDate || undefined,
      notes: form.notes?.trim() || undefined,
    };
    if (hasSupplier) {
      body.supplierId = form.supplierId || undefined;
      if (form.supplierInvoiceNumber?.trim()) body.supplierInvoiceNumber = form.supplierInvoiceNumber.trim();
      body.netAmount = parseFloat(form.netAmount) || 0;
      body.taxAmount = parseFloat(form.taxAmount) || 0;
      // النوع قابل للتعديل لـ purchase/expense فقط
      if (supplierRequired) body.kind = form.kind;
    } else {
      body.netAmount = total;
      body.taxAmount = 0;
    }
    if (form.vaultId) {
      if (isMultiVault || form.vaultId !== initialVaultKey) {
        body.vaultId = form.vaultId;
      }
    }
    saveMutation.mutate({ id: invoice.id, body });
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
          <div className="p-2.5 rounded-lg text-[13px] bg-noorix-bg-muted text-noorix-red">
            {error}
          </div>
        )}

        {hasSupplier && (
          <>
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
              label={supplierRequired ? `${t('supplierInvoiceNumber')} *` : t('supplierInvoiceNumber')}
              value={form.supplierInvoiceNumber}
              onChange={(e) => updateField('supplierInvoiceNumber', e.target.value)}
              placeholder={t('invoiceNumberPlaceholder')}
            />

            {supplierRequired && (
              <Input
                type="select"
                label={t('kind')}
                value={form.kind}
                onChange={(e) => updateField('kind', e.target.value)}
              >
                <option value="purchase">{t('purchaseType')}</option>
                <option value="expense">{t('expenseType')}</option>
              </Input>
            )}
          </>
        )}

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
          {hasSupplier && form.totalAmount && parseFloat(form.totalAmount) > 0 && (
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

        {vaultsList.length > 0 && (
          <div>
            <Input
              type="select"
              label={t('invoiceVaultColumn')}
              value={form.vaultId}
              onChange={(e) => updateField('vaultId', e.target.value)}
            >
              <option value="">{t('selectVault')}</option>
              {vaultsList.map((v) => (
                <option key={v.id} value={v.id}>{vaultDisplayName(v, lang) || v.id}</option>
              ))}
            </Input>
            {isMultiVault && (
              <p className="text-[11px] text-noorix-muted m-0 mt-1">
                {t('invoiceEditVaultMultiHint')}
              </p>
            )}
          </div>
        )}

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
