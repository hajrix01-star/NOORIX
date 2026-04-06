/**
 * BatchEditPanel — عرض دفعة وتعديل/حذف فواتيرها
 */
import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt, sumAmounts } from '../../../utils/format';
import { splitTaxFromTotalAsNumbers } from '../../../utils/math-engine';
import { SupplierSelect } from '../../../components/common/SupplierSelect';
import { Button, Modal, Input } from '../../../ui';

const inputBase = {
  width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 12,
  border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)', fontFamily: 'inherit', boxSizing: 'border-box',
};

export function BatchEditPanel({ batch, suppliers, companyId, onSaveInvoice, onClose }) {
  const { t, lang } = useTranslation();
  const invList = batch?.invoices || batch || [];
  const [invoices, setInvoices] = useState(() =>
    invList.map((i) => ({
      ...i,
      totalAmount: Number(i.totalAmount),
      netAmount: Number(i.netAmount),
      taxAmount: Number(i.taxAmount),
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const batchId = batch?.batchId || invList[0]?.batchId;

  function updateInv(idx, fieldOrObj, value) {
    setInvoices((p) =>
      p.map((inv, i) =>
        i === idx
          ? typeof fieldOrObj === 'object'
            ? { ...inv, ...fieldOrObj }
            : { ...inv, [fieldOrObj]: value }
          : inv,
      ),
    );
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      for (const inv of invoices) {
        const res = await onSaveInvoice(inv);
        if (!res?.success) throw new Error(res?.error || 'فشل التحديث');
      }
      onClose?.();
    } catch (e) {
      setError(e?.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  const items = invoices.filter((i) => i.status !== 'cancelled');
  const total = sumAmounts(items, 'totalAmount').toNumber();

  return (
    <Modal
      open
      onClose={onClose}
      title={`${t('batchLabel', batchId)} — ${t('batchSummary', items.length, fmt(total))}`}
      size="xl"
      footer={
        <Button variant="success" disabled={saving} onClick={handleSave}>
          {saving ? t('saving') : t('saveChanges')}
        </Button>
      }
    >
      {error && (
        <div style={{ padding: 12, marginBottom: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
          {error}
        </div>
      )}
      <div className="noorix-table-frame" style={{ overflowX: 'auto' }}>
        <table className="noorix-table">
          <thead>
            <tr style={{ background: 'var(--noorix-bg-page)', borderBottom: '2px solid var(--noorix-border)' }}>
              <th style={{ padding: '8px 10px', textAlign: 'right', width: 36 }}>#</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', minWidth: 140 }}>{t('supplier')}</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', width: 90 }}>{t('supplierInvoiceNumber')}</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', width: 90 }}>{t('total')}</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', width: 80 }}>{t('kind')}</th>
              <th style={{ padding: '8px 10px', width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, i) => (
              <tr key={inv.id || i} style={{ borderBottom: '1px solid var(--noorix-border)', opacity: inv.status === 'cancelled' ? 0.5 : 1, background: inv.status === 'cancelled' ? 'var(--noorix-bg-page)' : 'transparent' }}>
                <td style={{ padding: 6, textAlign: 'center', color: 'var(--noorix-text-muted)', fontWeight: 600 }}>{i + 1}</td>
                <td style={{ padding: 6 }}>
                  {inv.status === 'cancelled' ? (
                    <span className="nx-cell-muted">{(lang === 'en' ? inv.supplier?.nameEn || inv.supplier?.nameAr : inv.supplier?.nameAr || inv.supplier?.nameEn) || '—'}</span>
                  ) : (
                    <SupplierSelect
                      suppliers={suppliers}
                      value={inv.supplierId || ''}
                      onChange={(v) => updateInv(i, 'supplierId', v)}
                      bookmarkedIds={[]}
                      placeholder="—"
                    />
                  )}
                </td>
                <td style={{ padding: 6 }}>
                  {inv.status === 'cancelled' ? (
                    <span className="nx-cell-muted">{inv.supplierInvoiceNumber || inv.invoiceNumber}</span>
                  ) : (
                    <input
                      value={inv.supplierInvoiceNumber ?? inv.invoiceNumber ?? ''}
                      onChange={(e) => updateInv(i, 'supplierInvoiceNumber', e.target.value)}
                      style={inputBase}
                    />
                  )}
                </td>
                <td style={{ padding: 6 }}>
                  {inv.status === 'cancelled' ? (
                    <span className="nx-cell-num">{fmt(inv.totalAmount)}</span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={inv.totalAmount ?? ''}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v > 0) {
                          const { net, tax } = splitTaxFromTotalAsNumbers(v, true);
                          updateInv(i, { totalAmount: v, netAmount: net, taxAmount: tax });
                        }
                      }}
                      style={{ ...inputBase, fontFamily: 'var(--noorix-font-numbers)' }}
                    />
                  )}
                </td>
                <td style={{ padding: 6 }}>
                  {inv.status === 'cancelled' ? (
                    <span className="nx-cell-muted-sm">{inv.kind === 'purchase' ? t('purchaseType') : t('expenseType')}</span>
                  ) : (
                    <Input
                      type="select"
                      value={inv.kind || 'purchase'}
                      onChange={(e) => updateInv(i, 'kind', e.target.value)}
                    >
                      <option value="purchase">{t('purchaseType')}</option>
                      <option value="expense">{t('expenseType')}</option>
                    </Input>
                  )}
                </td>
                <td style={{ padding: 6 }}>
                  {inv.status === 'cancelled' ? (
                    <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>{t('cancelled')}</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => updateInv(i, 'status', 'cancelled')}
                    >
                      {t('cancel')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
