/**
 * DashboardAppSalesTab — نسبة مبيعات التطبيقات من المبيعات العامة + رسم بياني سنوي
 */
import React, { useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useSales } from '../../../hooks/useSales';
import { CARD_COLORS } from '../../../utils/cardStyles';
import { fmt } from '../../../utils/format';
import { EN_MONTHS } from '../../../modules/Reports/reportHelpers';

function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export default function DashboardAppSalesTab({ companyId, year, filter }) {
  const { t, lang } = useTranslation();

  const { summaries: allSummaries, isLoading } = useSales({
    companyId,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  });

  const { monthlyTotal, monthlyApp, appByChannel } = useMemo(() => {
    const totalByMonth = Array(12).fill(0);
    const appByMonth = Array(12).fill(0);
    const channelTotals = {};

    (allSummaries || []).forEach((s) => {
      const d = String(s.transactionDate || '').slice(0, 10);
      const month = parseInt(d.slice(5, 7), 10) - 1;
      if (month < 0 || month > 11) return;

      const total = Number(s.totalAmount || 0);
      totalByMonth[month] += total;

      let appAmount = 0;
      (s.channels || []).forEach((ch) => {
        const amt = Number(ch.amount || 0);
        const isApp = ch.vault?.type === 'app';
        if (isApp) appAmount += amt;
        const name = lang === 'en' ? (ch.vault?.nameEn || ch.vault?.nameAr) : (ch.vault?.nameAr || ch.vault?.nameEn);
        if (name) {
          channelTotals[name] = (channelTotals[name] || { total: 0, app: 0 });
          channelTotals[name].total += amt;
          if (isApp) channelTotals[name].app += amt;
        }
      });
      appByMonth[month] += appAmount;
    });

    return {
      monthlyTotal: totalByMonth,
      monthlyApp: appByMonth,
      appByChannel: Object.entries(channelTotals).map(([name, v]) => ({ name, ...v })).filter((c) => c.app > 0),
    };
  }, [allSummaries, lang]);

  const yearTotal = useMemo(() => monthlyTotal.reduce((a, b) => a + b, 0), [monthlyTotal]);
  const yearApp = useMemo(() => monthlyApp.reduce((a, b) => a + b, 0), [monthlyApp]);
  const appPercent = yearTotal > 0 ? (yearApp / yearTotal) * 100 : 0;

  const chartData = useMemo(() => {
    return monthlyTotal.map((total, i) => ({
      month: i + 1,
      label: EN_MONTHS[i],
      total,
      app: monthlyApp[i] || 0,
      percent: total > 0 ? ((monthlyApp[i] || 0) / total) * 100 : 0,
    }));
  }, [monthlyTotal, monthlyApp]);

  const maxPercent = useMemo(() => Math.max(1, ...chartData.map((d) => d.percent)), [chartData]);

  if (!companyId) {
    return (
      <div className="noorix-surface-card p-6 text-center text-noorix-muted">
        {t('pleaseSelectCompany')}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="noorix-surface-card text-center text-noorix-muted p-10">
        {t('loading')}
      </div>
    );
  }

  if (yearTotal === 0) {
    return (
      <div className="noorix-surface-card text-center text-noorix-muted p-12">
        <div className="mb-3 text-[40px] opacity-25"></div>
        <div className="text-[14px]">{t('noDataInPeriod')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex flex-col gap-6">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <div className="noorix-surface-card relative overflow-hidden">
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-1 z-[1]"
            style={{ background: CARD_COLORS.sales.accent }}
            aria-hidden
          />
          <div className="relative p-4">
            <div className="text-[12px] font-bold mb-2" style={{ color: CARD_COLORS.sales.accent }}>{t('dashboardAppSalesRatio')}</div>
            <div className="text-[28px] font-black nx-font-numbers" style={{ color: CARD_COLORS.sales.accent }}>
              {fmt(appPercent, 1)}%
            </div>
            <div className="text-[12px] text-noorix-muted mt-1.5">
              {fmt(yearApp)} / {fmt(yearTotal)} <span className="text-[11px] font-normal text-noorix-muted">SAR</span>
            </div>
            {yearApp === 0 && (
              <div className="mt-2 text-[11px] font-semibold text-noorix-amber">
                {t('dashboardNoAppSales')}
              </div>
            )}
          </div>
        </div>
      </div>

      {appByChannel.length > 0 && (
        <div className="noorix-surface-card overflow-hidden p-5">
          <div className="text-[14px] font-bold mb-4">{t('reportChannels')} — {t('dashboardAppSales')}</div>
          <div className="flex flex flex-col gap-2.5">
            {appByChannel.map((ch) => {
              const pct = yearTotal > 0 ? (ch.app / yearTotal) * 100 : 0;
              return (
                <div key={ch.name} className="flex items-center justify-between bg-noorix-bg-muted rounded-lg py-[10px] px-[14px]">
                  <span className="font-semibold">{ch.name}</span>
                  <span className="nx-font-numbers font-bold" style={{ color: CARD_COLORS.sales.accent }}>{fmt(pct, 1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="noorix-surface-card overflow-hidden p-5">
        <div className="text-[14px] font-bold mb-4" style={{ color: CARD_COLORS.sales.accent }}>{t('dashboardAppSalesChart')}</div>
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <div className="grid gap-2 items-end min-h-[100px] min-w-[360px] [grid-template-columns:repeat(12,minmax(36px,1fr))]">
            {chartData.map((point) => {
              const barHeight = `${Math.max(0, (point.percent / maxPercent) * 100)}%`;
              return (
                <div key={point.month} className="flex flex-col gap-1.5 items-center">
                  <div className="text-[11px] text-noorix-muted font-semibold">{point.label}</div>
                  <div className="w-full bg-noorix-bg-muted rounded-lg overflow-hidden h-[60px] flex items-end justify-center">
                    <div
                      style={{
                        width: '70%',
                        height: barHeight,
                        minHeight: point.percent > 0 ? 4 : 0,
                        background: CARD_COLORS.sales.accent,
                        borderRadius: '6px 6px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                    />
                  </div>
                  <div className="text-[10px] font-semibold nx-font-numbers" style={{ color: CARD_COLORS.sales.accent }}>
                    {fmt(point.percent, 1)}%
                  </div>
                </div>
              );
            })}
          </div>
          </div>
      </div>
    </div>
  );
}
