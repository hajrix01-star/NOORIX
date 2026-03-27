/**
 * تبويب التحليل — رسوم بيانية وبطاقات قابلة للإضافة (مستوحى من المشروع السابق)
 */
import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { useTranslation } from '../../../i18n/useTranslation';
import { AVAILABLE_ANALYSIS_CARDS } from './useBankStatementView';
import { buildCashFlowSeries, topDebits, countPosLikeTransactions } from './bankAnalysisUtils';
import { fmt } from '../../../utils/format';

const COLORS = ['#2563eb', '#16a34a', '#ca8a04', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#4f46e5'];

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

  const pieData = useMemo(() => {
    return Object.entries(summaryByCategory)
      .map(([name, d]) => ({
        name,
        value: Math.round((d.totalDebit + d.totalCredit) * 100) / 100,
        debit: d.totalDebit,
        credit: d.totalCredit,
      }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [summaryByCategory]);

  const barData = useMemo(() => {
    return Object.entries(summaryByCategory)
      .map(([name, d]) => ({
        name: name.length > 16 ? `${name.slice(0, 14)}…` : name,
        fullName: name,
        debit: d.totalDebit,
        credit: d.totalCredit,
      }))
      .sort((a, b) => b.debit - a.debit)
      .slice(0, 10);
  }, [summaryByCategory]);

  const cashSeries = useMemo(() => buildCashFlowSeries(txs), [txs]);
  const alerts = useMemo(() => topDebits(txs, 10), [txs]);
  const posCount = useMemo(() => countPosLikeTransactions(txs), [txs]);

  const cardById = (id) => AVAILABLE_ANALYSIS_CARDS.find((c) => c.id === id);

  const renderCard = (cardId) => {
    if (!isCardActive(cardId)) return null;

    if (cardId === 'cash_flow') {
      if (cashSeries.length < 2) {
        return (
          <div key={cardId} className="noorix-surface-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700 }}>{t('bankCardCashFlow')}</span>
              <button type="button" className="noorix-btn noorix-btn--ghost" style={{ fontSize: 12 }} onClick={() => setCardToDelete(cardId)}>
                {t('bankRemoveCard')}
              </button>
            </div>
            <p style={{ margin: 0, color: 'var(--noorix-text-muted)', fontSize: 13 }}>{t('bankChartNeedMoreData')}</p>
          </div>
        );
      }
      return (
        <div key={cardId} className="noorix-surface-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>{t('bankCardCashFlow')}</span>
            <button
              type="button"
              className="noorix-btn noorix-btn--ghost"
              style={{ fontSize: 12 }}
              onClick={() => setCardToDelete(cardId)}
            >
              {t('bankRemoveCard')}
            </button>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={cashSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--noorix-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={56} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Line type="monotone" dataKey="cumulative" stroke="#2563eb" strokeWidth={2} dot={false} name={t('bankCumulative')} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (cardId === 'alerts') {
      return (
        <div key={cardId} className="noorix-surface-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>{t('bankCardAlerts')}</span>
            <button
              type="button"
              className="noorix-btn noorix-btn--ghost"
              style={{ fontSize: 12 }}
              onClick={() => setCardToDelete(cardId)}
            >
              {t('bankRemoveCard')}
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginTop: 0 }}>
            {t('bankAlertsDesc')}
          </p>
          <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13 }}>
            {alerts.map((tx, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <span style={{ direction: 'ltr', display: 'inline-block' }}>{fmt(Number(tx.debit))}</span>
                {' — '}
                {(tx.description || '').slice(0, 80)}
                <button
                  type="button"
                  className="noorix-btn noorix-btn--ghost"
                  style={{ fontSize: 11, marginInlineStart: 8 }}
                  onClick={() => {
                    setTypeFilter('debit');
                    setActiveTab('transactions');
                  }}
                >
                  {t('bankViewTransactions')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (cardId === 'pos_hint') {
      return (
        <div key={cardId} className="noorix-surface-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>{t('bankCardPosHint')}</span>
            <button
              type="button"
              className="noorix-btn noorix-btn--ghost"
              style={{ fontSize: 12 }}
              onClick={() => setCardToDelete(cardId)}
            >
              {t('bankRemoveCard')}
            </button>
          </div>
          <p style={{ fontSize: 14, margin: 0 }}>
            {t('bankPosHintCount', String(posCount), String(txs.length))}
          </p>
        </div>
      );
    }

    if (cardId === 'category_pie') {
      if (!pieData.length) {
        return (
          <div key={cardId} className="noorix-surface-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700 }}>{t('bankCardCategoryPie')}</span>
              <button type="button" className="noorix-btn noorix-btn--ghost" style={{ fontSize: 12 }} onClick={() => setCardToDelete(cardId)}>
                {t('bankRemoveCard')}
              </button>
            </div>
            <p style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>{t('bankNoCategoryData')}</p>
          </div>
        );
      }
      return (
        <div key={cardId} className="noorix-surface-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>{t('bankCardCategoryPie')}</span>
            <button
              type="button"
              className="noorix-btn noorix-btn--ghost"
              style={{ fontSize: 12 }}
              onClick={() => setCardToDelete(cardId)}
            >
              {t('bankRemoveCard')}
            </button>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={88}
                  label={({ name, percent }) => `${name || ''} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (cardId === 'category_bar') {
      if (!barData.length) return null;
      return (
        <div key={cardId} className="noorix-surface-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>{t('bankCardCategoryBar')}</span>
            <button
              type="button"
              className="noorix-btn noorix-btn--ghost"
              style={{ fontSize: 12 }}
              onClick={() => setCardToDelete(cardId)}
            >
              {t('bankRemoveCard')}
            </button>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--noorix-border)" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9 }} />
                <Tooltip
                  formatter={(v) => fmt(Number(v))}
                  labelFormatter={(_, p) => p?.[0]?.payload?.fullName || ''}
                />
                <Bar dataKey="debit" fill="#dc2626" name={t('bankStatementColDebit')} />
                <Bar dataKey="credit" fill="#16a34a" name={t('bankStatementColCredit')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (cardId === 'category_table') {
      return (
        <div key={cardId} className="noorix-surface-card" style={{ padding: 16, overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>{t('bankCardCategoryTable')}</span>
            <button
              type="button"
              className="noorix-btn noorix-btn--ghost"
              style={{ fontSize: 12 }}
              onClick={() => setCardToDelete(cardId)}
            >
              {t('bankRemoveCard')}
            </button>
          </div>
          <table className="noorix-table" style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th>{t('bankStatementCategories')}</th>
                <th>{t('bankStatementTransactions')}</th>
                <th>{t('bankStatementColDebit')}</th>
                <th>{t('bankStatementColCredit')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {Object.entries(summaryByCategory)
                .sort((a, b) => b[1].totalDebit - a[1].totalDebit)
                .map(([name, d]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{d.count}</td>
                    <td style={{ direction: 'ltr', textAlign: 'right' }}>{fmt(d.totalDebit)}</td>
                    <td style={{ direction: 'ltr', textAlign: 'right' }}>{fmt(d.totalCredit)}</td>
                    <td>
                      <button
                        type="button"
                        className="noorix-btn noorix-btn--ghost"
                        style={{ fontSize: 12 }}
                        onClick={() => {
                          setCategoryFilter(name);
                          setActiveTab('transactions');
                        }}
                      >
                        {t('bankFilterThisCategory')}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          padding: 12,
          background: 'var(--noorix-bg-muted)',
          borderRadius: 10,
          border: '1px solid var(--noorix-border)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>{t('bankAddAnalysisCard')}:</span>
        {availableToAdd.map((c) => (
          <button
            key={c.id}
            type="button"
            className="noorix-btn noorix-btn--secondary"
            style={{ fontSize: 12 }}
            onClick={() => addCard(c.id)}
          >
            {c.icon} {t(c.nameKey)}
          </button>
        ))}
        {availableToAdd.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankAllCardsAdded')}</span>
        ) : null}
      </div>

      {activeCards.map((id) => renderCard(id))}

      {!activeCards.length ? (
        <p style={{ color: 'var(--noorix-text-muted)', textAlign: 'center', padding: 24 }}>{t('bankNoCardsPickAbove')}</p>
      ) : null}
    </div>
  );
}
