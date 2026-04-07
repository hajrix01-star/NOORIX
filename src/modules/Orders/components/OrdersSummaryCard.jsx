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
    <div className="nx-border-all nx-overflow-hidden nx-bg-surface nx-flex-col" style={{ borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ height: 3, background: accentColor || 'var(--noorix-accent-blue)' }} />
      <div style={{ padding: '14px 16px 12px' }}>
        <div className="nx-text-xs nx-font-700 nx-text-muted nx-mb-12 nx-uppercase" style={{ letterSpacing: '0.04em' }}>
          {title}
        </div>
        <div className="nx-grid nx-gap-8">
          <div className="flex items-center justify-between">
            <span className="nx-text-2xs nx-text-muted">{receivedLabel}</span>
            <span className="nx-font-numbers nx-font-700 nx-text-base nx-text-green">{fmt(Number(received ?? 0), 2)} <span className="nx-font-400 nx-text-muted nx-text-xs">﷼</span></span>
          </div>
          <div className="flex items-center justify-between">
            <span className="nx-text-2xs nx-text-muted">{spentLabel}</span>
            <span className="nx-font-numbers nx-font-700 nx-text-base nx-text-red">− {fmt(Number(spent ?? 0), 2)} <span className="nx-font-400 nx-text-muted nx-text-xs">﷼</span></span>
          </div>
        </div>
      </div>
      <div className="nx-border-t" style={{ margin: '0 16px' }} />
      <div className="nx-text-center" style={{ padding: '12px 16px' }}>
        <div className="nx-text-2xs nx-text-muted nx-mb-4 nx-uppercase" style={{ letterSpacing: '0.04em' }}>
          {resultLabel}
        </div>
        <div className="nx-font-800 nx-font-numbers" style={{
          fontSize: 22,
          color: resNum < 0 ? 'var(--noorix-accent-red)' : 'var(--noorix-text)',
          letterSpacing: '-0.5px',
        }}>
          {resNum < 0 ? '−' : ''}{fmt(Math.abs(resNum), 2)}
          <span className="nx-text-md nx-font-600 nx-text-muted" style={{ marginRight: 4 }}>﷼</span>
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
      <div className="nx-border-all nx-bg-surface nx-p-24 nx-text-center nx-text-muted" style={{ borderRadius: 14 }}>
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="nx-border-all nx-bg-surface nx-overflow-hidden" style={{ borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg, var(--noorix-accent-blue), var(--noorix-accent-green))' }} />
      <div className="nx-p-20">
        <div className="nx-text-base nx-font-700 nx-text-muted nx-mb-16" style={{ letterSpacing: '0.04em' }}>
          {t('ordersSummaryCardTitle')}
        </div>
        <div className="nx-grid nx-gap-14" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}>
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
