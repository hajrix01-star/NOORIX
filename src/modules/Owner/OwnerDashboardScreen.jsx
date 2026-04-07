/**
 * OwnerDashboardScreen — لوحة المالك
 * مؤشرات شاملة: المبيعات الشهرية لكل شركة، الأرباح المجمعة، توزيع الأرباح
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { Button, Input } from '../../ui';
import { useApp } from '../../context/AppContext';
import { useOwnerReports } from '../../hooks/useOwnerReports';
import { EN_MONTHS } from '../Reports/reportHelpers';
import { fmt } from '../../utils/format';
import { CARD_BORDER_RADIUS } from '../../utils/cardStyles';
import { exportToExcel, exportTableToPdf } from '../../utils/exportUtils';

const COLORS = ['var(--noorix-accent-green)', 'var(--noorix-accent-blue)', 'var(--noorix-accent-amber)', 'var(--noorix-accent-violet)', 'var(--noorix-accent-red)', '#0891b2', '#4f46e5', 'var(--noorix-accent-green)'];

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
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 700);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 700);
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, []);
  const allSelected = selectedCompanyIds.size === 0;
  const idsToFetch = allSelected ? companyList.map((c) => c.id) : [...selectedCompanyIds];
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
        [lang === 'ar' ? 'المبيعات' : 'Sales']: fmt(aggregated.totalSales, 2),
        [lang === 'ar' ? 'نسبة المشتريات' : 'Purchases %']: aggregated.totalSales > 0 ? fmt((aggregated.totalPurchases / aggregated.totalSales) * 100, 1) + '%' : '—',
        [lang === 'ar' ? 'نسبة المصروفات' : 'Expenses %']: aggregated.totalSales > 0 ? fmt((aggregated.totalExpenses / aggregated.totalSales) * 100, 1) + '%' : '—',
        [lang === 'ar' ? 'صافي الربح' : 'Net profit']: fmt(aggregated.totalNetProfit, 2),
      },
      ...aggregated.byCompany.map((x) => ({
        [lang === 'ar' ? 'الشركة' : 'Company']: x.name,
        [lang === 'ar' ? 'المبيعات' : 'Sales']: fmt(x.sales, 2),
        [lang === 'ar' ? 'نسبة المشتريات' : 'Purchases %']: x.sales > 0 ? fmt((x.purchases / x.sales) * 100, 1) + '%' : '—',
        [lang === 'ar' ? 'نسبة المصروفات' : 'Expenses %']: x.sales > 0 ? fmt((x.expenses / x.sales) * 100, 1) + '%' : '—',
        [lang === 'ar' ? 'صافي الربح' : 'Net profit']: fmt(x.netProfit, 2),
      })),
    ];
    exportToExcel(rows, `owner-dashboard-${year}${selectedMonthNum ? `-m${selectedMonthNum}` : ''}.xlsx`);
  };

  const handleExportPdf = () => {
    const cols = [lang === 'ar' ? 'الشركة' : 'Company', lang === 'ar' ? 'المبيعات' : 'Sales', lang === 'ar' ? 'نسبة المشتريات' : 'Purchases %', lang === 'ar' ? 'صافي الربح' : 'Net profit'];
    const data = aggregated.byCompany.map((x) => [x.name, fmt(x.sales, 2), x.sales > 0 ? fmt((x.purchases / x.sales) * 100, 1) + '%' : '—', fmt(x.netProfit, 2)]);
    data.unshift([lang === 'ar' ? 'الإجمالي' : 'Total', fmt(aggregated.totalSales, 2), aggregated.totalSales > 0 ? fmt((aggregated.totalPurchases / aggregated.totalSales) * 100, 1) + '%' : '—', fmt(aggregated.totalNetProfit, 2)]);
    exportTableToPdf({
      title: `${t('ownerDashboard')} — ${year}`,
      filename: `owner-dashboard-${year}.pdf`,
      columns: cols,
      data,
    });
  };

  if (companyList.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('ownerDashboard')}</h1>
        <div className="noorix-surface-card nx-text-center nx-text-muted nx-mt-16" style={{ padding: 32 }}>
          {t('pleaseSelectCompany')}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="nx-page-header">
        <div className="nx-page-header__titles">
          <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('ownerDashboard')}</h1>
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
      <div className="noorix-surface-card nx-border-all" style={{ padding: isMobile ? 12 : 16, borderRadius: CARD_BORDER_RADIUS }}>
        <div className="nx-font-700 nx-mb-12">{t('ownerSelectCompanies')}</div>
        <div className="nx-flex-center nx-flex-wrap nx-gap-8">
          <Button onClick={selectAll} size="sm">{t('ownerAllCompanies')}</Button>
          <Button onClick={selectNone} size="sm">{lang === 'ar' ? 'إخفاء الكل' : 'Hide all'}</Button>
          {companyList.map((c, i) => {
            const isVisible = allSelected ? true : selectedCompanyIds.has(c.id);
            return (
              <Button
                key={c.id}
                className="owner-company-card nx-flex-center nx-gap-6 nx-text-sm"
                onClick={() => toggleCompany(c.id)}
                title={isVisible ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'عرض' : 'Show')}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
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
        <div className="noorix-surface-card nx-text-center nx-text-muted" style={{ padding: 32 }}>{t('loading')}</div>
      )}

      {isError && (
        <div className="noorix-surface-card nx-p-20" style={{ color: 'var(--noorix-accent-red)', background: 'rgba(239,68,68,0.08)' }}>{error?.message || t('loading')}</div>
      )}

      {!isLoading && !isError && idsToFetch.length > 0 && (
        <>
          {/* كروت الإجماليات + النسب */}
          <div className="nx-grid nx-gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div className="nx-border-all nx-overflow-hidden nx-bg-surface" style={{ borderRadius: CARD_BORDER_RADIUS }}>
              <div style={{ height: 3, background: 'var(--noorix-accent-green)' }} />
              <div className="nx-p-16">
                <div className="nx-text-xs nx-text-muted nx-mb-4">{t('ownerTotalSales')}</div>
                <div className="nx-text-3xl nx-font-800 nx-font-numbers">{fmt(aggregated.totalSales, 2)} ﷼</div>
                <div className="nx-text-2xs nx-text-muted nx-mt-4">100%</div>
              </div>
            </div>
            <div className="nx-border-all nx-overflow-hidden nx-bg-surface" style={{ borderRadius: CARD_BORDER_RADIUS }}>
              <div style={{ height: 3, background: 'var(--noorix-accent-red)' }} />
              <div className="nx-p-16">
                <div className="nx-text-xs nx-text-muted nx-mb-4">{t('purchasesToSalesRatio')}</div>
                <div className="nx-text-3xl nx-font-800 nx-font-numbers nx-text-expense">
                  {aggregated.totalSales > 0 ? fmt((aggregated.totalPurchases / aggregated.totalSales) * 100, 1) : '—'}%
                </div>
                <div className="nx-text-2xs nx-text-muted nx-mt-4">{fmt(aggregated.totalPurchases, 2)} ﷼</div>
              </div>
            </div>
            <div className="nx-border-all nx-overflow-hidden nx-bg-surface" style={{ borderRadius: CARD_BORDER_RADIUS }}>
              <div style={{ height: 3, background: 'var(--noorix-accent-red)' }} />
              <div className="nx-p-16">
                <div className="nx-text-xs nx-text-muted nx-mb-4">{t('annualExpenses')} {t('sectionToSalesRatio')}</div>
                <div className="nx-text-3xl nx-font-800 nx-font-numbers" style={{ color: 'var(--noorix-accent-red)' }}>
                  {aggregated.totalSales > 0 ? fmt((aggregated.totalExpenses / aggregated.totalSales) * 100, 1) : '—'}%
                </div>
                <div className="nx-text-2xs nx-text-muted nx-mt-4">{fmt(aggregated.totalExpenses, 2)} ﷼</div>
              </div>
            </div>
            <div className="nx-border-all nx-overflow-hidden nx-bg-surface" style={{ borderRadius: CARD_BORDER_RADIUS }}>
              <div style={{ height: 3, background: aggregated.totalNetProfit >= 0 ? 'var(--noorix-accent-blue)' : 'var(--noorix-accent-red)' }} />
              <div className="nx-p-16">
                <div className="nx-text-xs nx-text-muted nx-mb-4">{t('ownerTotalNetProfit')}</div>
                <div className="nx-text-3xl nx-font-800 nx-font-numbers" style={{ color: aggregated.totalNetProfit >= 0 ? 'var(--noorix-accent-blue)' : 'var(--noorix-accent-red)' }}>
                  {fmt(aggregated.totalNetProfit, 2)} ﷼
                </div>
                <div className="nx-text-2xs nx-text-muted nx-mt-4">
                  {aggregated.totalSales > 0 ? fmt((aggregated.totalNetProfit / aggregated.totalSales) * 100, 1) + '%' : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* المبيعات الشهرية — رسم بياني */}
          <div className="noorix-surface-card nx-border-all" style={{ padding: isMobile ? 12 : 24, borderRadius: CARD_BORDER_RADIUS }}>
            <div className="nx-text-xl nx-font-700 nx-mb-20">{t('ownerMonthlySales')} — {year}{selectedMonthNum ? ` (${EN_MONTHS[selectedMonthNum - 1]})` : ''}</div>
            <div className="flex" style={{ gap: 0, minHeight: 220 }}>
              <div className="nx-flex-shrink-0 nx-flex-col" style={{ width: 48, justifyContent: 'space-between', paddingTop: 4, paddingBottom: 28 }}>
                {[...yAxisTicks].reverse().map((tick) => (
                  <div key={tick} className="nx-text-2xs nx-font-numbers nx-text-muted nx-font-600">
                    {formatAxisValue(tick)}
                  </div>
                ))}
              </div>
              <div className="nx-flex-1">
                <div className="nx-flex nx-gap-6" style={{ alignItems: 'flex-end', height: 180, paddingBottom: 28 }}>
                  {chartData.map((point) => {
                    const companyAmounts = point.byCompany || {};
                    const total = Object.values(companyAmounts).reduce((a, b) => a + b, 0);
                    const barHeightPct = maxChartValue > 0 ? (total / maxChartValue) * 100 : 0;
                    return (
                      <div key={point.month} className="nx-flex-1 nx-flex-col nx-gap-4 nx-min-w-0" style={{ alignItems: 'center' }}>
                        <div className="nx-w-full nx-h-full nx-flex" style={{ maxWidth: 40, flexDirection: 'column-reverse', alignItems: 'stretch' }}>
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
                                title={`${companyList.find((c) => c.id === companyId)?.nameAr || companyId}: ${fmt(amt, 2)} ﷼`}
                              />
                            );
                          })}
                        </div>
                        <div className="nx-text-2xs nx-text-muted nx-font-600">{point.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="nx-flex nx-flex-wrap nx-gap-16 nx-mt-16 nx-border-t" style={{ paddingTop: 12 }}>
              {idsToFetch.map((companyId, i) => {
                const c = companyList.find((x) => x.id === companyId);
                return (
                  <div key={companyId} className="flex items-center gap-6">
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                    <span className="nx-text-sm">{lang === 'ar' ? c?.nameAr || c?.nameEn : c?.nameEn || c?.nameAr}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* توزيع الأرباح */}
          <div className="noorix-surface-card nx-p-16 nx-border-all" style={{ borderRadius: CARD_BORDER_RADIUS }}>
            <div className="nx-text-xl nx-font-700" style={{ marginBottom: 14 }}>{t('ownerProfitDistribution')}</div>
            <div className="nx-stack-12">
              {aggregated.byCompany
                .filter((x) => Math.abs(x.netProfit) > 0.001)
                .sort((a, b) => b.netProfit - a.netProfit)
                .map((item, i) => {
                  const pct = aggregated.totalNetProfit !== 0 ? (item.netProfit / aggregated.totalNetProfit) * 100 : 0;
                  const barWidth = Math.min(100, Math.max(0, Math.abs(pct)));
                  const profitColor = item.netProfit >= 0 ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-red)';
                  return (
                    <div key={item.companyId}>
                      <div className="nx-flex-between nx-gap-8 nx-mb-4">
                        <div className="flex items-center gap-8 nx-min-w-0">
                          <span className="nx-flex-shrink-0" style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                          <span className="nx-text-base nx-font-600 nx-truncate">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-8 nx-flex-shrink-0">
                          <span className="nx-text-base nx-font-700 nx-font-numbers" style={{ color: profitColor }}>
                            {fmt(item.netProfit, 2)} ﷼
                          </span>
                          <span className="nx-text-xs nx-text-muted nx-text-end" style={{ minWidth: 38 }}>
                            {aggregated.totalNetProfit !== 0 ? `${fmt(pct, 1)}%` : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="nx-bg-muted nx-overflow-hidden" style={{ height: 6, borderRadius: 4 }}>
                        <div className="nx-h-full" style={{ width: `${barWidth}%`, background: profitColor, borderRadius: 4, transition: 'width 400ms ease' }} />
                      </div>
                    </div>
                  );
                })}
              {aggregated.byCompany.filter((x) => Math.abs(x.netProfit) > 0.001).length === 0 && (
                <div className="nx-p-24 nx-text-center nx-text-muted nx-text-base">{t('reportNoData')}</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
