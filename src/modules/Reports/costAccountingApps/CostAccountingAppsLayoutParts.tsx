import type Decimal from 'decimal.js';
import type { CostAppsPlResult } from '../costAccountingAppsModel';
import { CostAppsActionsBar, CostAppsKpiCards, CostAppsPlSummaryTable } from './CostAccountingAppsResultPanels';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;
type FormatDecimalFn = (value: Decimal) => string;

export function CostAccountingAppsNoCompany({ t }: { t: TranslateFn }) {
  return (
    <div className="rounded-lg border border-noorix-border bg-[var(--noorix-surface-1)] p-8 text-center text-noorix-muted">
      {t('pleaseSelectCompany')}
    </div>
  );
}

export function CostAccountingAppsPageHeader({
  t,
  companyName,
}: {
  t: TranslateFn;
  companyName: string;
}) {
  return (
    <header className="noorix-print-hidden overflow-hidden rounded-2xl border border-noorix-border bg-gradient-to-br from-noorix-blue/[0.07] via-[var(--noorix-surface-1)] to-[var(--noorix-surface-1)] p-4 shadow-sm sm:p-5 print:hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-xl font-bold tracking-tight text-noorix-text sm:text-2xl">{t('reportCostAppsTitle')}</h1>
            <span className="rounded-full border border-noorix-border bg-[var(--noorix-surface-2)] px-2.5 py-0.5 text-[11px] font-semibold text-noorix-muted">
              {t('reportCostAppsNav')}
            </span>
          </div>
        </div>
        {companyName ? (
          <div className="shrink-0 rounded-xl border border-noorix-border bg-[var(--noorix-surface-2)] px-4 py-3 text-center sm:text-end">
            <p className="m-0 text-[12px] font-semibold uppercase tracking-wider text-noorix-muted">{t('reportCostAppsCompanyLabel')}</p>
            <p className="m-0 mt-1 max-w-[200px] truncate text-sm font-bold text-noorix-text sm:max-w-[240px]" title={companyName}>
              {companyName}
            </p>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function CostAccountingAppsColumnHeading({
  label,
  tone,
}: {
  label: string;
  tone: 'blue' | 'green';
}) {
  const barClass = tone === 'blue' ? 'bg-noorix-blue/80' : 'bg-noorix-green/90';
  return (
    <div className="noorix-print-hidden flex items-center gap-2 border-b border-noorix-border pb-2 print:hidden">
      <span className={`h-1 w-8 shrink-0 rounded-full ${barClass}`} aria-hidden />
      <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-noorix-muted">{label}</span>
    </div>
  );
}

export function CostAccountingAppsResultsColumn({
  t,
  fmt2,
  withAppsScenarioLabel,
  appSalesRowLabel,
  plWith,
  plWithout,
  onPrint,
  onExportExcel,
  onClearDraft,
}: {
  t: TranslateFn;
  fmt2: FormatDecimalFn;
  withAppsScenarioLabel: string;
  appSalesRowLabel: string;
  plWith: CostAppsPlResult;
  plWithout: CostAppsPlResult;
  onPrint: () => void;
  onExportExcel: () => void;
  onClearDraft: () => void;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-4 lg:col-span-7 lg:sticky lg:top-4 lg:z-[1] lg:self-start print:order-2">
      <CostAccountingAppsColumnHeading label={t('reportCostAppsColumnResults')} tone="green" />
      <CostAppsKpiCards t={t} fmt2={fmt2} plWith={plWith} plWithout={plWithout} />
      <CostAppsPlSummaryTable
        t={t}
        fmt2={fmt2}
        withAppsScenarioLabel={withAppsScenarioLabel}
        appSalesRowLabel={appSalesRowLabel}
        plWith={plWith}
        plWithout={plWithout}
      />
      <CostAppsActionsBar t={t} onPrint={onPrint} onExportExcel={onExportExcel} onClearDraft={onClearDraft} />
    </div>
  );
}

export function CostAccountingAppsPrintStyles() {
  return (
    <style>{`
        @media print {
          .noorix-print-hidden { display: none !important; }
          .cost-apps-calc { break-inside: avoid; }
        }
      `}</style>
  );
}
