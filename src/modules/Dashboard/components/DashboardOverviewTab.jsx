/**
 * DashboardOverviewTab — نظرة عامة: كروت KPI + رسم بياني للأداء + توزيع القنوات
 * تصميم 2026 — sparklines، Recharts AreaChart، PieChart
 */
import React, { useMemo, useState, useCallback } from 'react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
  BarChart, Bar, LabelList,
} from 'recharts';
import { useTranslation } from '../../../i18n/useTranslation';
import { useReportsGeneralProfitLoss, usePeriodAnalytics } from '../../../hooks/useReports';
import { monthDateBounds } from '../../../utils/reportDrillLinks';
import { useDashboardSalesPack } from '../../../hooks/useDashboardSalesPack';
import { EN_MONTHS, amountText } from '../../../modules/Reports/reportHelpers';
import { fmt } from '../../../utils/format';
import { Button, cn, FmtNum, MetricCard } from '../../../ui';
import { KPI_RECHARTS_COLORS, VAULT_RECHARTS_COLORS } from '../../../constants/kpiCardTheme';
import { useUiDir } from '../../../hooks/useUiDir';
import { KPI_CARD_SPARKLINE_COLORS } from '../../../constants/kpiCardTheme';

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
      <div style={{ fontFamily: 'var(--noorix-font-numbers)', fontWeight: 700, color: 'var(--noorix-text)' }} className="ltr">
        {fmt(p.value)} <span className="nx-sar">SR</span>
      </div>
      <div style={{ color: 'var(--noorix-text-muted)', fontSize: 11 }}>{p.payload.pct}%</div>
    </div>
  );
}

/* باليت قنوات البيع — من الأحدث استخداماً: بنكي، نقدي، تطبيق، ثم تكميلية */
const PIE_COLORS = [
  VAULT_RECHARTS_COLORS.bank,   // #185FA5 أزرق داكن
  VAULT_RECHARTS_COLORS.cash,   // #3B6D11 أخضر داكن
  VAULT_RECHARTS_COLORS.app,    // #7c3aed بنفسجي
  KPI_RECHARTS_COLORS.netProfit,// #854F0B كهرماني
  KPI_RECHARTS_COLORS.expenses, // #A32D2D أحمر
  KPI_RECHARTS_COLORS.purchases,// #888780 رمادي
  '#0891b2', '#db2777',         // تكميلية
];

