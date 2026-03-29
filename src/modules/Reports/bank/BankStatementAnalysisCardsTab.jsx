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
  Legend,
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

const COLORS = [
  '#2563eb', '#16a34a', '#ca8a04', '#dc2626', '#7c3aed',
  '#0891b2', '#db2777', '#4f46e5', '#ea580c', '#84cc16',
];

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
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
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
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.name}</div>
      <div style={{ color: d.payload?.fill }}>{fmt(d.value)}</div>
      <div style={{ color: 'var(--noorix-text-muted)' }}>{d.payload?.percent}%</div>
    </div>
  );
}

/* ── غلاف بطاقة موحد ── */
function AnalysisCard({ cardId, title, icon, onRemove, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="noorix-surface-card"
      style={{ padding: 0, overflow: 'hidden', position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 18px 12px',
          borderBottom: '1px solid var(--noorix-border)',
          background: 'var(--noorix-bg-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span>
        </div>
        <button
          type="button"
          onClick={() => onRemove(cardId)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#dc2626',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.2s',
            padding: '2px 6px',
            borderRadius: 6,
            fontSize: 16,
            lineHeight: 1,
          }}
          title="حذف البطاقة"
        >
          ×
        </button>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
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
}) {
  const { t } = useTranslation();
  const txs = statement?.transactions || [];
  const [addOpen, setAddOpen] = useState(false);

  const dailyData = useMemo(() => buildDailyChartData(txs), [txs]);
  const alerts = useMemo(() => topDebits(txs, 10), [txs]);
  const posCount = useMemo(() => countPosLikeTransactions(txs), [txs]);
  const posTerminals = useMemo(() => extractPosTerminals(txs), [txs]);
  const depositsByCategory = useMemo(() => buildDepositsByCategory(txs, t('uncategorized')), [txs, t]);

  /* بيانات PieChart للسحوبات */
  const pieData = useMemo(() => {
    const total = Object.values(summaryByCategory).reduce((s, d) => s + d.totalDebit, 0);
    return Object.entries(summaryByCategory)
      .map(([name, d]) => ({
        name,
        value: Math.round(d.totalDebit * 100) / 100,
        count: d.count,
        percent: total > 0 ? ((d.totalDebit / total) * 100).toFixed(1) : '0',
      }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [summaryByCategory]);

  /* بيانات BarChart */
  const barData = useMemo(() => {
    return Object.entries(summaryByCategory)
      .map(([name, d]) => ({
        name: name.length > 14 ? `${name.slice(0, 13)}…` : name,
        fullName: name,
        debit: Math.round(d.totalDebit),
        credit: Math.round(d.totalCredit),
      }))
      .sort((a, b) => b.debit - a.debit)
      .slice(0, 8);
  }, [summaryByCategory]);

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
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardCashFlow')} icon="📈" onRemove={setCardToDelete}>
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
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardAlerts')} icon="⚠️" onRemove={setCardToDelete}>
          {alerts.length === 0 ? (
            <p style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>لا توجد سحوبات.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {alerts.map((tx, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--noorix-bg-muted)',
                    border: '1px solid var(--noorix-border)',
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, truncate: true, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(tx.description || '').slice(0, 60)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 2 }}>{tx.txDate}</div>
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: '#dc2626',
                      direction: 'ltr',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {fmt(Number(tx.debit))}
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="noorix-btn noorix-btn--ghost"
                style={{ fontSize: 12, marginTop: 4, alignSelf: 'flex-start' }}
                onClick={() => { setTypeFilter('debit'); setActiveTab('transactions'); }}
              >
                عرض كل السحوبات ←
              </button>
            </div>
          )}
        </AnalysisCard>
      );
    }

    /* ── لمحة نقاط البيع ── */
    if (cardId === 'pos_hint') {
      return (
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardPosHint')} icon="💳" onRemove={setCardToDelete}>
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
      if (!pieData.length) return null;
      return (
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardCategoryPie')} icon="🥧" onRemove={setCardToDelete}>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
            {pieData.map((item, i) => (
              <div
                key={item.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
                onClick={() => { setCategoryFilter(item.name); setActiveTab('transactions'); }}
                title="انقر لفلترة العمليات"
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: COLORS[i % COLORS.length],
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                <span style={{ color: 'var(--noorix-text-muted)', flexShrink: 0 }}>{item.percent}%</span>
                <span style={{ fontWeight: 700, direction: 'ltr', flexShrink: 0 }}>{fmt(item.value)}</span>
              </div>
            ))}
          </div>
        </AnalysisCard>
      );
    }

    /* ── أعمدة التصنيفات ── */
    if (cardId === 'category_bar') {
      if (!barData.length) return null;
      return (
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardCategoryBar')} icon="📊" onRemove={setCardToDelete}>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--noorix-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <YAxis type="category" dataKey="name" width={108} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v, name) => [fmt(Number(v)), name === 'debit' ? 'سحوبات' : 'إيداعات']}
                  labelFormatter={(_, p) => p?.[0]?.payload?.fullName || ''}
                />
                <Bar dataKey="debit" fill="#dc2626" name="سحوبات" radius={[0, 4, 4, 0]} />
                <Bar dataKey="credit" fill="#16a34a" name="إيداعات" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: '#dc2626', display: 'inline-block' }} />
              <span>سحوبات</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: '#16a34a', display: 'inline-block' }} />
              <span>إيداعات</span>
            </div>
          </div>
        </AnalysisCard>
      );
    }

    /* ── جدول الفئات ── */
    if (cardId === 'category_table') {
      return (
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardCategoryTable')} icon="📋" onRemove={setCardToDelete}>
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
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardDepositsTable')} icon="💰" onRemove={setCardToDelete}>
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
        <AnalysisCard key={cardId} cardId={cardId} title={t('bankCardPosTerminals')} icon="🏪" onRemove={setCardToDelete}>
          {posTerminals.length === 0 ? (
            <p style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>
              لم يتم الكشف عن أجهزة نقاط بيع في هذا الكشف.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                <div style={{ padding: '10px 14px', background: 'var(--noorix-bg-muted)', borderRadius: 10, border: '1px solid var(--noorix-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>{posTerminals.reduce((s, t) => s + t.count, 0)}</div>
                  <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 2 }}>عدد العمليات</div>
                </div>
                <div style={{ padding: '10px 14px', background: 'var(--noorix-bg-muted)', borderRadius: 10, border: '1px solid var(--noorix-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', direction: 'ltr' }}>{fmt(totalPOS)}</div>
                  <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 2 }}>إجمالي المبيعات</div>
                </div>
              </div>
              {posTerminals.slice(0, 6).map((term, i) => {
                const pct = totalPOS > 0 ? (term.total / totalPOS) * 100 : 0;
                return (
                  <div
                    key={term.terminalId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: 'var(--noorix-bg-muted)',
                      borderRadius: 8,
                      border: '1px solid var(--noorix-border)',
                    }}
                  >
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: i === 0 ? '#2563eb' : i === 1 ? '#16a34a' : '#94a3b8',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    <code style={{ fontSize: 11, background: 'var(--noorix-border)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
                      …{term.terminalId.slice(-6)}
                    </code>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <ProgressBar value={term.total} max={totalPOS} color={COLORS[i % COLORS.length]} />
                    </div>
                    <div style={{ textAlign: 'left', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#16a34a', direction: 'ltr' }}>{fmt(term.total)}</div>
                      <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)' }}>{term.count} عملية · {pct.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })}
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

      {/* البطاقات */}
      {activeCards.map((id) => renderCard(id))}

      {!activeCards.length && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--noorix-text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <p style={{ fontSize: 15, fontWeight: 600 }}>{t('bankNoCardsPickAbove')}</p>
        </div>
      )}
    </div>
  );
}
