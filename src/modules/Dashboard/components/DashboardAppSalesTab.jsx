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
      <div className="noorix-surface-card" style={{ padding: 24, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
        {t('pleaseSelectCompany')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div
          style={{
            borderRadius: CARD_BORDER_RADIUS,
            border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg-surface)',
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ height: 3, background: CARD_COLORS.sales.accent }} />
          <div style={{ padding: 16, background: 'var(--noorix-bg-surface)' }}>
            <div style={{ fontSize: 12, color: CARD_COLORS.sales.accent, marginBottom: 8, fontWeight: 700 }}>{t('dashboardAppSalesRatio')}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: CARD_COLORS.sales.accent, fontFamily: 'var(--noorix-font-numbers)' }}>
              {fmt(appPercent, 1)}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginTop: 6 }}>
              {fmt(yearApp, 2)} ﷼ / {fmt(yearTotal, 2)} ﷼
            </div>
          </div>
        </div>
      </div>

      {appByChannel.length > 0 && (
        <div
          style={{
            borderRadius: CARD_BORDER_RADIUS,
            border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg-surface)',
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            padding: 20,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--noorix-text)', marginBottom: 16 }}>{t('reportChannels')} — {t('dashboardAppSales')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {appByChannel.map((ch) => {
              const pct = yearTotal > 0 ? (ch.app / yearTotal) * 100 : 0;
              return (
                <div key={ch.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--noorix-bg-muted)', borderRadius: 8 }}>
                  <span style={{ fontWeight: 600 }}>{ch.name}</span>
                  <span style={{ fontFamily: 'var(--noorix-font-numbers)', fontWeight: 700, color: CARD_COLORS.sales.accent }}>{fmt(pct, 1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        style={{
          borderRadius: CARD_BORDER_RADIUS,
          border: '1px solid var(--noorix-border)',
          background: 'var(--noorix-bg-surface)',
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          padding: 20,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: CARD_COLORS.sales.accent, marginBottom: 16 }}>{t('dashboardAppSalesChart')}</div>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>{t('loading')}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 8, alignItems: 'end', minHeight: 100 }}>
            {chartData.map((point) => {
              const barHeight = `${Math.max(0, (point.percent / maxPercent) * 100)}%`;
              return (
                <div key={point.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', fontWeight: 600 }}>{point.label}</div>
                  <div style={{ width: '100%', height: 60, background: 'var(--noorix-bg-muted)', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
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
        )}
      </div>
    </div>
  );
}
