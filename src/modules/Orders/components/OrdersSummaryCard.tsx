/** Large summary card: customer → products → line → totals */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { FmtNum } from '../../../ui';

export type OrdersSummaryMetrics = {
  pettyCashTotal?: number;
  delegatePurchasesTotal?: number;
  localPurchasesTotal?: number;
  delegateBalance?: number;
};

function SectionBlock({ title, received, spent, result, receivedLabel, spentLabel, resultLabel, accentColor }: any) {
  const resNum = Number(result ?? 0);
  return (
    <div className="nx-orders-summary-section flex min-w-0 flex-col overflow-hidden rounded-lg border border-noorix-border bg-noorix-bg-muted/50">
      <div className="h-1 rounded-t-lg" style={{ background: accentColor || 'var(--color-nx-sales)' }} aria-hidden />
      <div className="pt-[14px] px-4 pb-3">
        <div className="text-[11px] font-bold text-noorix-muted mb-3 uppercase tracking-[0.04em]">
          {title}
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-noorix-muted">{receivedLabel}</span>
            <FmtNum n={Number(received ?? 0)} className="nx-font-numbers font-bold text-[13px] text-noorix-green" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-noorix-muted">{spentLabel}</span>
            <FmtNum n={Number(spent ?? 0)} className="nx-font-numbers font-bold text-[13px] text-noorix-red" />
          </div>
        </div>
      </div>
      <div className="border-t border-noorix-border mx-4" />
      <div className="text-center py-3 px-4">
        <div className="text-[10px] text-noorix-muted mb-1 uppercase tracking-[0.04em]">
          {resultLabel}
        </div>
        <div dir="ltr" className="font-extrabold nx-font-numbers text-[22px] tracking-[-0.5px]" style={{
          color: resNum < 0 ? 'var(--color-nx-expenses)' : 'var(--noorix-text)',
        }}>
          {resNum < 0 ? '-' : ''}
          <FmtNum n={Math.abs(resNum)} />
          <span className="nx-sar">SR</span>
        </div>
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
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-[12px] font-bold text-noorix-muted tracking-[0.04em] sm:text-[13px]">
            {t('ordersSummaryCardTitle')}
          </div>
          <span className="nx-sar text-[11px]">SR</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5">
          <SectionBlock
            title={t('ordersDelegateSection')}
            received={pettyCash}
            spent={delegatePurchases}
            result={delegateBalance}
            receivedLabel={t('ordersReceived')}
            spentLabel={t('ordersDelegatePurchases')}
            resultLabel={t('ordersDelegateBalance')}
            accentColor="var(--color-nx-sales)"
          />
          <SectionBlock
            title={t('ordersLocalCashSection')}
            received={cashSales}
            spent={localPurchases}
            result={cashRemaining}
            receivedLabel={t('ordersCashSales')}
            spentLabel={t('ordersLocalPurchases')}
            resultLabel={t('ordersCashRemaining')}
            accentColor="var(--color-nx-profit)"
          />
        </div>
      </div>
    </div>
  );
}
