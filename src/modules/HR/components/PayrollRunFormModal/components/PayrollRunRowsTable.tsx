import React from 'react';
import { employeeDisplayName } from '../../../../../utils/employeeDisplayName';
import { Checkbox, EditableNumberCell, cn, FmtNum } from '../../../../../ui';
import type { PayrollRunLineItem } from '../types';

type Emp = { id?: string; name?: string; nameAr?: string };

type Props = {
  displayEmployees: Emp[];
  items: PayrollRunLineItem[];
  lang: string;
  t: (key: string, ...subst: string[]) => string;
  updateItem: (idx: number, field: keyof PayrollRunLineItem, value: string) => void;
  toggleInclude: (emp: Record<string, unknown> & { id?: string }) => void;
  toggleAdvance: (employeeId: string, advanceId: string) => void;
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
                        <div className="grid gap-1.5">
                          {items[idx].advanceChoices.map((advance) => (
                            <label
                              key={advance.advanceId}
                              className={cn(
                                'flex items-center gap-2 rounded-lg border px-2 py-1.5 cursor-pointer',
                                advance.selected
                                  ? 'border-noorix-green/30 bg-noorix-green/5'
                                  : 'border-noorix-border bg-noorix-bg-muted text-noorix-muted',
                              )}
                            >
                              <Checkbox
                                checked={advance.selected}
                                onChange={() => toggleAdvance(emp.id as string, advance.advanceId)}
                                aria-label={`${t('payrollAdvances')} ${advance.invoiceNumber}`}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[11px] font-bold" dir="ltr">
                                  {advance.invoiceNumber} · {advance.dateLabel}
                                </span>
                                <span className="block text-[10px] text-noorix-muted">
                                  {t('payrollAdvanceDue')}: <FmtNum n={advance.amount} /> · {t('payrollAdvanceRemaining')}:{' '}
                                  <FmtNum n={advance.remaining} />
                                </span>
                              </span>
                              {!advance.selected ? (
                                <span className="shrink-0 rounded-full bg-noorix-amber/15 px-2 py-0.5 text-[10px] font-bold text-noorix-amber">
                                  {t('payrollAdvanceDeferred')}
                                </span>
                              ) : null}
                            </label>
                          ))}
                          <div className="text-center text-[11px] font-extrabold">
                            {t('payrollAdvances')}: <FmtNum n={items[idx].advancesDeduct ?? 0} />
                          </div>
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
