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
      <p className="nx-text-muted nx-text-center nx-p-24">
        {t('bankStatementNoTransactions')}
      </p>
    );
  }

  const okAgg = balanceVerification.aggregatesMatch;
  const okSeq = balanceVerification.balanceSequenceValid;

  return (
    <div className="nx-grid nx-gap-16">
      <div
        className="nx-grid nx-gap-12"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        }}
      >
        <div className="noorix-surface-card nx-p-14">
          <div className="nx-text-sm nx-text-muted">{t('bankReconDepositsComputed')}</div>
          <div className="nx-text-2xl nx-font-800 nx-ltr nx-text-end">
            {fmt(balanceVerification.totalDeposits)}
          </div>
        </div>
        <div className="noorix-surface-card nx-p-14">
          <div className="nx-text-sm nx-text-muted">{t('bankReconDepositsStored')}</div>
          <div className="nx-text-2xl nx-font-800 nx-ltr nx-text-end">
            {fmt(balanceVerification.stmtDeposits)}
          </div>
        </div>
        <div className="noorix-surface-card nx-p-14">
          <div className="nx-text-sm nx-text-muted">{t('bankReconWithdrawalsComputed')}</div>
          <div className="nx-text-2xl nx-font-800 nx-ltr nx-text-end">
            {fmt(balanceVerification.totalWithdrawals)}
          </div>
        </div>
        <div className="noorix-surface-card nx-p-14">
          <div className="nx-text-sm nx-text-muted">{t('bankReconWithdrawalsStored')}</div>
          <div className="nx-text-2xl nx-font-800 nx-ltr nx-text-end">
            {fmt(balanceVerification.stmtWithdrawals)}
          </div>
        </div>
      </div>

      <div
        className="noorix-surface-card nx-p-16"
        style={{
          borderLeft: `4px solid ${okAgg ? 'var(--noorix-accent-green)' : '#ca8a04'}`,
        }}
      >
        <strong>{t('bankReconAggregateCheck')}</strong>
        <p className="nx-text-md" style={{ margin: '8px 0 0' }}>
          {okAgg ? t('bankReconAggregateOk') : t('bankReconAggregateDiff')}
          {!okAgg && (
            <span className="nx-ltr nx-text-sm nx-mt-6" style={{ display: 'block' }}>
              Δ dep {fmt(balanceVerification.depositsDiff)} / Δ wdr {fmt(balanceVerification.withdrawalsDiff)}
            </span>
          )}
        </p>
      </div>

      <div
        className="noorix-surface-card nx-p-16"
        style={{
          borderLeft: `4px solid ${okSeq ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-red)'}`,
        }}
      >
        <strong>{t('bankReconBalanceSequence')}</strong>
        <p className="nx-text-md" style={{ margin: '8px 0 0' }}>
          {okSeq ? t('bankReconSequenceOk') : t('bankReconSequenceIssues')}
        </p>
        {!okSeq && balanceVerification.balanceErrors?.length ? (
          <ul className="nx-text-sm nx-mt-8">
            {balanceVerification.balanceErrors.map((e, i) => (
              <li key={i}>
                {e.date}: {t('bankReconExpected')} {fmt(e.expected)} / {t('bankReconActual')} {fmt(e.actual)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {(reconciliationStats || reconLoading) && (
        <div className="nx-grid nx-gap-12">
          <h3 className="nx-m-0 nx-text-lg">{t('bankReconSystemSection')}</h3>
          <div
            className="nx-grid nx-gap-12"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            }}
          >
            <div className="noorix-surface-card nx-p-14">
              <div className="nx-text-sm nx-text-muted">{t('bankReconSalesBankTotal')}</div>
              <div className="nx-font-800 nx-ltr nx-text-end" style={{ fontSize: 17 }}>
                {reconLoading ? '…' : fmt(reconciliationStats?.sales_bank_total ?? 0)}
              </div>
            </div>
            <div className="noorix-surface-card nx-p-14">
              <div className="nx-text-sm nx-text-muted">{t('bankReconCashDeposits')}</div>
              <div className="nx-font-800 nx-ltr nx-text-end" style={{ fontSize: 17 }}>
                {reconLoading ? '…' : fmt(reconciliationStats?.cash_deposits_total ?? 0)}
              </div>
            </div>
            <div className="noorix-surface-card nx-p-14">
              <div className="nx-text-sm nx-text-muted">{t('bankReconExpectedCredits')}</div>
              <div className="nx-font-800 nx-ltr nx-text-end" style={{ fontSize: 17, color: 'var(--noorix-accent-blue)' }}>
                {reconLoading ? '…' : fmt(reconciliationStats?.expected_credits ?? 0)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
