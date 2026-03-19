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
    <div style={{
      borderRadius: 14,
      border: '1px solid var(--noorix-border)',
      background: 'var(--noorix-bg-surface)',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ height: 3, background: accentColor || '#2563eb' }} />
      <div style={{ padding: '14px 16px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--noorix-text-muted)', marginBottom: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {title}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--noorix-text-muted)' }}>{receivedLabel}</span>
            <span style={{ fontFamily: 'var(--noorix-font-numbers)', fontWeight: 700, fontSize: 13, color: '#16a34a' }}>{fmt(Number(received ?? 0), 2)} <span style={{ fontWeight: 400, color: 'var(--noorix-text-muted)', fontSize: 11 }}>﷼</span></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--noorix-text-muted)' }}>{spentLabel}</span>
            <span style={{ fontFamily: 'var(--noorix-font-numbers)', fontWeight: 700, fontSize: 13, color: '#dc2626' }}>− {fmt(Number(spent ?? 0), 2)} <span style={{ fontWeight: 400, color: 'var(--noorix-text-muted)', fontSize: 11 }}>﷼</span></span>
          </div>
        </div>
      </div>
      <div style={{ margin: '0 16px', height: 1, background: 'var(--noorix-border)' }} />
      <div style={{ padding: '12px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {resultLabel}
        </div>
        <div style={{
          fontSize: 22, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)',
          color: resNum < 0 ? '#dc2626' : 'var(--noorix-text)',
          letterSpacing: '-0.5px',
        }}>
          {resNum < 0 ? '−' : ''}{fmt(Math.abs(resNum), 2)}
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--noorix-text-muted)', marginRight: 4 }}>﷼</span>
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
      <div style={{
        borderRadius: 14, border: '1px solid var(--noorix-border)',
        background: 'var(--noorix-bg-surface)', padding: 24,
        textAlign: 'center', color: 'var(--noorix-text-muted)',
      }}>
        {t('loading')}
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: 14,
      border: '1px solid var(--noorix-border)',
      background: 'var(--noorix-bg-surface)',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg, #2563eb, #16a34a)' }} />
      <div style={{ padding: '20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--noorix-text-muted)', marginBottom: 16, letterSpacing: '0.04em' }}>
          {t('ordersSummaryCardTitle')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
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
