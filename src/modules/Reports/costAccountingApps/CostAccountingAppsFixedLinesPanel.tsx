import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type Decimal from 'decimal.js';
import { Button, Input } from '../../../ui';
import Card from '../../../ui/Card';
import { newLine, parseMoneyInput, type FixedLine } from './costAccountingAppsScreenUtils';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;
type FormatDecimalFn = (value: Decimal) => string;

export function CostAccountingAppsFixedLinesPanel({
  t,
  fixedLines,
  setFixedLines,
  importingExpenses,
  onImportExpenses,
  salaryStr,
  setSalaryStr,
  expensesMonthlyTotal,
  expensesAnnualTotal,
  fmt2,
}: {
  t: TranslateFn;
  fixedLines: FixedLine[];
  setFixedLines: Dispatch<SetStateAction<FixedLine[]>>;
  importingExpenses: boolean;
  onImportExpenses: () => void;
  salaryStr: string;
  setSalaryStr: (value: string) => void;
  expensesMonthlyTotal: Decimal;
  expensesAnnualTotal: Decimal;
  fmt2: FormatDecimalFn;
}) {
  const inputValue = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => setter(event.target.value);

  return (
    <Card
      variant="surface"
      padding="none"
      className="overflow-hidden border border-noorix-border shadow-sm print:break-inside-avoid print:shadow-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-noorix-border bg-[var(--noorix-surface-2)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="m-0 text-[15px] font-bold print:text-xs">{t('reportCostAppsFixedLines')}</h2>
        </div>
        <div className="noorix-print-hidden flex flex-wrap gap-2 print:hidden">
          <Button type="button" variant="secondary" size="sm" disabled={importingExpenses} onClick={onImportExpenses}>
            {importingExpenses ? t('loading') : t('reportCostAppsExpensesImportBtn')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setFixedLines((prev) => [...prev, newLine()])}>
            {t('reportCostAppsAddLine')}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto p-2 sm:p-0 print:p-0">
        <table className="w-full border-collapse border border-noorix-border text-sm print:text-[11px]">
          <thead>
            <tr className="bg-[var(--noorix-table-header-bg)]">
              <th className="border border-noorix-border px-2 py-2.5 text-center text-xs font-bold leading-tight print:px-1 print:py-1">
                {t('reportCostAppsLineLabel')}
              </th>
              <th className="w-[120px] border border-noorix-border px-2 py-2.5 text-center text-xs font-bold leading-tight print:px-1 print:py-1">
                {t('reportCostAppsLineMonthlyAmount')}
              </th>
              <th className="w-[120px] border border-noorix-border px-2 py-2.5 text-center text-xs font-bold leading-tight print:px-1 print:py-1">
                {t('reportCostAppsLineAnnualAmount')}
              </th>
              <th className="noorix-print-hidden w-16 border border-noorix-border px-2 py-2 print:hidden" />
            </tr>
          </thead>
          <tbody>
            <tr className="bg-[var(--noorix-surface-1)]/60">
              <td className="border border-noorix-border px-2 py-2 text-center text-[13px] font-medium text-noorix-text">
                {t('reportCostAppsPayrollLineLabel')}
              </td>
              <td className="border border-noorix-border p-1">
                <Input
                  value={salaryStr}
                  onChange={inputValue(setSalaryStr)}
                  dir="ltr"
                  className="border-0 text-center tabular-nums"
                  inputMode="decimal"
                  placeholder="0"
                />
              </td>
              <td className="border border-noorix-border px-2 py-2 text-center tabular-nums text-noorix-text" dir="ltr">
                {fmt2(parseMoneyInput(salaryStr).mul(12))}
              </td>
              <td className="noorix-print-hidden border border-noorix-border px-2 py-2 print:hidden" aria-hidden />
            </tr>
            {fixedLines.map((line) => {
              const monthlyDec = parseMoneyInput(line.amount);
              const annualDec = monthlyDec.mul(12);
              return (
                <tr key={line.id}>
                  <td className="border border-noorix-border p-1">
                    <Input
                      value={line.label}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setFixedLines((rows) => rows.map((row) => (row.id === line.id ? { ...row, label: event.target.value } : row)))
                      }
                      className="border-0 text-center"
                    />
                  </td>
                  <td className="border border-noorix-border p-1">
                    <Input
                      value={line.amount}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setFixedLines((rows) => rows.map((row) => (row.id === line.id ? { ...row, amount: event.target.value } : row)))
                      }
                      dir="ltr"
                      className="border-0 text-center tabular-nums"
                      inputMode="decimal"
                    />
                  </td>
                  <td className="border border-noorix-border px-2 py-2 text-center tabular-nums text-noorix-text" dir="ltr">
                    {fmt2(annualDec)}
                  </td>
                  <td className="noorix-print-hidden border border-noorix-border p-1 print:hidden">
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-0 px-2 py-1 text-xs"
                      onClick={() => setFixedLines((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== line.id)))}
                    >
                      x
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="border border-noorix-border px-2 py-2 text-center font-bold">{t('reportTotalAmount')}</td>
              <td className="border border-noorix-border px-2 py-2 text-center font-bold tabular-nums" dir="ltr">
                {fmt2(expensesMonthlyTotal)}
              </td>
              <td className="border border-noorix-border px-2 py-2 text-center font-bold tabular-nums" dir="ltr">
                {fmt2(expensesAnnualTotal)}
              </td>
              <td className="noorix-print-hidden print:hidden" />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
