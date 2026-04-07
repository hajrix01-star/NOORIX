/**
 * DashboardOverviewTab — نظرة عامة: كروت KPI + رسم بياني للمبيعات
 * تصميم نظيف احترافي — بدون فواتير قادمة أو مستحقة
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { PERMISSIONS } from '../../../constants/permissions';
import { useReportsGeneralProfitLoss } from '../../../hooks/useReports';
import PeriodAnalyticsStrip from '../../Reports/PeriodAnalyticsStrip';
import { useSales } from '../../../hooks/useSales';
import { CARD_COLORS } from '../../../utils/cardStyles';
import { EN_MONTHS, moneyText } from '../../../modules/Reports/reportHelpers';
import { fmt } from '../../../utils/format';

const MONTH_NAMES_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function lastDayOfMonth(year, month) { return new Date(year, month, 0).getDate(); }
function ymd(y, m, d) { return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function formatAxisValue(n) {
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(0)}K`;
  return String(Math.round(n));
}

/* ── أيقونات SVG للكروت ── */
function IconSales()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>; }
function IconPurchases() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>; }
function IconExpenses()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>; }
function IconProfit()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>; }

export default function DashboardOverviewTab({ companyId, year, selectedMonth, filter }) {
  const { t, lang } = useTranslation();
  const { companies, userPermissions } = useApp();
  const canPeriodAnalytics = (userPermissions || []).includes(PERMISSIONS.REPORTS_READ);
  const { data: report, isLoading, error } = useReportsGeneralProfitLoss({ companyId, year });

  const month   = selectedMonth ? Number(selectedMonth) : 1;
  const lastDay = lastDayOfMonth(year, month);
  const dailyStart = selectedMonth ? ymd(year, month, 1) : null;
  const dailyEnd   = selectedMonth ? ymd(year, month, lastDay) : null;
  const { summaries: dailySummaries } = useSales({
    companyId, startDate: dailyStart, endDate: dailyEnd, enabled: !!selectedMonth,
  });

  function getCardValue(key) {
    if (!report) return '0';
    if (!selectedMonth) return report.cards?.[key] || '0';
    if (key === 'grossProfit' || key === 'netProfit')
      return report.summaryRows?.find((r) => r.key === key)?.months?.[selectedMonth - 1] || '0';
    return report.groups?.find((r) => r.key === key)?.months?.[selectedMonth - 1] || '0';
  }

  function getSectionPercentOfSales(key) {
    if (!report || key === 'sales') return null;
    const sales = Number(getCardValue('sales') || 0);
    if (!sales || sales < 0.0000001) return null;
    return ((Number(getCardValue(key) || 0) / sales) * 100).toFixed(1);
  }

  const salesTimeline = useMemo(() => {
    const sg = report?.groups?.find((r) => r.key === 'sales');
    if (!sg?.months?.length) return [];
    return (sg.months || []).map((val, i) => ({
      month: i + 1, label: EN_MONTHS[i], amount: Number(val || 0),
    }));
  }, [report]);

  const dailyTimeline = useMemo(() => {
    if (!selectedMonth) return [];
    const byDay = new Map();
    (dailySummaries || []).forEach((s) => {
      const d = String(s.transactionDate || '').slice(0, 10);
      const dayNum = parseInt(d.slice(8, 10), 10);
      byDay.set(dayNum, (byDay.get(dayNum) || 0) + Number(s.totalAmount || 0));
    });
    const points = [];
    for (let d = 1; d <= lastDay; d++)
      points.push({ day: d, label: String(d), amount: byDay.get(d) || 0 });
    return points;
  }, [selectedMonth, dailySummaries, lastDay]);

  const chartData    = selectedMonth ? dailyTimeline : salesTimeline;
  const isDailyChart = !!selectedMonth;
  const maxSales     = useMemo(() => Math.max(1, ...chartData.map((p) => p.amount)), [chartData]);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const yAxisTicks   = useMemo(() => {
    if (maxSales <= 0) return [0, 1];
    const step = Math.max(1, Math.ceil(maxSales / 4));
    return Array.from({ length: 5 }, (_, i) => step * i);
  }, [maxSales]);

  const monthName = selectedMonth
    ? (lang === 'ar' ? MONTH_NAMES_AR[selectedMonth - 1] : MONTH_NAMES_EN[selectedMonth - 1])
    : null;

  /* ── تعريف الكروت ── */
  const cards = useMemo(() => [
    {
      key: 'sales', icon: <IconSales />,
      label: monthName ? `${t('revenueGroup')} — ${monthName}` : t('annualSales'),
      colorClass: 'nx-kpi-card--sales',
      badgeLabel: t('sectionToSalesRatio'), badgeValue: '100',
    },
    {
      key: 'purchases', icon: <IconPurchases />,
      label: monthName ? `${t('purchasesGroup')} — ${monthName}` : t('annualPurchases'),
      colorClass: 'nx-kpi-card--purchases',
      badgeLabel: t('purchasesToSalesRatio'),
    },
    {
      key: 'expenses', icon: <IconExpenses />,
      label: monthName ? `${t('expensesGroup')} — ${monthName}` : t('annualExpenses'),
      colorClass: 'nx-kpi-card--expenses',
      badgeLabel: t('sectionToSalesRatio'),
    },
    {
      key: 'grossProfit', icon: <IconProfit />,
      label: t('annualGrossProfit'),
      colorClass: null,  /* يُحدَّد ديناميكياً */
      badgeLabel: t('reportProfitMargin'),
    },
    {
      key: 'netProfit', icon: <IconProfit />,
      label: t('annualNetProfit'),
      colorClass: null,
      badgeLabel: t('reportProfitMargin'),
    },
  ], [monthName, t]);

  /* ── حالة: لا شركة مختارة ── */
  if (!companyId) {
    return (
      <div className="p-8 text-center text-noorix-muted">
        {t('pleaseSelectCompany')}
      </div>
    );
  }

  /* ── حالة: تحميل ── */
  if (isLoading) {
    return (
      <div className="p-8 text-center text-noorix-muted">
        <div className="nx-kpi-grid mb-6">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="nx-kpi-card min-h-[120px] bg-noorix-bg-muted shadow-none bg-[length:200%_100%] animate-[shimmer_1.4s_ease_infinite]" />
          ))}
        </div>
      </div>
    );
  }

  /* ── حالة: خطأ ── */
  if (error) {
    return (
      <div className="p-5 m-4 rounded-xl text-noorix-red bg-noorix-red/5 border border-noorix-red/20">
        {error.message}
      </div>
    );
  }

  const chartTotal = chartData.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="flex flex flex-col gap-6">

      {/* شريط التحليلات */}
      <PeriodAnalyticsStrip
        companyId={companyId}
        year={year}
        month={selectedMonth ?? null}
        enabled={canPeriodAnalytics}
      />

      {/* ── كروت KPI ── */}
      <div className="nx-kpi-grid">
        {cards.map((card) => {
          const rawVal  = getCardValue(card.key);
          const numVal  = Number(rawVal || 0);
          const pct     = card.key === 'sales' ? card.badgeValue : getSectionPercentOfSales(card.key);
          const isProfit = card.key === 'grossProfit' || card.key === 'netProfit';
          const colorClass = card.colorClass ?? (isProfit
            ? (numVal >= 0 ? 'nx-kpi-card--profit' : 'nx-kpi-card--loss')
            : 'nx-kpi-card--neutral');

          return (
            <div key={card.key} className={`nx-kpi-card ${colorClass}`}>
              {/* أيقونة */}
              <div className="nx-kpi-card__icon">{card.icon}</div>
              {/* عنوان */}
              <div className="nx-kpi-card__label">{card.label}</div>
              {/* القيمة */}
              <div className="nx-kpi-card__value">{moneyText(rawVal)}</div>
              {/* نسبة مئوية */}
              {pct != null && (
                <span className="nx-kpi-card__badge">
                  {card.badgeLabel}: {pct}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── الرسم البياني للمبيعات ── */}
      <div className="noorix-surface-card p-6">
        {/* رأس الرسم */}
        <div className="flex items-center justify-between gap-2 flex-wrap flex flex-wrap gap-2 mb-5">
          <div>
            <div className="text-[13px] font-bold">
              {t('dashboardSalesTimeline')}
            </div>
            <div className="text-[12px] text-noorix-muted mt-0.5">
              {filter?.label || year} — {isDailyChart ? t('reportMonthTotal') : t('reportAnnualTotal')}
            </div>
          </div>
          <div
            className="text-[15px] font-black nx-font-numbers"
            style={{ color: CARD_COLORS.sales.accent, direction: 'ltr' }}
          >
            {fmt(chartTotal, 2)} <span className="text-[13px] font-medium text-noorix-muted">SAR</span>
          </div>
        </div>

        {/* الرسم */}
        {chartData.length === 0 || chartTotal === 0 ? (
          <div className="flex flex-col items-center text-noorix-muted gap-2.5 min-h-[200px]">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <div className="text-[12px]">{t('noDataInPeriod')}</div>
          </div>
        ) : (
          <div className="relative">
            <div className="flex gap-0 min-h-[200px]">
              {/* محور Y */}
              <div className="shrink-0 w-12 flex flex-col justify-between pt-1 pb-6">
                {[...yAxisTicks].reverse().map((tick) => (
                  <div key={tick} className="text-noorix-muted font-semibold text-[10px] nx-font-numbers">
                    {formatAxisValue(tick)}
                  </div>
                ))}
              </div>

              {/* منطقة الأعمدة */}
              <div className="flex-1 min-w-0 relative overflow-hidden">
                {/* خطوط الشبكة */}
                <div className="absolute flex flex-col justify-between pointer-events-none inset-x-0 top-0 bottom-6">
                  {yAxisTicks.map((_, i) => (
                    <div key={i} className="h-px opacity-50 bg-noorix-border" />
                  ))}
                </div>

                {/* الأعمدة */}
                <div className="flex items-end h-[180px] pb-6" style={{ gap: chartData.length > 20 ? 2 : 4 }}>
                  {chartData.map((point) => {
                    const barH  = maxSales > 0 ? (point.amount / maxSales) * 100 : 0;
                    const pKey  = point.month ?? point.day;
                    const isHov = hoveredPoint === pKey;
                    const hasVal = point.amount > 0;
                    return (
                      <div
                        key={pKey}
                        className="flex-1 min-w-0 flex flex-col items-center relative"
                        onMouseEnter={() => setHoveredPoint(pKey)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        {/* Tooltip */}
                        {isHov && hasVal && (
                          <div style={{
                            position: 'absolute', bottom: '100%', left: '50%',
                            transform: 'translate(-50%, -6px)',
                            background: 'var(--noorix-navy-95)', color: 'white',
                            padding: '6px 10px', borderRadius: 8,
                            fontSize: 11, fontFamily: 'var(--noorix-font-numbers)', fontWeight: 700,
                            whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                            zIndex: 10, pointerEvents: 'none',
                          }}>
                            {point.label} — {fmt(point.amount, 2)} SAR
                          </div>
                        )}
                        {/* العمود */}
                        <div className="w-full h-full flex items-end justify-center">
                          <div style={{
                            width: chartData.length > 20 ? '80%' : '65%',
                            height: `${Math.max(barH, hasVal ? 2 : 0)}%`,
                            minHeight: hasVal ? 3 : 0,
                            background: isHov
                              ? 'linear-gradient(180deg, #22c55e 0%, #15803d 100%)'
                              : 'linear-gradient(180deg, rgba(34,197,94,0.85) 0%, #16a34a 100%)',
                            borderRadius: '5px 5px 0 0',
                            transition: 'height 0.3s ease, background 0.15s',
                            boxShadow: isHov ? '0 -2px 10px rgba(22,163,74,0.4)' : 'none',
                          }} />
                        </div>
                        {/* ملصق المحور X */}
                        {(chartData.length <= 12 || pKey % Math.ceil(chartData.length / 12) === 0) && (
                          <div className="text-noorix-muted font-semibold text-[9px] mt-1 whitespace-nowrap">
                            {point.label}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
