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

const COLORS = [
  '#2563eb', '#16a34a', '#ca8a04', '#dc2626', '#7c3aed',
  '#0891b2', '#db2777', '#4f46e5', '#ea580c', '#84cc16',
];

const RED_PIE_TINTS = ['#dc2626', '#b91c1c', '#ef4444', '#991b1b', '#f87171'];
const GREEN_PIE_TINTS = ['#16a34a', '#15803d', '#22c55e', '#166534', '#4ade80'];

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
    <div
      className="nx-text-sm nx-rtl"
      style={{
        background: 'var(--noorix-surface)',
        border: '1px solid var(--noorix-border)',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        minWidth: 170,
      }}
    >
      <div className="nx-font-700 nx-text-primary nx-mb-6">{label}</div>
      <div className="nx-text-income nx-mb-4">
        إيداعات: <span className="nx-num-bold">{fmt(deposits)}</span>
      </div>
      <div className="nx-text-expense nx-mb-4">
        سحوبات: <span className="nx-num-bold">{fmt(withdrawals)}</span>
      </div>
      <div
        className="nx-font-700"
        style={{
          borderTop: '1px solid var(--noorix-border)',
          paddingTop: 4,
          marginTop: 4,
          color: deposits - withdrawals >= 0 ? '#059669' : '#e11d48',
        }}
      >
        الصافي: <span className="nx-inline-ltr">{fmt(deposits - withdrawals)}</span>
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
    <div
      className="nx-text-sm nx-rtl"
      style={{
        background: 'var(--noorix-surface)',
        border: '1px solid var(--noorix-border)',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        minWidth: 168,
      }}
    >
      <div className="nx-font-700 nx-text-primary nx-mb-6">{d.name}</div>
      {pieMode === 'combined' ? (
        <>
          <div className="nx-text-expense" style={{ marginBottom: 3 }}>
            {t('bankStatementColDebit')}:{' '}
            <span className="nx-num-bold">{fmt(p.debit)}</span>
          </div>
          <div className="nx-text-income" style={{ marginBottom: 3 }}>
            {t('bankStatementColCredit')}:{' '}
            <span className="nx-num-bold">{fmt(p.credit)}</span>
          </div>
          <div
            className="nx-font-700 nx-mb-4"
            style={{
              borderTop: '1px solid var(--noorix-border)',
              paddingTop: 6,
              marginTop: 4,
            }}
          >
            {t('bankPieCenterVolume')}:{' '}
            <span className="nx-inline-ltr">{fmt(d.value)}</span>
          </div>
        </>
      ) : (
        <div className="nx-font-700 nx-mb-4" style={{ color: p.fill }}>{fmt(d.value)}</div>
      )}
      <div className="nx-text-muted">{p.percent}%</div>
      {p.count != null ? (
        <div className="nx-text-muted nx-text-xs nx-mt-4">
          {t('bankStatementTransactions')}: {p.count}
        </div>
      ) : null}
    </div>
  );
}

/* ── غلاف بطاقة موحد ── */
function AnalysisCard({ cardId, title, icon, onRemove, removeLabel, children }) {
  return (
    <div
      className="noorix-surface-card"
      style={{
        padding: 0,
        overflow: 'hidden',
        position: 'relative',
        borderRadius: 14,
        border: '1px solid var(--noorix-border)',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.06)',
        height: '100%',
      }}
    >
      <div
        className="nx-flex-between nx-gap-12"
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--noorix-border)',
          background: 'linear-gradient(180deg, var(--noorix-bg-muted) 0%, var(--noorix-surface) 100%)',
        }}
      >
        <div className="nx-flex-center nx-gap-10" style={{ minWidth: 0 }}>
          <span className="nx-text-3xl nx-flex-shrink-0" style={{ lineHeight: 1 }}>{icon}</span>
          <span className="nx-font-700 nx-text-lg" style={{ lineHeight: 1.35 }}>{title}</span>
        </div>
        <Button size="sm" onClick={() => onRemove(cardId)} className="nx-flex-shrink-0 nx-nowrap">
          {removeLabel}
        </Button>
      </div>
      <div style={{ padding: '18px 20px' }}>{children}</div>
    </div>
  );
}

