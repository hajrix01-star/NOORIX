/**
 * مطابقة أرصدة وإجماليات — محلياً من بيانات الكشف
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { FmtNum } from '../../../ui';

export default function BankStatementReconciliationTab({ balanceVerification, reconciliationStats, reconLoading }: any) {
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
            <FmtNum n={balanceVerification.totalDeposits} />
          </div>
        </div>
        <div className="noorix-surface-card p-3.5">
          <div className="text-[12px] text-noorix-muted">{t('bankReconDepositsStored')}</div>
          <div className="text-[18px] font-extrabold nx-ltr text-end">
            <FmtNum n={balanceVerification.stmtDeposits} />
          </div>
        </div>
        <div className="noorix-surface-card p-3.5">
          <div className="text-[12px] text-noorix-muted">{t('bankReconWithdrawalsComputed')}</div>
          <div className="text-[18px] font-extrabold nx-ltr text-end">
            <FmtNum n={balanceVerification.totalWithdrawals} />
          </div>
        </div>
        <div className="noorix-surface-card p-3.5">
          <div className="text-[12px] text-noorix-muted">{t('bankReconWithdrawalsStored')}</div>
          <div className="text-[18px] font-extrabold nx-ltr text-end">
            <FmtNum n={balanceVerification.stmtWithdrawals} />
          </div>
        </div>
      </div>

      <div className={`noorix-surface-card p-4 border-l-4 ${okAgg ? 'border-l-noorix-green' : 'border-l-[var(--color-noorix-amber)]'}`}>
        <strong>{t('bankReconAggregateCheck')}</strong>
        <p className="text-[14px] mt-2 mb-0">
          {okAgg ? t('bankReconAggregateOk') : t('bankReconAggregateDiff')}
          {!okAgg && (
            <span className="nx-ltr text-[12px] mt-1.5 block">
              Δ dep <FmtNum n={balanceVerification.depositsDiff} /> / Δ wdr <FmtNum n={balanceVerification.withdrawalsDiff} />
            </span>
          )}
        </p>
      </div>

      <div className={`noorix-surface-card p-4 border-l-4 ${okSeq ? 'border-l-noorix-green' : 'border-l-noorix-red'}`}>
        <strong>{t('bankReconBalanceSequence')}</strong>
        <p className="text-[14px] mt-2 mb-0">
          {okSeq ? t('bankReconSequenceOk') : t('bankReconSequenceIssues')}
        </p>
        {!okSeq && balanceVerification.balanceErrors?.length ? (
          <ul className="text-[12px] mt-2">
            {balanceVerification.balanceErrors.map((e: any, i: any) => (
              <li key={i}>
                {e.date}: {t('bankReconExpected')} <FmtNum n={e.expected} /> / {t('bankReconActual')} <FmtNum n={e.actual} />
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
