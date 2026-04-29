/**
 * ملخص فواتير الفترة (حسب النوع + أعلى موردين) — نفس بيانات period-analytics المستخدمة في نظرة عامة الاستوديو.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, cn } from '../../../ui';
import { fmt } from '../../../utils/format';
import { drillToSearchParams } from '../../../utils/reportDrillLinks';
import { PERIOD_INVOICE_KIND_ORDER, periodInvoiceKindLabel } from '../utils/periodInvoiceKindLabels';

type PeriodData = {
  totalsByKind?: Record<string, { totalAmount?: string; invoiceCount?: number }>;
  topSuppliers?: Array<{
    supplierId?: string;
    nameAr?: string;
    nameEn?: string;
    totalAmount?: string;
    invoiceCount?: number;
  }>;
  suppliersInPeriodCount?: number;
};

type Props = {
  companyId: string;
  from: string;
  to: string;
  periodData: PeriodData | null | undefined;
  isLoading: boolean;
  isError: boolean;
  className?: string;
};

export function DashboardStudioPeriodSnapshot({
  companyId,
  from,
  to,
  periodData,
  isLoading,
  isError,
  className,
}: Props) {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();

  const byKindRows = useMemo(() => {
    const m = periodData?.totalsByKind || {};
    return PERIOD_INVOICE_KIND_ORDER.filter((k) => (m[k]?.invoiceCount ?? 0) > 0).map((k) => ({
      kind: k,
      total: Number(m[k]?.totalAmount || 0),
      count: m[k]?.invoiceCount || 0,
    }));
  }, [periodData]);

  if (!companyId) return null;

  return (
    <div
      className={cn(
        'noorix-surface-card border border-noorix-border p-4 shadow-sm',
        'bg-gradient-to-br from-noorix-blue/[0.06] via-noorix-surface to-noorix-surface',
        className,
      )}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="text-[14px] font-bold text-noorix-text">{t('dashboardStudioPeriodSnapshotTitle')}</div>
        <div className="text-[11px] text-noorix-muted font-mono ltr" dir="ltr">
          {from} — {to}
        </div>
      </div>
      {isLoading && <div className="text-[13px] text-noorix-muted mt-3">{t('loading')}</div>}
      {isError && <div className="text-[13px] text-noorix-red mt-3">{t('loadDataFailed')}</div>}
      {!isLoading && !isError && periodData && (
        <div className="mt-3 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <div>
            <div className="text-[12px] font-semibold text-noorix-muted mb-2">{t('dashboardStudioByInvoiceKind')}</div>
            <div className="flex flex-col gap-1.5">
              {byKindRows.length === 0 && <span className="text-[12px] text-noorix-muted">—</span>}
              {byKindRows.map((row) => (
                <Button
                  key={row.kind}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const path = row.kind === 'sale' ? '/sales' : '/invoices';
                    const q = row.kind === 'sale' ? { from, to } : { from, to, kind: row.kind };
                    navigate(`${path}?${drillToSearchParams(q)}`);
                  }}
                  className="h-auto min-h-9 w-full justify-between gap-2 py-1.5 text-start text-[12px] font-normal"
                >
                  <span className="font-semibold text-noorix-text">{periodInvoiceKindLabel(t, row.kind)}</span>
                  <span className="nx-font-numbers shrink-0 text-noorix-blue">
                    {fmt(row.total, 0)} <span className="text-noorix-muted">({row.count})</span>
                  </span>
                </Button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[12px] font-semibold text-noorix-muted mb-2">
              {t('dashboardStudioTopSuppliersShort')}
              {typeof periodData.suppliersInPeriodCount === 'number' ? (
                <span className="ms-1 font-normal text-noorix-muted">
                  ({periodData.suppliersInPeriodCount})
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              {(!periodData.topSuppliers || periodData.topSuppliers.length === 0) && (
                <span className="text-[12px] text-noorix-muted">—</span>
              )}
              {(periodData.topSuppliers || []).map((s) => (
                <Button
                  key={String(s.supplierId)}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    navigate(`/invoices?${drillToSearchParams({ from, to, supplierId: s.supplierId })}`)
                  }
                  className="h-auto min-h-9 w-full justify-between gap-2 py-1.5 text-start text-[12px] font-normal"
                >
                  <span
                    className="max-w-[58%] truncate font-semibold text-noorix-text"
                    title={lang === 'en' ? s.nameEn || s.nameAr : s.nameAr || s.nameEn}
                  >
                    {lang === 'en' ? s.nameEn || s.nameAr : s.nameAr || s.nameEn}
                  </span>
                  <span className="nx-font-numbers shrink-0 text-noorix-red">
                    {fmt(Number(s.totalAmount || 0), 0)}{' '}
                    <span className="text-noorix-muted">({s.invoiceCount ?? 0})</span>
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
