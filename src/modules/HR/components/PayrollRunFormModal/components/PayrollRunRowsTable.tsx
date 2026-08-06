import React from 'react';
import { employeeDisplayName } from '../../../../../utils/employeeDisplayName';
import { Checkbox, EditableNumberCell, cn, FmtNum } from '../../../../../ui';
import type { PayrollRunLineItem } from '../types';

type Emp = { id?: string; name?: string; nameAr?: string };

function compactAdvanceDate(dateLabel: string): string {
  const match = dateLabel.match(/^(\d{1,2})[-/](\d{1,2})[-/]\d{4}$/);
  return match ? `${match[1]}/${match[2]}` : dateLabel;
}

type Props = {
  displayEmployees: Emp[];
  items: PayrollRunLineItem[];
  lang: string;
  t: (key: string, ...subst: string[]) => string;
  updateItem: (idx: number, field: keyof PayrollRunLineItem, value: string) => void;
  toggleInclude: (emp: Record<string, unknown> & { id?: string }) => void;
  toggleAdvance: (employeeId: string, advanceId: string) => void;
  updateAdvanceAmount: (employeeId: string, advanceId: string, value: string) => void;
  selectInput: (e: React.FocusEvent<HTMLInputElement>) => void;
};

export function PayrollRunRowsTable({
  displayEmployees,
  items,
  lang,
  t,
  updateItem,
  toggleInclude,
  toggleAdvance,
  updateAdvanceAmount,
  selectInput,
}: Props) {
  return (
    <div className="prfm-modal-scroll min-w-0">
      <table className="payroll-run-table">
        <thead>
          <tr>
            <th className="w-[20%] min-w-0 text-start">{t('employeeName')}</th>
            <th className="w-[10%] min-w-0 text-center">{t('grossSalary')}</th>
            <th className="w-[10%] min-w-0 text-center">{t('payrollAllowances')}</th>
            <th className="w-[10%] min-w-0 text-center">{t('payrollDeductions')}</th>
            <th className="w-[38%] min-w-[18rem] text-center">{t('payrollAdvances')}</th>
            <th className="w-[12%] min-w-0 text-center">{t('netSalary')}</th>
          </tr>
        </thead>
        <tbody>
          {displayEmployees.map((emp) => {
            const idx = items.findIndex((i) => i.employeeId === emp.id);
            const included = idx >= 0;
            return (
              <tr key={emp.id}>
                <td className="min-w-0 text-start">
                  <label className="nx-checkbox nx-checkbox--tight min-w-0">
                    <Checkbox
                      checked={included}
                      onChange={() => toggleInclude(emp as Record<string, unknown> & { id?: string })}
                      aria-label={t('employeeName')}
                    />
                    <span
                      className={cn('min-w-0 truncate block', included ? 'font-semibold' : 'font-normal')}
                      title={employeeDisplayName(emp, lang)}
                    >
                      {employeeDisplayName(emp, lang)}
                    </span>
                  </label>
                </td>
                {included ? (
                  <>
                    <td className="font-semibold text-[12px] whitespace-nowrap text-center">
                      <FmtNum n={items[idx].grossSalary} className="payroll-run-cell-num nx-font-numbers" />
                    </td>
                    <td className="text-center">
                      <EditableNumberCell
                        step={1}
                        className="max-w-[4.5rem] mx-auto tabular-nums text-center !py-1 !px-2"
                        value={items[idx].allowancesAdd ?? 0}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateItem(idx, 'allowancesAdd', e.target.value)
                        }
                        selectOnFocus
                        onFocus={selectInput}
                        aria-label={t('payrollAllowances')}
                      />
                    </td>
                    <td className="text-center">
                      <EditableNumberCell
                        step={1}
                        className="max-w-[4.5rem] mx-auto tabular-nums text-center !py-1 !px-2"
                        value={items[idx].deductions ?? 0}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateItem(idx, 'deductions', e.target.value)
                        }
                        selectOnFocus
                        onFocus={selectInput}
                        aria-label={t('payrollDeductions')}
                      />
                    </td>
                    <td className="text-start align-top p-2">
                      {items[idx].advanceChoices.length ? (
                        <div className="grid grid-cols-3 gap-1">
                          {items[idx].advanceChoices.map((advance) => (
                            <div
                              key={advance.advanceId}
                              className={cn(
                                'min-w-0 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1 rounded-md border px-1.5 py-1',
                                advance.selected
                                  ? 'border-noorix-green/30 bg-noorix-green/5'
                                  : 'border-noorix-amber/40 bg-noorix-amber/10 text-noorix-muted',
                              )}
                            >
                              <Checkbox
                                checked={advance.selected}
                                onChange={() => toggleAdvance(emp.id as string, advance.advanceId)}
                                aria-label={`${t('payrollAdvances')} ${advance.amount} ${compactAdvanceDate(advance.dateLabel)}`}
                              />
                              <EditableNumberCell
                                value={advance.amount}
                                min="0.01"
                                max={advance.remaining}
                                step="0.01"
                                disabled={!advance.selected}
                                selectOnFocus
                                align="end"
                                className="h-7 !px-1 text-[11px] font-bold"
                                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                                  updateAdvanceAmount(emp.id as string, advance.advanceId, event.target.value)
                                }
                                aria-label={`${t('payrollAdvanceDeductionAmount')} ${compactAdvanceDate(advance.dateLabel)}`}
                              />
                              <span
                                className={cn(
                                  'col-start-2 min-w-0 truncate text-[10px] text-center tabular-nums',
                                  !advance.selected && 'line-through decoration-noorix-amber/70',
                                )}
                                dir="ltr"
                              >
                                {compactAdvanceDate(advance.dateLabel)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-noorix-muted text-[11px]">{t('payrollNoAdvances')}</span>
                      )}
                    </td>
                    <td className="font-extrabold text-[12px] whitespace-nowrap text-center">
                      <FmtNum n={items[idx].netSalary} className="payroll-run-cell-num nx-font-numbers" />
                    </td>
                  </>
                ) : (
                  <td colSpan={5} className="text-noorix-muted text-[13px] text-center">
                    —
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
