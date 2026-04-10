/**
 * OwnerDashboardScreen — لوحة المالك
 * مؤشرات شاملة: المبيعات الشهرية لكل شركة، الأرباح المجمعة، توزيع الأرباح
 */
import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { useTranslation } from '../../i18n/useTranslation';
import { Button, Input, ScreenShell, ScreenTitle, cn, MetricCard } from '../../ui';
import { useApp } from '../../context/AppContext';
import { useOwnerReports } from '../../hooks/useOwnerReports';
import { useOwnerDailySales } from '../../hooks/useOwnerDailySales';
import { EN_MONTHS } from '../Reports/reportHelpers';
import { fmt } from '../../utils/format';
import { exportToExcel, exportTableToPdf } from '../../utils/exportUtils';
import { useIsNarrow700 } from '../../hooks/useMediaQuery';
import { useUiDir } from '../../hooks/useUiDir';
import { KPI_CARD_SPARKLINE_COLORS, KPI_RECHARTS_COLORS, SERIES_RECHARTS_COLORS } from '../../constants/kpiCardTheme';

const MONTH_NAMES_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

/* SERIES_RECHARTS_COLORS — ألوان موحّدة من kpiCardTheme لسلاسل الشركات */
const COLORS = SERIES_RECHARTS_COLORS;

const METRIC_COLORS = {
  sales:     KPI_RECHARTS_COLORS.sales,
  purchases: KPI_RECHARTS_COLORS.purchases,
  expenses:  KPI_RECHARTS_COLORS.expenses,
  netProfit: KPI_RECHARTS_COLORS.netProfit,
};

/** يُعيد مصفوفة 12 قيمة شهرية لمؤشر معين من تقرير شركة */
function getCompanyMonthlyArr(report, metric) {
  if (!report) return Array(12).fill(0);
  if (metric === 'netProfit') {
    const row = report.summaryRows?.find((r) => r.key === 'netProfit');
    return Array.from({ length: 12 }, (_, i) => Number(row?.months?.[i] || 0));
  }
  const group = report.groups?.find((r) => r.key === metric);
  return Array.from({ length: 12 }, (_, i) => Number(group?.months?.[i] || 0));
}

function getSaudiYearMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date());
  const m = {};
  for (const p of parts) if (p.type !== 'literal') m[p.type] = p.value;
  return { year: parseInt(m.year, 10), month: parseInt(m.month, 10) };
}

function fmtAxis(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(Math.round(n));
}

function ChartTooltip({ active, payload, label, companyList, lang }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--noorix-bg-surface)', border: '1px solid var(--noorix-border)', borderRadius: 6, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 12, minWidth: 140 }}>
      <div style={{ fontWeight: 700, marginBottom: 5, color: 'var(--noorix-text)', fontSize: 11 }}>{label}</div>
      {payload.map((p) => {
        const company = (companyList || []).find((c) => c.id === p.dataKey);
        const name = company
          ? (lang === 'ar' ? company.nameAr || company.nameEn : company.nameEn || company.nameAr)
          : p.name;
        return (
          <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: p.color, fontWeight: 600, marginTop: 2 }}>
            <span>{name}</span>
            <span style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(p.value, 0)} SR</span>
          </div>
        );
      })}
    </div>
  );
}

