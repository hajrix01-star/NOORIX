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

const MONTH_NAMES_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function lastDayOfMonth(year, month) { return new Date(year, month, 0).getDate(); }
function ymd(y, m, d) { return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function fmtAxis(n) {
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(0)}K`;
  return String(Math.round(n));
}

/* ألوان الشريط الجانبي والسباركلاين حسب نوع الكرت */
const KPI_ACCENT = {
  sales: '#185FA5',
  grossProfit: '#3B6D11',
  netProfit: '#854F0B',
  purchases: '#888780',
  expenses: '#A32D2D',
};

const KPI_ACCENT_BAR = {
  sales: 'bg-[#185FA5]',
  grossProfit: 'bg-[#3B6D11]',
  netProfit: 'bg-[#854F0B]',
  purchases: 'bg-[#888780]',
  expenses: 'bg-[#A32D2D]',
};

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
  const { userPermissions } = useApp();
  const canPeriodAnalytics = (userPermissions || []).includes(PERMISSIONS.REPORTS_READ);
  const { data: report, isLoading, error } = useReportsGeneralProfitLoss({ companyId, year });

  const month    = selectedMonth ? Number(selectedMonth) : 1;
  const lastDay  = lastDayOfMonth(year, month);
  const dailyStart = selectedMonth ? ymd(year, month, 1)      : null;
  const dailyEnd   = selectedMonth ? ymd(year, month, lastDay) : null;

  /* ── بيانات التقويم اليومية ── */
  const { summaries: dailySummaries } = useSales({
    companyId, startDate: dailyStart, endDate: dailyEnd, enabled: !!selectedMonth,
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
    if (selectedMonth) {
      /* عرض يومي للشهر المختار */
      const byDay = new Map();
      (dailySummaries || []).forEach((s) => {
        const d = String(s.transactionDate || '').slice(0, 10);
        const dayNum = parseInt(d.slice(8, 10), 10);
        byDay.set(dayNum, (byDay.get(dayNum) || 0) + Number(s.totalAmount || 0));
      });
      return Array.from({ length: lastDay }, (_, i) => ({
        label: String(i + 1),
        [t('annualSales')]: byDay.get(i + 1) || 0,
      }));
    }
    /* عرض سنوي */
    const sg = report?.groups?.find((r) => r.key === 'sales');
    const pg = report?.groups?.find((r) => r.key === 'purchases');
    const eg = report?.groups?.find((r) => r.key === 'expenses');
    return EN_MONTHS.map((lbl, i) => ({
      label: lang === 'ar' ? MONTH_NAMES_AR[i] : lbl,
      [t('annualSales')]:     Number(sg?.months?.[i] || 0),
      [t('annualPurchases')]: Number(pg?.months?.[i] || 0),
      [t('annualExpenses')]:  Number(eg?.months?.[i] || 0),
    }));
  }, [report, selectedMonth, dailySummaries, lastDay, lang, t]);

  /* ── بيانات توزيع القنوات ── */
  const channelData = useMemo(() => {
    const src = selectedMonth ? (dailySummaries || []) : (yearSummaries || []);
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
  }, [yearSummaries, dailySummaries, selectedMonth, lang]);

  const perfTotal = useMemo(() =>
    performanceData.reduce((s, p) => s + Number(p[t('annualSales')] || 0), 0),
    [performanceData, t]
  );

  /* ── ثوابت السلاسل الزمنية — قبل أي return مشروط ── */
  const salesSeries   = t('annualSales');
  const purchSeries   = t('annualPurchases');
  const expSeries     = t('annualExpenses');
  const isAnnualChart = !selectedMonth;

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
                className="relative min-h-[168px] rounded-xl border-[0.5px] border-noorix-border bg-noorix-surface p-4 shadow-none bg-[length:200%_100%] animate-[shimmer_1.4s_ease_infinite]"
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

          const accentColor = KPI_ACCENT[card.key] || KPI_ACCENT.sales;
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
          const currencySuffix = lang === 'ar' ? 'ر.س' : 'SAR';

          return (
            <div
              key={card.key}
              className="relative flex min-h-[168px] min-w-0 flex-col overflow-hidden rounded-xl border-[0.5px] border-noorix-border bg-noorix-surface p-4 shadow-none"
            >
              <span
                className={`pointer-events-none absolute right-0 top-0 h-full w-1 ${KPI_ACCENT_BAR[card.key] || KPI_ACCENT_BAR.sales}`}
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

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-noorix-border pt-3" dir="ltr">
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
                {filter?.label || year}{selectedMonth ? ` — ${monthName}` : ''}
              </div>
            </div>
            {/* أزرار إخفاء/إظهار الخطوط */}
            <div className="flex items-center gap-2 flex-wrap">
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
              {selectedMonth ? monthName : year}
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
