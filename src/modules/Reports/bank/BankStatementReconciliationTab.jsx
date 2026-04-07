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
      <p className="text-noorix-muted text-center p-6">
        {t('bankStatementNoTransactions')}
      </p>
    );
  }

  const okAgg = balanceVerification.aggregatesMatch;
  const okSeq = balanceVerification.balanceSequenceValid;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
        <div className="noorix-surface-card p-3.5">
          <div className="text-[12px] text-noorix-muted">{t('bankReconDepositsComputed')}</div>
          <div className="text-[18px] font-extrabold nx-ltr text-end">
            {fmt(balanceVerification.totalDeposits)}
          </div>
        </div>
        <div className="noorix-surface-card p-3.5">
          <div className="text-[12px] text-noorix-muted">{t('bankReconDepositsStored')}</div>
          <div className="text-[18px] font-extrabold nx-ltr text-end">
            {fmt(balanceVerification.stmtDeposits)}
          </div>
        </div>
        <div className="noorix-surface-card p-3.5">
          <div className="text-[12px] text-noorix-muted">{t('bankReconWithdrawalsComputed')}</div>
          <div className="text-[18px] font-extrabold nx-ltr text-end">
            {fmt(balanceVerification.totalWithdrawals)}
          </div>
        </div>
        <div className="noorix-surface-card p-3.5">
          <div className="text-[12px] text-noorix-muted">{t('bankReconWithdrawalsStored')}</div>
          <div className="text-[18px] font-extrabold nx-ltr text-end">
            {fmt(balanceVerification.stmtWithdrawals)}
          </div>
        </div>
      </div>

      <div
        className="noorix-surface-card p-4"
        style={{
          borderLeft: `4px solid ${okAgg ? 'var(--noorix-accent-green)' : '#ca8a04'}`,
        }}
      >
        <strong>{t('bankReconAggregateCheck')}</strong>
        <p className="text-[14px] mt-2 mb-0">
          {okAgg ? t('bankReconAggregateOk') : t('bankReconAggregateDiff')}
          {!okAgg && (
            <span className="nx-ltr text-[12px] mt-1.5 block">
              Δ dep {fmt(balanceVerification.depositsDiff)} / Δ wdr {fmt(balanceVerification.withdrawalsDiff)}
            </span>
          )}
        </p>
      </div>

      <div
        className="noorix-surface-card p-4"
        style={{
          borderLeft: `4px solid ${okSeq ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-red)'}`,
        }}
      >
        <strong>{t('bankReconBalanceSequence')}</strong>
        <p className="text-[14px] mt-2 mb-0">
          {okSeq ? t('bankReconSequenceOk') : t('bankReconSequenceIssues')}
        </p>
        {!okSeq && balanceVerification.balanceErrors?.length ? (
          <ul className="text-[12px] mt-2">
            {balanceVerification.balanceErrors.map((e, i) => (
              <li key={i}>
                {e.date}: {t('bankReconExpected')} {fmt(e.expected)} / {t('bankReconActual')} {fmt(e.actual)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {(reconciliationStats || reconLoading) && (
        <div className="grid gap-3">
          <h3 className="m-0 text-[15px]">{t('bankReconSystemSection')}</h3>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
            <div className="noorix-surface-card p-3.5">
              <div className="text-[12px] text-noorix-muted">{t('bankReconSalesBankTotal')}</div>
              <div className="font-extrabold nx-ltr text-end text-[17px]">
                {reconLoading ? '…' : fmt(reconciliationStats?.sales_bank_total ?? 0)}
              </div>
            </div>
            <div className="noorix-surface-card p-3.5">
              <div className="text-[12px] text-noorix-muted">{t('bankReconCashDeposits')}</div>
              <div className="font-extrabold nx-ltr text-end text-[17px]">
                {reconLoading ? '…' : fmt(reconciliationStats?.cash_deposits_total ?? 0)}
              </div>
            </div>
            <div className="noorix-surface-card p-3.5">
              <div className="text-[12px] text-noorix-muted">{t('bankReconExpectedCredits')}</div>
              <div className="font-extrabold nx-ltr text-end text-[17px] text-noorix-blue">
                {reconLoading ? '…' : fmt(reconciliationStats?.expected_credits ?? 0)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
