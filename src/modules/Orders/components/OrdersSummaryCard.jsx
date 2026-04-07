/**
 * OrdersSummaryCard — كرت ملخص واحد كبير
 * تنسيق هرمي: المستلم → المشتريات → خط → النتيجة
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';

function SectionBlock({ title, received, spent, result, receivedLabel, spentLabel, resultLabel, accentColor }) {
  const resNum = Number(result ?? 0);
  return (
    <div className="border border-noorix-border overflow-hidden bg-noorix-surface flex flex-col rounded-[14px]" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div className="h-[3px]" style={{ background: accentColor || 'var(--noorix-accent-blue)' }} />
      <div className="pt-[14px] px-4 pb-3">
        <div className="text-[11px] font-bold text-noorix-muted mb-3 uppercase tracking-[0.04em]">
          {title}
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-noorix-muted">{receivedLabel}</span>
            <span className="nx-font-numbers font-bold text-[13px] text-noorix-green">{fmt(Number(received ?? 0), 2)} <span className="font-normal text-noorix-muted text-[11px]">﷼</span></span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-noorix-muted">{spentLabel}</span>
            <span className="nx-font-numbers font-bold text-[13px] text-noorix-red">− {fmt(Number(spent ?? 0), 2)} <span className="font-normal text-noorix-muted text-[11px]">﷼</span></span>
          </div>
        </div>
      </div>
      <div className="border-t border-noorix-border mx-4" />
      <div className="text-center py-3 px-4">
        <div className="text-[10px] text-noorix-muted mb-1 uppercase tracking-[0.04em]">
          {resultLabel}
        </div>
        <div className="font-extrabold nx-font-numbers text-[22px] tracking-[-0.5px]" style={{
          color: resNum < 0 ? 'var(--noorix-accent-red)' : 'var(--noorix-text)',
        }}>
          {resNum < 0 ? '−' : ''}{fmt(Math.abs(resNum), 2)}
          <span className="text-[14px] font-semibold text-noorix-muted mr-1">﷼</span>
        </div>
      </div>
    </div>
  );
}

export function OrdersSummaryCard({ summary = {}, cashSalesTotal = 0, isLoading }) {
  const { t } = useTranslation();
  const pettyCash = Number(summary.pettyCashTotal ?? 0);
  const delegatePurchases = Number(summary.delegatePurchasesTotal ?? 0);
  const localPurchases = Number(summary.localPurchasesTotal ?? 0);
  const delegateBalance = Number(summary.delegateBalance ?? 0);
  const cashSales = Number(cashSalesTotal);
  const cashRemaining = cashSales - localPurchases;

  if (isLoading) {
    return (
      <div className="border border-noorix-border bg-noorix-surface p-6 text-center text-noorix-muted rounded-[14px]">
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="border border-noorix-border bg-noorix-surface overflow-hidden rounded-[14px]" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, var(--noorix-accent-blue), var(--noorix-accent-green))' }} />
      <div className="p-5">
        <div className="text-[13px] font-bold text-noorix-muted mb-4 tracking-[0.04em]">
          {t('ordersSummaryCardTitle')}
        </div>
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
          <SectionBlock
            title={t('ordersDelegateSection')}
            received={pettyCash}
            spent={delegatePurchases}
            result={delegateBalance}
            receivedLabel={t('ordersReceived')}
            spentLabel={t('ordersDelegatePurchases')}
            resultLabel={t('ordersDelegateBalance')}
            accentColor="#2563eb"
          />
          <SectionBlock
            title={t('ordersLocalCashSection')}
            received={cashSales}
            spent={localPurchases}
            result={cashRemaining}
            receivedLabel={t('ordersCashSales')}
            spentLabel={t('ordersLocalPurchases')}
            resultLabel={t('ordersCashRemaining')}
            accentColor="#16a34a"
          />
        </div>
      </div>
    </div>
  );
}
