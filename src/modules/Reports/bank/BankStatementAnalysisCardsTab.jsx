/**
 * تبويب التحليل — رسوم بيانية احترافية وبطاقات قابلة للإضافة/الحذف
 */
import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { useTranslation } from '../../../i18n/useTranslation';
import { AVAILABLE_ANALYSIS_CARDS } from './useBankStatementView';
import { Button } from '../../../ui';
import {
  buildDailyChartData,
  buildDepositsByCategory,
  extractPosTerminals,
  topDebits,
  countPosLikeTransactions,
} from './bankAnalysisUtils';
import { fmt } from '../../../utils/format';
import BankStatementPieDrilldownModal from './BankStatementPieDrilldownModal';

const BAR_CHART_TOOLTIP_STYLE = {
  borderRadius: 10,
  border: '1px solid var(--noorix-border)',
  fontSize: 12,
  direction: 'rtl',
};

const COLORS = [
  'var(--noorix-accent-blue)', 'var(--noorix-accent-green)', '#ca8a04', 'var(--noorix-accent-red)', 'var(--noorix-accent-violet)',
  '#0891b2', '#db2777', 'var(--noorix-accent-violet)', '#ea580c', '#84cc16',
];

const RED_PIE_TINTS = ['var(--noorix-accent-red)', 'var(--noorix-accent-red)', 'var(--noorix-accent-red)', 'var(--color-danger-bg)', '#f87171'];
const GREEN_PIE_TINTS = ['var(--noorix-accent-green)', 'var(--noorix-accent-green)', 'var(--noorix-accent-green)', 'var(--noorix-accent-green)', '#4ade80'];

function pieSliceFill(mode, index, item) {
  if (mode === 'combined') {
    const pal = (item.debit || 0) >= (item.credit || 0) ? RED_PIE_TINTS : GREEN_PIE_TINTS;
    return pal[index % pal.length];
  }
  if (mode === 'debit') return RED_PIE_TINTS[index % RED_PIE_TINTS.length];
  return GREEN_PIE_TINTS[index % GREEN_PIE_TINTS.length];
}

/** جداول كبيرة تبقى بعرض الصف كاملاً؛ الرسوم والبطاقات الأصغر تُوزّع عمودين */
const ANALYSIS_CARD_FULL_WIDTH = new Set(['category_table', 'deposits_table', 'pos_terminals']);

