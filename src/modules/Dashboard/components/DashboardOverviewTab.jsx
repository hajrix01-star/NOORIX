/**
 * DashboardOverviewTab — نظرة عامة: كروت KPI + رسم بياني للأداء + توزيع القنوات
 * تصميم 2026 — sparklines، Recharts AreaChart، PieChart
 */
import React, { useMemo, useState, useCallback } from 'react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { PERMISSIONS } from '../../../constants/permissions';
import { useReportsGeneralProfitLoss } from '../../../hooks/useReports';
import PeriodAnalyticsStrip from '../../Reports/PeriodAnalyticsStrip';
import { useSales } from '../../../hooks/useSales';
import { EN_MONTHS, amountText } from '../../../modules/Reports/reportHelpers';
import { fmt } from '../../../utils/format';
import { Button, cn } from '../../../ui';
import { useUiDir } from '../../../hooks/useUiDir';
import { KPI_CARD_SPARKLINE_COLORS, KPI_CARD_TOP_BAR_CLASS } from '../../../constants/kpiCardTheme';

const MONTH_NAMES_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function lastDayOfMonth(year, month) { return new Date(year, month, 0).getDate(); }

/** شهر السنة الحالية بتوقيت السعودية (للافتراض عند «كل الأشهر» + عرض يومي) */
function getSaudiYearMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date());
  const m = {};
  for (const p of parts) {
    if (p.type !== 'literal') m[p.type] = p.value;
  }
  return { year: parseInt(m.year, 10), month: parseInt(m.month, 10) };
}
function ymd(y, m, d) { return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function fmtAxis(n) {
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(0)}K`;
  return String(Math.round(n));
}

/* ── Sparkline — polyline + تعبئة شفافة؛ بدون بيانات: خط متقطع ── */
function SparkLine({ data = [], color = '#185FA5' }) {
  const W = 100;
  const H = 36;
  const pad = 3;
  const nums = (data || []).map((v) => Number(v || 0));
  const empty = !nums.length || nums.every((v) => v === 0);

  if (empty) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="36" className="block">
        <line
          x1={pad}
          y1={H / 2}
          x2={W - pad}
          y2={H / 2}
          className="stroke-noorix-border"
          strokeWidth="1"
          strokeDasharray="5 5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }

  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const range = Math.max(max - min, 1e-9);
  const n = nums.length;
  const xs = nums.map((_, i) => (n === 1 ? W / 2 : pad + (i / (n - 1)) * (W - 2 * pad)));
  const ys = nums.map((v) => pad + (1 - (v - min) / range) * (H - 2 * pad));
  const points = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const fillPoints = `${points} ${xs[n - 1]},${H} ${xs[0]},${H}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="36" className="block">
      <polygon points={fillPoints} fill={color} fillOpacity={0.08} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ── Custom Recharts Tooltip ── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--noorix-bg-surface)', border: '1px solid var(--noorix-border)', borderRadius: 6, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 12, minWidth: 140 }}>
      <div style={{ fontWeight: 700, marginBottom: 5, color: 'var(--noorix-text)', fontSize: 11 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: p.color, fontWeight: 600, marginTop: 2 }}>
          <span>{p.name}</span>
          <span style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(p.value, 0)} SR</span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={{ background: 'var(--noorix-bg-surface)', border: '1px solid var(--noorix-border)', borderRadius: 6, padding: '7px 11px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: p.payload.fill }}>{p.name}</div>
      <div style={{ fontFamily: 'var(--noorix-font-numbers)', fontWeight: 700, color: 'var(--noorix-text)' }}>{fmt(p.value, 0)} SR</div>
      <div style={{ color: 'var(--noorix-text-muted)', fontSize: 11 }}>{p.payload.pct}%</div>
    </div>
  );
}

const PIE_COLORS = ['#2563eb','#16a34a','#d97706','#7c3aed','#db2777','#0891b2','#ea580c','#65a30d'];

