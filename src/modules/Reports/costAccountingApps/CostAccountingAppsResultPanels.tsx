import { Button } from '../../../ui';
import Card from '../../../ui/Card';
import type { CostAppsPlResult } from '../costAccountingAppsModel';
import type Decimal from 'decimal.js';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;
type FormatDecimalFn = (value: Decimal) => string;

export function CostAppsKpiCards({
  t,
  fmt2,
  plWith,
  plWithout,
}: {
  t: TranslateFn;
  fmt2: FormatDecimalFn;
  plWith: CostAppsPlResult;
  plWithout: CostAppsPlResult;
}) {
  return (
    <div className="noorix-print-hidden grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3 print:hidden">
      <Card
        variant="stat"
        color="blue"
        label={<span className="text-[11px] font-bold leading-tight text-noorix-text">{t('reportCostAppsGrossTotal')}</span>}
        value={<span dir="ltr" className="tabular-nums">{fmt2(plWith.grossTotal)}</span>}
      />
      <Card
        variant="stat"
        color="green"
        label={<span className="text-[11px] font-bold leading-tight text-noorix-text">{t('reportCostAppsKpiNetWithApps')}</span>}
        value={<span dir="ltr" className="tabular-nums">{fmt2(plWith.netProfit)}</span>}
      />
      <Card
        variant="stat"
        color="gray"
        label={<span className="text-[11px] font-bold leading-tight text-noorix-text">{t('reportCostAppsKpiNetNoApps')}</span>}
        value={<span dir="ltr" className="tabular-nums">{fmt2(plWithout.netProfit)}</span>}
      />
    </div>
  );
}

export function CostAppsPlSummaryTable({
  t,
  fmt2,
  withAppsScenarioLabel,
  appSalesRowLabel,
  plWith,
  plWithout,
}: {
  t: TranslateFn;
  fmt2: FormatDecimalFn;
  withAppsScenarioLabel: string;
  appSalesRowLabel: string;
  plWith: CostAppsPlResult;
  plWithout: CostAppsPlResult;
}) {
  const rows = [
    [appSalesRowLabel, plWith.grossApp, plWithout.grossApp],
    [t('reportCostAppsPlLocalSales'), plWith.grossLocal, plWithout.grossLocal],
    [t('reportCostAppsGrossTotal'), plWith.grossTotal, plWithout.grossTotal],
    [t('reportCostAppsNetSales'), plWith.netSales, plWithout.netSales],
    [t('reportCostAppsVatExtracted'), plWith.vatAmount, plWithout.vatAmount],
    [t('reportCostAppsCommission'), plWith.commission, plWithout.commission],
    [t('reportCostAppsCogsLocal'), plWith.cogsLocal, plWithout.cogsLocal],
    [t('reportCostAppsCogsApp'), plWith.cogsApp, plWithout.cogsApp],
    [t('reportCostAppsCogsTotal'), plWith.cogsTotal, plWithout.cogsTotal],
    [t('reportCostAppsExpensesTotalRow'), plWith.fixedTotal.plus(plWith.salaryTotal), plWithout.fixedTotal.plus(plWithout.salaryTotal)],
    [t('reportCostAppsNetProfit'), plWith.netProfit, plWithout.netProfit, true],
  ] as const;

  return (
    <Card variant="surface" padding="none" className="overflow-hidden border border-noorix-border shadow-sm print:break-inside-avoid print:shadow-none">
      <div className="border-s-4 border-s-noorix-blue border-b border-noorix-border bg-[var(--noorix-surface-2)] px-4 py-3">
        <h2 className="m-0 text-[15px] font-bold text-noorix-text print:text-xs">{t('reportCostAppsPlSummaryTitle')}</h2>
      </div>
      <div className="overflow-x-auto p-2 sm:p-0 print:p-0">
        <table className="w-full border-collapse border border-noorix-border text-sm print:text-[11px]">
          <thead>
            <tr className="bg-[var(--noorix-table-header-bg)]">
              <th className="border border-noorix-border px-2 py-2.5 text-center text-xs font-bold leading-tight">{t('reportItem')}</th>
              <th className="border border-noorix-border px-2 py-2.5 text-center text-xs font-bold leading-tight">{withAppsScenarioLabel}</th>
              <th className="border border-noorix-border px-2 py-2.5 text-center text-xs font-bold leading-tight">{t('reportCostAppsScenarioNoApps')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, withApps, noApps, strong]) => (
              <tr key={String(label)}>
                <td className={`border border-noorix-border px-2 py-2 text-center ${strong ? 'font-bold' : ''}`}>{label}</td>
                <td className={`border border-noorix-border px-2 py-2 text-center ${strong ? 'font-bold text-noorix-blue' : ''}`} dir="ltr">
                  {fmt2(withApps)}
                </td>
                <td className={`border border-noorix-border px-2 py-2 text-center ${strong ? 'font-bold' : ''}`} dir="ltr">
                  {fmt2(noApps)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function CostAppsActionsBar({
  t,
  onPrint,
  onExportExcel,
  onClearDraft,
}: {
  t: TranslateFn;
  onPrint: () => void;
  onExportExcel: () => void;
  onClearDraft: () => void;
}) {
  return (
    <div className="noorix-print-hidden rounded-xl border border-noorix-border bg-[var(--noorix-surface-2)] p-4 print:hidden">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={onPrint}>
          {t('reportCostAppsPrint')}
        </Button>
        <Button type="button" variant="secondary" onClick={onExportExcel}>
          {t('reportCostAppsExportExcel')}
        </Button>
        <Button type="button" variant="ghost" onClick={onClearDraft}>
          {t('reportCostAppsResetDraft')}
        </Button>
      </div>
    </div>
  );
}
