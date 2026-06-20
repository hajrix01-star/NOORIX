/**
 * BatchEditPanel — عرض دفعة وتعديل/حذف فواتيرها
 * جدول على العرض الواسع، بطاقات تحت 700px — سطر موحّد: BatchEditInvoiceLine
 */
import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt, sumAmounts } from '../../../utils/format';
import { Button, AdaptiveSheet } from '../../../ui';
import { rejectIfApiFailed } from '../../../utils/apiResponse';
import { useIsNarrow700 } from '../../../hooks/useMediaQuery';
import { toDateInputYmd } from '../../../utils/saudiDate';
import { BatchEditInvoiceLine } from './BatchEditInvoiceLine';

export function BatchEditPanel({ batch, suppliers, companyId: _companyId, vatRateDecimal, onSaveInvoice, onClose }: any) {
  const { t, lang } = useTranslation();
  const narrow = useIsNarrow700();
  const invList = batch?.invoices || batch || [];
  const [invoices, setInvoices] = useState(() =>
    invList.map((i: any) => ({
      ...i,
      totalAmount: Number(i.totalAmount),
      netAmount: Number(i.netAmount),
      taxAmount: Number(i.taxAmount),
      transactionDate: toDateInputYmd(i.transactionDate) || '',
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const batchId = batch?.batchId || invList[0]?.batchId;

  function updateInv(idx: any, fieldOrObj: any, value: any) {
    setInvoices((p: any) =>
      p.map((inv: any, i: any) =>
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
        rejectIfApiFailed(res, t('saveFailed'));
      }
      onClose?.();
    } catch (e: any) {
      setError(e?.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  const items = invoices.filter((i: any) => i.status !== 'cancelled');
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
        <div className="rounded-lg text-[13px] p-3 mb-3 bg-red-50 border border-red-200 text-noorix-red">
          {error}
        </div>
      )}
      {narrow ? (
        <div className="flex flex-col gap-3 min-w-0">
          {invoices.map((inv: any, i: any) => (
            <BatchEditInvoiceLine
              key={inv.id || i}
              inv={inv}
              i={i}
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
              {invoices.map((inv: any, i: any) => (
                <BatchEditInvoiceLine
                  key={inv.id || i}
                  inv={inv}
                  i={i}
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
