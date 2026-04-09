/**
 * مقارنة دائن الكشف مع «المتوقع من النظام» — نفس منطق getBankReconciliationStats (Base44)
 */
import React, { useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { FmtNum } from '../../../ui';

export default function BankStatementSalesCompareTab({ statement, reconciliationStats, reconLoading }) {
  const { t } = useTranslation();
  const start = statement?.startDate?.slice(0, 10);
  const end = statement?.endDate?.slice(0, 10);

  const bankCredits = useMemo(() => {
    const txs = statement?.transactions || [];
    return txs.reduce((s, tx) => s + (Number(tx.credit) || 0), 0);
  }, [statement]);

  if (!start || !end) {
    return (
      <p className="text-noorix-muted p-4">{t('bankSalesCompareNeedDates')}</p>
    );
  }

  const expected = reconciliationStats?.expected_credits ?? 0;
  const salesBank = reconciliationStats?.sales_bank_total ?? 0;
  const cashDeposits = reconciliationStats?.cash_deposits_total ?? 0;
  const saleCount = reconciliationStats?.sale_invoice_count;
  const diff = bankCredits - expected;

  return (
    <div className="grid gap-4">
      <p className="text-[13px] text-noorix-muted m-0">{t('bankSalesCompareDescServer')}</p>

      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        }}
      >
        <div className="noorix-surface-card p-4">
          <div className="text-[12px] text-noorix-muted">{t('bankStatementBankCredits')}</div>
          <div className="text-[20px] font-extrabold nx-ltr text-end" style={{ color: 'var(--noorix-accent-green)' }}>
            <FmtNum n={bankCredits} />
          </div>
        </div>
        <div className="noorix-surface-card p-4">
          <div className="text-[12px] text-noorix-muted">{t('bankReconExpectedCredits')}</div>
          <div className="text-[20px] font-extrabold nx-ltr text-end">
            {reconLoading ? '…' : fmt(expected)}
          </div>
        </div>
        <div className="noorix-surface-card p-4">
          <div className="text-[12px] text-noorix-muted">{t('bankReconSalesBankTotal')}</div>
          <div className="text-[18px] font-bold nx-ltr text-end">
            {reconLoading ? '…' : fmt(salesBank)}
          </div>
          {saleCount != null && !reconLoading ? (
            <div className="text-[11px] text-noorix-muted mt-1">
              {t('bankSalesInvoiceCount', String(saleCount))}
            </div>
          ) : null}
        </div>
        <div className="noorix-surface-card p-4">
          <div className="text-[12px] text-noorix-muted">{t('bankReconCashDeposits')}</div>
          <div className="text-[18px] font-bold nx-ltr text-end">
            {reconLoading ? '…' : fmt(cashDeposits)}
          </div>
        </div>
        <div className="noorix-surface-card p-4">
          <div className="text-[12px] text-noorix-muted">{t('bankSalesDifference')}</div>
          <div
            className="font-extrabold nx-ltr text-[20px] text-right"
            style={{
              color: reconLoading ? 'var(--noorix-text-muted)' : Math.abs(diff) < 1 ? 'var(--noorix-accent-green)' : '#ca8a04',
            }}
          >
            {reconLoading ? '…' : fmt(diff)}
          </div>
        </div>
      </div>

      <p className="text-[12px] text-noorix-muted m-0">{t('bankSalesCompareFootnote')}</p>
    </div>
  );
}
