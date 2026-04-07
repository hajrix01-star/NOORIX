/**
 * DashboardAppSalesTab — نسبة مبيعات التطبيقات من المبيعات العامة + رسم بياني سنوي
 */
import React, { useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useSales } from '../../../hooks/useSales';
import { CARD_COLORS, CARD_BORDER_RADIUS } from '../../../utils/cardStyles';
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
      <div className="noorix-surface-card text-center text-noorix-muted" style={{ padding: 40 }}>
        {t('loading')}
      </div>
    );
  }

  if (yearTotal === 0) {
    return (
      <div className="rounded-xl border border-noorix-border bg-noorix-surface text-center text-noorix-muted" style={{ padding: 48, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div className="mb-3" style={{ fontSize: 40, opacity: 0.25 }}></div>
        <div className="text-[14px]">{t('noDataInPeriod')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex flex-col gap-6">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="nx-surface overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ height: 3, background: CARD_COLORS.sales.accent }} />
          <div className="p-4 bg-noorix-surface">
            <div className="text-[12px] font-bold mb-2" style={{ color: CARD_COLORS.sales.accent }}>{t('dashboardAppSalesRatio')}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: CARD_COLORS.sales.accent, fontFamily: 'var(--noorix-font-numbers)' }}>
              {fmt(appPercent, 1)}%
            </div>
            <div className="text-[12px] text-noorix-muted mt-1.5">
              {fmt(yearApp, 2)} ﷼ / {fmt(yearTotal, 2)} ﷼
            </div>
            {yearApp === 0 && (
              <div className="mt-2 text-[11px] font-semibold" style={{ color: 'var(--color-noorix-amber)' }}>
                {t('dashboardNoAppSales')}
              </div>
            )}
          </div>
        </div>
      </div>

      {appByChannel.length > 0 && (
        <div className="nx-surface overflow-hidden p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="text-[14px] font-bold mb-4">{t('reportChannels')} — {t('dashboardAppSales')}</div>
          <div className="flex flex flex-col gap-2.5">
            {appByChannel.map((ch) => {
              const pct = yearTotal > 0 ? (ch.app / yearTotal) * 100 : 0;
              return (
                <div key={ch.name} className="flex items-center justify-between bg-noorix-bg-muted rounded-lg" style={{ padding: '10px 14px' }}>
                  <span className="font-semibold">{ch.name}</span>
                  <span style={{ fontFamily: 'var(--noorix-font-numbers)', fontWeight: 700, color: CARD_COLORS.sales.accent }}>{fmt(pct, 1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="nx-surface overflow-hidden p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div className="text-[14px] font-bold mb-4" style={{ color: CARD_COLORS.sales.accent }}>{t('dashboardAppSalesChart')}</div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(12, minmax(36px, 1fr))', alignItems: 'end', minHeight: 100, minWidth: 360 }}>
            {chartData.map((point) => {
              const barHeight = `${Math.max(0, (point.percent / maxPercent) * 100)}%`;
              return (
                <div key={point.month} className="flex flex flex-col gap-1.5" style={{ alignItems: 'center' }}>
                  <div className="text-[11px] text-noorix-muted font-semibold">{point.label}</div>
                  <div className="w-full bg-noorix-bg-muted rounded-lg overflow-hidden" style={{ height: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
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
                  <div style={{ fontSize: 10, fontFamily: 'var(--noorix-font-numbers)', fontWeight: 600, color: CARD_COLORS.sales.accent }}>
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
