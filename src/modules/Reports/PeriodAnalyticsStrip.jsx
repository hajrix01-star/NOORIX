/**
 * شريط تحليل خفيف للفترة — يعتمد على /reports/period-analytics
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { usePeriodAnalytics } from '../../hooks/useReports';
import { fmt } from '../../utils/format';
import { monthDateBounds, drillToSearchParams } from '../../utils/reportDrillLinks';

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
  const { t } = useTranslation();
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
      className="noorix-surface-card"
      style={{
        padding: '14px 16px',
        display: 'grid',
        gap: 14,
        border: '1px solid rgba(37,99,235,0.15)',
        background: 'linear-gradient(135deg, rgba(37,99,235,0.04) 0%, var(--noorix-bg-surface) 48%)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>{t('periodAnalyticsTitle')}</div>
        <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{from} — {to}</div>
      </div>
      {isLoading && <div style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('loading')}</div>}
      {isError && <div style={{ fontSize: 13, color: '#dc2626' }}>{t('loadDataFailed')}</div>}
      {!isLoading && !isError && data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginBottom: 8 }}>{t('periodAnalyticsByKind')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {byKindRows.length === 0 && <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>—</span>}
              {byKindRows.map((row) => (
                <button
                  key={row.kind}
                  type="button"
                  className="noorix-btn-nav"
                  onClick={() => {
                    const path = row.kind === 'sale' ? '/sales' : '/invoices';
                    const q = row.kind === 'sale' ? { from, to } : { from, to, kind: row.kind };
                    navigate(`${path}?${drillToSearchParams(q)}`);
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textAlign: 'start',
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid var(--noorix-border)',
                    background: 'var(--noorix-bg-surface)',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{kindLabel(t, row.kind)}</span>
                  <span style={{ fontFamily: 'var(--noorix-font-numbers)', color: '#2563eb' }}>
                    {fmt(row.total, 0)} <small style={{ opacity: 0.7 }}>({row.count})</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginBottom: 8 }}>{t('periodAnalyticsTopSuppliers')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(!data.topSuppliers || data.topSuppliers.length === 0) && (
                <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>—</span>
              )}
              {(data.topSuppliers || []).map((s) => (
                <button
                  key={s.supplierId}
                  type="button"
                  className="noorix-btn-nav"
                  onClick={() =>
                    navigate(`/invoices?${drillToSearchParams({ from, to, supplierId: s.supplierId })}`)
                  }
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textAlign: 'start',
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid var(--noorix-border)',
                    background: 'var(--noorix-bg-surface)',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '58%' }} title={s.nameAr}>
                    {s.nameAr}
                  </span>
                  <span style={{ fontFamily: 'var(--noorix-font-numbers)', color: '#dc2626', flexShrink: 0 }}>
                    {fmt(Number(s.totalAmount || 0), 0)} <small style={{ opacity: 0.7 }}>({s.invoiceCount})</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
