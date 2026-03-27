/**
 * بطاقات ملخص الكشف — أسلوب مشابه للمشروع السابق مع متغيرات Noorix
 */
import React from 'react';
import { fmt } from '../../../utils/format';

export default function BankStatementSummaryCards({ statement, t }) {
  if (!statement) return null;

  const dep = Number(statement.totalDeposits) || 0;
  const wdr = Number(statement.totalWithdrawals) || 0;
  const net = dep - wdr;
  const nTx = statement.transactionCount ?? statement.transactions?.length ?? 0;

  const cards = [
    {
      title: t('bankStatementBankName'),
      value: statement.bankName || '—',
      sub: statement.companyName || '',
      accent: 'var(--noorix-accent-blue)',
    },
    {
      title: t('bankStatementDateRange'),
      value: statement.startDate?.slice(0, 10) || '—',
      sub: statement.endDate?.slice(0, 10) ? `→ ${statement.endDate.slice(0, 10)}` : '',
      accent: '#64748b',
    },
    {
      title: t('bankStatementCardDeposits'),
      value: fmt(dep),
      sub: t('bankCurrencySar'),
      accent: '#16a34a',
    },
    {
      title: t('bankStatementCardWithdrawals'),
      value: fmt(wdr),
      sub: t('bankCurrencySar'),
      accent: '#dc2626',
    },
    {
      title: t('bankStatementCardNetFlow'),
      value: fmt(net),
      sub: net >= 0 ? t('bankNetSurplus') : t('bankNetDeficit'),
      accent: net >= 0 ? '#059669' : '#e11d48',
    },
    {
      title: t('bankStatementTransactions'),
      value: String(nTx),
      sub: statement.fileName || '',
      accent: '#7c3aed',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 12,
      }}
    >
      {cards.map((c, i) => (
        <div
          key={i}
          style={{
            borderRadius: 12,
            padding: 14,
            background: `linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,58,95,0.92) 100%)`,
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
          }}
        >
          <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 6 }}>{c.title}</div>
          <div
            style={{
              fontSize: c.value?.length > 14 ? 15 : 17,
              fontWeight: 800,
              direction: 'ltr',
              textAlign: 'right',
              wordBreak: 'break-word',
            }}
          >
            {c.value}
          </div>
          {c.sub ? (
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>{c.sub}</div>
          ) : null}
          <div
            style={{
              height: 3,
              borderRadius: 2,
              marginTop: 10,
              background: c.accent,
              opacity: 0.85,
            }}
          />
        </div>
      ))}
    </div>
  );
}