export default function DashboardOverviewTab({ companyId, year, selectedMonth, filter }) {
  const { t, lang } = useTranslation();
  const uiDir = useUiDir();
  const { data: report, isLoading, error } = useReportsGeneralProfitLoss({ companyId, year });

  const [timelineGrain, setTimelineGrain] = useState(() => (selectedMonth != null ? 'daily' : 'monthly'));

  const saudiYM = getSaudiYearMonth();
  /** شهر المخطط اليومي: من الفلتر أو (سنة حالية → شهر السعودية) وإلا يناير */
  const chartMonthForDaily =
    selectedMonth != null ? selectedMonth : (year === saudiYM.year ? saudiYM.month : 1);
  const lastDayChart = lastDayOfMonth(year, chartMonthForDaily);
  const dailyStart = timelineGrain === 'daily' ? ymd(year, chartMonthForDaily, 1) : null;
  const dailyEnd   = timelineGrain === 'daily' ? ymd(year, chartMonthForDaily, lastDayChart) : null;

  const yearStart = `${year}-01-01`;
  const yearEnd   = `${year}-12-31`;

  const monthSalesAvgBounds = useMemo(() => {
    if (selectedMonth == null) return { start: null, end: null };
    const ld = lastDayOfMonth(year, selectedMonth);
    return { start: ymd(year, selectedMonth, 1), end: ymd(year, selectedMonth, ld) };
  }, [year, selectedMonth]);

  /* ── ملخصات المبيعات: طلب واحد للسنة + اليومي + الشهر (بدل ثلاث حلقات pagination) ── */
  const {
    dailySummaries,
    yearSummaries,
    monthSummaries: monthSalesForDailyAvg,
    isLoading: salesPackLoading,
  } = useDashboardSalesPack({
    companyId,
    yearStart,
    yearEnd,
    dailyStart: timelineGrain === 'daily' ? dailyStart : null,
    dailyEnd: timelineGrain === 'daily' ? dailyEnd : null,
    monthStart: monthSalesAvgBounds.start,
    monthEnd: monthSalesAvgBounds.end,
    enabled: !!companyId,
  });

  /** متوسط يومي للإيراد: المجموع ÷ عدد الأيام التي فيها إيراد &gt; 0 (شهر مُختار فقط) */
  const revenueDailyAvgActiveDays = useMemo(() => {
    if (!monthSalesForDailyAvg?.length) return null;
    const byDay = new Map();
    monthSalesForDailyAvg.forEach((s) => {
      const d = String(s.transactionDate || '').slice(0, 10);
      byDay.set(d, (byDay.get(d) || 0) + Number(s.totalAmount || 0));
    });
    let sum = 0;
    let n = 0;
    for (const amt of byDay.values()) {
      if (amt > 0) {
        sum += amt;
        n += 1;
      }
    }
    if (n === 0) return null;
    return sum / n;
  }, [monthSalesForDailyAvg]);

  /* ── بيانات أعلى الموردين + فئاتهم ── */
  const { from: supplierFrom, to: supplierTo } = useMemo(
    () => monthDateBounds(year, selectedMonth ?? null),
    [year, selectedMonth],
  );
  const { data: periodData, isLoading: isPeriodLoading } = usePeriodAnalytics({
    companyId, startDate: supplierFrom, endDate: supplierTo, enabled: !!companyId,
  });
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

  /** نسبة من المبيعات لكل كرت (المبيعات = 100٪ عند وجود مبيعات) */
  function getPctStringForCard(key) {
    if (key === 'sales') {
      const sales = Number(getCardValue('sales') || 0);
      return sales > 0 ? (100).toFixed(1) : null;
    }
    return getSectionPercentOfSales(key);
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
    { key: 'sales',       label: monthName ? `${t('revenueGroup')} — ${monthName}` : t('annualSales'),       formulaKey: 'dashboardKpiFormulaSales',       pctLabelKey: 'dashboardKpiPctSales' },
    { key: 'purchases',   label: monthName ? `${t('purchasesGroup')} — ${monthName}` : t('annualPurchases'), formulaKey: 'dashboardKpiFormulaPurchases', pctLabelKey: 'purchasesToSalesRatio' },
    { key: 'expenses',    label: monthName ? `${t('expensesGroup')} — ${monthName}` : t('annualExpenses'),   formulaKey: 'dashboardKpiFormulaExpenses',   pctLabelKey: 'expensesToSalesRatio' },
    { key: 'grossProfit', label: t('annualGrossProfit'), formulaKey: 'dashboardKpiFormulaGrossProfit', pctLabelKey: 'dashboardKpiPctGrossProfit' },
    { key: 'netProfit',   label: t('annualNetProfit'),   formulaKey: 'dashboardKpiFormulaNetProfit',   pctLabelKey: 'dashboardKpiPctNetProfit' },
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

  /* ── بيانات رسم بياني أعلى الموردين ── */
  const topSuppliersChartData = useMemo(() => {
    const list = (periodData?.topSuppliers || []).slice(0, 8);
    const total = list.reduce((s, x) => s + Number(x.totalAmount || 0), 0) || 1;
    return list.map((s, i) => ({
      name: (lang === 'ar' ? s.nameAr || s.nameEn : s.nameEn || s.nameAr) || '—',
      value: Number(s.totalAmount || 0),
      count: s.invoiceCount || 0,
      pct: ((Number(s.totalAmount || 0) / total) * 100).toFixed(1),
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [periodData, lang]);

  /* ── مشتريات حسب فئة الفاتورة (فواتير مشتريات) — نفس فترة أعلى الموردين ── */
  const purchaseCategoriesData = useMemo(() => {
    const raw = periodData?.purchaseCategoryBreakdown;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const total = Number(periodData?.purchaseCategoryTotal) || raw.reduce((s, r) => s + Number(r.amount || 0), 0) || 1;
    return raw.map((row, i) => {
      const amt = Number(row.amount || 0);
      return {
        name: lang === 'ar' ? row.nameAr : (row.nameEn || row.nameAr) || '—',
        value: amt,
        pct: ((amt / total) * 100).toFixed(1),
        fill: PIE_COLORS[i % PIE_COLORS.length],
      };
    });
  }, [periodData, lang]);

  /** دمج الفئات بعد الخامسة في «أخرى» ليتطابق المخطط مع القائمة والإجمالي */
  const purchaseCategoriesPieData = useMemo(() => {
    if (purchaseCategoriesData.length === 0) return [];
    if (purchaseCategoriesData.length <= 6) return purchaseCategoriesData;
    const top = purchaseCategoriesData.slice(0, 5);
    const rest = purchaseCategoriesData.slice(5);
    const othersValue = rest.reduce((s, r) => s + r.value, 0);
    const total = purchaseCategoriesData.reduce((s, r) => s + r.value, 0) || 1;
    return [
      ...top,
      {
        name: t('dashboardPurchasesByCategoryOthers'),
        value: othersValue,
        pct: ((othersValue / total) * 100).toFixed(1),
        fill: PIE_COLORS[5 % PIE_COLORS.length],
      },
    ];
  }, [purchaseCategoriesData, t]);

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
    { key: salesSeries,  label: t('annualSales'),     color: KPI_RECHARTS_COLORS.sales,     gradId: 'gradSales', disabled: false },
    { key: purchSeries,  label: t('annualPurchases'),  color: KPI_RECHARTS_COLORS.purchases,  gradId: 'gradPurch', disabled: !isAnnualChart },
    { key: expSeries,    label: t('annualExpenses'),   color: KPI_RECHARTS_COLORS.expenses,   gradId: 'gradExp',   disabled: !isAnnualChart },
  ], [salesSeries, purchSeries, expSeries, isAnnualChart, t]);

  const timelineMonthName =
    lang === 'ar' ? MONTH_NAMES_AR[chartMonthForDaily - 1] : MONTH_NAMES_EN[chartMonthForDaily - 1];

  /* ── حالة: لا شركة ── */
  if (!companyId) {
    return <div className="p-8 text-center text-noorix-muted">{t('pleaseSelectCompany')}</div>;
  }

  /* ── حالة: تحميل ── */
  if (isLoading || salesPackLoading) {
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

      {/* ── رسوم بيانية: أعلى الموردين + مشتريات الفئات (فواتير مشتريات) ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">

        {/* أعلى الموردين — أفقي */}
        <div className="noorix-surface-card p-4 lg:p-5">
          <div className="text-[14px] font-bold text-noorix-text mb-0.5 max-lg:text-center lg:text-start">
            {t('periodAnalyticsTopSuppliers')}
          </div>
          <div className="text-[12px] text-noorix-muted mb-4 max-lg:text-center lg:text-start">
            {supplierFrom} — {supplierTo}
          </div>
          {isPeriodLoading ? (
            <div className="h-[220px] flex items-center justify-center text-noorix-muted text-[12px]">{t('loading')}</div>
          ) : topSuppliersChartData.length === 0 ? (
            <div className="h-[220px] flex flex-col items-center justify-center text-noorix-muted gap-2">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <div className="text-[12px]">{t('noDataInPeriod')}</div>
            </div>
          ) : (
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={Math.max(220, topSuppliersChartData.length * 40)}>
                <BarChart
                  layout="vertical"
                  data={topSuppliersChartData}
                  margin={{ top: 0, right: 56, left: 0, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    tickFormatter={fmtAxis}
                    tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fontSize: 11, fill: 'var(--noorix-text)', fontFamily: 'var(--noorix-font-primary)' }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div style={{ background: 'var(--noorix-bg-surface)', border: '1px solid var(--noorix-border)', borderRadius: 6, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 12, minWidth: 160 }}>
                          <div style={{ fontWeight: 700, marginBottom: 4, color: d?.fill }}>{d?.name}</div>
                          <div style={{ color: 'var(--noorix-text)', fontWeight: 600, fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(d?.value, 0)} SR</div>
                          <div style={{ color: 'var(--noorix-text-muted)', fontSize: 11, marginTop: 2 }}>{d?.count} {lang === 'ar' ? 'فاتورة' : 'inv.'} · {d?.pct}%</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {topSuppliersChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v) => fmt(v, 0)}
                      style={{ fontSize: 10, fill: 'var(--noorix-text-muted)', fontFamily: 'var(--noorix-font-numbers)' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* مشتريات الفئات — donut — فواتير kind=purchase حسب categoryId */}
        <div className="noorix-surface-card p-4 lg:p-5 flex flex-col max-lg:items-center">
          <div className="text-[14px] font-bold text-noorix-text mb-0.5 w-full max-lg:text-center lg:text-start">
            {selectedMonth != null ? t('dashboardPurchasesByCategoryTitleMonth') : t('dashboardPurchasesByCategoryTitlePeriod')}
          </div>
          <div className="text-[12px] text-noorix-muted mb-1 w-full max-lg:text-center lg:text-start">
            {supplierFrom} — {supplierTo}
          </div>
          <div className="text-[12px] text-noorix-muted mb-4 w-full max-lg:text-center lg:text-start">
            {t('dashboardPurchasesTotalForPeriod')}:{' '}
            {isPeriodLoading ? (
              '…'
            ) : (
              <>
                <span className="font-bold text-noorix-text ltr">{fmt(Number(periodData?.purchaseCategoryTotal || 0))}</span>{' '}
                <span className="nx-sar">SR</span>
              </>
            )}
          </div>
          {isPeriodLoading ? (
            <div className="h-[170px] flex items-center justify-center text-noorix-muted text-[12px]">{t('loading')}</div>
          ) : purchaseCategoriesPieData.length === 0 ? (
            <div className="h-[170px] flex flex-col items-center justify-center text-noorix-muted text-[12px] gap-2 text-center px-1">
              <div>{t('dashboardNoPurchasesByCategory')}</div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={purchaseCategoriesPieData}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={78}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {purchaseCategoriesPieData.map((entry, i) => (
                      <Cell key={`${entry.name}-${i}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 mt-3 w-full max-lg:max-w-md">
                {purchaseCategoriesPieData.map((cat, idx) => (
                  <div key={`${cat.name}-${idx}`} className="flex items-center justify-between gap-2 text-[12px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: cat.fill }} />
                      <span className="text-noorix-text truncate">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-bold text-noorix-text ltr">{fmt(cat.value)}</span>
                      <span className="nx-sar">SR</span>
                      <span className="text-noorix-muted">({cat.pct}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── كروت KPI — الغلاف يحمل container-type ── */}
      <div className="nx-kpi-container">
      <div className="nx-kpi-grid">
        {cards.map((card) => {
          const rawVal = getCardValue(card.key);
          const isProfit = card.key === 'grossProfit' || card.key === 'netProfit';
          const isSales = card.key === 'sales';
          const pct = getPctStringForCard(card.key);
          const pctNum = pct != null ? Number(pct) : null;

          const accentColor = KPI_CARD_SPARKLINE_COLORS[card.key] || KPI_CARD_SPARKLINE_COLORS.sales;
          const sparkData = getMonthlyData(card.key);

          let badgeTone = 'neutral';
          let arrow = '';
          if (isSales && pctNum != null) {
            badgeTone = 'neutral';
            arrow = '';
          } else if (isProfit && pctNum != null) {
            if (pctNum > 0) { badgeTone = 'positive'; arrow = '↑ '; }
            else if (pctNum < 0) { badgeTone = 'negative'; arrow = '↓ '; }
          } else if (!isSales && pctNum != null) {
            badgeTone = 'zero'; arrow = '↓ ';
          }

          const badgeClass =
            badgeTone === 'positive' ? 'bg-[#eaf3de] text-[#3B6D11]' :
            badgeTone === 'negative' ? 'bg-[#FCEBEB] text-[#A32D2D]' :
            'bg-noorix-bg-muted text-noorix-muted';

          const periodLabel = filter?.label || String(year);
          const pctLabelText = t(card.pctLabelKey);
          const pctTitle = pctNum != null ? `${pctLabelText}: ${arrow}${Math.abs(pctNum)}%` : pctLabelText;

          return (
            <MetricCard key={card.key} color={accentColor} className="min-h-[188px]">
              <MetricCard.Header label={card.label} subLabel={t(card.formulaKey)} />
              {isSales && revenueDailyAvgActiveDays != null ? (
                <div className="px-4 mt-1">
                  <div className="flex w-full min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <div
                      dir="ltr"
                      className="nx-font-numbers inline-flex shrink-0 items-baseline gap-x-1 text-[22px] font-bold leading-tight tracking-[-0.5px] text-noorix-text"
                      style={{ fontFamily: 'var(--noorix-font-numbers)' }}
                    >
                      {amountText(rawVal)}
                      <span className="nx-sar">SR</span>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-baseline justify-end gap-x-1.5 text-end">
                      <span className="text-[11px] text-noorix-muted">{t('dashboardSalesDailyAvgActiveDays')}</span>
                      <span className="text-[15px] font-semibold text-noorix-blue nx-font-numbers ltr whitespace-nowrap">
                        <FmtNum n={revenueDailyAvgActiveDays} /> <span className="nx-sar">SR</span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <MetricCard.Value value={amountText(rawVal)} currency="SR" />
              )}
              <MetricCard.Spark data={sparkData} color={accentColor} grow />
              <MetricCard.Footer className="mt-3 flex flex-col gap-1.5 border-t border-noorix-border pt-3 pb-3">
                <span className="min-w-0 truncate text-[11px] font-medium text-noorix-muted">{periodLabel}</span>
                <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                  <span className="min-w-0 max-w-[min(100%,calc(100%-3.5rem))] text-[10px] leading-snug text-noorix-muted">
                    {pctLabelText}
                  </span>
                  {pctNum != null ? (
                    <span
                      className={`inline-flex max-w-[min(100%,140px)] shrink-0 items-center truncate rounded px-2 py-0.5 text-[11px] font-bold ${badgeClass}`}
                      title={pctTitle}
                    >
                      {arrow}{Math.abs(pctNum)}%
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] font-medium text-noorix-muted">—</span>
                  )}
                </div>
              </MetricCard.Footer>
            </MetricCard>
          );
        })}
      </div>
      </div>{/* /nx-kpi-container */}

      {/* ── الرسوم البيانية: الأداء الشهري + توزيع القنوات ── */}
      <div
        className={cn(
          'grid gap-5',
          channelData.length > 0
            ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]'
            : 'grid-cols-1',
        )}
      >

        {/* تحليل الأداء الشهري */}
        <div className="noorix-surface-card p-4 lg:p-5">
          {/* رأس: العنوان + الإجمالي + أزرار Toggle */}
          <div className="flex flex-col gap-3 mb-4 max-lg:items-center lg:flex-row lg:items-start lg:justify-between lg:gap-3">
            <div className="min-w-0 max-lg:text-center lg:text-start">
              <div className="text-[14px] font-bold text-noorix-text">{t('dashboardSalesTimeline')}</div>
              <div className="text-[12px] text-noorix-muted mt-0.5">
                {timelineGrain === 'monthly'
                  ? String(year)
                  : `${timelineMonthName} — ${year}`}
              </div>
            </div>
            {/* يومي / شهري + إخفاء/إظهار الخطوط */}
            <div className="flex items-center gap-2 flex-wrap max-lg:justify-center">
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
          <div className="noorix-surface-card p-4 lg:p-5 flex flex-col max-lg:items-center">
            <div className="text-[14px] font-bold text-noorix-text mb-1 w-full max-lg:text-center lg:text-start">
              {t('reportChannels')}
            </div>
            <div className="text-[12px] text-noorix-muted mb-4 w-full max-lg:text-center lg:text-start">
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
            <div className="flex flex-col gap-1.5 mt-3 w-full max-lg:max-w-md">
              {channelData.slice(0, 5).map((ch, i) => (
                <div key={ch.name} className="flex items-center justify-between gap-2 text-[12px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-noorix-text truncate">{ch.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <FmtNum n={ch.value} className="nx-font-numbers font-bold text-noorix-text" />
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
