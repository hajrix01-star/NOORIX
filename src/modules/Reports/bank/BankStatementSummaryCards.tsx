import React from 'react';
import { fmt } from '../../../utils/format';
import { toYmd } from '../../../utils/saudiDate';
import { MetricCard } from '../../../ui';

export default function BankStatementSummaryCards({ statement, t }: any) {
  if (!statement) return null;

  const dep = Number(statement.totalDeposits)    || 0;
  const wdr = Number(statement.totalWithdrawals) || 0;
  const net = dep - wdr;
  const nTx = statement.transactionCount ?? statement.transactions?.length ?? 0;

  const cards = [
    {
      title: t('bankStatementBankName'),
      value: statement.bankName || '—',
      sub:   statement.companyName || '',
      color: 'var(--color-nx-sales)',
    },
    {
      title: t('bankStatementDateRange'),
      value: toYmd(statement.startDate) || '—',
      sub:   toYmd(statement.endDate) ? `← ${toYmd(statement.endDate)}` : '',
      color: 'var(--color-nx-purchases)',
    },
    {
      title: t('bankStatementCardDeposits'),
      value: fmt(dep),
      sub:   'SR',
      color: 'var(--color-nx-profit)',
    },
    {
      title: t('bankStatementCardWithdrawals'),
      value: fmt(wdr),
      sub:   'SR',
      color: 'var(--color-nx-expenses)',
    },
    {
      title: t('bankStatementCardNetFlow'),
      value: fmt(net),
      sub:   net >= 0 ? t('bankNetSurplus') : t('bankNetDeficit'),
      color: net >= 0 ? 'var(--color-nx-profit)' : 'var(--color-nx-expenses)',
    },
    {
      title: t('bankStatementTransactions'),
      value: String(nTx),
      sub:   statement.fileName || '',
      color: 'var(--color-nx-sales)',
    },
  ];

  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
      {cards.map((c: any, i: any) => (
        <MetricCard key={i} color={c.color}>
          <MetricCard.Header label={c.title} />
          <MetricCard.Value value={c.value} />
          {c.sub && (
            <MetricCard.Section>
              <span className="text-[11px] text-noorix-muted">{c.sub}</span>
            </MetricCard.Section>
          )}
        </MetricCard>
      ))}
    </div>
  );
}
