/**
 * InvoiceEditModal — نافذة تعديل الفاتورة
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { SupplierSelect } from '../../../components/common/SupplierSelect';
import { splitTaxFromTotalAsNumbers } from '../../../utils/math-engine';
import { updateInvoice } from '../../../services/api';
import { fmt } from '../../../utils/format';

const inputBase = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)', fontFamily: 'inherit', boxSizing: 'border-box',
};

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
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        style={{
          background: 'var(--noorix-bg-surface)', borderRadius: 12, maxWidth: 480, width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--noorix-border)' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t('editInvoice')}</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--noorix-text-muted)' }}>
            {invoice.supplierInvoiceNumber || invoice.invoiceNumber}
          </p>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ padding: 10, background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('supplier')}</label>
            <SupplierSelect
              suppliers={suppliers}
              value={form.supplierId}
              onChange={(v) => updateField('supplierId', v)}
              bookmarkedIds={[]}
              placeholder={t('selectSupplier')}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('supplierInvoiceNumber')} *</label>
            <input
              value={form.supplierInvoiceNumber}
              onChange={(e) => updateField('supplierInvoiceNumber', e.target.value)}
              style={inputBase}
              placeholder={t('invoiceNumberPlaceholder')}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('kind')}</label>
            <select value={form.kind} onChange={(e) => updateField('kind', e.target.value)} style={inputBase}>
              <option value="purchase">{t('purchaseType')}</option>
              <option value="expense">{t('expenseType')}</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>الإجمالي (شامل الضريبة) *</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.totalAmount}
              onChange={(e) => updateField('totalAmount', e.target.value)}
              style={{ ...inputBase, fontFamily: 'var(--noorix-font-numbers)' }}
            />
            {form.totalAmount && parseFloat(form.totalAmount) > 0 && (
              <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginTop: 4 }}>
                {t('netShort')}: {form.netAmount} | {t('tax')}: {form.taxAmount}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('transactionDateLabel')}</label>
            <input
              type="date"
              value={form.transactionDate}
              onChange={(e) => updateField('transactionDate', e.target.value)}
              style={inputBase}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('notesLabel')}</label>
            <input
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              style={inputBase}
              placeholder={t('invoiceNotesPlaceholder')}
            />
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--noorix-border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="noorix-btn-nav" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="noorix-btn-nav noorix-btn-success"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? t('saving') : t('saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}