/* ── شريط تقدم بسيط ── */
function ProgressBar({ value, color = '#2563eb', max = 100 }) {
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  return (
    <div className="nx-progress-track nx-flex-1">
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
          <div className="nx-w-full" style={{ height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradDeposits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradWithdrawals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--noorix-border)" vertical={false} />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} width={60} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip content={<DailyTooltip />} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="deposits" stroke="#16a34a" strokeWidth={2} fill="url(#gradDeposits)" name="إيداعات" />
                <Area type="monotone" dataKey="withdrawals" stroke="#dc2626" strokeWidth={2} fill="url(#gradWithdrawals)" name="سحوبات" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="nx-flex nx-gap-24 nx-mt-10" style={{ justifyContent: 'center' }}>
            <div className="nx-flex-center nx-gap-6 nx-text-sm">
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
              <span>إيداعات</span>
            </div>
            <div className="nx-flex-center nx-gap-6 nx-text-sm">
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
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
            <p className="nx-text-muted nx-text-base">لا توجد سحوبات.</p>
          ) : (
            <div className="nx-grid nx-gap-10">
              <div className="nx-overflow-auto nx-rounded nx-border-all">
                <table className="nx-w-full nx-text-sm" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="nx-bg-muted nx-border-b">
                      <th className="nx-font-700" style={{ padding: '8px 10px', textAlign: 'right' }}>التاريخ</th>
                      <th className="nx-font-700" style={{ padding: '8px 10px', textAlign: 'right' }}>الوصف</th>
                      <th className="nx-font-700 nx-nowrap" style={{ padding: '8px 10px', textAlign: 'right' }}>المبلغ</th>
                      <th className="nx-font-700 nx-text-center" style={{ padding: '8px 10px', width: 100 }}>إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((tx, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--noorix-border)', background: i % 2 ? 'var(--noorix-bg-muted)' : 'var(--noorix-bg-surface)' }}>
                        <td className="nx-text-muted nx-nowrap" style={{ padding: '8px 10px', verticalAlign: 'middle' }}>{tx.txDate}</td>
                        <td style={{ padding: '8px 10px', maxWidth: 360, verticalAlign: 'middle' }}>
                          <div className="nx-truncate" title={tx.description || ''}>
                            {tx.description || '—'}
                          </div>
                        </td>
                        <td className="nx-text-end nx-ltr nx-font-800 nx-text-expense nx-nowrap" style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
                          {fmt(Number(tx.debit))}
                        </td>
                        <td className="nx-text-center" style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
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
          <div className="nx-flex nx-gap-16 nx-flex-wrap">
            <div className="nx-bg-muted nx-border-all nx-text-center" style={{ flex: 1, minWidth: 100, padding: '12px 16px', borderRadius: 10 }}>
              <div className="nx-font-800 nx-text-info" style={{ fontSize: 28 }}>{posCount}</div>
              <div className="nx-text-xs nx-text-muted nx-mt-4">عملية تشبه نقاط البيع</div>
            </div>
            <div className="nx-bg-muted nx-border-all nx-text-center" style={{ flex: 1, minWidth: 100, padding: '12px 16px', borderRadius: 10 }}>
              <div className="nx-font-800" style={{ fontSize: 28, color: '#7c3aed' }}>{txs.length}</div>
              <div className="nx-text-xs nx-text-muted nx-mt-4">إجمالي العمليات</div>
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
          <div className="nx-flex-center nx-gap-8 nx-flex-wrap" style={{ marginBottom: 14 }}>
            <span className="nx-text-sm nx-font-700 nx-text-muted">{t('bankPieViewMode')}</span>
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
          <p className="nx-text-sm nx-text-muted" style={{ margin: '0 0 14px', lineHeight: 1.5 }}>
            {t('bankPieLegendHint')}
          </p>
          <div className="nx-flex-wrap nx-gap-24" style={{ alignItems: 'stretch' }}>
            <div style={{ flex: '1 1 300px', minWidth: 280, position: 'relative', height: 320 }}>
              {/* النص المركزي يُرسم أولاً ليبقى تحت tooltip الدائرة */}
              {pieDisplayData.length > 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    pointerEvents: 'none',
                    maxWidth: 132,
                    background: 'var(--noorix-bg-surface)',
                    borderRadius: 50,
                    padding: '8px 10px',
                    zIndex: 0,
                  }}
                >
                  <div className="nx-text-muted nx-font-600" style={{ fontSize: 10, lineHeight: 1.25 }}>
                    {centerTitle}
                  </div>
                  <div className="nx-font-800 nx-text-primary nx-ltr nx-mt-4" style={{ fontSize: 17 }}>
                    {fmt(centerMain)}
                  </div>
                  {pieMode === 'combined' && (pieGrandTotals.totalDebit > 0 || pieGrandTotals.totalCredit > 0) ? (
                    <div style={{ fontSize: 10, marginTop: 6, lineHeight: 1.35 }}>
                      <div className="nx-text-expense nx-ltr">{fmt(pieGrandTotals.totalDebit)}</div>
                      <div className="nx-text-income nx-ltr">{fmt(pieGrandTotals.totalCredit)}</div>
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
                      labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
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
                <div
                  className="nx-flex-center nx-bg-muted nx-rounded-lg nx-text-md nx-text-muted"
                  style={{
                    height: 320,
                    justifyContent: 'center',
                    border: '1px dashed var(--noorix-border)',
                  }}
                >
                  {t('bankNoCategoryData')}
                </div>
              )}
            </div>
            <div className="nx-flex-col" style={{ flex: '1 1 240px', minWidth: 220 }}>
              <div className="nx-text-sm nx-font-700 nx-text-muted" style={{ marginBottom: 10 }}>
                {t('bankPieCategoryKey')}
              </div>
              <div
                className="nx-rounded-lg nx-p-12 nx-bg-muted nx-flex-1 nx-grid nx-gap-8 nx-border-all"
              >
                {pieDisplayData.length === 0 ? (
                  <span className="nx-text-sm nx-text-muted nx-text-center nx-p-12">
                    {t('bankNoCategoryData')}
                  </span>
                ) : (
                  pieDisplayData.map((item, i) => {
                    const dot = pieSliceFill(pieMode, i, item);
                    return (
                      <Button
                        key={item.name}
                        variant="ghost"
                        className="bank-pie-legend-row nx-flex-col nx-w-full nx-text-base nx-text-end"
                        onClick={() => setPieDrilldownCategory(item.name)}
                        style={{
                          alignItems: 'stretch',
                          gap: 4,
                          padding: '8px 10px',
                          color: 'inherit',
                        }}
                      >
                        <div className="nx-flex-center nx-gap-10 nx-w-full">
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: dot,
                              flexShrink: 0,
                            }}
                          />
                          <span className="nx-flex-1 nx-truncate nx-font-600">
                            {item.name}
                          </span>
                          <span className="nx-text-muted nx-flex-shrink-0 nx-text-sm">{item.percent}%</span>
                          <span className="nx-font-800 nx-ltr nx-flex-shrink-0 nx-text-base">{fmt(item.value)}</span>
                        </div>
                        {pieMode === 'combined' ? (
                          <div
                            className="nx-flex-between nx-gap-8 nx-text-xs nx-text-muted"
                            style={{ paddingInlineStart: 20 }}
                          >
                            <span className="nx-text-expense">
                              {t('bankStatementColDebit')}: <strong className="nx-ltr">{fmt(item.debit)}</strong>
                            </span>
                            <span className="nx-text-income">
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
          <div className="nx-mb-8">
            <div
              className="nx-text-sm nx-font-700 nx-text-muted nx-border-b"
              style={{ marginBottom: 10, paddingBottom: 6 }}
            >
              {blockTitle}
            </div>
            <div className="nx-w-full" style={{ height: h }}>
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
                    contentStyle={{
                      borderRadius: 10,
                      border: '1px solid var(--noorix-border)',
                      fontSize: 12,
                      direction: 'rtl',
                    }}
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
          {renderBarBlock(barRowsDebit, 'أعلى الفئات — السحوبات', '#dc2626', barDebitAxisW)}
          {renderBarBlock(barRowsCredit, 'أعلى الفئات — الإيداعات', '#16a34a', barCreditAxisW)}
          <div
            className="nx-flex nx-flex-wrap nx-mt-16 nx-border-t"
            style={{ justifyContent: 'center', gap: 28, paddingTop: 16 }}
          >
            <div className="nx-flex-center nx-gap-8 nx-text-sm">
              <span style={{ width: 14, height: 14, borderRadius: 4, background: '#dc2626', display: 'inline-block' }} />
              <span className="nx-font-600">سحوبات</span>
            </div>
            <div className="nx-flex-center nx-gap-8 nx-text-sm">
              <span style={{ width: 14, height: 14, borderRadius: 4, background: '#16a34a', display: 'inline-block' }} />
              <span className="nx-font-600">إيداعات</span>
            </div>
          </div>
        </AnalysisCard>
      );
    }

    /* ── جدول الفئات ── */
    if (cardId === 'category_table') {
      return (
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardCategoryTable')} icon="" onRemove={setCardToDelete} removeLabel={t('bankRemoveCard')}>
          <div className="nx-overflow-auto">
            <table className="nx-w-full nx-text-sm" style={{ borderCollapse: 'collapse', minWidth: 540 }}>
              <thead>
                <tr className="nx-bg-muted" style={{ borderBottom: '2px solid var(--noorix-border)' }}>
                  <th className="nx-font-700 nx-nowrap" style={{ padding: '8px 10px', textAlign: 'right' }}>الفئة</th>
                  <th className="nx-font-700 nx-text-center" style={{ padding: '8px 10px' }}>العمليات</th>
                  <th className="nx-font-700 nx-text-expense nx-nowrap" style={{ padding: '8px 10px', textAlign: 'right' }}>السحوبات</th>
                  <th className="nx-font-700 nx-text-income nx-nowrap" style={{ padding: '8px 10px', textAlign: 'right' }}>الإيداعات</th>
                  <th className="nx-font-700" style={{ padding: '8px 10px', minWidth: 120 }}>النسبة (سحب)</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map((row, i) => (
                  <tr
                    key={row.name}
                    style={{
                      borderBottom: '1px solid var(--noorix-border)',
                      background: i % 2 === 0 ? 'var(--noorix-bg-surface)' : 'var(--noorix-bg-muted)',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onClick={() => { setCategoryFilter(row.name); setActiveTab('transactions'); }}
                    title="انقر لعرض عمليات هذه الفئة"
                  >
                    <td style={{ padding: '9px 10px' }}>
                      <div className="nx-flex-center" style={{ gap: 7 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: COLORS[i % COLORS.length],
                            flexShrink: 0,
                          }}
                        />
                        {row.name}
                      </div>
                    </td>
                    <td className="nx-text-center nx-text-muted" style={{ padding: '9px 10px' }}>{row.count}</td>
                    <td
                      className="nx-text-end nx-ltr"
                      style={{ padding: '9px 10px', color: row.debit > 0 ? '#dc2626' : 'var(--noorix-text-muted)', fontWeight: row.debit > 0 ? 700 : 400 }}
                    >
                      {row.debit > 0 ? fmt(row.debit) : '—'}
                    </td>
                    <td
                      className="nx-text-end nx-ltr"
                      style={{ padding: '9px 10px', color: row.credit > 0 ? '#16a34a' : 'var(--noorix-text-muted)', fontWeight: row.credit > 0 ? 700 : 400 }}
                    >
                      {row.credit > 0 ? fmt(row.credit) : '—'}
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      <div className="nx-flex-center nx-gap-8">
                        <ProgressBar value={row.debit} max={totalDebit} color={COLORS[i % COLORS.length]} />
                        <span className="nx-text-muted nx-flex-shrink-0" style={{ minWidth: 38, textAlign: 'left' }}>
                          {row.debitPct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="nx-font-800 nx-bg-muted" style={{ borderTop: '2px solid var(--noorix-border)' }}>
                  <td style={{ padding: '10px' }}>الإجمالي</td>
                  <td className="nx-text-center" style={{ padding: '10px' }}>
                    {categoryRows.reduce((s, r) => s + r.count, 0)}
                  </td>
                  <td className="nx-text-end nx-ltr nx-text-expense" style={{ padding: '10px' }}>{fmt(totalDebit)}</td>
                  <td className="nx-text-end nx-ltr nx-text-income" style={{ padding: '10px' }}>{fmt(totalCredit)}</td>
                  <td className="nx-text-muted" style={{ padding: '10px' }}>100%</td>
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
            <p className="nx-text-muted nx-text-base">لا توجد إيداعات.</p>
          ) : (
            <div className="nx-overflow-auto">
              <table className="nx-w-full nx-text-sm" style={{ borderCollapse: 'collapse', minWidth: 400 }}>
                <thead>
                  <tr className="nx-bg-muted" style={{ borderBottom: '2px solid var(--noorix-border)' }}>
                    <th className="nx-font-700" style={{ padding: '8px 10px', textAlign: 'right' }}>#</th>
                    <th className="nx-font-700" style={{ padding: '8px 10px', textAlign: 'right' }}>الفئة</th>
                    <th className="nx-font-700 nx-text-center" style={{ padding: '8px 10px' }}>العمليات</th>
                    <th className="nx-font-700 nx-text-income" style={{ padding: '8px 10px', textAlign: 'right' }}>إجمالي الإيداعات</th>
                    <th className="nx-font-700" style={{ padding: '8px 10px', minWidth: 120 }}>النسبة</th>
                  </tr>
                </thead>
                <tbody>
                  {depositsByCategory.map((row, i) => {
                    const pct = totalDep > 0 ? (row.total / totalDep) * 100 : 0;
                    return (
                      <tr
                        key={row.name}
                        style={{
                          borderBottom: '1px solid var(--noorix-border)',
                          background: i % 2 === 0 ? 'var(--noorix-bg-surface)' : 'var(--noorix-bg-muted)',
                          cursor: 'pointer',
                        }}
                        onClick={() => { setCategoryFilter(row.name); setTypeFilter('credit'); setActiveTab('transactions'); }}
                      >
                        <td className="nx-text-muted nx-font-700" style={{ padding: '9px 10px' }}>{i + 1}</td>
                        <td style={{ padding: '9px 10px' }}>
                          <div className="nx-flex-center" style={{ gap: 7 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                            {row.name}
                          </div>
                        </td>
                        <td className="nx-text-center nx-text-muted" style={{ padding: '9px 10px' }}>{row.count}</td>
                        <td className="nx-text-end nx-ltr nx-text-income nx-font-700" style={{ padding: '9px 10px' }}>{fmt(row.total)}</td>
                        <td style={{ padding: '9px 10px' }}>
                          <div className="nx-flex-center nx-gap-8">
                            <ProgressBar value={row.total} max={totalDep} color="#16a34a" />
                            <span className="nx-text-muted nx-flex-shrink-0" style={{ minWidth: 38, textAlign: 'left' }}>{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="nx-font-800 nx-bg-muted" style={{ borderTop: '2px solid var(--noorix-border)' }}>
                    <td colSpan={2} style={{ padding: '10px' }}>الإجمالي</td>
                    <td className="nx-text-center" style={{ padding: '10px' }}>{depositsByCategory.reduce((s, r) => s + r.count, 0)}</td>
                    <td className="nx-text-end nx-ltr nx-text-income" style={{ padding: '10px' }}>{fmt(totalDep)}</td>
                    <td className="nx-text-muted" style={{ padding: '10px' }}>100%</td>
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
            <p className="nx-text-muted nx-text-base">
              لم يتم الكشف عن أجهزة نقاط بيع في هذا الكشف.
            </p>
          ) : (
            <div className="nx-grid nx-gap-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                <div className="nx-bg-muted nx-border-all nx-rounded-lg nx-text-center" style={{ padding: '12px 14px' }}>
                  <div className="nx-font-800 nx-text-income" style={{ fontSize: 22 }}>{posTerminals.reduce((s, t) => s + t.count, 0)}</div>
                  <div className="nx-text-xs nx-text-muted nx-mt-4">عدد العمليات</div>
                </div>
                <div className="nx-bg-muted nx-border-all nx-rounded-lg nx-text-center" style={{ padding: '12px 14px' }}>
                  <div className="nx-text-2xl nx-font-800 nx-text-income nx-ltr">{fmt(totalPOS)}</div>
                  <div className="nx-text-xs nx-text-muted nx-mt-4">إجمالي المبيعات</div>
                </div>
              </div>
              <div className="nx-overflow-auto nx-rounded nx-border-all">
                <table className="nx-w-full nx-text-sm" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="nx-bg-muted nx-border-b">
                      <th className="nx-font-700" style={{ padding: '8px 10px', textAlign: 'right', width: 40 }}>#</th>
                      <th className="nx-font-700" style={{ padding: '8px 10px', textAlign: 'right' }}>الجهاز</th>
                      <th className="nx-font-700 nx-text-center" style={{ padding: '8px 10px' }}>العمليات</th>
                      <th className="nx-font-700" style={{ padding: '8px 10px', textAlign: 'right' }}>المبلغ</th>
                      <th className="nx-font-700" style={{ padding: '8px 10px', textAlign: 'right' }}>النسبة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posTerminals.slice(0, 8).map((term, i) => {
                      const pct = totalPOS > 0 ? (term.total / totalPOS) * 100 : 0;
                      return (
                        <tr key={term.terminalId} style={{ borderBottom: '1px solid var(--noorix-border)', background: i % 2 ? 'var(--noorix-bg-muted)' : 'var(--noorix-bg-surface)' }}>
                          <td className="nx-font-700 nx-text-muted" style={{ padding: '8px 10px' }}>{i + 1}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <code style={{ fontSize: 11, background: 'var(--noorix-border)', padding: '4px 8px', borderRadius: 6 }}>…{term.terminalId.slice(-8)}</code>
                          </td>
                          <td className="nx-text-center" style={{ padding: '8px 10px' }}>{term.count}</td>
                          <td className="nx-text-end nx-ltr nx-font-800 nx-text-income" style={{ padding: '8px 10px' }}>{fmt(term.total)}</td>
                          <td className="nx-text-end" style={{ padding: '8px 10px' }}>
                            <div className="nx-flex-end nx-gap-8">
                              <ProgressBar value={term.total} max={totalPOS} color={COLORS[i % COLORS.length]} />
                              <span className="nx-text-xs nx-text-muted" style={{ minWidth: 36 }}>{pct.toFixed(1)}%</span>
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
    <div className="nx-grid" style={{ gap: 18 }}>
      {/* شريط التحكم — إضافة بطاقات */}
      <div className="nx-row-between nx-bg-muted nx-border-all nx-rounded-lg nx-gap-10 nx-px-16 nx-py-12">
        <span className="nx-text-base nx-text-muted">
          {activeCards.length} بطاقة معروضة
        </span>
        <div style={{ position: 'relative' }}>
          <Button
            size="sm"
            onClick={() => setAddOpen((v) => !v)}
            disabled={availableToAdd.length === 0}
          >
            + {t('bankAddAnalysisCard')}
            {availableToAdd.length > 0 && (
              <span
                style={{
                  background: 'var(--noorix-accent-blue)',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 18,
                  height: 18,
                  fontSize: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  marginInlineStart: 6,
                }}
              >
                {availableToAdd.length}
              </span>
            )}
          </Button>
          {addOpen && availableToAdd.length > 0 && (
            <div
              className="bank-analysis-add-menu"
              style={{
                position: 'absolute',
                top: '110%',
                insetInlineEnd: 0,
                background: 'var(--noorix-surface)',
                border: '1px solid var(--noorix-border)',
                borderRadius: 10,
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                minWidth: 220,
                zIndex: 200,
                overflow: 'hidden',
              }}
            >
              {availableToAdd.map((c) => (
                <Button
                  key={c.id}
                  variant="ghost"
                  className="bank-add-card-item nx-flex-center nx-gap-10 nx-w-full nx-text-base nx-text-end nx-border-b"
                  style={{ padding: '10px 14px' }}
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
      <div
        className="nx-grid"
        style={{
          gap: 18,
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 400px), 1fr))',
          alignItems: 'stretch',
        }}
      >
        {activeCards.map((id) => {
          const card = renderCard(id);
          if (!card) return null;
          const fullRow = ANALYSIS_CARD_FULL_WIDTH.has(id);
          return (
            <div
              key={id}
              style={{
                minWidth: 0,
                ...(fullRow ? { gridColumn: '1 / -1' } : {}),
              }}
            >
              {card}
            </div>
          );
        })}
      </div>

      {!activeCards.length && (
        <div className="nx-text-center nx-text-muted" style={{ padding: 48 }}>
          <div className="nx-mb-16" style={{ fontSize: 40 }}></div>
          <p className="nx-text-lg nx-font-600">{t('bankNoCardsPickAbove')}</p>
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
