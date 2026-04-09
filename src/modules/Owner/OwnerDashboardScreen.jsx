/**
 * OwnerDashboardScreen — لوحة المالك
 * مؤشرات شاملة: المبيعات الشهرية لكل شركة، الأرباح المجمعة، توزيع الأرباح
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { Button, Input, ScreenShell, ScreenTitle, cn } from '../../ui';
import { useApp } from '../../context/AppContext';
import { useOwnerReports } from '../../hooks/useOwnerReports';
import { EN_MONTHS } from '../Reports/reportHelpers';
import { fmt } from '../../utils/format';
import { exportToExcel, exportTableToPdf } from '../../utils/exportUtils';
import { useIsNarrow700 } from '../../hooks/useMediaQuery';
import { KPI_CARD_SPARKLINE_COLORS, KPI_CARD_TOP_BAR_CLASS } from '../../constants/kpiCardTheme';

const COLORS = ['var(--noorix-accent-green)', 'var(--noorix-accent-blue)', 'var(--noorix-accent-amber)', 'var(--noorix-accent-violet)', 'var(--noorix-accent-red)', '#0891b2', 'var(--noorix-accent-violet)', 'var(--noorix-accent-green)'];

function SparkLine({ data = [], color = '#185FA5' }) {
  const W = 100; const H = 36; const pad = 3;
  const nums = (data || []).map((v) => Number(v || 0));
  const empty = !nums.length || nums.every((v) => v === 0);
  if (empty) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="36" className="block">
        <line x1={pad} y1={H / 2} x2={W - pad} y2={H / 2} className="stroke-noorix-border" strokeWidth="1" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  const max = Math.max(...nums); const min = Math.min(...nums);
  const range = Math.max(max - min, 1e-9); const n = nums.length;
  const xs = nums.map((_, i) => (n === 1 ? W / 2 : pad + (i / (n - 1)) * (W - 2 * pad)));
  const ys = nums.map((v) => pad + (1 - (v - min) / range) * (H - 2 * pad));
  const points = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const fillPoints = `${points} ${xs[n - 1]},${H} ${xs[0]},${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="36" className="block">
      <polygon points={fillPoints} fill={color} fillOpacity={0.08} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function formatAxisValue(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(Math.round(n));
}

export default function OwnerDashboardScreen() {
  const { t, lang } = useTranslation();
  const { companies } = useApp();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedCompanyIds, setSelectedCompanyIds] = useState(() => new Set(companies?.map((c) => c.id) || []));

  const companyList = companies?.filter((c) => !c.isArchived) || [];
  const isMobile = useIsNarrow700();
  const allSelected = selectedCompanyIds.size === companyList.length && companyList.length > 0;
  const idsToFetch = [...selectedCompanyIds];
  const { reportsByCompany, isLoading, isError, error } = useOwnerReports({ companyIds: idsToFetch, year });

  const toggleCompany = (id) => {
    setSelectedCompanyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedCompanyIds(new Set(companyList.map((c) => c.id)));
  };

  const selectNone = () => {
    setSelectedCompanyIds(new Set());
  };

  const selectedMonthNum = selectedMonth ? Number(selectedMonth) : null;

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

  const salesByMonthByCompany = useMemo(() => {
    const result = {};
    Object.entries(reportsByCompany).forEach(([companyId, report]) => {
      const salesGroup = report?.groups?.find((r) => r.key === 'sales');
      if (!salesGroup?.months?.length) return;
      result[companyId] = (salesGroup.months || []).map((val, i) => ({
        month: i + 1,
        label: EN_MONTHS[i],
        amount: Number(val || 0),
      }));
    });
    return result;
  }, [reportsByCompany]);

  const aggregated = useMemo(() => {
    const m = selectedMonthNum != null ? selectedMonthNum - 1 : null;
    let totalSales = 0;
    let totalPurchases = 0;
    let totalExpenses = 0;
    let totalNetProfit = 0;
    const byCompany = [];
    Object.entries(reportsByCompany).forEach(([companyId, report]) => {
      const sales = getMonthValue(report, 'sales', m);
      const purchases = getMonthValue(report, 'purchases', m);
      const expenses = getMonthValue(report, 'expenses', m);
      const netProfit = getMonthValue(report, 'netProfit', m);
      totalSales += sales;
      totalPurchases += purchases;
      totalExpenses += expenses;
      totalNetProfit += netProfit;
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

  const chartData = useMemo(() => {
    let months = EN_MONTHS.map((_, i) => ({ month: i + 1, label: EN_MONTHS[i], byCompany: {} }));
    if (selectedMonthNum != null) {
      months = months.filter((x) => x.month === selectedMonthNum);
    }
    Object.entries(salesByMonthByCompany).forEach(([companyId, data]) => {
      data.forEach((p) => {
        const m = months.find((x) => x.month === p.month);
        if (m) m.byCompany[companyId] = p.amount;
      });
    });
    return months;
  }, [salesByMonthByCompany, selectedMonthNum]);

  const maxChartValue = useMemo(() => {
    let max = 0;
    chartData.forEach((m) => {
      const sum = Object.values(m.byCompany || {}).reduce((a, b) => a + b, 0);
      max = Math.max(max, sum);
    });
    return Math.max(1, max);
  }, [chartData]);

  const yAxisTicks = useMemo(() => {
    const step = Math.max(1, Math.ceil(maxChartValue / 5));
    return [0, 1, 2, 3, 4, 5].map((i) => step * i);
  }, [maxChartValue]);

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
    exportTableToPdf({
      title: `${t('ownerDashboard')} — ${year}`,
      filename: `owner-dashboard-${year}.pdf`,
      columns: cols,
      data,
    });
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
          <Input
            type="select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Input>
          <Input
            type="select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="">{t('allMonths')}</option>
            {EN_MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </Input>
          <Button variant="primary" onClick={handleExportExcel} size="sm">Excel</Button>
          <Button onClick={handleExportPdf} size="sm">PDF</Button>
        </div>
      </div>

      {/* اختيار الشركات — أزرار عين */}
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
              return (
                <div key={card.key} className="noorix-surface-card relative flex min-h-[168px] min-w-0 flex-col overflow-hidden p-4">
                  <span className={`pointer-events-none absolute inset-x-0 top-0 h-1 ${KPI_CARD_TOP_BAR_CLASS[card.key]}`} aria-hidden />
                  <div className="text-[12px] font-medium text-noorix-muted">{card.label}</div>
                  <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span dir="ltr" className="nx-font-numbers text-[22px] font-bold leading-tight tracking-[-0.5px] text-noorix-text text-start">
                      {fmt(card.value)}
                    </span>
                    <span className="text-[12px] font-medium text-noorix-muted">SR</span>
                  </div>
                  <div className="mt-3 min-h-[36px] w-full min-w-0 flex-1">
                    <SparkLine data={aggregatedMonthly.map((m) => m[card.key])} color={KPI_CARD_SPARKLINE_COLORS[card.key]} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-noorix-border pt-3">
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
                  </div>
                </div>
              );
            })}
          </div>

          {/* المبيعات الشهرية — رسم بياني */}
          <div className={cn('noorix-surface-card', isMobile ? 'p-3' : 'p-6')}>
            <div className="text-[16px] font-bold mb-5">{t('ownerMonthlySales')} — {year}{selectedMonthNum ? ` (${EN_MONTHS[selectedMonthNum - 1]})` : ''}</div>
            <div className="flex gap-0 min-h-[220px]">
              <div className="shrink-0 flex flex-col w-12 justify-between pt-1 pb-7">
                {[...yAxisTicks].reverse().map((tick) => (
                  <div key={tick} className="text-[10px] nx-font-numbers text-noorix-muted font-semibold">
                    {formatAxisValue(tick)}
                  </div>
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex gap-1.5 items-end h-[180px] pb-7">
                  {chartData.map((point) => {
                    const companyAmounts = point.byCompany || {};
                    const total = Object.values(companyAmounts).reduce((a, b) => a + b, 0);
                    const barHeightPct = maxChartValue > 0 ? (total / maxChartValue) * 100 : 0;
                    return (
                      <div key={point.month} className="flex-1 min-w-0 flex flex-col gap-1 items-center">
                        <div className="w-full h-full flex max-w-[40px] flex-col-reverse items-stretch">
                          {idsToFetch.map((companyId, i) => {
                            const amt = companyAmounts[companyId] || 0;
                            if (amt <= 0) return null;
                            const heightPct = Math.max(0.5, (amt / maxChartValue) * 100);
                            return (
                              <div
                                key={companyId}
                                style={{
                                  height: `${heightPct}%`,
                                  minHeight: 2,
                                  background: COLORS[i % COLORS.length],
                                  borderRadius: '2px 2px 0 0',
                                }}
                                title={`${companyList.find((c) => c.id === companyId)?.nameAr || companyId}: ${fmt(amt)} SR`}
                              />
                            );
                          })}
                        </div>
                        <div className="text-[10px] text-noorix-muted font-semibold">{point.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 mt-4 border-t border-noorix-border pt-3">
              {idsToFetch.map((companyId, i) => {
                const c = companyList.find((x) => x.id === companyId);
                return (
                  <div key={companyId} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-[12px]">{lang === 'ar' ? c?.nameAr || c?.nameEn : c?.nameEn || c?.nameAr}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* توزيع الأرباح */}
          <div className="noorix-surface-card p-4">
            <div className="text-[16px] font-bold mb-3.5">{t('ownerProfitDistribution')}</div>
            <div className="flex flex-col gap-3">
              {aggregated.byCompany
                .filter((x) => Math.abs(x.netProfit) > 0.001)
                .sort((a, b) => b.netProfit - a.netProfit)
                .map((item, i) => {
                  const pct = aggregated.totalNetProfit !== 0 ? (item.netProfit / aggregated.totalNetProfit) * 100 : 0;
                  const barWidth = Math.min(100, Math.max(0, Math.abs(pct)));
                  const profitColor = item.netProfit >= 0 ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-red)';
                  return (
                    <div key={item.companyId}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-8 min-w-0">
                          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-[13px] font-semibold truncate">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-8 shrink-0">
                          <span className="text-[13px] font-bold nx-font-numbers" style={{ color: profitColor /* dynamic: profit/loss color */ }}>
                            {fmt(item.netProfit)} <span className="nx-sar">SR</span>
                          </span>
                          <span className="text-[11px] text-noorix-muted text-end min-w-[38px]">
                            {aggregated.totalNetProfit !== 0 ? `${fmt(pct, 1)}%` : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="bg-noorix-bg-muted overflow-hidden h-1.5 rounded">
                        <div className="h-full" style={{ width: `${barWidth}%`, background: profitColor, borderRadius: 4, transition: 'width 400ms ease' }} />
                      </div>
                    </div>
                  );
                })}
              {aggregated.byCompany.filter((x) => Math.abs(x.netProfit) > 0.001).length === 0 && (
                <div className="p-6 text-center text-noorix-muted text-[13px]">{t('reportNoData')}</div>
              )}
            </div>
          </div>
        </>
      )}
    </ScreenShell>
  );
}
