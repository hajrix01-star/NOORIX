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
      style={{
        background: 'var(--noorix-surface)',
        border: '1px solid var(--noorix-border)',
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        minWidth: 170,
        direction: 'rtl',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--noorix-text)' }}>{label}</div>
      <div style={{ color: '#16a34a', marginBottom: 4 }}>
        إيداعات: <span style={{ direction: 'ltr', display: 'inline-block', fontWeight: 700 }}>{fmt(deposits)}</span>
      </div>
      <div style={{ color: '#dc2626', marginBottom: 4 }}>
        سحوبات: <span style={{ direction: 'ltr', display: 'inline-block', fontWeight: 700 }}>{fmt(withdrawals)}</span>
      </div>
      <div
        style={{
          borderTop: '1px solid var(--noorix-border)',
          paddingTop: 4,
          marginTop: 4,
          color: deposits - withdrawals >= 0 ? '#059669' : '#e11d48',
          fontWeight: 700,
        }}
      >
        الصافي: <span style={{ direction: 'ltr', display: 'inline-block' }}>{fmt(deposits - withdrawals)}</span>
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
      style={{
        background: 'var(--noorix-surface)',
        border: '1px solid var(--noorix-border)',
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        direction: 'rtl',
        minWidth: 168,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--noorix-text)' }}>{d.name}</div>
      {pieMode === 'combined' ? (
        <>
          <div style={{ color: '#dc2626', marginBottom: 3 }}>
            {t('bankStatementColDebit')}:{' '}
            <span style={{ direction: 'ltr', display: 'inline-block', fontWeight: 700 }}>{fmt(p.debit)}</span>
          </div>
          <div style={{ color: '#16a34a', marginBottom: 3 }}>
            {t('bankStatementColCredit')}:{' '}
            <span style={{ direction: 'ltr', display: 'inline-block', fontWeight: 700 }}>{fmt(p.credit)}</span>
          </div>
          <div
            style={{
              fontWeight: 700,
              marginBottom: 4,
              borderTop: '1px solid var(--noorix-border)',
              paddingTop: 6,
              marginTop: 4,
            }}
          >
            {t('bankPieCenterVolume')}:{' '}
            <span style={{ direction: 'ltr', display: 'inline-block' }}>{fmt(d.value)}</span>
          </div>
        </>
      ) : (
        <div style={{ color: p.fill, fontWeight: 700, marginBottom: 4 }}>{fmt(d.value)}</div>
      )}
      <div style={{ color: 'var(--noorix-text-muted)' }}>{p.percent}%</div>
      {p.count != null ? (
        <div style={{ color: 'var(--noorix-text-muted)', fontSize: 11, marginTop: 4 }}>
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
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          padding: '14px 18px',
          borderBottom: '1px solid var(--noorix-border)',
          background: 'linear-gradient(180deg, var(--noorix-bg-muted) 0%, var(--noorix-surface) 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
          <span style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.35 }}>{title}</span>
        </div>
        <button
          type="button"
          className="noorix-btn noorix-btn--ghost"
          onClick={() => onRemove(cardId)}
          style={{
            fontSize: 12,
            color: '#64748b',
            border: '1px solid var(--noorix-border)',
            borderRadius: 8,
            padding: '6px 12px',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {removeLabel}
        </button>
      </div>
      <div style={{ padding: '18px 20px' }}>{children}</div>
    </div>
  );
}

/* ── شريط تقدم بسيط ── */
function ProgressBar({ value, color = '#2563eb', max = 100 }) {
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  return (
    <div style={{ height: 6, borderRadius: 4, background: 'var(--noorix-border)', overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s' }} />
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
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardCashFlow')} icon="📈" onRemove={setCardToDelete} removeLabel={t('bankRemoveCard')}>
          <div style={{ width: '100%', height: 260 }}>
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
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
              <span>إيداعات</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
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
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardAlerts')} icon="⚠️" onRemove={setCardToDelete} removeLabel={t('bankRemoveCard')}>
          {alerts.length === 0 ? (
            <p style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>لا توجد سحوبات.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ overflow: 'auto', borderRadius: 10, border: '1px solid var(--noorix-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--noorix-bg-muted)', borderBottom: '1px solid var(--noorix-border)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>التاريخ</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>الوصف</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>المبلغ</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, width: 100 }}>إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((tx, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--noorix-border)', background: i % 2 ? 'var(--noorix-bg-muted)' : 'transparent' }}>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'var(--noorix-text-muted)', verticalAlign: 'middle' }}>{tx.txDate}</td>
                        <td style={{ padding: '8px 10px', maxWidth: 360, verticalAlign: 'middle' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.description || ''}>
                            {tx.description || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', direction: 'ltr', fontWeight: 800, color: '#dc2626', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {fmt(Number(tx.debit))}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <button
                            type="button"
                            className="noorix-btn noorix-btn--ghost"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() => { setTypeFilter('debit'); setActiveTab('transactions'); }}
                          >
                            {t('bankViewTransactions')}
                          </button>
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
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardPosHint')} icon="💳" onRemove={setCardToDelete} removeLabel={t('bankRemoveCard')}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: '12px 16px', background: 'var(--noorix-bg-muted)', borderRadius: 10, border: '1px solid var(--noorix-border)' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#2563eb' }}>{posCount}</div>
              <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 4 }}>عملية تشبه نقاط البيع</div>
            </div>
            <div style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: '12px 16px', background: 'var(--noorix-bg-muted)', borderRadius: 10, border: '1px solid var(--noorix-border)' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#7c3aed' }}>{txs.length}</div>
              <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 4 }}>إجمالي العمليات</div>
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
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardCategoryPie')} icon="🥧" onRemove={setCardToDelete} removeLabel={t('bankRemoveCard')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--noorix-text-muted)' }}>{t('bankPieViewMode')}</span>
            {(['combined', 'debit', 'credit']).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPieMode(m)}
                className="noorix-btn"
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: pieMode === m ? '2px solid var(--noorix-accent-blue)' : '1px solid var(--noorix-border)',
                  background: pieMode === m ? 'rgba(37,99,235,0.1)' : 'var(--noorix-surface)',
                  fontWeight: pieMode === m ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {t(`bankPieMode_${m}`)}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--noorix-text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
            {t('bankPieLegendHint')}
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'stretch',
              gap: 24,
            }}
          >
            <div style={{ flex: '1 1 300px', minWidth: 280, position: 'relative', height: 320 }}>
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
                  style={{
                    height: 320,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--noorix-text-muted)',
                    fontSize: 14,
                    border: '1px dashed var(--noorix-border)',
                    borderRadius: 12,
                    background: 'var(--noorix-bg-muted)',
                  }}
                >
                  {t('bankNoCategoryData')}
                </div>
              )}
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
                  }}
                >
                  <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', fontWeight: 600, lineHeight: 1.25 }}>
                    {centerTitle}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, direction: 'ltr', color: 'var(--noorix-text)', marginTop: 4 }}>
                    {fmt(centerMain)}
                  </div>
                  {pieMode === 'combined' && (pieGrandTotals.totalDebit > 0 || pieGrandTotals.totalCredit > 0) ? (
                    <div style={{ fontSize: 10, marginTop: 6, lineHeight: 1.35 }}>
                      <div style={{ color: '#dc2626', direction: 'ltr' }}>{fmt(pieGrandTotals.totalDebit)}</div>
                      <div style={{ color: '#16a34a', direction: 'ltr' }}>{fmt(pieGrandTotals.totalCredit)}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div style={{ flex: '1 1 240px', minWidth: 220, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--noorix-text-muted)', marginBottom: 10 }}>
                {t('bankPieCategoryKey')}
              </div>
              <div
                style={{
                  border: '1px solid var(--noorix-border)',
                  borderRadius: 12,
                  padding: 12,
                  background: 'var(--noorix-bg-muted)',
                  flex: 1,
                  display: 'grid',
                  gap: 8,
                }}
              >
                {pieDisplayData.length === 0 ? (
                  <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)', textAlign: 'center', padding: 12 }}>
                    {t('bankNoCategoryData')}
                  </span>
                ) : (
                  pieDisplayData.map((item, i) => {
                    const dot = pieSliceFill(pieMode, i, item);
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setPieDrilldownCategory(item.name)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          gap: 4,
                          fontSize: 13,
                          cursor: 'pointer',
                          background: 'var(--noorix-surface)',
                          border: '1px solid var(--noorix-border)',
                          borderRadius: 10,
                          padding: '8px 10px',
                          textAlign: 'right',
                          width: '100%',
                          color: 'inherit',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: dot,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                            {item.name}
                          </span>
                          <span style={{ color: 'var(--noorix-text-muted)', flexShrink: 0, fontSize: 12 }}>{item.percent}%</span>
                          <span style={{ fontWeight: 800, direction: 'ltr', flexShrink: 0, fontSize: 13 }}>{fmt(item.value)}</span>
                        </div>
                        {pieMode === 'combined' ? (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 8,
                              fontSize: 11,
                              color: 'var(--noorix-text-muted)',
                              paddingInlineStart: 20,
                            }}
                          >
                            <span style={{ color: '#dc2626' }}>
                              {t('bankStatementColDebit')}: <strong style={{ direction: 'ltr' }}>{fmt(item.debit)}</strong>
                            </span>
                            <span style={{ color: '#16a34a' }}>
                              {t('bankStatementColCredit')}: <strong style={{ direction: 'ltr' }}>{fmt(item.credit)}</strong>
                            </span>
                          </div>
                        ) : null}
                      </button>
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
          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--noorix-text-muted)',
                marginBottom: 10,
                paddingBottom: 6,
                borderBottom: '1px solid var(--noorix-border)',
              }}
            >
              {blockTitle}
            </div>
            <div style={{ width: '100%', height: h }}>
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
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardCategoryBar')} icon="📊" onRemove={setCardToDelete} removeLabel={t('bankRemoveCard')}>
          {renderBarBlock(barRowsDebit, 'أعلى الفئات — السحوبات', '#dc2626', barDebitAxisW)}
          {renderBarBlock(barRowsCredit, 'أعلى الفئات — الإيداعات', '#16a34a', barCreditAxisW)}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 28,
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px solid var(--noorix-border)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: '#dc2626', display: 'inline-block' }} />
              <span style={{ fontWeight: 600 }}>سحوبات</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: '#16a34a', display: 'inline-block' }} />
              <span style={{ fontWeight: 600 }}>إيداعات</span>
            </div>
          </div>
        </AnalysisCard>
      );
    }

    /* ── جدول الفئات ── */
    if (cardId === 'category_table') {
      return (
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardCategoryTable')} icon="📋" onRemove={setCardToDelete} removeLabel={t('bankRemoveCard')}>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 540 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--noorix-border)', background: 'var(--noorix-bg-muted)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>الفئة</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>العمليات</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#dc2626', whiteSpace: 'nowrap' }}>السحوبات</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>الإيداعات</th>
                  <th style={{ padding: '8px 10px', minWidth: 120, fontWeight: 700 }}>النسبة (سحب)</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map((row, i) => (
                  <tr
                    key={row.name}
                    style={{
                      borderBottom: '1px solid var(--noorix-border)',
                      background: i % 2 === 0 ? 'transparent' : 'var(--noorix-bg-muted)',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onClick={() => { setCategoryFilter(row.name); setActiveTab('transactions'); }}
                    title="انقر لعرض عمليات هذه الفئة"
                  >
                    <td style={{ padding: '9px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
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
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: 'var(--noorix-text-muted)' }}>{row.count}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', direction: 'ltr', color: row.debit > 0 ? '#dc2626' : 'var(--noorix-text-muted)', fontWeight: row.debit > 0 ? 700 : 400 }}>
                      {row.debit > 0 ? fmt(row.debit) : '—'}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', direction: 'ltr', color: row.credit > 0 ? '#16a34a' : 'var(--noorix-text-muted)', fontWeight: row.credit > 0 ? 700 : 400 }}>
                      {row.credit > 0 ? fmt(row.credit) : '—'}
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ProgressBar value={row.debit} max={totalDebit} color={COLORS[i % COLORS.length]} />
                        <span style={{ minWidth: 38, textAlign: 'left', color: 'var(--noorix-text-muted)', flexShrink: 0 }}>
                          {row.debitPct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--noorix-border)', fontWeight: 800, background: 'var(--noorix-bg-muted)' }}>
                  <td style={{ padding: '10px 10px' }}>الإجمالي</td>
                  <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                    {categoryRows.reduce((s, r) => s + r.count, 0)}
                  </td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', direction: 'ltr', color: '#dc2626' }}>{fmt(totalDebit)}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', direction: 'ltr', color: '#16a34a' }}>{fmt(totalCredit)}</td>
                  <td style={{ padding: '10px 10px', color: 'var(--noorix-text-muted)' }}>100%</td>
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
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardDepositsTable')} icon="💰" onRemove={setCardToDelete} removeLabel={t('bankRemoveCard')}>
          {depositsByCategory.length === 0 ? (
            <p style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>لا توجد إيداعات.</p>
          ) : (
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 400 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--noorix-border)', background: 'var(--noorix-bg-muted)' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>#</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>الفئة</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>العمليات</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>إجمالي الإيداعات</th>
                    <th style={{ padding: '8px 10px', minWidth: 120, fontWeight: 700 }}>النسبة</th>
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
                          background: i % 2 === 0 ? 'transparent' : 'var(--noorix-bg-muted)',
                          cursor: 'pointer',
                        }}
                        onClick={() => { setCategoryFilter(row.name); setTypeFilter('credit'); setActiveTab('transactions'); }}
                      >
                        <td style={{ padding: '9px 10px', color: 'var(--noorix-text-muted)', fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ padding: '9px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                            {row.name}
                          </div>
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'center', color: 'var(--noorix-text-muted)' }}>{row.count}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', direction: 'ltr', color: '#16a34a', fontWeight: 700 }}>{fmt(row.total)}</td>
                        <td style={{ padding: '9px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ProgressBar value={row.total} max={totalDep} color="#16a34a" />
                            <span style={{ minWidth: 38, textAlign: 'left', color: 'var(--noorix-text-muted)', flexShrink: 0 }}>{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--noorix-border)', fontWeight: 800, background: 'var(--noorix-bg-muted)' }}>
                    <td colSpan={2} style={{ padding: '10px 10px' }}>الإجمالي</td>
                    <td style={{ padding: '10px 10px', textAlign: 'center' }}>{depositsByCategory.reduce((s, r) => s + r.count, 0)}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', direction: 'ltr', color: '#16a34a' }}>{fmt(totalDep)}</td>
                    <td style={{ padding: '10px 10px', color: 'var(--noorix-text-muted)' }}>100%</td>
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
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardPosTerminals')} icon="🏪" onRemove={setCardToDelete} removeLabel={t('bankRemoveCard')}>
          {posTerminals.length === 0 ? (
            <p style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>
              لم يتم الكشف عن أجهزة نقاط بيع في هذا الكشف.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                <div style={{ padding: '12px 14px', background: 'var(--noorix-bg-muted)', borderRadius: 12, border: '1px solid var(--noorix-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>{posTerminals.reduce((s, t) => s + t.count, 0)}</div>
                  <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 4 }}>عدد العمليات</div>
                </div>
                <div style={{ padding: '12px 14px', background: 'var(--noorix-bg-muted)', borderRadius: 12, border: '1px solid var(--noorix-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', direction: 'ltr' }}>{fmt(totalPOS)}</div>
                  <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 4 }}>إجمالي المبيعات</div>
                </div>
              </div>
              <div style={{ overflow: 'auto', borderRadius: 10, border: '1px solid var(--noorix-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--noorix-bg-muted)', borderBottom: '1px solid var(--noorix-border)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, width: 40 }}>#</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>الجهاز</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>العمليات</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>المبلغ</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>النسبة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posTerminals.slice(0, 8).map((term, i) => {
                      const pct = totalPOS > 0 ? (term.total / totalPOS) * 100 : 0;
                      return (
                        <tr key={term.terminalId} style={{ borderBottom: '1px solid var(--noorix-border)', background: i % 2 ? 'var(--noorix-bg-muted)' : 'transparent' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--noorix-text-muted)' }}>{i + 1}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <code style={{ fontSize: 11, background: 'var(--noorix-border)', padding: '4px 8px', borderRadius: 6 }}>…{term.terminalId.slice(-8)}</code>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>{term.count}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', direction: 'ltr', fontWeight: 800, color: '#16a34a' }}>{fmt(term.total)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                              <ProgressBar value={term.total} max={totalPOS} color={COLORS[i % COLORS.length]} />
                              <span style={{ minWidth: 36, fontSize: 11, color: 'var(--noorix-text-muted)' }}>{pct.toFixed(1)}%</span>
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
    <div style={{ display: 'grid', gap: 18 }}>
      {/* شريط التحكم — إضافة بطاقات */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--noorix-bg-muted)',
          borderRadius: 12,
          border: '1px solid var(--noorix-border)',
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>
          {activeCards.length} بطاقة معروضة
        </span>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="noorix-btn noorix-btn--secondary"
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setAddOpen((v) => !v)}
            disabled={availableToAdd.length === 0}
          >
            <span>+</span>
            {t('bankAddAnalysisCard')}
            {availableToAdd.length > 0 && (
              <span
                style={{
                  background: 'var(--noorix-accent-blue)',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 18,
                  height: 18,
                  fontSize: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                }}
              >
                {availableToAdd.length}
              </span>
            )}
          </button>
          {addOpen && availableToAdd.length > 0 && (
            <div
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
                <button
                  key={c.id}
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '10px 14px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--noorix-border)',
                    cursor: 'pointer',
                    fontSize: 13,
                    textAlign: 'right',
                    color: 'var(--noorix-text)',
                  }}
                  onClick={() => { addCard(c.id); setAddOpen(false); }}
                >
                  <span>{c.icon}</span>
                  <span>{t(c.nameKey)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* البطاقات — عمودان تلقائياً عندما تسمح الشاشة (min ~400px لكل عمود) */}
      <div
        style={{
          display: 'grid',
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
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--noorix-text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <p style={{ fontSize: 15, fontWeight: 600 }}>{t('bankNoCardsPickAbove')}</p>
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
