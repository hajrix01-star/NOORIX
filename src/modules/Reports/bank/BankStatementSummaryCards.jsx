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
      accent: 'var(--noorix-accent-green)',
    },
    {
      title: t('bankStatementCardWithdrawals'),
      value: fmt(wdr),
      sub: t('bankCurrencySar'),
      accent: 'var(--noorix-accent-red)',
    },
    {
      title: t('bankStatementCardNetFlow'),
      value: fmt(net),
      sub: net >= 0 ? t('bankNetSurplus') : t('bankNetDeficit'),
      accent: net >= 0 ? '#059669' : 'var(--noorix-accent-rose)',
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
      className="nx-grid nx-gap-12"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      }}
    >
      {cards.map((c, i) => (
        <div
          key={i}
          className="noorix-surface-card nx-flex-col nx-gap-4"
          style={{
            padding: 14,
          }}
        >
          <div className="nx-text-xs nx-text-muted nx-font-600" style={{ marginBottom: 2 }}>{c.title}</div>
          <div
            className="nx-font-800 nx-ltr nx-text-primary"
            style={{
              fontSize: c.value?.length > 14 ? 14 : 17,
              textAlign: 'right',
              wordBreak: 'break-word',
            }}
          >
            {c.value}
          </div>
          {c.sub ? (
            <div className="nx-text-xs nx-text-muted" style={{ marginTop: 2 }}>{c.sub}</div>
          ) : null}
          <div
            className="nx-mt-8"
            style={{
              height: 3,
              borderRadius: 2,
              background: c.accent,
            }}
          />
        </div>
      ))}
    </div>
  );
}
