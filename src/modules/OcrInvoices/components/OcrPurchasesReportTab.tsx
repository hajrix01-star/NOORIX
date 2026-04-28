import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button } from '../../../ui';
import { formatNumber } from '../../../utils/money';
import { getOcrPurchasesByMonth } from '../services/ocrApi';
import { ocrKeys } from '../../../services/queryKeys';

function defaultMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function OcrPurchasesReportTab() {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const isAr = lang === 'ar';
  const [monthInput, setMonthInput] = useState(defaultMonthStr);
  const [appliedMonth, setAppliedMonth] = useState(defaultMonthStr);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ocrKeys.purchasesReport(activeCompanyId || '', appliedMonth),
    enabled: !!activeCompanyId && /^\d{4}-\d{2}$/.test(appliedMonth),
    queryFn: async () => {
      const r = await getOcrPurchasesByMonth(appliedMonth);
      return r.success ? r.data : null;
    },
  });

  const fmt = (n: any) =>
    typeof n === 'number' && !Number.isNaN(n)
      ? formatNumber(n, lang, { minFractionDigits: 0, maxFractionDigits: 2 })
      : '—';

  return (
    <div className="flex flex-col gap-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="text-noorix-muted font-medium">{t('ocrReportMonth')}</span>
          <input
            type="month"
            value={monthInput}
            onChange={(e: any) => setMonthInput(e.target.value)}
            className="rounded-md border border-noorix-border bg-noorix-bg-surface px-2 py-2 text-[13px] text-noorix-text"
          />
        </label>
        <Button variant="primary" size="sm" onClick={() => { setAppliedMonth(monthInput); refetch(); }}>
          {t('ocrReportLoad')}
        </Button>
      </div>

      {isLoading && <div className="text-[13px] text-noorix-muted">{t('ocrReportLoading')}</div>}

      {!isLoading && data && data.invoiceCount === 0 && (
        <div className="text-[13px] text-noorix-muted rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2">
          {t('ocrReportEmpty')}
        </div>
      )}

      {!isLoading && data && data.invoiceCount > 0 && (
        <>
          <div className="text-[13px] text-noorix-muted">
            {isAr ? 'الفواتير:' : 'Invoices:'} <strong>{data.invoiceCount}</strong>
            {' · '}
            {isAr ? 'السطور:' : 'Lines:'} <strong>{data.lineCount}</strong>
            {' · '}
            {isAr ? 'الإجمالي:' : 'Grand total:'}{' '}
            <strong>{fmt(data.grandTotal)}</strong> <span className="nx-sar">SR</span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="noorix-surface-card overflow-hidden border border-noorix-border rounded-lg">
              <div className="px-3 py-2 font-semibold text-[13px] border-b border-noorix-border bg-noorix-bg-muted">
                {t('ocrReportByCategory')}
              </div>
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="border-b border-noorix-border text-noorix-muted">
                    <th className="text-start p-2">{t('ocrReportCategory')}</th>
                    <th className="text-end p-2">{t('ocrReportLines')}</th>
                    <th className="text-end p-2">{t('ocrReportTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.byCategory || []).map((row: any) => (
                    <tr key={row.category} className="border-b border-noorix-border/60 last:border-0">
                      <td className="p-2">{row.category}</td>
                      <td className="p-2 text-end tabular-nums">{row.lineCount}</td>
                      <td className="p-2 text-end tabular-nums">{fmt(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="noorix-surface-card overflow-hidden border border-noorix-border rounded-lg">
              <div className="px-3 py-2 font-semibold text-[13px] border-b border-noorix-border bg-noorix-bg-muted">
                {t('ocrReportByItem')}
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                <table className="w-full text-[12px] border-collapse">
                  <thead className="sticky top-0 bg-noorix-bg-muted border-b border-noorix-border">
                    <tr className="text-noorix-muted">
                      <th className="text-start p-2">{t('ocrReportItem')}</th>
                      <th className="text-start p-2">{t('ocrItemCategory')}</th>
                      <th className="text-end p-2">{t('ocrReportQty')}</th>
                      <th className="text-end p-2">{t('ocrReportTotal')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.byItem || []).map((row: any, idx: any) => (
                      <tr key={`${row.itemId || row.nameAr}-${idx}`} className="border-b border-noorix-border/60 last:border-0">
                        <td className="p-2 max-w-[140px] truncate" title={row.nameAr}>{row.nameAr}</td>
                        <td className="p-2 text-noorix-muted">{row.category || '—'}</td>
                        <td className="p-2 text-end tabular-nums">{fmt(row.quantity)}</td>
                        <td className="p-2 text-end tabular-nums">{fmt(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="noorix-surface-card overflow-hidden border border-noorix-border rounded-lg">
            <div className="px-3 py-2 font-semibold text-[13px] border-b border-noorix-border bg-noorix-bg-muted">
              {t('ocrReportInvoices')}
            </div>
            <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="w-full text-[12px] border-collapse min-w-[520px]">
                <thead className="sticky top-0 bg-noorix-bg-muted border-b border-noorix-border">
                  <tr className="text-noorix-muted">
                    <th className="text-start p-2">{t('ocrInvoiceDate')}</th>
                    <th className="text-start p-2">{t('ocrSupplierField')}</th>
                    <th className="text-start p-2">{t('ocrInvoiceNumber')}</th>
                    <th className="text-end p-2">{t('ocrReportTotal')}</th>
                    <th className="text-center p-2">{t('ocrReportLinked')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.invoices || []).map((inv: any) => (
                    <tr key={inv.id} className="border-b border-noorix-border/60 last:border-0">
                      <td className="p-2 whitespace-nowrap">
                        {inv.invoiceDate
                          ? new Date(inv.invoiceDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB')
                          : new Date(inv.createdAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB')}
                      </td>
                      <td className="p-2 max-w-[160px] truncate" title={inv.supplier?.nameAr}>
                        {inv.supplier?.nameAr || '—'}
                      </td>
                      <td className="p-2">{inv.invoiceNumber || '—'}</td>
                      <td className="p-2 text-end tabular-nums">{fmt(inv.totalAmount)}</td>
                      <td className="p-2 text-center">{inv.linkedPurchaseId ? '✓' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
