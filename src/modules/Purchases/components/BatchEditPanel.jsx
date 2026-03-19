/**
 * BatchEditPanel — عرض دفعة وتعديل/حذف فواتيرها
 */
import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt, sumAmounts } from '../../../utils/format';
import { splitTaxFromTotalAsNumbers } from '../../../utils/math-engine';
import { SupplierSelect } from '../../../components/common/SupplierSelect';

const inputBase = {
  width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 12,
  border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)', fontFamily: 'inherit', boxSizing: 'border-box',
};

export function BatchEditPanel({ batch, suppliers, companyId, onSaveInvoice, onClose }) {
  const { t } = useTranslation();
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}
    onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div style={{
        background: 'var(--noorix-bg-surface)', borderRadius: 12, maxWidth: 900, width: '100%',
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--noorix-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t('batchLabel', batchId)}</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--noorix-text-muted)' }}>
              {t('batchSummary', items.length, fmt(total))}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-page)', cursor: 'pointer' }}>
            {t('close')}
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
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
                        <span style={{ color: 'var(--noorix-text-muted)' }}>{inv.supplier?.nameAr || '—'}</span>
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
                        <span style={{ color: 'var(--noorix-text-muted)' }}>{inv.supplierInvoiceNumber || inv.invoiceNumber}</span>
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
                        <span style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(inv.totalAmount)}</span>
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
                        <span style={{ fontSize: 12 }}>{inv.kind === 'purchase' ? t('purchaseType') : t('expenseType')}</span>
                      ) : (
                        <select
                          value={inv.kind || 'purchase'}
                          onChange={(e) => updateInv(i, 'kind', e.target.value)}
                          style={inputBase}
                        >
                          <option value="purchase">{t('purchaseType')}</option>
                          <option value="expense">{t('expenseType')}</option>
                        </select>
                      )}
                    </td>
                    <td style={{ padding: 6 }}>
                      {inv.status === 'cancelled' ? (
                        <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>{t('cancelled')}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updateInv(i, 'status', 'cancelled')}
                          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #fecaca', background: 'rgba(239,68,68,0.06)', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}
                        >
                          {t('cancel')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--noorix-border)', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
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