function truncateLabel(str, max = 20) {
  const s = String(str || '');
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function estimateYAxisWidth(labels, minW = 140, maxW = 280) {
  if (!labels.length) return minW;
  const longest = Math.max(...labels.map((x) => String(x).length));
  return Math.min(maxW, Math.max(minW, 12 + Math.round(longest * 7.2)));
}

/* ── Tooltip مخصص للـ AreaChart ── */
function DailyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const deposits = payload.find((p) => p.dataKey === 'deposits')?.value ?? 0;
  const withdrawals = payload.find((p) => p.dataKey === 'withdrawals')?.value ?? 0;
  return (
    <div className="text-[12px] nx-rtl nx-recharts-tooltip-shell">
      <div className="font-bold text-noorix-text mb-1.5">{label}</div>
      <div className="text-noorix-green mb-1">
        إيداعات: <span className="nx-num-bold">{fmt(deposits)}</span>
      </div>
      <div className="text-noorix-red mb-1">
        سحوبات: <span className="nx-num-bold">{fmt(withdrawals)}</span>
      </div>
      <div
        className="font-bold nx-recharts-tooltip-footer"
        style={{ color: deposits - withdrawals >= 0 ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-rose)' }}
      >
        الصافي: <span className="inline-block ltr">{fmt(deposits - withdrawals)}</span>
      </div>
    </div>
  );
}

/* ── Tooltip مخصص للـ PieChart ── */
function PieTooltip({ active, payload, pieMode, t }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const p = d.payload;
  return (
    <div className="text-[12px] nx-rtl nx-recharts-tooltip-shell">
      <div className="font-bold text-noorix-text mb-1.5">{d.name}</div>
      {pieMode === 'combined' ? (
        <>
          <div className="text-noorix-red mb-[3px]">
            {t('bankStatementColDebit')}:{' '}
            <span className="nx-num-bold">{fmt(p.debit)}</span>
          </div>
          <div className="text-noorix-green mb-[3px]">
            {t('bankStatementColCredit')}:{' '}
            <span className="nx-num-bold">{fmt(p.credit)}</span>
          </div>
          <div className="font-bold mb-1 nx-recharts-tooltip-footer--loose">
            {t('bankPieCenterVolume')}:{' '}
            <span className="inline-block ltr">{fmt(d.value)}</span>
          </div>
        </>
      ) : (
        <div className="font-bold mb-1" style={{ color: p.fill }}>{fmt(d.value)}</div>
      )}
      <div className="text-noorix-muted">{p.percent}%</div>
      {p.count != null ? (
        <div className="text-noorix-muted text-[11px] mt-1">
          {t('bankStatementTransactions')}: {p.count}
        </div>
      ) : null}
    </div>
  );
}

/* ── غلاف بطاقة موحد ── */
function AnalysisCard({ cardId, title, icon, onRemove, removeLabel, children }) {
  return (
    <div className="noorix-surface-card nx-analysis-card">
      <div className="nx-analysis-card__head">
        <div className="nx-analysis-card__title-cluster">
          <span className="text-[20px] shrink-0 leading-none">{icon}</span>
          <span className="font-bold text-[15px] leading-[1.35]">{title}</span>
        </div>
        <Button size="sm" onClick={() => onRemove(cardId)} className="shrink-0 whitespace-nowrap">
          {removeLabel}
        </Button>
      </div>
      <div className="nx-analysis-card__body">{children}</div>
    </div>
  );
}

/* ── شريط تقدم بسيط ── */
function ProgressBar({ value, color = 'var(--noorix-accent-blue)', max = 100 }) {
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  return (
    <div className="nx-progress-track flex-1 min-w-0">
      <div className="nx-progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function BankStatementAnalysisCardsTab({
  statement,
  summaryByCategory,
  activeCards,
  availableToAdd,
  isCardActive,
  addCard,
  setCardToDelete,
  setCategoryFilter,
  setTypeFilter,
  setActiveTab,
  categories = [],
  showToast,
  onSaveTxCategory,
}) {
  const { t } = useTranslation();
  const txs = statement?.transactions || [];
  const [addOpen, setAddOpen] = useState(false);
  const [pieMode, setPieMode] = useState('combined');
  const [pieDrilldownCategory, setPieDrilldownCategory] = useState(null);

  const dailyData = useMemo(() => buildDailyChartData(txs), [txs]);
  const alerts = useMemo(() => topDebits(txs, 10), [txs]);
  const posCount = useMemo(() => countPosLikeTransactions(txs), [txs]);
  const posTerminals = useMemo(() => extractPosTerminals(txs), [txs]);
  const depositsByCategory = useMemo(() => buildDepositsByCategory(txs, t('uncategorized')), [txs, t]);

  /* بيانات PieChart — شامل / سحوبات / إيرادات */
  const pieDisplayData = useMemo(() => {
    const entries = Object.entries(summaryByCategory).map(([name, d]) => ({
      name,
      debit: d.totalDebit,
      credit: d.totalCredit,
      count: d.count,
    }));

    let rows;
    if (pieMode === 'combined') {
      rows = entries
        .map((e) => ({
          ...e,
          value: Math.round((e.debit + e.credit) * 100) / 100,
        }))
        .filter((x) => x.value > 0);
    } else if (pieMode === 'debit') {
      rows = entries
        .map((e) => ({ ...e, value: Math.round(e.debit * 100) / 100 }))
        .filter((x) => x.value > 0);
    } else {
      rows = entries
        .map((e) => ({ ...e, value: Math.round(e.credit * 100) / 100 }))
        .filter((x) => x.value > 0);
    }

    rows.sort((a, b) => b.value - a.value);
    rows = rows.slice(0, 10);
    const sliceTotal = rows.reduce((s, x) => s + x.value, 0);
    return rows.map((x) => ({
      ...x,
      percent: sliceTotal > 0 ? ((x.value / sliceTotal) * 100).toFixed(1) : '0',
    }));
  }, [summaryByCategory, pieMode]);

  const pieGrandTotals = useMemo(() => {
    const entries = Object.values(summaryByCategory);
    const totalDebit = entries.reduce((s, d) => s + d.totalDebit, 0);
    const totalCredit = entries.reduce((s, d) => s + d.totalCredit, 0);
    return {
      totalDebit,
      totalCredit,
      totalVolume: totalDebit + totalCredit,
    };
  }, [summaryByCategory]);

  /* أعمدة أفقية منفصلة: أوضح من دمج سحب+إيداع في نفس المخطط */
  const barRowsDebit = useMemo(
    () =>
      Object.entries(summaryByCategory)
        .map(([name, d]) => ({
          fullName: name,
          name: truncateLabel(name, 26),
          value: Math.round(d.totalDebit),
        }))
        .filter((x) => x.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    [summaryByCategory],
  );

  const barRowsCredit = useMemo(
    () =>
      Object.entries(summaryByCategory)
        .map(([name, d]) => ({
          fullName: name,
          name: truncateLabel(name, 26),
          value: Math.round(d.totalCredit),
        }))
        .filter((x) => x.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    [summaryByCategory],
  );

  const barDebitAxisW = useMemo(
    () => estimateYAxisWidth(barRowsDebit.map((r) => r.name)),
    [barRowsDebit],
  );
  const barCreditAxisW = useMemo(
    () => estimateYAxisWidth(barRowsCredit.map((r) => r.name)),
    [barRowsCredit],
  );

  /* جدول الفئات (للسحوبات والإيداعات) */
  const categoryRows = useMemo(() => {
    const totalDebit = Object.values(summaryByCategory).reduce((s, d) => s + d.totalDebit, 0);
    const totalCredit = Object.values(summaryByCategory).reduce((s, d) => s + d.totalCredit, 0);
    return Object.entries(summaryByCategory)
      .map(([name, d]) => ({
        name,
        count: d.count,
        debit: d.totalDebit,
        credit: d.totalCredit,
        debitPct: totalDebit > 0 ? (d.totalDebit / totalDebit) * 100 : 0,
        creditPct: totalCredit > 0 ? (d.totalCredit / totalCredit) * 100 : 0,
      }))
      .sort((a, b) => b.debit - a.debit);
  }, [summaryByCategory]);

  const totalDebit = categoryRows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = categoryRows.reduce((s, r) => s + r.credit, 0);

  const renderCard = (cardId) => {
    /* ── التدفق النقدي اليومي ── */
    if (cardId === 'cash_flow') {
      if (dailyData.length < 2) return null;
      return (
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardCashFlow')} icon="" onRemove={setCardToDelete} removeLabel={t('bankRemoveCard')}>
          <div className="w-full h-[260px]">
            <ResponsiveContainer>
              <AreaChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradDeposits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradWithdrawals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--noorix-accent-red)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--noorix-accent-red)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--noorix-border)" vertical={false} />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} width={60} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip content={<DailyTooltip />} />
                <ReferenceLine y={0} stroke="var(--noorix-text-muted-2)" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="deposits" stroke="#16a34a" strokeWidth={2} fill="url(#gradDeposits)" name="إيداعات" />
                <Area type="monotone" dataKey="withdrawals" stroke="var(--noorix-accent-red)" strokeWidth={2} fill="url(#gradWithdrawals)" name="سحوبات" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-6 mt-2.5 flex items-center">
            <div className="flex items-center gap-6 text-[12px]">
              <span className="nx-legend-dot nx-legend-dot--income" />
              <span>إيداعات</span>
            </div>
            <div className="flex items-center gap-6 text-[12px]">
              <span className="nx-legend-dot nx-legend-dot--expense" />
              <span>سحوبات</span>
            </div>
          </div>
        </AnalysisCard>
      );
    }

    /* ── التنبيهات: أكبر السحوبات ── */
    if (cardId === 'alerts') {
      return (
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardAlerts')} icon="⚠" onRemove={setCardToDelete} removeLabel={t('bankRemoveCard')}>
          {alerts.length === 0 ? (
            <p className="text-noorix-muted text-[13px]">لا توجد سحوبات.</p>
          ) : (
            <div className="grid gap-2.5">
              <div className="overflow-auto rounded-lg border border-noorix-border">
                <table className="w-full text-[12px] nx-table-collapse">
                  <thead>
                    <tr className="bg-noorix-bg-muted border-b border-noorix-border">
                      <th className="font-bold nx-th-pad">التاريخ</th>
                      <th className="font-bold nx-th-pad">الوصف</th>
                      <th className="font-bold whitespace-nowrap nx-th-pad">المبلغ</th>
                      <th className="font-bold nx-th-pad-center w-[100px]">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((tx, i) => (
                      <tr key={i} className={`nx-bank-row ${i % 2 ? 'nx-bank-row--b' : 'nx-bank-row--a'}`}>
                        <td className="text-noorix-muted whitespace-nowrap nx-td-pad">{tx.txDate}</td>
                        <td className="nx-td-pad max-w-[360px]">
                          <div className="truncate" title={tx.description || ''}>
                            {tx.description || '—'}
                          </div>
                        </td>
                        <td className="text-end nx-ltr font-extrabold text-noorix-red whitespace-nowrap nx-td-pad">
                          {fmt(Number(tx.debit))}
                        </td>
                        <td className="text-center nx-td-pad">
                          <Button size="sm" onClick={() => { setTypeFilter('debit'); setActiveTab('transactions'); }}>
                            {t('bankViewTransactions')}
                        </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </AnalysisCard>
      );
    }

    /* ── لمحة نقاط البيع ── */
    if (cardId === 'pos_hint') {
      return (
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardPosHint')} icon="" onRemove={setCardToDelete} removeLabel={t('bankRemoveCard')}>
          <div className="flex gap-4 flex flex-wrap">
            <div className="bg-noorix-bg-muted border border-noorix-border nx-stat-tile">
              <div className="font-extrabold text-noorix-blue text-[28px]">{posCount}</div>
              <div className="text-[11px] text-noorix-muted mt-1">عملية تشبه نقاط البيع</div>
            </div>
            <div className="bg-noorix-bg-muted border border-noorix-border nx-stat-tile">
              <div className="font-extrabold text-[28px] text-noorix-violet">{txs.length}</div>
              <div className="text-[11px] text-noorix-muted mt-1">إجمالي العمليات</div>
            </div>
          </div>
        </AnalysisCard>
      );
    }

    /* ── دائري التصنيفات ── */
    if (cardId === 'category_pie') {
      if (Object.keys(summaryByCategory).length === 0) return null;
      const pieTip = (props) => <PieTooltip {...props} pieMode={pieMode} t={t} />;
      const centerTitle =
        pieMode === 'combined'
          ? t('bankPieCenterVolume')
          : pieMode === 'debit'
            ? t('bankPieCenterWithdrawals')
            : t('bankPieCenterRevenue');
      const centerMain =
        pieMode === 'combined'
          ? pieGrandTotals.totalVolume
          : pieMode === 'debit'
            ? pieGrandTotals.totalDebit
            : pieGrandTotals.totalCredit;

      return (
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardCategoryPie')} icon="" onRemove={setCardToDelete} removeLabel={t('bankRemoveCard')}>
          <div className="flex items-center gap-8 flex flex-wrap mb-3.5">
            <span className="text-[12px] font-bold text-noorix-muted">{t('bankPieViewMode')}</span>
            {(['combined', 'debit', 'credit']).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={pieMode === m ? 'primary' : 'default'}
                onClick={() => setPieMode(m)}
              >
                {t(`bankPieMode_${m}`)}
              </Button>
            ))}
          </div>
          <p className="text-[12px] text-noorix-muted m-0 mb-3.5 nx-line-145">
            {t('bankPieLegendHint')}
          </p>
          <div className="flex flex-wrap gap-6 items-stretch">
            <div className="nx-pie-chart-wrap">
              {/* النص المركزي يُرسم أولاً ليبقى تحت tooltip الدائرة */}
              {pieDisplayData.length > 0 ? (
                <div className="nx-pie-center-label">
                  <div className="text-noorix-muted font-semibold text-[10px] nx-line-145">
                    {centerTitle}
                  </div>
                  <div className="font-extrabold text-noorix-text nx-ltr mt-1 text-[17px]">
                    {fmt(centerMain)}
                  </div>
                  {pieMode === 'combined' && (pieGrandTotals.totalDebit > 0 || pieGrandTotals.totalCredit > 0) ? (
                    <div className="text-[10px] mt-[6px] leading-[1.35]">
                      <div className="text-noorix-red nx-ltr">{fmt(pieGrandTotals.totalDebit)}</div>
                      <div className="text-noorix-green nx-ltr">{fmt(pieGrandTotals.totalCredit)}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {pieDisplayData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={pieDisplayData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={76}
                      outerRadius={120}
                      paddingAngle={2}
                      cursor="pointer"
                      isAnimationActive={false}
                      label={({ percent }) => (percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : '')}
                      labelLine={{ stroke: 'var(--noorix-text-muted-2)', strokeWidth: 1 }}
                      onClick={(_, index) => {
                        const item = pieDisplayData[index];
                        if (item?.name) setPieDrilldownCategory(item.name);
                      }}
                    >
                      {pieDisplayData.map((item, i) => (
                        <Cell
                          key={item.name}
                          fill={pieSliceFill(pieMode, i, item)}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={pieTip} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center bg-noorix-bg-muted rounded-xl text-[14px] text-noorix-muted h-[320px] nx-pie-empty-box">
                  {t('bankNoCategoryData')}
                </div>
              )}
            </div>
            <div className="flex flex-col nx-pie-legend-aside">
              <div className="text-[12px] font-bold text-noorix-muted mb-2.5">
                {t('bankPieCategoryKey')}
              </div>
              <div
                className="rounded-xl p-3 bg-noorix-bg-muted flex-1 min-w-0 grid gap-2 border border-noorix-border"
              >
                {pieDisplayData.length === 0 ? (
                  <span className="text-[12px] text-noorix-muted text-center p-3">
                    {t('bankNoCategoryData')}
                  </span>
                ) : (
                  pieDisplayData.map((item, i) => {
                    const dot = pieSliceFill(pieMode, i, item);
                    return (
                      <Button
                        key={item.name}
                        variant="ghost"
                        className="bank-pie-legend-row nx-bank-pie-legend-btn flex flex-col w-full text-[13px] text-end"
                        onClick={() => setPieDrilldownCategory(item.name)}
                      >
                        <div className="flex items-center gap-10 w-full">
                          <span
                            className="nx-bank-dot-10"
                            style={{ background: dot }}
                          />
                          <span className="flex-1 min-w-0 truncate font-semibold">
                            {item.name}
                          </span>
                          <span className="text-noorix-muted shrink-0 text-[12px]">{item.percent}%</span>
                          <span className="font-extrabold nx-ltr shrink-0 text-[13px]">{fmt(item.value)}</span>
                        </div>
                        {pieMode === 'combined' ? (
                          <div className="flex items-center justify-between gap-2 text-[11px] text-noorix-muted ps-5">
                            <span className="text-noorix-red">
                              {t('bankStatementColDebit')}: <strong className="nx-ltr">{fmt(item.debit)}</strong>
                            </span>
                            <span className="text-noorix-green">
                              {t('bankStatementColCredit')}: <strong className="nx-ltr">{fmt(item.credit)}</strong>
                            </span>
                          </div>
                        ) : null}
                      </Button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </AnalysisCard>
      );
    }

    /* ── أعمدة التصنيفات (سحوبات / إيداعات منفصلة) ── */
    if (cardId === 'category_bar') {
      if (!barRowsDebit.length && !barRowsCredit.length) return null;

      const renderBarBlock = (rows, blockTitle, color, yAxisW) => {
        if (!rows.length) return null;
        const h = Math.max(168, 52 + rows.length * 46);
        return (
          <div className="mb-2">
            <div className="text-[12px] font-bold text-noorix-muted border-b border-noorix-border nx-bank-bar-section-hdr">
              {blockTitle}
            </div>
            <div className="w-full" style={{ height: h }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 32, top: 6, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--noorix-border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: 'var(--noorix-text-muted)' }}
                    tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={yAxisW}
                    tick={{ fontSize: 12, fill: 'var(--noorix-text)' }}
                    interval={0}
                  />
                  <Tooltip
                    formatter={(v) => [fmt(Number(v)), blockTitle]}
                    labelFormatter={(_, p) => p?.[0]?.payload?.fullName || ''}
                    contentStyle={BAR_CHART_TOOLTIP_STYLE}
                  />
                  <Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      };

      return (
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardCategoryBar')} icon="" onRemove={setCardToDelete} removeLabel={t('bankRemoveCard')}>
          {renderBarBlock(barRowsDebit, 'أعلى الفئات — السحوبات', 'var(--noorix-accent-red)', barDebitAxisW)}
          {renderBarBlock(barRowsCredit, 'أعلى الفئات — الإيداعات', 'var(--noorix-accent-green)', barCreditAxisW)}
          <div className="flex flex flex-wrap mt-4 border-t border-noorix-border nx-bank-bar-legend-row">
            <div className="flex items-center gap-8 text-[12px]">
              <span className="nx-legend-dot--bar nx-legend-dot--bar-red" />
              <span className="font-semibold">سحوبات</span>
            </div>
            <div className="flex items-center gap-8 text-[12px]">
              <span className="nx-legend-dot--bar nx-legend-dot--bar-green" />
              <span className="font-semibold">إيداعات</span>
            </div>
          </div>
        </AnalysisCard>
      );
    }

    /* ── جدول الفئات ── */
    if (cardId === 'category_table') {
      return (
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardCategoryTable')} icon="" onRemove={setCardToDelete} removeLabel={t('bankRemoveCard')}>
          <div className="overflow-auto">
            <table className="w-full text-[12px] nx-table-collapse nx-table-min-540">
              <thead>
                <tr className="bg-noorix-bg-muted border-b-2 border-noorix-border">
                  <th className="font-bold whitespace-nowrap nx-th-pad">الفئة</th>
                  <th className="font-bold nx-th-pad-center">العمليات</th>
                  <th className="font-bold text-noorix-red whitespace-nowrap nx-th-pad">السحوبات</th>
                  <th className="font-bold text-noorix-green whitespace-nowrap nx-th-pad">الإيداعات</th>
                  <th className="font-bold nx-th-pad min-w-[120px]">النسبة (سحب)</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map((row, i) => (
                  <tr
                    key={row.name}
                    className={`nx-bank-row nx-bank-row--click ${i % 2 === 0 ? 'nx-bank-row--a' : 'nx-bank-row--b'}`}
                    onClick={() => { setCategoryFilter(row.name); setActiveTab('transactions'); }}
                    title="انقر لعرض عمليات هذه الفئة"
                  >
                    <td className="nx-td-pad-9">
                      <div className="flex items-center gap-7">
                        <span
                          className="nx-bank-dot-8"
                          style={{ background: COLORS[i % COLORS.length] }}
                        />
                        {row.name}
                      </div>
                    </td>
                    <td className="text-center text-noorix-muted nx-td-pad-9">{row.count}</td>
                    <td
                      className={`text-end nx-ltr nx-td-pad-9 ${row.debit > 0 ? 'text-noorix-red font-bold' : 'text-noorix-muted font-normal'}`}
                    >
                      {row.debit > 0 ? fmt(row.debit) : '—'}
                    </td>
                    <td
                      className={`text-end nx-ltr nx-td-pad-9 ${row.credit > 0 ? 'text-noorix-green font-bold' : 'text-noorix-muted font-normal'}`}
                    >
                      {row.credit > 0 ? fmt(row.credit) : '—'}
                    </td>
                    <td className="nx-td-pad-9">
                      <div className="flex items-center gap-8">
                        <ProgressBar value={row.debit} max={totalDebit} color={COLORS[i % COLORS.length]} />
                        <span className="text-noorix-muted shrink-0 min-w-[38px] nx-ltr text-start">
                          {row.debitPct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-extrabold bg-noorix-bg-muted border-t-2 border-noorix-border">
                  <td className="nx-td-pad-10">الإجمالي</td>
                  <td className="text-center nx-td-pad-10">
                    {categoryRows.reduce((s, r) => s + r.count, 0)}
                  </td>
                  <td className="text-end nx-ltr text-noorix-red nx-td-pad-10">{fmt(totalDebit)}</td>
                  <td className="text-end nx-ltr text-noorix-green nx-td-pad-10">{fmt(totalCredit)}</td>
                  <td className="text-noorix-muted nx-td-pad-10">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </AnalysisCard>
      );
    }

    /* ── جدول الإيداعات ── */
    if (cardId === 'deposits_table') {
      const totalDep = depositsByCategory.reduce((s, r) => s + r.total, 0);
      return (
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardDepositsTable')} icon="" onRemove={setCardToDelete} removeLabel={t('bankRemoveCard')}>
          {depositsByCategory.length === 0 ? (
            <p className="text-noorix-muted text-[13px]">لا توجد إيداعات.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-[12px] nx-table-collapse nx-table-min-400">
                <thead>
                  <tr className="bg-noorix-bg-muted border-b-2 border-noorix-border">
                    <th className="font-bold nx-th-pad">#</th>
                    <th className="font-bold nx-th-pad">الفئة</th>
                    <th className="font-bold nx-th-pad-center">العمليات</th>
                    <th className="font-bold text-noorix-green nx-th-pad">إجمالي الإيداعات</th>
                    <th className="font-bold nx-th-pad min-w-[120px]">النسبة</th>
                  </tr>
                </thead>
                <tbody>
                  {depositsByCategory.map((row, i) => {
                    const pct = totalDep > 0 ? (row.total / totalDep) * 100 : 0;
                    return (
                      <tr
                        key={row.name}
                        className={`nx-bank-row nx-bank-row--click ${i % 2 === 0 ? 'nx-bank-row--a' : 'nx-bank-row--b'}`}
                        onClick={() => { setCategoryFilter(row.name); setTypeFilter('credit'); setActiveTab('transactions'); }}
                      >
                        <td className="text-noorix-muted font-bold nx-td-pad-9">{i + 1}</td>
                        <td className="nx-td-pad-9">
                          <div className="flex items-center gap-7">
                            <span
                              className="nx-bank-dot-8"
                              style={{ background: COLORS[i % COLORS.length] }}
                            />
                            {row.name}
                          </div>
                        </td>
                        <td className="text-center text-noorix-muted nx-td-pad-9">{row.count}</td>
                        <td className="text-end nx-ltr text-noorix-green font-bold nx-td-pad-9">{fmt(row.total)}</td>
                        <td className="nx-td-pad-9">
                          <div className="flex items-center gap-8">
                            <ProgressBar value={row.total} max={totalDep} color="#16a34a" />
                            <span className="text-noorix-muted shrink-0 min-w-[38px] nx-ltr text-start">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-extrabold bg-noorix-bg-muted border-t-2 border-noorix-border">
                    <td colSpan={2} className="nx-td-pad-10">الإجمالي</td>
                    <td className="text-center nx-td-pad-10">{depositsByCategory.reduce((s, r) => s + r.count, 0)}</td>
                    <td className="text-end nx-ltr text-noorix-green nx-td-pad-10">{fmt(totalDep)}</td>
                    <td className="text-noorix-muted nx-td-pad-10">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </AnalysisCard>
      );
    }

    /* ── تحليل نقاط البيع ── */
    if (cardId === 'pos_terminals') {
      const totalPOS = posTerminals.reduce((s, t) => s + t.total, 0);
      return (
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardPosTerminals')} icon="" onRemove={setCardToDelete} removeLabel={t('bankRemoveCard')}>
          {posTerminals.length === 0 ? (
            <p className="text-noorix-muted text-[13px]">
              لم يتم الكشف عن أجهزة نقاط بيع في هذا الكشف.
            </p>
          ) : (
            <div className="grid gap-3">
              <div className="nx-grid-auto-fill-140">
                <div className="bg-noorix-bg-muted border border-noorix-border rounded-xl text-center py-3 px-3.5">
                  <div className="font-extrabold text-noorix-green text-[22px]">{posTerminals.reduce((s, t) => s + t.count, 0)}</div>
                  <div className="text-[11px] text-noorix-muted mt-1">عدد العمليات</div>
                </div>
                <div className="bg-noorix-bg-muted border border-noorix-border rounded-xl text-center py-3 px-3.5">
                  <div className="text-[18px] font-extrabold text-noorix-green nx-ltr">{fmt(totalPOS)}</div>
                  <div className="text-[11px] text-noorix-muted mt-1">إجمالي المبيعات</div>
                </div>
              </div>
              <div className="overflow-auto rounded-lg border border-noorix-border">
                <table className="w-full text-[12px] nx-table-collapse">
                  <thead>
                    <tr className="bg-noorix-bg-muted border-b border-noorix-border">
                      <th className="font-bold nx-th-pad w-10">#</th>
                      <th className="font-bold nx-th-pad">الجهاز</th>
                      <th className="font-bold nx-th-pad-center">العمليات</th>
                      <th className="font-bold nx-th-pad">المبلغ</th>
                      <th className="font-bold nx-th-pad">النسبة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posTerminals.slice(0, 8).map((term, i) => {
                      const pct = totalPOS > 0 ? (term.total / totalPOS) * 100 : 0;
                      return (
                        <tr key={term.terminalId} className={`nx-bank-row ${i % 2 ? 'nx-bank-row--b' : 'nx-bank-row--a'}`}>
                          <td className="font-bold text-noorix-muted nx-td-pad">{i + 1}</td>
                          <td className="nx-td-pad">
                            <code className="nx-code-inline">…{term.terminalId.slice(-8)}</code>
                          </td>
                          <td className="text-center nx-td-pad">{term.count}</td>
                          <td className="text-end nx-ltr font-extrabold text-noorix-green nx-td-pad">{fmt(term.total)}</td>
                          <td className="text-end nx-td-pad">
                            <div className="flex items-center justify-end gap-2">
                              <ProgressBar value={term.total} max={totalPOS} color={COLORS[i % COLORS.length]} />
                              <span className="text-[11px] text-noorix-muted min-w-[36px] nx-ltr text-start">{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </AnalysisCard>
      );
    }

    return null;
  };

  return (
    <div className="grid gap-[18px]">
      {/* شريط التحكم — إضافة بطاقات */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-noorix-bg-muted border border-noorix-border rounded-xl gap-2.5 px-4 py-3">
        <span className="text-[13px] text-noorix-muted">
          {activeCards.length} بطاقة معروضة
        </span>
        <div className="nx-bank-add-wrap">
          <Button
            size="sm"
            onClick={() => setAddOpen((v) => !v)}
            disabled={availableToAdd.length === 0}
          >
            + {t('bankAddAnalysisCard')}
            {availableToAdd.length > 0 && (
              <span className="nx-pill-count">
                {availableToAdd.length}
              </span>
            )}
          </Button>
          {addOpen && availableToAdd.length > 0 && (
            <div className="bank-analysis-add-menu nx-bank-add-menu">
              {availableToAdd.map((c) => (
                <Button
                  key={c.id}
                  variant="ghost"
                  className="bank-add-card-item nx-bank-add-menu-item flex items-center gap-2.5 w-full text-[13px] text-end border-b border-noorix-border"
                  onClick={() => { addCard(c.id); setAddOpen(false); }}
                >
                  <span>{c.icon}</span>
                  <span>{t(c.nameKey)}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* البطاقات — عمودان تلقائياً عندما تسمح الشاشة (min ~400px لكل عمود) */}
      <div className="grid nx-bank-cards-grid">
        {activeCards.map((id) => {
          const card = renderCard(id);
          if (!card) return null;
          const fullRow = ANALYSIS_CARD_FULL_WIDTH.has(id);
          return (
            <div
              key={id}
              className={`nx-bank-card-cell${fullRow ? ' nx-bank-card-cell--full' : ''}`}
            >
              {card}
            </div>
          );
        })}
      </div>

      {!activeCards.length && (
        <div className="text-center text-noorix-muted p-12">
          <div className="mb-4 text-[40px]" />
          <p className="text-[15px] font-semibold">{t('bankNoCardsPickAbove')}</p>
        </div>
      )}

      <BankStatementPieDrilldownModal
        open={!!pieDrilldownCategory}
        onClose={() => setPieDrilldownCategory(null)}
        categoryName={pieDrilldownCategory}
        transactions={txs}
        categories={categories}
        uncategorizedLabel={t('uncategorized')}
        t={t}
        onSaveTxCategory={onSaveTxCategory}
        showToast={showToast}
      />
    </div>
  );
}
