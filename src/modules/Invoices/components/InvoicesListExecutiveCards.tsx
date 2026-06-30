import React from 'react';
import { Badge, FmtNum, cn } from '../../../ui';

function SummaryMetric({ label, value, tone = 'neutral' }: any) {
  return (
    <div className="nx-invoice-summary-metric">
      <span className="nx-invoice-summary-metric__label">{label}</span>
      <span className={cn('nx-invoice-summary-metric__value', `nx-invoice-summary-metric__value--${tone}`)}>
        {value}
      </span>
    </div>
  );
}

function Money({ value, className }: any) {
  return (
    <span dir="ltr" className={cn('nx-invoice-summary-money', className)}>
      <FmtNum n={Number(value)} /> <span className="nx-sar">SR</span>
    </span>
  );
}

function SummaryCard({
  title,
  total,
  count,
  net,
  tax,
  labels,
  tone,
  icon,
  children,
  isRefreshing,
  refreshLabel,
}: any) {
  return (
    <section className={cn('nx-invoice-summary-card', `nx-invoice-summary-card--${tone}`)}>
      <div className="nx-invoice-summary-card__stripe" />
      <div className="nx-invoice-summary-card__body">
        <div className="nx-invoice-summary-card__head">
          <div className="nx-invoice-summary-card__icon">{icon}</div>
          <div className="min-w-0">
            <div className="nx-invoice-summary-card__title">{title}</div>
            {isRefreshing && <Badge size="sm" color="blue">{refreshLabel}</Badge>}
          </div>
        </div>

        <div className="nx-invoice-summary-card__total">
          <FmtNum n={Number(total)} className="nx-invoice-summary-card__total-number" />
          <span className="nx-sar">SR</span>
        </div>

        {children && <div className="nx-invoice-summary-card__breakdown">{children}</div>}

        <div className="nx-invoice-summary-card__metrics">
          <SummaryMetric label={labels.validInvoices} value={count} />
          <SummaryMetric label={labels.net} value={<Money value={net} />} tone="strong" />
          <SummaryMetric label={labels.tax} value={<Money value={tax} />} tone="amber" />
        </div>
      </div>
    </section>
  );
}

function InboundIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function OutboundIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );
}

/**
 * Executive invoices summary: two balanced financial cards plus a separate vault movement strip.
 */
export function InvoicesListExecutiveCards({
  t,
  serverInflow,
  serverOutflow,
  inflowByVault,
  outflowSummary,
  vaultRowLabel,
  isRefreshing = false,
}: any) {
  const refreshLabel = typeof t === 'function' ? t('refreshing') : 'جاري التحديث';
  const labels = {
    validInvoices: t('validInvoices'),
    net: t('net'),
    tax: t('tax'),
  };

  return (
    <section className="nx-invoice-summary">
      <div className="nx-invoice-summary__cards">
        <SummaryCard
          title={`${t('inbound')} — ${t('categoryTypeSale')}`}
          total={serverInflow.total}
          count={serverInflow.count}
          net={serverInflow.net}
          tax={serverInflow.tax}
          labels={labels}
          tone="inbound"
          icon={<InboundIcon />}
          isRefreshing={isRefreshing}
          refreshLabel={refreshLabel}
        />

        <SummaryCard
          title={`${t('outbound')} — ${t('purchases')} / ${t('categoryTypeExpense')}`}
          total={serverOutflow.total}
          count={serverOutflow.count}
          net={serverOutflow.net}
          tax={serverOutflow.tax}
          labels={labels}
          tone="outbound"
          icon={<OutboundIcon />}
          isRefreshing={isRefreshing}
          refreshLabel={refreshLabel}
        >
          <div className="nx-invoice-summary-splits">
            <SummaryMetric label={t('purchases')} value={<Money value={outflowSummary.purchasesTotal} className="text-nx-purchases" />} />
            <SummaryMetric label={t('invoicesCardNonPurchaseOutflow')} value={<Money value={outflowSummary.expensesTotal} className="text-nx-expenses" />} />
          </div>
        </SummaryCard>
      </div>

      <div className="nx-invoice-vault-flow">
        <div className="nx-invoice-vault-flow__head">
          <span className="nx-invoice-vault-flow__title">{t('invoicesVaultChannelFlowTitle')}</span>
          <span className="nx-invoice-vault-flow__hint">
            {t('invoicesVaultFlowInAbbr')} / {t('invoicesVaultFlowOutAbbr')} / {t('invoicesVaultFlowRemainAbbr')}
          </span>
        </div>

        <div className="nx-invoice-vault-flow__grid">
          {!inflowByVault?.length ? (
            <div className="nx-invoice-vault-flow__empty">—</div>
          ) : (
            inflowByVault.map((row: any) => {
              const outNum = Number(row.outflow ?? 0);
              const remNum = Number(row.remainder ?? 0);
              return (
                <div key={row.vaultId} className="nx-invoice-vault-flow__item">
                  <span className="nx-invoice-vault-flow__name">{vaultRowLabel(row)}</span>
                  <span className="nx-invoice-vault-flow__amount text-nx-profit">
                    <FmtNum n={Number(row.total)} /> <span className="nx-sar">SR</span>
                  </span>
                  <span className="nx-invoice-vault-flow__amount text-nx-expenses">
                    <FmtNum n={outNum} /> <span className="nx-sar">SR</span>
                  </span>
                  <span
                    className={cn(
                      'nx-invoice-vault-flow__amount',
                      remNum > 0 ? 'text-nx-profit' : remNum < 0 ? 'text-nx-expenses' : 'text-noorix-muted',
                    )}
                  >
                    <FmtNum n={remNum} /> <span className="nx-sar">SR</span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
