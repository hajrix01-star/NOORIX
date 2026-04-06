/**
 * DashboardOverviewTab — نظرة عامة: كروت الأقسام + مؤشر خط زمني للمبيعات
 * رسم بياني احترافي: شهري (كل الأشهر) أو يومي (عند اختيار شهر)
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { PERMISSIONS } from '../../../constants/permissions';
import { useReportsGeneralProfitLoss } from '../../../hooks/useReports';
import PeriodAnalyticsStrip from '../../Reports/PeriodAnalyticsStrip';
import { useSales } from '../../../hooks/useSales';
import { CARD_COLORS, CARD_BORDER_RADIUS } from '../../../utils/cardStyles';
import { EN_MONTHS, moneyText, percentText } from '../../../modules/Reports/reportHelpers';

const MONTH_NAMES_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
import { fmt } from '../../../utils/format';

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}
function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatAxisValue(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(Math.round(n));
}

export default function DashboardOverviewTab({ companyId, year, selectedMonth, filter }) {
  const { t, lang } = useTranslation();
  const { companies, userPermissions } = useApp();
  const canPeriodAnalytics = (userPermissions || []).includes(PERMISSIONS.REPORTS_READ);
  const { data: report, isLoading, error } = useReportsGeneralProfitLoss({ companyId, year });

  const month = selectedMonth ? Number(selectedMonth) : 1;
  const lastDay = lastDayOfMonth(year, month);
  const dailyStart = selectedMonth ? ymd(year, month, 1) : null;
  const dailyEnd = selectedMonth ? ymd(year, month, lastDay) : null;
  const { summaries: dailySummaries, isLoading: dailyLoading } = useSales({
    companyId,
    startDate: dailyStart,
    endDate: dailyEnd,
    enabled: !!selectedMonth,
  });

  const company = companies?.find((c) => c.id === companyId);
  const companyName = lang === 'en' ? (company?.nameEn || company?.nameAr || '') : (company?.nameAr || company?.nameEn || '');

  function getCardValue(key) {
    if (!report) return '0';
    if (!selectedMonth) return report.cards?.[key] || '0';
    if (key === 'grossProfit' || key === 'netProfit') {
      return report.summaryRows?.find((r) => r.key === key)?.months?.[selectedMonth - 1] || '0';
    }
    return report.groups?.find((r) => r.key === key)?.months?.[selectedMonth - 1] || '0';
  }

  function getCardProfitPercent(key) {
    if (!report || (key !== 'grossProfit' && key !== 'netProfit')) return null;
    const sales = Number(getCardValue('sales') || 0);
    if (!sales || sales < 0.0000001) return null;
    const profit = Number(getCardValue(key) || 0);
    return ((profit / sales) * 100).toFixed(1);
  }

  /** نسبة القسم من المبيعات (للمشتريات، المصروفات، الربح الإجمالي، صافي الربح) */
  function getSectionPercentOfSales(key) {
    if (!report || key === 'sales') return null;
    const sales = Number(getCardValue('sales') || 0);
    if (!sales || sales < 0.0000001) return null;
    const val = Number(getCardValue(key) || 0);
    return ((val / sales) * 100).toFixed(1);
  }

  const salesTimeline = useMemo(() => {
    const salesGroup = report?.groups?.find((r) => r.key === 'sales');
    if (!salesGroup?.months?.length) return [];
    return (salesGroup.months || []).map((val, i) => ({
      month: i + 1,
      label: EN_MONTHS[i],
      amount: Number(val || 0),
    }));
  }, [report]);

  const dailyTimeline = useMemo(() => {
    if (!selectedMonth) return [];
    const byDay = new Map();
    (dailySummaries || []).forEach((s) => {
      const d = String(s.transactionDate || '').slice(0, 10);
      const dayNum = parseInt(d.slice(8, 10), 10);
      const amt = Number(s.totalAmount || 0);
      byDay.set(dayNum, (byDay.get(dayNum) || 0) + amt);
    });
    const points = [];
    for (let d = 1; d <= lastDay; d++) {
      points.push({ day: d, label: String(d), amount: byDay.get(d) || 0 });
    }
    return points;
  }, [selectedMonth, dailySummaries, lastDay]);

  const chartData = selectedMonth ? dailyTimeline : salesTimeline;
  const isDailyChart = !!selectedMonth;
  const maxSales = useMemo(() => Math.max(1, ...chartData.map((p) => p.amount)), [chartData]);

  const [hoveredPoint, setHoveredPoint] = useState(null);
  const yAxisTicks = useMemo(() => {
    if (maxSales <= 0) return [0, 1];
    const step = Math.max(1, Math.ceil(maxSales / 5));
    const ticks = [];
    for (let i = 0; i <= 5; i++) ticks.push(step * i);
    return ticks;
  }, [maxSales]);

  const monthName = selectedMonth ? (lang === 'ar' ? MONTH_NAMES_AR[selectedMonth - 1] : MONTH_NAMES_EN[selectedMonth - 1]) : null;
  const cards = useMemo(() => [
    { key: 'sales', label: monthName ? `${monthName} — ${t('revenueGroup')}` : t('annualSales') },
    { key: 'purchases', label: monthName ? `${monthName} — ${t('purchasesGroup')}` : t('annualPurchases') },
    { key: 'expenses', label: monthName ? `${monthName} — ${t('expensesGroup')}` : t('annualExpenses') },
    { key: 'grossProfit', label: t('annualGrossProfit') },
    { key: 'netProfit', label: t('annualNetProfit') },
  ], [monthName, t]);

  if (!companyId) {
    return (
      <div className="noorix-surface-card nx-p-24 nx-text-center nx-text-muted">
        {t('pleaseSelectCompany')}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="noorix-surface-card nx-p-24 nx-text-center nx-text-muted">
        {t('loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="noorix-surface-card nx-p-20 nx-text-expense" style={{ background: 'rgba(239,68,68,0.08)' }}>
        {error.message}
      </div>
    );
  }

  return (
    <div className="nx-flex nx-flex-col nx-gap-24">
      <PeriodAnalyticsStrip
        companyId={companyId}
        year={year}
        month={selectedMonth ?? null}
        enabled={canPeriodAnalytics}
      />
      <div className="nx-grid nx-gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {cards.map((card) => {
          const profitPct = (card.key === 'grossProfit' || card.key === 'netProfit') ? getCardProfitPercent(card.key) : null;
          const sectionPct = getSectionPercentOfSales(card.key);
          const val = Number(getCardValue(card.key) || 0);
          const isProfit = card.key === 'grossProfit' || card.key === 'netProfit';
          const c = CARD_COLORS[card.key];
          const accent = isProfit ? (val >= 0 ? c.accent : c.accentLoss) : c.accent;
          const ratioLabel = card.key === 'sales' ? t('sectionToSalesRatio') : card.key === 'purchases' ? t('purchasesToSalesRatio') : card.key === 'expenses' ? t('sectionToSalesRatio') : (card.key === 'grossProfit' || card.key === 'netProfit') ? t('reportProfitMargin') : null;
          const ratioValue = card.key === 'sales' ? '100' : (sectionPct ?? profitPct);
          return (
            <div
              key={card.key}
              className="nx-surface nx-overflow-hidden"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              <div style={{ height: 3, background: accent }} />
              <div className="nx-p-16 nx-bg-surface">
                <div className="nx-text-sm nx-font-700 nx-mb-8" style={{ color: accent }}>{card.label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: accent, fontFamily: 'var(--noorix-font-numbers)' }}>
                  {moneyText(getCardValue(card.key))}
                </div>
                {(ratioLabel && ratioValue != null) && (
                  <div className="nx-text-sm nx-mt-6" style={{ color: accent, opacity: 0.9 }}>
                    {ratioLabel}: {ratioValue}%
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="nx-surface nx-overflow-hidden nx-p-24" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div className="nx-flex nx-flex-between nx-flex-wrap nx-gap-8 nx-mb-20">
          <div className="nx-text-lg nx-font-700">
            {t('dashboardSalesTimeline')} — {filter?.label || year}
          </div>
          <div className="nx-text-xs nx-text-muted">
            {isDailyChart ? t('reportMonthTotal') : t('reportAnnualTotal')}: <strong style={{ fontFamily: 'var(--noorix-font-numbers)', color: CARD_COLORS.sales.accent }}>{moneyText(chartData.reduce((s, p) => s + p.amount, 0))}</strong>
          </div>
        </div>

        {chartData.length === 0 || chartData.every((p) => p.amount === 0) ? (
          <div className="nx-flex nx-flex-col nx-flex-center nx-text-muted nx-gap-8" style={{ minHeight: 220 }}>
            <div style={{ fontSize: 32, opacity: 0.3 }}></div>
            <div className="nx-text-base">{t('noDataInPeriod')}</div>
          </div>
        ) : (
          <>
        <div className="nx-flex" style={{ gap: 0, minHeight: 220 }}>
          {/* Y-axis */}
          <div style={{ flexShrink: 0, width: 52, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 28 }}>
            {[...yAxisTicks].reverse().map((tick) => (
              <div key={tick} className="nx-text-muted nx-font-600" style={{ fontSize: 10, fontFamily: 'var(--noorix-font-numbers)' }}>
                {formatAxisValue(tick)}
              </div>
            ))}
          </div>

          {/* Chart area with grid */}
          <div className="nx-flex-1" style={{ position: 'relative' }}>
            {/* Grid lines */}
            <div style={{ position: 'absolute', inset: 0, top: 0, bottom: 32, left: 0, right: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
              {yAxisTicks.slice(1).map((_, i) => (
                <div key={i} style={{ height: 1, background: 'var(--noorix-border)', opacity: 0.6 }} />
              ))}
            </div>

            {/* Bars */}
            <div className="nx-flex nx-gap-6" style={{ alignItems: 'flex-end', height: 180, paddingBottom: 28 }}>
              {chartData.map((point) => {
                const barHeightPct = maxSales > 0 ? (point.amount / maxSales) * 100 : 0;
                const pointKey = point.month ?? point.day;
                const isHovered = hoveredPoint === pointKey;
                return (
                  <div
                    key={pointKey}
                    className="nx-flex-1 nx-flex nx-flex-col nx-gap-4"
                    style={{ alignItems: 'center', minWidth: 0, position: 'relative' }}
                    onMouseEnter={() => setHoveredPoint(pointKey)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    {/* Tooltip */}
                    {isHovered && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: '50%',
                          transform: 'translate(-50%, -8px)',
                          background: 'rgba(22,26,32,0.95)',
                          color: '#fff',
                          padding: '8px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontFamily: 'var(--noorix-font-numbers)',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                          zIndex: 10,
                        }}
                      >
                        {point.label} — {fmt(point.amount, 2)} ﷼
                      </div>
                    )}
                    <div
                      className="nx-w-full"
                      style={{
                        maxWidth: 36,
                        height: '100%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: `${Math.max(barHeightPct, point.amount > 0 ? 2 : 0)}%`,
                          minHeight: point.amount > 0 ? 4 : 0,
                          background: isHovered
                            ? 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)'
                            : 'linear-gradient(180deg, rgba(34,197,94,0.9) 0%, #16a34a 100%)',
                          borderRadius: '6px 6px 0 0',
                          transition: 'all 0.2s ease',
                          boxShadow: isHovered ? '0 -2px 8px rgba(22,163,74,0.3)' : '0 1px 3px rgba(0,0,0,0.08)',
                        }}
                      />
                    </div>
                    <div className="nx-text-muted nx-font-600 nx-nowrap" style={{ fontSize: 10 }}>{point.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* X-axis label */}
        <div className="nx-mt-8 nx-text-xs nx-text-muted nx-text-center" style={{ paddingRight: 52 }}>
          {isDailyChart ? `${t('reportYear')} ${year} — ${EN_MONTHS[month - 1]} — ${t('revenueGroup')}` : `${t('reportYear')} ${year} — ${t('revenueGroup')}`}
        </div>
          </>
        )}
      </div>

    </div>
  );
}