export default function OwnerDashboardScreen() {
  const { t, lang } = useTranslation();
  const { companies } = useApp();
  const uiDir = useUiDir();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedCompanyIds, setSelectedCompanyIds] = useState(() => new Set(companies?.map((c) => c.id) || []));
  const [chartGrain, setChartGrain] = useState('monthly');
  const [metricFilter, setMetricFilter] = useState(new Set(['sales']));
  const [comparisonMetric, setComparisonMetric] = useState('sales');

  const toggleMetric = (key) => {
    setMetricFilter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // لا يُسمح بإلغاء الكل
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const companyList = companies?.filter((c) => !c.isArchived) || [];
  const isMobile = useIsNarrow700();
  const allSelected = selectedCompanyIds.size === companyList.length && companyList.length > 0;
  const idsToFetch = [...selectedCompanyIds];
  const selectedMonthNum = selectedMonth ? Number(selectedMonth) : null;

  const saudiYM = getSaudiYearMonth();
  const chartMonthForDaily = selectedMonthNum != null
    ? selectedMonthNum
    : (year === saudiYM.year ? saudiYM.month : 1);

  const { reportsByCompany, isLoading, isError, error } = useOwnerReports({ companyIds: idsToFetch, year });
  const dailySalesQuery = useOwnerDailySales({
    companyIds: idsToFetch,
    year,
    month: chartMonthForDaily,
    enabled: chartGrain === 'daily',
  });

  const toggleCompany = (id) => {
    setSelectedCompanyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedCompanyIds(new Set(companyList.map((c) => c.id)));
  const selectNone = () => setSelectedCompanyIds(new Set());

  const getMonthValue = (report, key, monthIdx) => {
    if (!report) return 0;
    if (monthIdx == null) {
      if (key === 'sales' || key === 'purchases' || key === 'expenses') return Number(report?.cards?.[key] || 0);
      if (key === 'netProfit') return Number(report?.cards?.netProfit || 0);
      return 0;
    }
    if (key === 'netProfit') {
      const row = report?.summaryRows?.find((r) => r.key === 'netProfit');
      return Number(row?.months?.[monthIdx] || 0);
    }
    const group = report?.groups?.find((r) => r.key === key);
    return Number(group?.months?.[monthIdx] || 0);
  };

  const aggregated = useMemo(() => {
    const m = selectedMonthNum != null ? selectedMonthNum - 1 : null;
    let totalSales = 0, totalPurchases = 0, totalExpenses = 0, totalNetProfit = 0;
    const byCompany = [];
    Object.entries(reportsByCompany).forEach(([companyId, report]) => {
      const sales = getMonthValue(report, 'sales', m);
      const purchases = getMonthValue(report, 'purchases', m);
      const expenses = getMonthValue(report, 'expenses', m);
      const netProfit = getMonthValue(report, 'netProfit', m);
      totalSales += sales; totalPurchases += purchases;
      totalExpenses += expenses; totalNetProfit += netProfit;
      const company = companyList.find((c) => c.id === companyId);
      const name = lang === 'ar' ? (company?.nameAr || company?.nameEn || companyId) : (company?.nameEn || company?.nameAr || companyId);
      byCompany.push({ companyId, name, sales, purchases, expenses, netProfit });
    });
    return { totalSales, totalPurchases, totalExpenses, totalNetProfit, byCompany };
  }, [reportsByCompany, companyList, lang, selectedMonthNum]);

  const aggregatedMonthly = useMemo(() => {
    const months = Array.from({ length: 12 }, () => ({ sales: 0, purchases: 0, expenses: 0, netProfit: 0 }));
    Object.values(reportsByCompany).forEach((report) => {
      const salesG = report?.groups?.find((r) => r.key === 'sales');
      const purchG = report?.groups?.find((r) => r.key === 'purchases');
      const expG   = report?.groups?.find((r) => r.key === 'expenses');
      const netRow = report?.summaryRows?.find((r) => r.key === 'netProfit');
      for (let i = 0; i < 12; i++) {
        months[i].sales     += Number(salesG?.months?.[i] || 0);
        months[i].purchases += Number(purchG?.months?.[i] || 0);
        months[i].expenses  += Number(expG?.months?.[i]   || 0);
        months[i].netProfit += Number(netRow?.months?.[i] || 0);
      }
    });
    return months;
  }, [reportsByCompany]);

  /* ── بيانات جدول المقارنة الشهرية ── */
  const companyMonthlyData = useMemo(() =>
    idsToFetch.map((cid, i) => {
      const report = reportsByCompany[cid];
      const company = companyList.find((c) => c.id === cid);
      const name = lang === 'ar' ? company?.nameAr || company?.nameEn || cid : company?.nameEn || company?.nameAr || cid;
      const months = getCompanyMonthlyArr(report, comparisonMetric);
      const total = months.reduce((a, b) => a + b, 0);
      return { cid, name, months, total, color: COLORS[i % COLORS.length] };
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [idsToFetch.join(','), reportsByCompany, comparisonMetric, companyList, lang]);

  const grandMonthlyTotals = useMemo(() =>
    Array.from({ length: 12 }, (_, i) =>
      companyMonthlyData.reduce((a, c) => a + (c.months[i] || 0), 0),
    ),
  [companyMonthlyData]);

  const grandTotal = grandMonthlyTotals.reduce((a, b) => a + b, 0);

  /* ── بيانات الرسم البياني الموحّد ── */
  const performanceData = useMemo(() => {
    if (chartGrain === 'daily') {
      const { itemsByCompanyId } = dailySalesQuery;
      const lastDay = new Date(year, chartMonthForDaily, 0).getDate();
      const pad = (n) => String(n).padStart(2, '0');
      return Array.from({ length: lastDay }, (_, idx) => {
        const day = idx + 1;
        const dateStr = `${year}-${pad(chartMonthForDaily)}-${pad(day)}`;
        const entry = { label: String(day) };
        idsToFetch.forEach((cid) => {
          const list = itemsByCompanyId[cid] || [];
          entry[cid] = list
            .filter((s) => (s.transactionDate || '').slice(0, 10) === dateStr && s.status !== 'cancelled')
            .reduce((a, s) => a + Number(s.totalAmount || 0), 0);
        });
        return entry;
      });
    }
    /* Monthly — دائماً 12 شهراً للسياق، مجموع المؤشرات المختارة */
    const activeMetrics = ['sales', 'purchases', 'expenses'].filter((k) => metricFilter.has(k));
    return Array.from({ length: 12 }, (_, i) => {
      const entry = { label: lang === 'ar' ? MONTH_NAMES_AR[i] : EN_MONTHS[i] };
      idsToFetch.forEach((cid) => {
        const report = reportsByCompany[cid];
        entry[cid] = activeMetrics.reduce((sum, key) => {
          const g = report?.groups?.find((r) => r.key === key);
          return sum + Number(g?.months?.[i] || 0);
        }, 0);
      });
      return entry;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartGrain, dailySalesQuery.dataStamp, year, chartMonthForDaily, idsToFetch.join(','), selectedMonthNum, reportsByCompany, [...metricFilter].join(','), lang]);

  const companySeries = useMemo(() =>
    idsToFetch.map((cid, i) => {
      const c = companyList.find((x) => x.id === cid);
      return {
        key: cid,
        label: lang === 'ar' ? c?.nameAr || c?.nameEn || cid : c?.nameEn || c?.nameAr || cid,
        color: COLORS[i % COLORS.length],
        gradId: `grad-owner-${i}`,
      };
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [idsToFetch.join(','), companyList, lang]);

  const METRIC_FILTERS = [
    { key: 'sales',     label: t('annualSales') },
    { key: 'purchases', label: t('annualPurchases') },
    { key: 'expenses',  label: t('annualExpenses') },
  ];

  const chartMonthName = lang === 'ar' ? MONTH_NAMES_AR[chartMonthForDaily - 1] : EN_MONTHS[chartMonthForDaily - 1];
  const chartSubtitle  = chartGrain === 'monthly' ? String(year) : `${chartMonthName} — ${year}`;

  const handleExportExcel = () => {
    const rows = [
      {
        [lang === 'ar' ? 'الشركة' : 'Company']: lang === 'ar' ? 'كل الشركات' : 'All companies',
        [lang === 'ar' ? 'المبيعات' : 'Sales']: fmt(aggregated.totalSales),
        [lang === 'ar' ? 'نسبة المشتريات' : 'Purchases %']: aggregated.totalSales > 0 ? fmt((aggregated.totalPurchases / aggregated.totalSales) * 100, 1) + '%' : '—',
        [lang === 'ar' ? 'نسبة المصروفات' : 'Expenses %']: aggregated.totalSales > 0 ? fmt((aggregated.totalExpenses / aggregated.totalSales) * 100, 1) + '%' : '—',
        [lang === 'ar' ? 'صافي الربح' : 'Net profit']: fmt(aggregated.totalNetProfit),
      },
      ...aggregated.byCompany.map((x) => ({
        [lang === 'ar' ? 'الشركة' : 'Company']: x.name,
        [lang === 'ar' ? 'المبيعات' : 'Sales']: fmt(x.sales),
        [lang === 'ar' ? 'نسبة المشتريات' : 'Purchases %']: x.sales > 0 ? fmt((x.purchases / x.sales) * 100, 1) + '%' : '—',
        [lang === 'ar' ? 'نسبة المصروفات' : 'Expenses %']: x.sales > 0 ? fmt((x.expenses / x.sales) * 100, 1) + '%' : '—',
        [lang === 'ar' ? 'صافي الربح' : 'Net profit']: fmt(x.netProfit),
      })),
    ];
    exportToExcel(rows, `owner-dashboard-${year}${selectedMonthNum ? `-m${selectedMonthNum}` : ''}.xlsx`);
  };

  const handleExportPdf = () => {
    const cols = [lang === 'ar' ? 'الشركة' : 'Company', lang === 'ar' ? 'المبيعات' : 'Sales', lang === 'ar' ? 'نسبة المشتريات' : 'Purchases %', lang === 'ar' ? 'صافي الربح' : 'Net profit'];
    const data = aggregated.byCompany.map((x) => [x.name, fmt(x.sales), x.sales > 0 ? fmt((x.purchases / x.sales) * 100, 1) + '%' : '—', fmt(x.netProfit)]);
    data.unshift([lang === 'ar' ? 'الإجمالي' : 'Total', fmt(aggregated.totalSales), aggregated.totalSales > 0 ? fmt((aggregated.totalPurchases / aggregated.totalSales) * 100, 1) + '%' : '—', fmt(aggregated.totalNetProfit)]);
    exportTableToPdf({ title: `${t('ownerDashboard')} — ${year}`, filename: `owner-dashboard-${year}.pdf`, columns: cols, data });
  };

  if (companyList.length === 0) {
    return (
      <ScreenShell>
        <ScreenTitle>{t('ownerDashboard')}</ScreenTitle>
        <div className="noorix-surface-card text-center text-noorix-muted mt-4 p-8">
          {t('pleaseSelectCompany')}
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <div className="nx-page-header">
        <div className="nx-page-header__titles">
          <ScreenTitle>{t('ownerDashboard')}</ScreenTitle>
          <p className="text-[13px] text-noorix-muted m-0">{t('ownerDashboardDesc')}</p>
        </div>
        <div className="nx-toolbar">
          <Input type="select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Input>
          <Input type="select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            <option value="">{t('allMonths')}</option>
            {EN_MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </Input>
          <Button variant="primary" onClick={handleExportExcel} size="sm">Excel</Button>
          <Button onClick={handleExportPdf} size="sm">PDF</Button>
        </div>
      </div>

      {/* اختيار الشركات */}
      <div className={cn('noorix-surface-card', isMobile ? 'p-3' : 'p-4')}>
        <div className="font-bold mb-3">{t('ownerSelectCompanies')}</div>
        <div className="flex items-center flex flex-wrap gap-2">
          <Button onClick={selectAll} size="sm">{t('ownerAllCompanies')}</Button>
          <Button onClick={selectNone} size="sm">{lang === 'ar' ? 'إخفاء الكل' : 'Hide all'}</Button>
          {companyList.map((c, i) => {
            const isVisible = allSelected ? true : selectedCompanyIds.has(c.id);
            return (
              <Button
                key={c.id}
                variant="raw"
                className="owner-company-card flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg"
                onClick={() => toggleCompany(c.id)}
                title={isVisible ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'عرض' : 'Show')}
                style={{
                  border: `1px solid ${isVisible ? COLORS[i % COLORS.length] : 'var(--noorix-border)'}`,
                  background: isVisible ? `${COLORS[i % COLORS.length]}18` : 'var(--noorix-bg-muted)',
                  color: isVisible ? COLORS[i % COLORS.length] : 'var(--noorix-text-muted)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" fill={isVisible ? 'currentColor' : 'none'} />
                </svg>
                <span>{lang === 'ar' ? c.nameAr || c.nameEn : c.nameEn || c.nameAr}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {isLoading && (
        <div className="noorix-surface-card text-center text-noorix-muted p-8">{t('loading')}</div>
      )}

      {isError && (
        <div className="noorix-surface-card p-5" style={{ color: 'var(--noorix-accent-red)', background: 'var(--noorix-red-8)' }}>{error?.message || t('loading')}</div>
      )}

      {!isLoading && !isError && idsToFetch.length > 0 && (
        <>
          {/* كروت KPI */}
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
            {[
              { key: 'sales',     label: t('ownerTotalSales'),     value: aggregated.totalSales },
              { key: 'purchases', label: t('annualPurchases'),     value: aggregated.totalPurchases },
              { key: 'expenses',  label: t('annualExpenses'),      value: aggregated.totalExpenses },
              { key: 'netProfit', label: t('ownerTotalNetProfit'), value: aggregated.totalNetProfit },
            ].map((card) => {
              const pctNum = card.key !== 'sales' && aggregated.totalSales > 0
                ? Number(((card.value / aggregated.totalSales) * 100).toFixed(1))
                : null;
              const isProfit = card.key === 'netProfit';
              const badgeClass = isProfit && pctNum != null
                ? (pctNum >= 0 ? 'bg-[#eaf3de] text-[#3B6D11]' : 'bg-[#FCEBEB] text-[#A32D2D]')
                : 'bg-noorix-bg-muted text-noorix-muted';
              const arrow = isProfit && pctNum != null ? (pctNum >= 0 ? '↑ ' : '↓ ') : '';
              const accentColor = KPI_CARD_SPARKLINE_COLORS[card.key];
              return (
                <MetricCard key={card.key} color={accentColor} className="min-h-[168px]">
                  <MetricCard.Header label={card.label} />
                  <MetricCard.Value value={card.value} currency="SR" />
                  <MetricCard.Spark data={aggregatedMonthly.map((m) => m[card.key])} color={accentColor} grow />
                  <MetricCard.Footer className="mt-3 border-t border-noorix-border pt-3 pb-3">
                    <span className="min-w-0 truncate text-[11px] font-medium text-noorix-muted">
                      {year}{selectedMonthNum ? ` — ${EN_MONTHS[selectedMonthNum - 1]}` : ''}
                    </span>
                    {pctNum != null ? (
                      <span className={`inline-flex max-w-[min(100%,140px)] shrink-0 items-center truncate rounded px-2 py-0.5 text-[11px] font-bold ${badgeClass}`}>
                        {arrow}{Math.abs(pctNum)}%
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-noorix-muted">100%</span>
                    )}
                  </MetricCard.Footer>
                </MetricCard>
              );
            })}
          </div>

          {/* ── الرسم البياني الموحّد (شهري/يومي) ── */}
          <div className={cn('noorix-surface-card', isMobile ? 'p-3' : 'p-5')}>
            {/* رأس: العنوان + التبديل شهري/يومي + فلاتر المؤشرات */}
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div>
                <div className="text-[14px] font-bold text-noorix-text">{t('ownerMonthlySales')}</div>
                <div className="text-[12px] text-noorix-muted mt-0.5">{chartSubtitle}</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Toggle شهري / يومي */}
                <div
                  role="tablist"
                  dir={uiDir}
                  className="inline-flex shrink-0 items-stretch rounded-lg border border-noorix-border bg-noorix-bg-muted p-0.5"
                >
                  <Button
                    type="button" role="tab"
                    aria-selected={chartGrain === 'monthly'}
                    variant="raw" size="auto"
                    className={cn(
                      'min-h-9 rounded-md px-3 py-1.5 text-[12px] font-semibold sm:min-h-8 sm:py-1',
                      chartGrain === 'monthly'
                        ? 'bg-noorix-surface text-noorix-text shadow-sm'
                        : 'text-noorix-muted hover:bg-noorix-surface/60 hover:text-noorix-text',
                    )}
                    data-active={chartGrain === 'monthly' ? 'true' : 'false'}
                    onClick={() => setChartGrain('monthly')}
                  >
                    {t('dashboardTimelineMonthly')}
                  </Button>
                  <Button
                    type="button" role="tab"
                    aria-selected={chartGrain === 'daily'}
                    variant="raw" size="auto"
                    className={cn(
                      'min-h-9 rounded-md px-3 py-1.5 text-[12px] font-semibold sm:min-h-8 sm:py-1',
                      chartGrain === 'daily'
                        ? 'bg-noorix-surface text-noorix-text shadow-sm'
                        : 'text-noorix-muted hover:bg-noorix-surface/60 hover:text-noorix-text',
                    )}
                    data-active={chartGrain === 'daily' ? 'true' : 'false'}
                    onClick={() => setChartGrain('daily')}
                  >
                    {t('dashboardTimelineDaily')}
                  </Button>
                </div>

                {/* فلاتر المؤشرات — مبيعات/مشتريات/مصروفات (متعدد الاختيار) */}
                {METRIC_FILTERS.map((f) => {
                  const disabled = chartGrain === 'daily' && f.key !== 'sales';
                  const active   = !disabled && metricFilter.has(f.key);
                  return (
                    <button
                      key={f.key}
                      onClick={() => !disabled && toggleMetric(f.key)}
                      style={{
                        borderColor: active ? METRIC_COLORS[f.key] : 'var(--noorix-border)',
                        color:       active ? METRIC_COLORS[f.key] : disabled ? 'var(--noorix-border)' : 'var(--noorix-text-muted)',
                        background:  active ? `${METRIC_COLORS[f.key]}14` : 'transparent',
                        opacity:     disabled ? 0.35 : 1,
                        cursor:      disabled ? 'not-allowed' : 'pointer',
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded border transition-all duration-150 select-none"
                    >
                      <span
                        className="inline-block w-3 h-0.5 rounded-full flex-shrink-0"
                        style={{ background: active ? METRIC_COLORS[f.key] : 'var(--noorix-border)' }}
                      />
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* حالة تحميل اليومي */}
            {chartGrain === 'daily' && dailySalesQuery.isLoading && (
              <div className="text-center text-noorix-muted py-12">{t('loading')}</div>
            )}
            {chartGrain === 'daily' && dailySalesQuery.isError && (
              <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted px-4 py-3 text-[13px] text-noorix-red">
                {dailySalesQuery.error?.message || t('loadingError')}
              </div>
            )}

            {/* الرسم البياني */}
            {!(chartGrain === 'daily' && (dailySalesQuery.isLoading || dailySalesQuery.isError)) && (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={performanceData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <defs>
                    {companySeries.map((s) => (
                      <linearGradient key={s.gradId} id={s.gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={s.color} stopOpacity={0.22} />
                        <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
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
                  <Tooltip content={(props) => <ChartTooltip {...props} companyList={companyList} lang={lang} />} />
                  {companySeries.map((s) => (
                    <Area
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={s.color}
                      strokeWidth={2}
                      fill={`url(#${s.gradId})`}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}

            {/* مفتاح الألوان */}
            <div className="flex flex-wrap gap-4 mt-4 border-t border-noorix-border pt-3">
              {companySeries.map((s) => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                  <span className="text-[12px]">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── جدول مقارنة الشركات الشهرية ── */}
          {(() => {
            const isNetProfit = comparisonMetric === 'netProfit';
            const metricColor = METRIC_COLORS[comparisonMetric];
            const COMPARISON_METRICS = [
              { key: 'sales',     label: t('annualSales') },
              { key: 'purchases', label: t('annualPurchases') },
              { key: 'expenses',  label: t('annualExpenses') },
              { key: 'netProfit', label: t('ownerTotalNetProfit') },
            ];
            const monthAbbr = lang === 'ar'
              ? MONTH_NAMES_AR.map((m) => m.slice(0, 3))
              : EN_MONTHS.map((m) => m.slice(0, 3));

            const valColor = (val) => {
              if (!isNetProfit) return undefined;
              return val < 0 ? 'var(--noorix-accent-red)' : val > 0 ? 'var(--noorix-accent-green)' : undefined;
            };

            return (
              <div className="noorix-surface-card p-5">
                {/* رأس */}
                <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                  <div>
                    <div className="text-[14px] font-bold text-noorix-text">
                      {lang === 'ar' ? 'مقارنة الشركات الشهرية' : 'Monthly Company Comparison'}
                    </div>
                    <div className="text-[12px] text-noorix-muted mt-0.5">{year}</div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {COMPARISON_METRICS.map((m) => {
                      const active = comparisonMetric === m.key;
                      const color  = METRIC_COLORS[m.key];
                      return (
                        <button
                          key={m.key}
                          onClick={() => setComparisonMetric(m.key)}
                          style={{
                            borderColor: active ? color : 'var(--noorix-border)',
                            color:       active ? color : 'var(--noorix-text-muted)',
                            background:  active ? `${color}14` : 'transparent',
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded border transition-all duration-150"
                        >
                          <span
                            className="inline-block w-3 h-0.5 rounded-full flex-shrink-0"
                            style={{ background: active ? color : 'var(--noorix-border)' }}
                          />
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* الجدول */}
                <div className="overflow-x-auto -mx-5 px-5">
                  <table style={{ minWidth: 860 }} className="w-full text-[12px] border-collapse">
                    <thead>
                      <tr>
                        <th className="text-start py-2 px-3 text-[11px] text-noorix-muted font-semibold w-36 border-b border-noorix-border">
                          {lang === 'ar' ? 'الشركة' : 'Company'}
                        </th>
                        {monthAbbr.map((m, i) => (
                          <th key={i} className="text-end py-2 px-1.5 text-[10px] text-noorix-muted font-semibold min-w-[56px] border-b border-noorix-border">
                            {m}
                          </th>
                        ))}
                        <th className="text-end py-2 px-3 text-[11px] text-noorix-muted font-semibold min-w-[80px] border-b-2 border-noorix-border">
                          {lang === 'ar' ? 'المجموع' : 'Total'}
                        </th>
                        <th className="text-end py-2 px-3 text-[10px] text-noorix-muted font-semibold min-w-[48px] border-b-2 border-noorix-border">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyMonthlyData.map(({ cid, name, months, total, color }) => {
                        const pct = Math.abs(grandTotal) > 0 ? (total / Math.abs(grandTotal)) * 100 : 0;
                        const bestMonth = Math.max(...months);
                        return (
                          <tr key={cid} className="border-b border-noorix-border/40 hover:bg-noorix-bg-muted/50 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
                                <span className="font-semibold text-noorix-text truncate max-w-[110px]">{name}</span>
                              </div>
                            </td>
                            {months.map((val, mi) => (
                              <td
                                key={mi}
                                className="py-2.5 px-1.5 text-end tabular-nums"
                                style={{
                                  color: valColor(val) || (val === 0 ? 'var(--noorix-text-muted)' : 'var(--noorix-text)'),
                                  fontWeight: !isNetProfit && val === bestMonth && val > 0 ? 700 : 400,
                                  background: !isNetProfit && val === bestMonth && val > 0
                                    ? `${color}0d`
                                    : undefined,
                                }}
                              >
                                {val === 0 ? <span className="text-[10px] opacity-30">—</span> : fmtAxis(val)}
                              </td>
                            ))}
                            <td className="py-2.5 px-3 text-end font-bold tabular-nums"
                              style={{ color: valColor(total) || metricColor }}
                            >
                              {fmtAxis(total)}
                            </td>
                            <td className="py-2.5 px-3 text-end text-[11px] text-noorix-muted tabular-nums">
                              {fmt(Math.abs(pct), 1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-noorix-border">
                        <td className="py-3 px-3 font-bold text-noorix-text text-[12px]">
                          {lang === 'ar' ? 'الإجمالي' : 'Total'}
                        </td>
                        {grandMonthlyTotals.map((val, mi) => (
                          <td key={mi} className="py-3 px-1.5 text-end font-bold tabular-nums"
                            style={{ color: valColor(val) || 'var(--noorix-text)' }}
                          >
                            {val === 0 ? <span className="text-[10px] opacity-30">—</span> : fmtAxis(val)}
                          </td>
                        ))}
                        <td className="py-3 px-3 text-end font-bold tabular-nums"
                          style={{ color: valColor(grandTotal) || metricColor }}
                        >
                          {fmtAxis(grandTotal)}
                        </td>
                        <td className="py-3 px-3 text-end text-[11px] text-noorix-muted">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}

        </>
      )}
    </ScreenShell>
  );
}
