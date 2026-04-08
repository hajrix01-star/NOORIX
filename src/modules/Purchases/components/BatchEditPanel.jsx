/**
 * BatchEditPanel — عرض دفعة وتعديل/حذف فواتيرها
 */
import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt, sumAmounts } from '../../../utils/format';
import { splitTaxFromTotalAsNumbers } from '../../../utils/math-engine';
import { SupplierSelect } from '../../../components/common/SupplierSelect';
import { Button, AdaptiveSheet, Input } from '../../../ui';
import { getApiErrorMessage, rejectIfApiFailed } from '../../../utils/apiResponse';

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
        rejectIfApiFailed(res, getApiErrorMessage(res, t('saveFailed')));
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
    <AdaptiveSheet
      open
      onClose={onClose}
      title={`${t('batchLabel', batchId)} — ${t('batchSummary', items.length, fmt(total))}`}
      size="xl"
      side="start"
      className="batch-edit-drawer"
      footer={
        <Button variant="primary" disabled={saving} onClick={handleSave}>
          {saving ? t('saving') : t('saveChanges')}
        </Button>
      }
    >
      {error && (
        <div className="rounded-lg text-[13px] p-3 mb-3" style={{ background: 'var(--noorix-red-10)', color: 'var(--noorix-accent-red)' }}>
          {error}
        </div>
      )}
      <div className="noorix-table-frame overflow-auto">
        <table className="noorix-table">
          <thead>
            <tr className="bg-noorix-bg border-b-2 border-noorix-border">
              <th className="py-2 px-2.5 text-right w-9">#</th>
              <th className="py-2 px-2.5 text-right min-w-[140px]">{t('supplier')}</th>
              <th className="py-2 px-2.5 text-right w-[90px]">{t('supplierInvoiceNumber')}</th>
              <th className="py-2 px-2.5 text-right w-[90px]">{t('total')}</th>
              <th className="py-2 px-2.5 text-right w-20">{t('kind')}</th>
              <th className="py-2 px-2.5 w-11" />
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, i) => (
              <tr key={inv.id || i} style={{ borderBottom: '1px solid var(--noorix-border)', opacity: inv.status === 'cancelled' ? 0.5 : 1, background: inv.status === 'cancelled' ? 'var(--noorix-bg-page)' : 'transparent' }}>
                <td className="text-center text-noorix-muted font-semibold p-1.5">{i + 1}</td>
                <td className="p-1.5">
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
                <td className="p-1.5">
                  {inv.status === 'cancelled' ? (
                    <span className="nx-cell-muted">{inv.supplierInvoiceNumber || inv.invoiceNumber}</span>
                  ) : (
                    <Input
                      value={inv.supplierInvoiceNumber ?? inv.invoiceNumber ?? ''}
                      onChange={(e) => updateInv(i, 'supplierInvoiceNumber', e.target.value)}
                      style={inputBase}
                    />
                  )}
                </td>
                <td className="p-1.5">
                  {inv.status === 'cancelled' ? (
                    <span className="nx-cell-num">{fmt(inv.totalAmount)}</span>
                  ) : (
                    <Input
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
                <td className="p-1.5">
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
                <td className="p-1.5">
                  {inv.status === 'cancelled' ? (
                    <span className="text-[12px] font-semibold text-noorix-red">{t('cancelled')}</span>
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
    </AdaptiveSheet>
  );
}
