/**
 * مطابقة أرصدة وإجماليات — محلياً من بيانات الكشف
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';

export default function BankStatementReconciliationTab({ balanceVerification, reconciliationStats, reconLoading }) {
  const { t } = useTranslation();
  if (!balanceVerification) {
    return (
      <p style={{ color: 'var(--noorix-text-muted)', textAlign: 'center', padding: 24 }}>
        {t('bankStatementNoTransactions')}
      </p>
    );
  }

  const okAgg = balanceVerification.aggregatesMatch;
  const okSeq = balanceVerification.balanceSequenceValid;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
        }}
      >
        <div className="noorix-surface-card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankReconDepositsComputed')}</div>
          <div style={{ fontSize: 18, fontWeight: 800, direction: 'ltr', textAlign: 'right' }}>
            {fmt(balanceVerification.totalDeposits)}
          </div>
        </div>
        <div className="noorix-surface-card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankReconDepositsStored')}</div>
          <div style={{ fontSize: 18, fontWeight: 800, direction: 'ltr', textAlign: 'right' }}>
            {fmt(balanceVerification.stmtDeposits)}
          </div>
        </div>
        <div className="noorix-surface-card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankReconWithdrawalsComputed')}</div>
          <div style={{ fontSize: 18, fontWeight: 800, direction: 'ltr', textAlign: 'right' }}>
            {fmt(balanceVerification.totalWithdrawals)}
          </div>
        </div>
        <div className="noorix-surface-card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankReconWithdrawalsStored')}</div>
          <div style={{ fontSize: 18, fontWeight: 800, direction: 'ltr', textAlign: 'right' }}>
            {fmt(balanceVerification.stmtWithdrawals)}
          </div>
        </div>
      </div>

      <div
        className="noorix-surface-card"
        style={{
          padding: 16,
          borderLeft: `4px solid ${okAgg ? '#16a34a' : '#ca8a04'}`,
        }}
      >
        <strong>{t('bankReconAggregateCheck')}</strong>
        <p style={{ margin: '8px 0 0', fontSize: 14 }}>
          {okAgg ? t('bankReconAggregateOk') : t('bankReconAggregateDiff')}
          {!okAgg && (
            <span style={{ direction: 'ltr', display: 'block', marginTop: 6, fontSize: 12 }}>
              Δ dep {fmt(balanceVerification.depositsDiff)} / Δ wdr {fmt(balanceVerification.withdrawalsDiff)}
            </span>
          )}
        </p>
      </div>

      <div
        className="noorix-surface-card"
        style={{
          padding: 16,
          borderLeft: `4px solid ${okSeq ? '#16a34a' : '#dc2626'}`,
        }}
      >
        <strong>{t('bankReconBalanceSequence')}</strong>
        <p style={{ margin: '8px 0 0', fontSize: 14 }}>
          {okSeq ? t('bankReconSequenceOk') : t('bankReconSequenceIssues')}
        </p>
        {!okSeq && balanceVerification.balanceErrors?.length ? (
          <ul style={{ fontSize: 12, marginTop: 8 }}>
            {balanceVerification.balanceErrors.map((e, i) => (
              <li key={i}>
                {e.date}: {t('bankReconExpected')} {fmt(e.expected)} / {t('bankReconActual')} {fmt(e.actual)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {(reconciliationStats || reconLoading) && (
        <div style={{ display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>{t('bankReconSystemSection')}</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <div className="noorix-surface-card" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankReconSalesBankTotal')}</div>
              <div style={{ fontSize: 17, fontWeight: 800, direction: 'ltr', textAlign: 'right' }}>
                {reconLoading ? '…' : fmt(reconciliationStats?.sales_bank_total ?? 0)}
              </div>
            </div>
            <div className="noorix-surface-card" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankReconCashDeposits')}</div>
              <div style={{ fontSize: 17, fontWeight: 800, direction: 'ltr', textAlign: 'right' }}>
                {reconLoading ? '…' : fmt(reconciliationStats?.cash_deposits_total ?? 0)}
              </div>
            </div>
            <div className="noorix-surface-card" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankReconExpectedCredits')}</div>
              <div style={{ fontSize: 17, fontWeight: 800, direction: 'ltr', textAlign: 'right', color: '#2563eb' }}>
                {reconLoading ? '…' : fmt(reconciliationStats?.expected_credits ?? 0)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
