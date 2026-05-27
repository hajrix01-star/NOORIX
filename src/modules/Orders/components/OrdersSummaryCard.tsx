/** ملخص الطلبات — كرت واحد: عهدة المندوب + نقد المحل (جداول داخلية) */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { FmtNum } from '../../../ui';

export type OrdersSummaryMetrics = {
  pettyCashTotal?: number;
  delegatePurchasesTotal?: number;
  localPurchasesTotal?: number;
  delegateBalance?: number;
};

function SummaryPane({
  title,
  received,
  spent,
  result,
  receivedLabel,
  spentLabel,
  resultLabel,
  accentColor,
  colItem,
  colAmount,
}: {
  title: string;
  received: number;
  spent: number;
  result: number;
  receivedLabel: string;
  spentLabel: string;
  resultLabel: string;
  accentColor: string;
  colItem: string;
  colAmount: string;
}) {
  const resNum = Number(result ?? 0);
  return (
    <div className="nx-orders-summary-pane flex min-w-0 flex-col px-3 py-3 sm:px-4 sm:py-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="h-4 w-1 shrink-0 rounded-full"
          style={{ background: accentColor || 'var(--color-nx-sales)' }}
          aria-hidden
        />
        <div className="text-[11px] font-bold uppercase tracking-[0.04em] text-noorix-muted">
          {title}
        </div>
      </div>
      <div className="overflow-hidden rounded-md border border-noorix-border">
        <table className="nx-orders-summary-table noorix-table w-full">
          <thead>
            <tr>
              <th scope="col">{colItem}</th>
              <th scope="col">{colAmount}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{receivedLabel}</td>
              <td>
                <FmtNum n={Number(received ?? 0)} className="nx-font-numbers font-semibold text-noorix-green" />
              </td>
            </tr>
            <tr>
              <td>{spentLabel}</td>
              <td>
                <FmtNum n={Number(spent ?? 0)} className="nx-font-numbers font-semibold text-noorix-red" />
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>{resultLabel}</td>
              <td>
                <span
                  dir="ltr"
                  className="nx-font-numbers inline-flex items-baseline justify-center gap-0.5 font-bold"
                  style={{
                    color: resNum < 0 ? 'var(--color-nx-expenses)' : 'var(--noorix-text)',
                  }}
                >
                  {resNum < 0 ? '-' : ''}
                  <FmtNum n={Math.abs(resNum)} className="text-[15px] sm:text-[16px]" />
                  <span className="nx-sar text-[11px] font-normal">SR</span>
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function OrdersSummaryCard({
  summary = {} as OrdersSummaryMetrics,
  cashSalesTotal = 0,
  isLoading,
}: {
  summary?: OrdersSummaryMetrics;
  cashSalesTotal?: number;
  isLoading?: boolean;
}) {
  const { t } = useTranslation();
  const pettyCash = Number(summary.pettyCashTotal ?? 0);
  const delegatePurchases = Number(summary.delegatePurchasesTotal ?? 0);
  const localPurchases = Number(summary.localPurchasesTotal ?? 0);
  const delegateBalance = Number(summary.delegateBalance ?? 0);
  const cashSales = Number(cashSalesTotal);
  const cashRemaining = cashSales - localPurchases;

  const colItem = t('ordersSummaryColItem');
  const colAmount = t('ordersSummaryColAmount');

  if (isLoading) {
    return (
      <div className="nx-orders-summary-card rounded-lg border border-noorix-border bg-noorix-bg-muted/40 p-4 text-center text-[13px] text-noorix-muted">
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="nx-orders-summary-card overflow-hidden rounded-lg border border-noorix-border bg-noorix-surface">
      <div
        className="h-1 bg-gradient-to-r from-noorix-blue to-noorix-green"
        aria-hidden
      />
      <div className="flex items-center justify-between gap-2 border-b border-noorix-border px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="text-[12px] font-bold tracking-[0.04em] text-noorix-muted sm:text-[13px]">
          {t('ordersSummaryCardTitle')}
        </div>
        <span className="nx-sar text-[11px]">SR</span>
      </div>
      <div className="grid grid-cols-1 divide-y divide-noorix-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <SummaryPane
          title={t('ordersDelegateSection')}
          received={pettyCash}
          spent={delegatePurchases}
          result={delegateBalance}
          receivedLabel={t('ordersReceived')}
          spentLabel={t('ordersDelegatePurchases')}
          resultLabel={t('ordersDelegateBalance')}
          accentColor="var(--color-nx-sales)"
          colItem={colItem}
          colAmount={colAmount}
        />
        <SummaryPane
          title={t('ordersLocalCashSection')}
          received={cashSales}
          spent={localPurchases}
          result={cashRemaining}
          receivedLabel={t('ordersCashSales')}
          spentLabel={t('ordersLocalPurchases')}
          resultLabel={t('ordersCashRemaining')}
          accentColor="var(--color-nx-profit)"
          colItem={colItem}
          colAmount={colAmount}
        />
      </div>
    </div>
  );
}
