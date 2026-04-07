/**
 * DashboardOverviewTab — نظرة عامة: كروت KPI + رسم بياني للأداء + توزيع القنوات
 * تصميم 2026 — sparklines، Recharts AreaChart، PieChart
 */
import React, { useMemo, useState } from 'react';
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

/* ── أيقونات SVG للكروت ── */
function IconSales()     { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>; }
function IconPurchases() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>; }
function IconExpenses()  { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>; }
function IconProfit()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>; }

/* ── Sparkline SVG — منحنى سلس مع تظليل ── */
function SparkLine({ data = [], color = '#2563eb' }) {
  const nums = (data || []).map(v => Number(v || 0));
  if (!nums.length || nums.every(v => v === 0)) {
    /* منحنى فارغ لحجز المساحة */
    return <svg viewBox="0 0 100 52" preserveAspectRatio="none" width="100%" height="52" className="block" />;
  }
  const max  = Math.max(...nums, 1);
  const W = 100, H = 52, pad = 4;
  const n = nums.length;
  const xs = nums.map((_, i) => n === 1 ? W / 2 : (i / (n - 1)) * W);
  const ys = nums.map(v => pad + (1 - v / max) * (H - pad * 2));

  /* cubic bezier للحصول على منحنى سلس */
  function smoothPath() {
    if (n === 1) return `M ${xs[0]} ${ys[0]}`;
    let d = `M ${xs[0]} ${ys[0]}`;
    for (let i = 1; i < n; i++) {
      const cpX = (xs[i - 1] + xs[i]) / 2;
      d += ` C ${cpX} ${ys[i - 1]}, ${cpX} ${ys[i]}, ${xs[i]} ${ys[i]}`;
    }
    return d;
  }

  const linePath = smoothPath();
  const areaPath = `${linePath} L ${xs[n-1]} ${H} L ${xs[0]} ${H} Z`;
  const gradId   = `sp-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="52" className="block">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.20"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.01"/>
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath}  fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
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
    { key: 'sales',       icon: <IconSales />,     label: monthName ? `${t('revenueGroup')} — ${monthName}` : t('annualSales'),       colorClass: 'nx-kpi-card--sales',     accent: 'var(--noorix-accent-green)',  badgeLabel: t('sectionToSalesRatio'), badgeValue: '100' },
    { key: 'purchases',   icon: <IconPurchases />, label: monthName ? `${t('purchasesGroup')} — ${monthName}` : t('annualPurchases'), colorClass: 'nx-kpi-card--purchases', accent: 'var(--noorix-accent-blue)',   badgeLabel: t('purchasesToSalesRatio') },
    { key: 'expenses',    icon: <IconExpenses />,  label: monthName ? `${t('expensesGroup')} — ${monthName}` : t('annualExpenses'),   colorClass: 'nx-kpi-card--expenses',  accent: 'var(--noorix-accent-amber)',  badgeLabel: t('sectionToSalesRatio') },
    { key: 'grossProfit', icon: <IconProfit />,    label: t('annualGrossProfit'), colorClass: null, accent: null, badgeLabel: t('reportProfitMargin') },
    { key: 'netProfit',   icon: <IconProfit />,    label: t('annualNetProfit'),   colorClass: null, accent: null, badgeLabel: t('reportProfitMargin') },
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

  /* ── حالة: لا شركة ── */
  if (!companyId) {
    return <div className="p-8 text-center text-noorix-muted">{t('pleaseSelectCompany')}</div>;
  }

  /* ── حالة: تحميل ── */
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="nx-kpi-grid">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="nx-kpi-card min-h-[130px] bg-noorix-bg-muted shadow-none bg-[length:200%_100%] animate-[shimmer_1.4s_ease_infinite]" />
          ))}
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

  const salesSeries    = t('annualSales');
  const purchSeries    = t('annualPurchases');
  const expSeries      = t('annualExpenses');
  const isAnnualChart  = !selectedMonth;

  return (
    <div className="flex flex-col gap-5">

      {/* شريط التحليلات */}
      <PeriodAnalyticsStrip
        companyId={companyId}
        year={year}
        month={selectedMonth ?? null}
        enabled={canPeriodAnalytics}
      />

      {/* ── كروت KPI ── */}
      <div className="nx-kpi-grid">
        {cards.map((card) => {
          const rawVal    = getCardValue(card.key);
          const numVal    = Number(rawVal || 0);
          const isProfit  = card.key === 'grossProfit' || card.key === 'netProfit';
          const isSales   = card.key === 'sales';
          /* النسبة: الربح → هامش الربح بالنسبة للمبيعات | غيره → نسبته من المبيعات */
          const pct       = isSales ? null : getSectionPercentOfSales(card.key);
          const pctNum    = pct != null ? Number(pct) : null;

          const colorClass = card.colorClass ?? (isProfit
            ? (numVal >= 0 ? 'nx-kpi-card--profit' : 'nx-kpi-card--loss')
            : 'nx-kpi-card--neutral');

          /* لون sparkline */
          const accentColor = card.accent || (isProfit
            ? (numVal >= 0 ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-red)')
            : 'var(--noorix-accent-blue)');

          const sparkData = getMonthlyData(card.key);

          /* كلاس + سهم باج النسبة */
          let pctClass = 'nx-kpi-card__pct--neutral';
          let arrow    = '';
          if (isProfit && pctNum != null) {
            pctClass = pctNum >= 0 ? 'nx-kpi-card__pct--up' : 'nx-kpi-card__pct--down';
            arrow    = pctNum >= 0 ? '↑ ' : '↓ ';
          }

          return (
            <div key={card.key} className={`nx-kpi-card ${colorClass}`}>
              {/* العنوان */}
              <div className="nx-kpi-card__label">{card.label}</div>

              {/* صف: ر.س + الرقم الكبير + باج % */}
              <div className="nx-kpi-card__num-row">
                <span className="nx-kpi-card__sar">ر.س</span>
                <div className="nx-kpi-card__value">{amountText(rawVal)}</div>
                {pctNum != null && (
                  <span className={`nx-kpi-card__pct ${pctClass}`}>
                    {arrow}{Math.abs(pctNum)}%
                  </span>
                )}
              </div>

              {/* Sparkline — ممتد حتى الحواف */}
              <div className="nx-kpi-card__sparkline">
                <SparkLine data={sparkData} color={accentColor} />
              </div>

              {/* تذييل الكرت: الفترة الزمنية | تسمية المؤشر */}
              <div className="nx-kpi-card__footer">
                <span className="nx-kpi-card__footer-label">{filter?.label || year}</span>
                <span className="nx-kpi-card__footer-label">{card.badgeLabel}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── الرسوم البيانية: الأداء الشهري + توزيع القنوات ── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: channelData.length > 0 ? '1fr 340px' : '1fr' }}>

        {/* تحليل الأداء الشهري */}
        <div className="noorix-surface-card p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <div className="text-[14px] font-bold text-noorix-text">{t('dashboardSalesTimeline')}</div>
              <div className="text-[12px] text-noorix-muted mt-0.5">
                {filter?.label || year}
                {selectedMonth ? ` — ${monthName}` : ''}
              </div>
            </div>
            <div className="flex items-end gap-1.5">
              <span className="text-[18px] font-black nx-font-numbers" style={{ color: 'var(--noorix-accent-green)', direction: 'ltr' }}>
                {fmt(perfTotal, 0)}
              </span>
              <span className="nx-kpi-card__sar mb-0.5">SR</span>
            </div>
          </div>

          {performanceData.length === 0 || perfTotal === 0 ? (
            <div className="flex flex-col items-center justify-center text-noorix-muted gap-2 h-[200px]">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              <div className="text-[12px]">{t('noDataInPeriod')}</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={performanceData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02}/>
                  </linearGradient>
                  {isAnnualChart && <>
                    <linearGradient id="gradPurch" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02}/>
                    </linearGradient>
                    <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#d97706" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0.02}/>
                    </linearGradient>
                  </>}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--noorix-border)" opacity={0.6} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)', fontFamily: 'var(--noorix-font-primary)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)' }} axisLine={false} tickLine={false} width={46} />
                <Tooltip content={<ChartTooltip />} />
                {isAnnualChart && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
                <Area type="monotone" dataKey={salesSeries}  stroke="#16a34a" strokeWidth={2} fill="url(#gradSales)" dot={false} activeDot={{ r: 4 }} />
                {isAnnualChart && <>
                  <Area type="monotone" dataKey={purchSeries} stroke="#2563eb" strokeWidth={2} fill="url(#gradPurch)" dot={false} activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey={expSeries}   stroke="#d97706" strokeWidth={2} fill="url(#gradExp)"   dot={false} activeDot={{ r: 4 }} />
                </>}
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
