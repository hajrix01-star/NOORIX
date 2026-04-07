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
      accent: 'var(--noorix-text-muted)',
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
      accent: net >= 0 ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-rose)',
    },
    {
      title: t('bankStatementTransactions'),
      value: String(nTx),
      sub: statement.fileName || '',
      accent: 'var(--noorix-accent-violet)',
    },
  ];

  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      }}
    >
      {cards.map((c, i) => (
        <div
          key={i}
          className="noorix-surface-card flex flex-col gap-1"
          style={{
            padding: 14,
          }}
        >
          <div className="text-[11px] text-noorix-muted font-semibold" style={{ marginBottom: 2 }}>{c.title}</div>
          <div
            className="font-extrabold nx-ltr text-noorix-text"
            style={{
              fontSize: c.value?.length > 14 ? 14 : 17,
              textAlign: 'right',
              wordBreak: 'break-word',
            }}
          >
            {c.value}
          </div>
          {c.sub ? (
            <div className="text-[11px] text-noorix-muted" style={{ marginTop: 2 }}>{c.sub}</div>
          ) : null}
          <div
            className="mt-2"
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
