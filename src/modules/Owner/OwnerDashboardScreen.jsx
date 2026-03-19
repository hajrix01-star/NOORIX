/**
 * OwnerDashboardScreen — لوحة المالك
 * مؤشرات شاملة: المبيعات الشهرية لكل شركة، الأرباح المجمعة، توزيع الأرباح
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import { useOwnerReports } from '../../hooks/useOwnerReports';
import { EN_MONTHS } from '../Reports/reportHelpers';
import { fmt } from '../../utils/format';
import { CARD_BORDER_RADIUS } from '../../utils/cardStyles';
import { exportToExcel, exportTableToPdf } from '../../utils/exportUtils';

const COLORS = ['#16a34a', '#2563eb', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#4f46e5', '#059669'];

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
  const idsToFetch = selectedCompanyIds.size > 0 ? [...selectedCompanyIds] : companyList.map((c) => c.id);
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
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('ownerDashboard')}</h1>
        <div className="noorix-surface-card" style={{ padding: 32, textAlign: 'center', color: 'var(--noorix-text-muted)', marginTop: 16 }}>
          {t('pleaseSelectCompany')}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('ownerDashboard')}</h1>
          <p style={{ marginTop: 6, color: 'var(--noorix-text-muted)', maxWidth: 700 }}>{t('ownerDashboardDesc')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('reportYear')}</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)' }}
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <label style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('reportMonth')}</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)', minWidth: 120 }}
          >
            <option value="">{t('allMonths')}</option>
            {EN_MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={handleExportExcel} style={{ padding: '8px 12px', fontSize: 12 }}>📥 Excel</button>
          <button type="button" className="noorix-btn-nav" onClick={handleExportPdf} style={{ padding: '8px 12px', fontSize: 12 }}>📄 PDF</button>
        </div>
      </div>

      {/* اختيار الشركات — أزرار عين */}
      <div className="noorix-surface-card" style={{ padding: 16, border: '1px solid var(--noorix-border)', borderRadius: CARD_BORDER_RADIUS }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>{t('ownerSelectCompanies')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button type="button" className="noorix-btn-nav" onClick={selectAll} style={{ padding: '6px 10px', fontSize: 11 }}>{t('ownerAllCompanies')}</button>
          <button type="button" className="noorix-btn-nav" onClick={selectNone} style={{ padding: '6px 10px', fontSize: 11 }}>{lang === 'ar' ? 'إخفاء الكل' : 'Hide all'}</button>
          {companyList.map((c, i) => {
            const isVisible = selectedCompanyIds.has(c.id) || selectedCompanyIds.size === 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCompany(c.id)}
                title={isVisible ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'عرض' : 'Show')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: `1px solid ${isVisible ? COLORS[i % COLORS.length] : 'var(--noorix-border)'}`,
                  background: isVisible ? `${COLORS[i % COLORS.length]}18` : 'var(--noorix-bg-muted)',
                  color: isVisible ? COLORS[i % COLORS.length] : 'var(--noorix-text-muted)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" fill={isVisible ? 'currentColor' : 'none'} />
                </svg>
                <span>{lang === 'ar' ? c.nameAr || c.nameEn : c.nameEn || c.nameAr}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && (
        <div className="noorix-surface-card" style={{ padding: 32, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>{t('loading')}</div>
      )}

      {isError && (
        <div className="noorix-surface-card" style={{ padding: 20, color: '#dc2626', background: 'rgba(239,68,68,0.08)' }}>{error?.message || t('loading')}</div>
      )}

      {!isLoading && !isError && idsToFetch.length > 0 && (
        <>
          {/* كروت الإجماليات + النسب */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div style={{ borderRadius: CARD_BORDER_RADIUS, border: '1px solid var(--noorix-border)', overflow: 'hidden', background: 'var(--noorix-bg-surface)' }}>
              <div style={{ height: 3, background: '#16a34a' }} />
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 4 }}>{t('ownerTotalSales')}</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(aggregated.totalSales, 2)} ﷼</div>
                <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', marginTop: 4 }}>100%</div>
              </div>
            </div>
            <div style={{ borderRadius: CARD_BORDER_RADIUS, border: '1px solid var(--noorix-border)', overflow: 'hidden', background: 'var(--noorix-bg-surface)' }}>
              <div style={{ height: 3, background: '#dc2626' }} />
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 4 }}>{t('purchasesToSalesRatio')}</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)', color: '#dc2626' }}>
                  {aggregated.totalSales > 0 ? fmt((aggregated.totalPurchases / aggregated.totalSales) * 100, 1) : '—'}%
                </div>
                <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', marginTop: 4 }}>{fmt(aggregated.totalPurchases, 2)} ﷼</div>
              </div>
            </div>
            <div style={{ borderRadius: CARD_BORDER_RADIUS, border: '1px solid var(--noorix-border)', overflow: 'hidden', background: 'var(--noorix-bg-surface)' }}>
              <div style={{ height: 3, background: '#b91c1c' }} />
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 4 }}>{t('annualExpenses')} {t('sectionToSalesRatio')}</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)', color: '#b91c1c' }}>
                  {aggregated.totalSales > 0 ? fmt((aggregated.totalExpenses / aggregated.totalSales) * 100, 1) : '—'}%
                </div>
                <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', marginTop: 4 }}>{fmt(aggregated.totalExpenses, 2)} ﷼</div>
              </div>
            </div>
            <div style={{ borderRadius: CARD_BORDER_RADIUS, border: '1px solid var(--noorix-border)', overflow: 'hidden', background: 'var(--noorix-bg-surface)' }}>
              <div style={{ height: 3, background: aggregated.totalNetProfit >= 0 ? '#2563eb' : '#dc2626' }} />
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 4 }}>{t('ownerTotalNetProfit')}</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)', color: aggregated.totalNetProfit >= 0 ? '#2563eb' : '#dc2626' }}>
                  {fmt(aggregated.totalNetProfit, 2)} ﷼
                </div>
                <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', marginTop: 4 }}>
                  {aggregated.totalSales > 0 ? fmt((aggregated.totalNetProfit / aggregated.totalSales) * 100, 1) + '%' : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* المبيعات الشهرية — رسم بياني */}
          <div className="noorix-surface-card" style={{ padding: 24, border: '1px solid var(--noorix-border)', borderRadius: CARD_BORDER_RADIUS }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{t('ownerMonthlySales')} — {year}{selectedMonthNum ? ` (${EN_MONTHS[selectedMonthNum - 1]})` : ''}</div>
            <div style={{ display: 'flex', gap: 0, minHeight: 220 }}>
              <div style={{ flexShrink: 0, width: 48, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 28 }}>
                {[...yAxisTicks].reverse().map((tick) => (
                  <div key={tick} style={{ fontSize: 10, fontFamily: 'var(--noorix-font-numbers)', color: 'var(--noorix-text-muted)', fontWeight: 600 }}>
                    {formatAxisValue(tick)}
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 180, paddingBottom: 28 }}>
                  {chartData.map((point) => {
                    const companyAmounts = point.byCompany || {};
                    const total = Object.values(companyAmounts).reduce((a, b) => a + b, 0);
                    const barHeightPct = maxChartValue > 0 ? (total / maxChartValue) * 100 : 0;
                    return (
                      <div key={point.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
                        <div style={{ width: '100%', maxWidth: 40, height: '100%', display: 'flex', flexDirection: 'column-reverse', alignItems: 'stretch' }}>
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
                        <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', fontWeight: 600 }}>{point.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--noorix-border)' }}>
              {idsToFetch.map((companyId, i) => {
                const c = companyList.find((x) => x.id === companyId);
                return (
                  <div key={companyId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                    <span style={{ fontSize: 12 }}>{lang === 'ar' ? c?.nameAr || c?.nameEn : c?.nameEn || c?.nameAr}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* توزيع الأرباح */}
          <div className="noorix-surface-card" style={{ padding: 24, border: '1px solid var(--noorix-border)', borderRadius: CARD_BORDER_RADIUS }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('ownerProfitDistribution')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {aggregated.byCompany
                .filter((x) => Math.abs(x.netProfit) > 0.001)
                .sort((a, b) => b.netProfit - a.netProfit)
                .map((item, i) => {
                  const pct = aggregated.totalNetProfit !== 0 ? (item.netProfit / aggregated.totalNetProfit) * 100 : 0;
                  const barWidth = Math.min(100, Math.max(0, Math.abs(pct)));
                  return (
                    <div key={item.companyId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                      <span style={{ minWidth: 120, fontSize: 13 }}>{item.name}</span>
                      <div style={{ flex: 1, height: 20, background: 'var(--noorix-bg-muted)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                        <div
                          style={{
                            width: `${barWidth}%`,
                            height: '100%',
                            background: item.netProfit >= 0 ? '#16a34a' : '#dc2626',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      <span style={{ minWidth: 90, fontSize: 13, fontWeight: 700, fontFamily: 'var(--noorix-font-numbers)', color: item.netProfit >= 0 ? '#16a34a' : '#dc2626', textAlign: 'right' }}>
                        {fmt(item.netProfit, 2)} ﷼
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--noorix-text-muted)', minWidth: 45 }}>
                        {aggregated.totalNetProfit !== 0 ? `${fmt(pct, 1)}%` : '—'}
                      </span>
                    </div>
                  );
                })}
              {aggregated.byCompany.filter((x) => Math.abs(x.netProfit) > 0.001).length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--noorix-text-muted)', fontSize: 13 }}>{t('reportNoData')}</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
