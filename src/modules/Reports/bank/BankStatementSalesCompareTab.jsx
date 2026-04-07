/**
 * مقارنة دائن الكشف مع «المتوقع من النظام» — نفس منطق getBankReconciliationStats (Base44)
 */
import React, { useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';

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
      <p className="nx-text-muted nx-p-16">{t('bankSalesCompareNeedDates')}</p>
    );
  }

  const expected = reconciliationStats?.expected_credits ?? 0;
  const salesBank = reconciliationStats?.sales_bank_total ?? 0;
  const cashDeposits = reconciliationStats?.cash_deposits_total ?? 0;
  const saleCount = reconciliationStats?.sale_invoice_count;
  const diff = bankCredits - expected;

  return (
    <div className="nx-grid nx-gap-16">
      <p className="nx-text-base nx-text-muted nx-m-0">{t('bankSalesCompareDescServer')}</p>

      <div
        className="nx-grid nx-gap-12"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        }}
      >
        <div className="noorix-surface-card nx-p-16">
          <div className="nx-text-sm nx-text-muted">{t('bankStatementBankCredits')}</div>
          <div className="nx-text-3xl nx-font-800 nx-ltr nx-text-end" style={{ color: 'var(--noorix-accent-green)' }}>
            {fmt(bankCredits)}
          </div>
        </div>
        <div className="noorix-surface-card nx-p-16">
          <div className="nx-text-sm nx-text-muted">{t('bankReconExpectedCredits')}</div>
          <div className="nx-text-3xl nx-font-800 nx-ltr nx-text-end">
            {reconLoading ? '…' : fmt(expected)}
          </div>
        </div>
        <div className="noorix-surface-card nx-p-16">
          <div className="nx-text-sm nx-text-muted">{t('bankReconSalesBankTotal')}</div>
          <div className="nx-text-2xl nx-font-700 nx-ltr nx-text-end">
            {reconLoading ? '…' : fmt(salesBank)}
          </div>
          {saleCount != null && !reconLoading ? (
            <div className="nx-text-xs nx-text-muted nx-mt-4">
              {t('bankSalesInvoiceCount', String(saleCount))}
            </div>
          ) : null}
        </div>
        <div className="noorix-surface-card nx-p-16">
          <div className="nx-text-sm nx-text-muted">{t('bankReconCashDeposits')}</div>
          <div className="nx-text-2xl nx-font-700 nx-ltr nx-text-end">
            {reconLoading ? '…' : fmt(cashDeposits)}
          </div>
        </div>
        <div className="noorix-surface-card nx-p-16">
          <div className="nx-text-sm nx-text-muted">{t('bankSalesDifference')}</div>
          <div
            className="nx-font-800 nx-ltr"
            style={{
              fontSize: 20,
              textAlign: 'right',
              color: reconLoading ? 'var(--noorix-text-muted)' : Math.abs(diff) < 1 ? 'var(--noorix-accent-green)' : '#ca8a04',
            }}
          >
            {reconLoading ? '…' : fmt(diff)}
          </div>
        </div>
      </div>

      <p className="nx-text-sm nx-text-muted nx-m-0">{t('bankSalesCompareFootnote')}</p>
    </div>
  );
}