export default function DashboardOverviewTab({ companyId, year, selectedMonth, filter }) {
  const { t, lang } = useTranslation();
  const uiDir = useUiDir();
  const { userPermissions } = useApp();
  const canPeriodAnalytics = (userPermissions || []).includes(PERMISSIONS.REPORTS_READ);
  const { data: report, isLoading, error } = useReportsGeneralProfitLoss({ companyId, year });

  const [timelineGrain, setTimelineGrain] = useState(() => (selectedMonth != null ? 'daily' : 'monthly'));

  const saudiYM = getSaudiYearMonth();
  /** شهر المخطط اليومي: من الفلتر أو (سنة حالية → شهر السعودية) وإلا يناير */
  const chartMonthForDaily =
    selectedMonth != null ? selectedMonth : (year === saudiYM.year ? saudiYM.month : 1);
  const lastDayChart = lastDayOfMonth(year, chartMonthForDaily);
  const dailyStart = timelineGrain === 'daily' ? ymd(year, chartMonthForDaily, 1) : null;
  const dailyEnd   = timelineGrain === 'daily' ? ymd(year, chartMonthForDaily, lastDayChart) : null;

  /* ── بيانات المبيعات اليومية (للمخطط اليومي وقسم القنوات عند العرض اليومي) ── */
  const { summaries: dailySummaries } = useSales({
    companyId, startDate: dailyStart, endDate: dailyEnd, enabled: timelineGrain === 'daily',
  });

  /* ── بيانات السنة الكاملة لتوزيع القنوات ── */
  const yearStart = `${year}-01-01`;
  const yearEnd   = `${year}-12-31`;
  const { summaries: yearSummaries } = useSales({ companyId, startDate: yearStart, endDate: yearEnd });

  /* ── دوال القيم ── */
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

  /* ── sparkline data لكل بطاقة ── */
  function getMonthlyData(key) {
    if (!report) return [];
    if (key === 'grossProfit' || key === 'netProfit')
      return report.summaryRows?.find((r) => r.key === key)?.months || [];
    return report.groups?.find((r) => r.key === key)?.months || [];
  }

  const monthName = selectedMonth
    ? (lang === 'ar' ? MONTH_NAMES_AR[selectedMonth - 1] : MONTH_NAMES_EN[selectedMonth - 1])
    : null;

  /* ── تعريف الكروت ── */
  const cards = useMemo(() => [
    { key: 'sales',       label: monthName ? `${t('revenueGroup')} — ${monthName}` : t('annualSales'),       badgeLabel: t('sectionToSalesRatio') },
    { key: 'purchases',   label: monthName ? `${t('purchasesGroup')} — ${monthName}` : t('annualPurchases'), badgeLabel: t('purchasesToSalesRatio') },
    { key: 'expenses',    label: monthName ? `${t('expensesGroup')} — ${monthName}` : t('annualExpenses'),   badgeLabel: t('sectionToSalesRatio') },
    { key: 'grossProfit', label: t('annualGrossProfit'), badgeLabel: t('reportProfitMargin') },
    { key: 'netProfit',   label: t('annualNetProfit'),   badgeLabel: t('reportProfitMargin') },
  ], [monthName, t]);

  /* ── بيانات الرسم البياني للأداء (Recharts) ── */
  const performanceData = useMemo(() => {
    if (timelineGrain === 'daily') {
      const byDay = new Map();
      (dailySummaries || []).forEach((s) => {
        const d = String(s.transactionDate || '').slice(0, 10);
        const dayNum = parseInt(d.slice(8, 10), 10);
        byDay.set(dayNum, (byDay.get(dayNum) || 0) + Number(s.totalAmount || 0));
      });
      return Array.from({ length: lastDayChart }, (_, i) => ({
        label: String(i + 1),
        [t('annualSales')]: byDay.get(i + 1) || 0,
      }));
    }
    const sg = report?.groups?.find((r) => r.key === 'sales');
    const pg = report?.groups?.find((r) => r.key === 'purchases');
    const eg = report?.groups?.find((r) => r.key === 'expenses');
    return EN_MONTHS.map((lbl, i) => ({
      label: lang === 'ar' ? MONTH_NAMES_AR[i] : lbl,
      [t('annualSales')]:     Number(sg?.months?.[i] || 0),
      [t('annualPurchases')]: Number(pg?.months?.[i] || 0),
      [t('annualExpenses')]:  Number(eg?.months?.[i] || 0),
    }));
  }, [report, timelineGrain, dailySummaries, lastDayChart, lang, t]);

  /* ── بيانات توزيع القنوات ── */
  const channelData = useMemo(() => {
    const src = timelineGrain === 'daily' ? (dailySummaries || []) : (yearSummaries || []);
    const map = {};
    src.forEach((s) =>
      (s.channels || []).forEach((ch) => {
        const name = lang === 'ar'
          ? (ch.vault?.nameAr || ch.vault?.nameEn || '—')
          : (ch.vault?.nameEn || ch.vault?.nameAr || '—');
        map[name] = (map[name] || 0) + Number(ch.amount || 0);
      })
    );
    const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, pct: ((value / total) * 100).toFixed(1) }))
      .sort((a, b) => b.value - a.value);
  }, [yearSummaries, dailySummaries, timelineGrain, lang]);

  const perfTotal = useMemo(() =>
    performanceData.reduce((s, p) => s + Number(p[t('annualSales')] || 0), 0),
    [performanceData, t]
  );

  /* ── ثوابت السلاسل الزمنية — قبل أي return مشروط ── */
  const salesSeries   = t('annualSales');
  const purchSeries   = t('annualPurchases');
  const expSeries     = t('annualExpenses');
  const isAnnualChart = timelineGrain === 'monthly';

  /* ── حالة إخفاء/إظهار الخطوط — يجب أن تكون قبل أي return مشروط ── */
  const [hiddenSeries, setHiddenSeries] = useState(new Set());
  const toggleSeries = useCallback((key) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const SERIES = useMemo(() => [
    { key: salesSeries,  label: t('annualSales'),    color: '#16a34a', gradId: 'gradSales', disabled: false },
    { key: purchSeries,  label: t('annualPurchases'), color: '#2563eb', gradId: 'gradPurch', disabled: !isAnnualChart },
    { key: expSeries,    label: t('annualExpenses'),  color: '#d97706', gradId: 'gradExp',   disabled: !isAnnualChart },
  ], [salesSeries, purchSeries, expSeries, isAnnualChart, t]);

  const timelineMonthName =
    lang === 'ar' ? MONTH_NAMES_AR[chartMonthForDaily - 1] : MONTH_NAMES_EN[chartMonthForDaily - 1];

  /* ── حالة: لا شركة ── */
  if (!companyId) {
    return <div className="p-8 text-center text-noorix-muted">{t('pleaseSelectCompany')}</div>;
  }

  /* ── حالة: تحميل ── */
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="nx-kpi-container">
          <div className="nx-kpi-grid">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="noorix-surface-card relative min-h-[168px] overflow-hidden p-4 bg-[linear-gradient(110deg,var(--noorix-bg-muted)_0%,var(--noorix-bg-surface)_45%,var(--noorix-bg-muted)_90%)] bg-[length:200%_100%] animate-[shimmer_1.4s_ease_infinite]"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── حالة: خطأ ── */
  if (error) {
    return (
      <div className="p-5 m-4 rounded text-noorix-red bg-noorix-red/5 border border-noorix-red/20">
        {error.message}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* شريط التحليلات */}
      <PeriodAnalyticsStrip
        companyId={companyId}
        year={year}
        month={selectedMonth ?? null}
        enabled={canPeriodAnalytics}
      />

      {/* ── كروت KPI — الغلاف يحمل container-type ── */}
      <div className="nx-kpi-container">
      <div className="nx-kpi-grid">
        {cards.map((card) => {
          const rawVal = getCardValue(card.key);
          const isProfit = card.key === 'grossProfit' || card.key === 'netProfit';
          const isSales = card.key === 'sales';
          const pct = isSales ? null : getSectionPercentOfSales(card.key);
          const pctNum = pct != null ? Number(pct) : null;

          const accentColor = KPI_CARD_SPARKLINE_COLORS[card.key] || KPI_CARD_SPARKLINE_COLORS.sales;
          const sparkData = getMonthlyData(card.key);

          let badgeTone = 'neutral';
          let arrow = '';
          if (isProfit && pctNum != null) {
            if (pctNum > 0) {
              badgeTone = 'positive';
              arrow = '↑ ';
            } else if (pctNum < 0) {
              badgeTone = 'negative';
              arrow = '↓ ';
            } else {
              badgeTone = 'zero';
              arrow = '';
            }
          } else if (!isSales && pctNum != null) {
            badgeTone = 'zero';
            arrow = '↓ ';
          }

          const badgeClass =
            badgeTone === 'positive'
              ? 'bg-[#eaf3de] text-[#3B6D11]'
              : badgeTone === 'negative'
                ? 'bg-[#FCEBEB] text-[#A32D2D]'
                : 'bg-noorix-bg-muted text-noorix-muted';

          const periodLabel = filter?.label || String(year);
          const currencySuffix = 'SA';

          return (
            <div
              key={card.key}
              className="noorix-surface-card relative flex min-h-[168px] min-w-0 flex-col overflow-hidden p-4"
            >
              <span
                className={`pointer-events-none absolute inset-x-0 top-0 h-1 ${KPI_CARD_TOP_BAR_CLASS[card.key] || KPI_CARD_TOP_BAR_CLASS.sales}`}
                aria-hidden
              />

              <div className="text-[12px] font-medium text-noorix-muted">{card.label}</div>

              <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span
                  dir="ltr"
                  className="nx-font-numbers text-[22px] font-bold leading-tight tracking-[-0.5px] text-noorix-text text-start"
                >
                  {amountText(rawVal)}
                </span>
                <span className="text-[12px] font-medium text-noorix-muted">{currencySuffix}</span>
              </div>

              <div className="mt-3 min-h-[36px] w-full min-w-0 flex-1">
                <SparkLine data={sparkData} color={accentColor} />
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-noorix-border pt-3">
                <span className="min-w-0 truncate text-[11px] font-medium text-noorix-muted">{periodLabel}</span>
                {!isSales && pctNum != null ? (
                  <span
                    className={`inline-flex max-w-[min(100%,140px)] shrink-0 items-center truncate rounded px-2 py-0.5 text-[11px] font-bold ${badgeClass}`}
                    title={`${card.badgeLabel}: ${arrow}${Math.abs(pctNum)}%`}
                  >
                    {arrow}
                    {Math.abs(pctNum)}%
                  </span>
                ) : (
                  <span className="max-w-[min(100%,140px)] truncate text-end text-[11px] font-medium text-noorix-muted">
                    {card.badgeLabel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>{/* /nx-kpi-container */}

      {/* ── الرسوم البيانية: الأداء الشهري + توزيع القنوات ── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: channelData.length > 0 ? '1fr 340px' : '1fr' }}>

        {/* تحليل الأداء الشهري */}
        <div className="noorix-surface-card p-5">
          {/* رأس: العنوان + الإجمالي + أزرار Toggle */}
          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div>
              <div className="text-[14px] font-bold text-noorix-text">{t('dashboardSalesTimeline')}</div>
              <div className="text-[12px] text-noorix-muted mt-0.5">
                {timelineGrain === 'monthly'
                  ? String(year)
                  : `${timelineMonthName} — ${year}`}
              </div>
            </div>
            {/* يومي / شهري + إخفاء/إظهار الخطوط */}
            <div className="flex items-center gap-2 flex-wrap">
              <div
                role="tablist"
                dir={uiDir}
                className="inline-flex shrink-0 items-stretch rounded-lg border border-noorix-border bg-noorix-bg-muted p-0.5"
              >
                <Button
                  type="button"
                  role="tab"
                  aria-selected={timelineGrain === 'monthly'}
                  variant="raw"
                  size="auto"
                  className={cn(
                    'min-h-9 rounded-md px-3 py-1.5 text-[12px] font-semibold sm:min-h-8 sm:py-1',
                    timelineGrain === 'monthly'
                      ? 'bg-noorix-surface text-noorix-text shadow-sm'
                      : 'text-noorix-muted hover:bg-noorix-surface/60 hover:text-noorix-text',
                  )}
                  data-active={timelineGrain === 'monthly' ? 'true' : 'false'}
                  onClick={() => setTimelineGrain('monthly')}
                >
                  {t('dashboardTimelineMonthly')}
                </Button>
                <Button
                  type="button"
                  role="tab"
                  aria-selected={timelineGrain === 'daily'}
                  variant="raw"
                  size="auto"
                  className={cn(
                    'min-h-9 rounded-md px-3 py-1.5 text-[12px] font-semibold sm:min-h-8 sm:py-1',
                    timelineGrain === 'daily'
                      ? 'bg-noorix-surface text-noorix-text shadow-sm'
                      : 'text-noorix-muted hover:bg-noorix-surface/60 hover:text-noorix-text',
                  )}
                  data-active={timelineGrain === 'daily' ? 'true' : 'false'}
                  onClick={() => setTimelineGrain('daily')}
                >
                  {t('dashboardTimelineDaily')}
                </Button>
              </div>
              {SERIES.map((s) => {
                const hidden   = hiddenSeries.has(s.key);
                const disabled = s.disabled;
                return (
                  <button
                    key={s.key}
                    onClick={() => !disabled && toggleSeries(s.key)}
                    title={disabled ? (lang === 'ar' ? 'بيانات يومية غير متاحة' : 'Daily data unavailable') : undefined}
                    style={{
                      borderColor: s.color,
                      color:       hidden || disabled ? 'var(--noorix-text-muted)' : s.color,
                      background:  hidden || disabled ? 'transparent' : `${s.color}14`,
                      opacity:     disabled ? 0.4 : 1,
                      cursor:      disabled ? 'not-allowed' : 'pointer',
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-600 rounded border transition-all duration-150 select-none"
                  >
                    <span
                      className="inline-block w-3 h-0.5 rounded-full flex-shrink-0"
                      style={{ background: hidden || disabled ? 'var(--noorix-border)' : s.color }}
                    />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* الرسم البياني */}
          {performanceData.length === 0 || perfTotal === 0 ? (
            <div className="flex flex-col items-center justify-center text-noorix-muted gap-2 h-[220px]">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              <div className="text-[12px]">{t('noDataInPeriod')}</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={performanceData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <defs>
                  {SERIES.map((s) => (
                    <linearGradient key={s.gradId} id={s.gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={s.color} stopOpacity={0.22}/>
                      <stop offset="95%" stopColor={s.color} stopOpacity={0.02}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--noorix-border)" opacity={0.6} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)', fontFamily: 'var(--noorix-font-primary)' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tickFormatter={fmtAxis}
                  tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)' }}
                  axisLine={false} tickLine={false} width={46}
                />
                <Tooltip content={<ChartTooltip />} />
                {SERIES.map((s) => (
                  !hiddenSeries.has(s.key) && !s.disabled && (
                    <Area
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      stroke={s.color}
                      strokeWidth={2}
                      fill={`url(#${s.gradId})`}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* توزيع المبيعات حسب القنوات */}
        {channelData.length > 0 && (
          <div className="noorix-surface-card p-5 flex flex-col">
            <div className="text-[14px] font-bold text-noorix-text mb-1">{t('reportChannels')}</div>
            <div className="text-[12px] text-noorix-muted mb-4">
              {timelineGrain === 'daily' ? timelineMonthName : year}
            </div>

            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={channelData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {channelData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* قائمة القنوات */}
            <div className="flex flex-col gap-1.5 mt-3">
              {channelData.slice(0, 5).map((ch, i) => (
                <div key={ch.name} className="flex items-center justify-between gap-2 text-[12px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-noorix-text truncate">{ch.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="nx-font-numbers font-bold text-noorix-text">{fmt(ch.value, 0)}</span>
                    <span className="text-noorix-muted">({ch.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
