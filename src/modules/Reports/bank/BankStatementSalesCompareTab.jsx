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
      <p style={{ color: 'var(--noorix-text-muted)', padding: 16 }}>{t('bankSalesCompareNeedDates')}</p>
    );
  }

  const expected = reconciliationStats?.expected_credits ?? 0;
  const salesBank = reconciliationStats?.sales_bank_total ?? 0;
  const cashDeposits = reconciliationStats?.cash_deposits_total ?? 0;
  const saleCount = reconciliationStats?.sale_invoice_count;
  const diff = bankCredits - expected;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--noorix-text-muted)', margin: 0 }}>{t('bankSalesCompareDescServer')}</p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
        }}
      >
        <div className="noorix-surface-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankStatementBankCredits')}</div>
          <div style={{ fontSize: 20, fontWeight: 800, direction: 'ltr', textAlign: 'right', color: '#16a34a' }}>
            {fmt(bankCredits)}
          </div>
        </div>
        <div className="noorix-surface-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankReconExpectedCredits')}</div>
          <div style={{ fontSize: 20, fontWeight: 800, direction: 'ltr', textAlign: 'right' }}>
            {reconLoading ? '…' : fmt(expected)}
          </div>
        </div>
        <div className="noorix-surface-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankReconSalesBankTotal')}</div>
          <div style={{ fontSize: 18, fontWeight: 700, direction: 'ltr', textAlign: 'right' }}>
            {reconLoading ? '…' : fmt(salesBank)}
          </div>
          {saleCount != null && !reconLoading ? (
            <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 4 }}>
              {t('bankSalesInvoiceCount', String(saleCount))}
            </div>
          ) : null}
        </div>
        <div className="noorix-surface-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankReconCashDeposits')}</div>
          <div style={{ fontSize: 18, fontWeight: 700, direction: 'ltr', textAlign: 'right' }}>
            {reconLoading ? '…' : fmt(cashDeposits)}
          </div>
        </div>
        <div className="noorix-surface-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankSalesDifference')}</div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              direction: 'ltr',
              textAlign: 'right',
              color: reconLoading ? 'var(--noorix-text-muted)' : Math.abs(diff) < 1 ? '#16a34a' : '#ca8a04',
            }}
          >
            {reconLoading ? '…' : fmt(diff)}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--noorix-text-muted)', margin: 0 }}>{t('bankSalesCompareFootnote')}</p>
    </div>
  );
}
