/**
 * شريط تحليل خفيف للفترة — يعتمد على /reports/period-analytics
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { usePeriodAnalytics } from '../../hooks/useReports';
import { fmt } from '../../utils/format';
import { monthDateBounds, drillToSearchParams } from '../../utils/reportDrillLinks';
import { Button } from '../../ui';
import { PERIOD_INVOICE_KIND_ORDER, periodInvoiceKindLabel } from '../Dashboard/utils/periodInvoiceKindLabels';

export default function PeriodAnalyticsStrip({ companyId, year, month, enabled }: any) {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const { from, to } = useMemo(() => monthDateBounds(year, month), [year, month]);

  const { data, isLoading, isError } = usePeriodAnalytics({
    companyId,
    startDate: from,
    endDate: to,
    enabled: !!enabled && !!companyId,
  });

  const byKindRows = useMemo(() => {
    const m = data?.totalsByKind || {};
    return PERIOD_INVOICE_KIND_ORDER.filter((k: any) => m[k]?.invoiceCount > 0).map((k: any) => ({
      kind: k,
      total: Number(m[k]?.totalAmount || 0),
      count: m[k]?.invoiceCount || 0,
    }));
  }, [data]);

  if (!enabled || !companyId) return null;

  return (
    <div
      className="noorix-surface-card grid gap-3.5 border border-[var(--noorix-blue-15)] bg-[linear-gradient(135deg,var(--noorix-blue-4)_0%,var(--noorix-bg-surface)_48%)] py-[14px] px-4"
    >
      <div className="flex flex items-center justify-between flex flex-wrap gap-3">
        <div>
          <div className="text-[14px] font-extrabold">{t('periodAnalyticsTitle')}</div>
          <div className="text-[11px] text-noorix-muted mt-0.5">{t('periodAnalyticsHint')}</div>
        </div>
        <div className="text-[12px] text-noorix-muted">{from} — {to}</div>
      </div>
      {isLoading && <div className="text-[13px] text-noorix-muted">{t('loading')}</div>}
      {isError && <div className="text-[13px] text-noorix-red">{t('loadDataFailed')}</div>}
      {!isLoading && !isError && data && (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          <div>
            <div className="text-[12px] text-noorix-muted mb-2">{t('periodAnalyticsByKind')}</div>
            <div className="flex flex flex-col gap-1.5">
              {byKindRows.length === 0 && <span className="text-[12px] text-noorix-muted">—</span>}
              {byKindRows.map((row: any) => (
                <Button
                  key={row.kind}
                  onClick={() => {
                    const path = row.kind === 'sale' ? '/sales' : '/invoices';
                    const q = row.kind === 'sale' ? { from, to } : { from, to, kind: row.kind };
                    navigate(`${path}?${drillToSearchParams(q)}`);
                  }}
                  className="flex items-center justify-between w-full text-[12px] text-start"
                >
                  <span className="font-bold">{periodInvoiceKindLabel(t, row.kind)}</span>
                  <span className="nx-font-numbers text-noorix-blue">
                    {fmt(row.total, 0)} <small className="opacity-70">({row.count})</small>
                  </span>
                </Button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[12px] text-noorix-muted mb-2">{t('periodAnalyticsTopSuppliers')}</div>
            <div className="flex flex flex-col gap-1.5">
              {(!data.topSuppliers || data.topSuppliers.length === 0) && (
                <span className="text-[12px] text-noorix-muted">—</span>
              )}
              {(data.topSuppliers || []).map((s: any) => (
                <Button
                  key={s.supplierId}
                  onClick={() =>
                    navigate(`/invoices?${drillToSearchParams({ from, to, supplierId: s.supplierId })}`)
                  }
                  className="flex items-center justify-between w-full text-[12px] text-start"
                >
                  <span className="font-semibold truncate max-w-[58%]" title={lang === 'en' ? s.nameEn || s.nameAr : s.nameAr || s.nameEn}>
                    {lang === 'en' ? s.nameEn || s.nameAr : s.nameAr || s.nameEn}
                  </span>
                  <span className="shrink-0 nx-font-numbers text-noorix-red">
                    {fmt(Number(s.totalAmount || 0), 0)} <small className="opacity-70">({s.invoiceCount})</small>
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
