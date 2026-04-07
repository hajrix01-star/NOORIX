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

const KIND_ORDER = ['sale', 'purchase', 'expense', 'fixed_expense', 'hr_expense', 'salary', 'advance'];

function kindLabel(t, k) {
  const m = {
    sale: t('categoryTypeSale'),
    purchase: t('categoryTypes'),
    expense: t('categoryTypeExpense'),
    fixed_expense: t('fixedExpenseType'),
    hr_expense: t('invoiceKindHrExpense'),
    salary: t('totalSalary'),
    advance: t('quickAdvance'),
  };
  return m[k] || k;
}

export default function PeriodAnalyticsStrip({ companyId, year, month, enabled }) {
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
    return KIND_ORDER.filter((k) => m[k]?.invoiceCount > 0).map((k) => ({
      kind: k,
      total: Number(m[k]?.totalAmount || 0),
      count: m[k]?.invoiceCount || 0,
    }));
  }, [data]);

  if (!enabled || !companyId) return null;

  return (
    <div
      className="noorix-surface-card grid gap-3.5 border border-noorix-border"
      style={{ padding: '14px 16px', border: '1px solid rgba(37,99,235,0.15)', background: 'linear-gradient(135deg, rgba(37,99,235,0.04) 0%, var(--noorix-bg-surface) 48%)' }}
    >
      <div className="flex flex items-center justify-between flex flex-wrap gap-3">
        <div className="text-[14px] font-extrabold">{t('periodAnalyticsTitle')}</div>
        <div className="text-[12px] text-noorix-muted">{from} — {to}</div>
      </div>
      {isLoading && <div className="text-[13px] text-noorix-muted">{t('loading')}</div>}
      {isError && <div className="text-[13px]" style={{ color: 'var(--noorix-error)' }}>{t('loadDataFailed')}</div>}
      {!isLoading && !isError && data && (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <div>
            <div className="text-[12px] text-noorix-muted mb-2">{t('periodAnalyticsByKind')}</div>
            <div className="flex flex flex-col gap-1.5">
              {byKindRows.length === 0 && <span className="text-[12px] text-noorix-muted">—</span>}
              {byKindRows.map((row) => (
                <Button
                  key={row.kind}
                  onClick={() => {
                    const path = row.kind === 'sale' ? '/sales' : '/invoices';
                    const q = row.kind === 'sale' ? { from, to } : { from, to, kind: row.kind };
                    navigate(`${path}?${drillToSearchParams(q)}`);
                  }}
                  className="flex flex items-center justify-between w-full text-[12px]"
                  style={{ textAlign: 'start' }}
                >
                  <span className="font-bold">{kindLabel(t, row.kind)}</span>
                  <span style={{ fontFamily: 'var(--noorix-font-numbers)', color: 'var(--noorix-accent-blue)' }}>
                    {fmt(row.total, 0)} <small style={{ opacity: 0.7 }}>({row.count})</small>
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
              {(data.topSuppliers || []).map((s) => (
                <Button
                  key={s.supplierId}
                  onClick={() =>
                    navigate(`/invoices?${drillToSearchParams({ from, to, supplierId: s.supplierId })}`)
                  }
                  className="flex flex items-center justify-between w-full text-[12px]"
                  style={{ textAlign: 'start' }}
                >
                  <span className="font-semibold truncate" style={{ maxWidth: '58%' }} title={lang === 'en' ? s.nameEn || s.nameAr : s.nameAr || s.nameEn}>
                    {lang === 'en' ? s.nameEn || s.nameAr : s.nameAr || s.nameEn}
                  </span>
                  <span style={{ fontFamily: 'var(--noorix-font-numbers)', color: 'var(--noorix-accent-red)', flexShrink: 0 }}>
                    {fmt(Number(s.totalAmount || 0), 0)} <small style={{ opacity: 0.7 }}>({s.invoiceCount})</small>
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
