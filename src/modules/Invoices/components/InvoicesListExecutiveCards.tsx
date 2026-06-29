import React from 'react';
import { Badge, FmtNum, cn } from '../../../ui';

/**
 * كروت ملخص الداخل/الخارج — مستخرجة من InvoicesListScreen
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

  return (
    <div className="noorix-exec-card-grid">
      <div className="noorix-exec-card noorix-exec-card--inbound flex flex-col">
        <div className="noorix-exec-card__stripe" />
        <div className="noorix-exec-card__header">
          <div className="noorix-exec-card__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </div>
          <span className="noorix-exec-card__title">
            {t('inbound')} — {t('categoryTypeSale')}
          </span>
          {isRefreshing && (
            <Badge size="sm" color="blue">{refreshLabel}</Badge>
          )}
        </div>
        <div className="flex min-h-0 w-full flex-1 flex-col gap-2 px-1 pt-1">
          <div className="border-b border-noorix-border/50 pb-2 text-center">
            <div className="flex items-baseline justify-center gap-1.5">
              <FmtNum n={Number(serverInflow.total)} className="text-[22px] font-black tabular-nums leading-none text-noorix-text sm:text-[24px]" />
              <span className="nx-sar text-noorix-muted">SR</span>
            </div>
            <div className="mt-0.5 text-[10px] text-noorix-muted">{t('total')}</div>
          </div>
          <div className="text-center text-[10px] font-semibold text-noorix-muted">
            {t('invoicesVaultChannelFlowTitle')} — {t('invoicesVaultFlowInAbbr')} / {t('invoicesVaultFlowOutAbbr')} / {t('invoicesVaultFlowRemainAbbr')}
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {!inflowByVault?.length ? (
              <div className="col-span-full rounded-lg border border-dashed border-noorix-border/60 py-2 text-center text-[12px] text-noorix-muted">—</div>
            ) : (
              inflowByVault.map((row: any) => {
                const outNum = Number(row.outflow ?? 0);
                const remNum = Number(row.remainder ?? 0);
                return (
                  <div
                    key={row.vaultId}
                    className="flex min-w-0 flex-col gap-1 rounded-lg border border-noorix-border bg-noorix-bg-muted/60 px-2 py-1.5"
                  >
                    <span className="min-w-0 truncate text-start text-[11px] font-semibold text-noorix-text">{vaultRowLabel(row)}</span>
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div>
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-noorix-muted">{t('invoicesVaultFlowInAbbr')}</div>
                        <div dir="ltr" className="text-[11px] font-bold tabular-nums text-nx-profit">
                          <FmtNum n={Number(row.total)} /> <span className="nx-sar">SR</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-noorix-muted">{t('invoicesVaultFlowOutAbbr')}</div>
                        <div dir="ltr" className="text-[11px] font-bold tabular-nums text-nx-expenses">
                          <FmtNum n={outNum} /> <span className="nx-sar">SR</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-noorix-muted">{t('invoicesVaultFlowRemainAbbr')}</div>
                        <div
                          dir="ltr"
                          className={cn(
                            'text-[11px] font-bold tabular-nums',
                            remNum > 0 ? 'text-nx-profit' : remNum < 0 ? 'text-nx-expenses' : 'text-noorix-muted',
                          )}
                        >
                          <FmtNum n={remNum} /> <span className="nx-sar">SR</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="noorix-exec-card__divider mt-1" />
        <div className="noorix-exec-card__footer">
          <div className="noorix-exec-card__stat">
            <span className="noorix-exec-card__stat-label">{t('validInvoices')}</span>
            <span className="noorix-exec-card__stat-value">{serverInflow.count}</span>
          </div>
          <div className="noorix-exec-card__stat">
            <span className="noorix-exec-card__stat-label">{t('net')}</span>
            <span className="noorix-exec-card__stat-value">
              <FmtNum n={Number(serverInflow.net)} /> <span className="nx-sar">SR</span>
            </span>
          </div>
          <div className="noorix-exec-card__stat">
            <span className="noorix-exec-card__stat-label">{t('tax')}</span>
            <span className="noorix-exec-card__stat-value">
              <FmtNum n={Number(serverInflow.tax)} /> <span className="nx-sar">SR</span>
            </span>
          </div>
        </div>
      </div>

      <div className="noorix-exec-card noorix-exec-card--outbound flex flex-col">
        <div className="noorix-exec-card__stripe" />
        <div className="noorix-exec-card__header">
          <div className="noorix-exec-card__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </div>
          <span className="noorix-exec-card__title">
            {t('outbound')} — {t('purchases')} / {t('categoryTypeExpense')}
          </span>
          {isRefreshing && (
            <Badge size="sm" color="blue">{refreshLabel}</Badge>
          )}
        </div>
        <div className="flex min-h-0 w-full flex-1 flex-col gap-2 px-1 pt-1">
          <div className="border-b border-noorix-border/50 pb-2 text-center">
            <div className="flex items-baseline justify-center gap-1.5">
              <FmtNum n={Number(serverOutflow.total)} className="text-[22px] font-black tabular-nums leading-none text-noorix-text sm:text-[24px]" />
              <span className="nx-sar text-noorix-muted">SR</span>
            </div>
            <div className="mt-0.5 text-[10px] text-noorix-muted">{t('total')}</div>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-noorix-border bg-noorix-bg-muted/60 px-2 py-1.5">
              <span className="min-w-0 truncate text-start text-[11px] font-semibold text-noorix-text">{t('purchases')}</span>
              <span dir="ltr" className="shrink-0 text-[12px] font-bold tabular-nums text-nx-purchases">
                <FmtNum n={Number(outflowSummary.purchasesTotal)} /> <span className="nx-sar">SR</span>
              </span>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-noorix-border bg-noorix-bg-muted/60 px-2 py-1.5">
              <span className="min-w-0 truncate text-start text-[11px] font-semibold text-noorix-text">{t('invoicesCardNonPurchaseOutflow')}</span>
              <span dir="ltr" className="shrink-0 text-[12px] font-bold tabular-nums text-nx-expenses">
                <FmtNum n={Number(outflowSummary.expensesTotal)} /> <span className="nx-sar">SR</span>
              </span>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-noorix-border bg-noorix-bg-muted/60 px-2 py-1.5">
              <span className="min-w-0 truncate text-start text-[11px] font-semibold text-noorix-text">{t('tax')}</span>
              <span dir="ltr" className="shrink-0 text-[12px] font-bold tabular-nums text-noorix-amber">
                <FmtNum n={Number(outflowSummary.taxTotal)} /> <span className="nx-sar">SR</span>
              </span>
            </div>
          </div>
        </div>
        <div className="noorix-exec-card__divider mt-1" />
        <div className="noorix-exec-card__footer">
          <div className="noorix-exec-card__stat">
            <span className="noorix-exec-card__stat-label">{t('validInvoices')}</span>
            <span className="noorix-exec-card__stat-value">{serverOutflow.count}</span>
          </div>
          <div className="noorix-exec-card__stat">
            <span className="noorix-exec-card__stat-label">{t('net')}</span>
            <span className="noorix-exec-card__stat-value">
              <FmtNum n={Number(serverOutflow.net)} /> <span className="nx-sar">SR</span>
            </span>
          </div>
          <div className="noorix-exec-card__stat">
            <span className="noorix-exec-card__stat-label">{t('tax')}</span>
            <span className="noorix-exec-card__stat-value">
              <FmtNum n={Number(serverOutflow.tax)} /> <span className="nx-sar">SR</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
