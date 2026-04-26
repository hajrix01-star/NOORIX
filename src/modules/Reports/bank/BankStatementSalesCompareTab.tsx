/**
 * مقارنة دائن الكشف مع «المتوقع من النظام» — نفس منطق getBankReconciliationStats (Base44)
 */
import React, { useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { FmtNum, MetricCard } from '../../../ui';

export default function BankStatementSalesCompareTab({ statement, reconciliationStats, reconLoading }: any) {
  const { t } = useTranslation();
  const start = statement?.startDate?.slice(0, 10);
  const end = statement?.endDate?.slice(0, 10);

  const bankCredits = useMemo(() => {
    const txs = statement?.transactions || [];
    return txs.reduce((s: any, tx: any) => s + (Number(tx.credit) || 0), 0);
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

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <MetricCard color="var(--color-nx-profit)">
          <MetricCard.Header label={t('bankStatementBankCredits')} />
          <MetricCard.Value value={<FmtNum n={bankCredits} />} />
        </MetricCard>
        <MetricCard color="var(--color-nx-sales)">
          <MetricCard.Header label={t('bankReconExpectedCredits')} />
          <MetricCard.Value value={reconLoading ? '…' : fmt(expected)} />
        </MetricCard>
        <MetricCard color="var(--color-nx-sales)">
          <MetricCard.Header label={t('bankReconSalesBankTotal')} />
          <MetricCard.Value value={reconLoading ? '…' : fmt(salesBank)} />
          {saleCount != null && !reconLoading && (
            <MetricCard.Section>
              <span className="text-[11px] text-noorix-muted">{t('bankSalesInvoiceCount', String(saleCount))}</span>
            </MetricCard.Section>
          )}
        </MetricCard>
        <MetricCard color="var(--color-nx-purchases)">
          <MetricCard.Header label={t('bankReconCashDeposits')} />
          <MetricCard.Value value={reconLoading ? '…' : fmt(cashDeposits)} />
        </MetricCard>
        <MetricCard color={reconLoading || Math.abs(diff) < 1 ? 'var(--color-nx-profit)' : 'var(--color-nx-net-profit)'}>
          <MetricCard.Header label={t('bankSalesDifference')} />
          <MetricCard.Value value={reconLoading ? '…' : fmt(diff)} />
        </MetricCard>
      </div>

      <p className="text-[12px] text-noorix-muted m-0">{t('bankSalesCompareFootnote')}</p>
    </div>
  );
}
