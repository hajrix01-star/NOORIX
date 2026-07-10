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
  toggleDefer: (employeeId: string) => void;
  selectInput: (e: React.FocusEvent<HTMLInputElement>) => void;
};

export function PayrollRunRowsTable({
  displayEmployees,
  items,
  lang,
  t,
  updateItem,
  toggleInclude,
  toggleDefer,
  selectInput,
}: Props) {
  return (
    <div className="prfm-modal-scroll min-w-0">
      <table className="payroll-run-table">
        <thead>
          <tr>
            <th className="w-[26%] min-w-0 text-start">{t('employeeName')}</th>
            <th className="w-[12%] min-w-0 text-center">{t('payrollAdvanceDates')}</th>
            <th className="w-[11%] min-w-0 text-center">{t('grossSalary')}</th>
            <th className="w-[10%] min-w-0 text-center">{t('payrollAllowances')}</th>
            <th className="w-[10%] min-w-0 text-center">{t('payrollDeductions')}</th>
            <th className="w-[10%] min-w-0 text-center">{t('payrollAdvances')}</th>
            <th className="w-[11%] min-w-0 text-center">{t('payrollDeferAdvanceDeduct')}</th>
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
                    <td
                      className="text-noorix-muted text-[11px] min-w-0 nx-line-145 align-top text-center"
                      title={items[idx].advanceDates || ''}
                    >
                      <span className="line-clamp-2 break-words inline-block max-w-full text-center">
                        {items[idx].advanceDates || '—'}
                      </span>
                    </td>
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
                    <td className="text-center">
                      <EditableNumberCell
                        step={1}
                        className="max-w-[4.5rem] mx-auto tabular-nums text-center !py-1 !px-2"
                        value={items[idx].advancesDeduct ?? 0}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateItem(idx, 'advancesDeduct', e.target.value)
                        }
                        disabled={items[idx].deferAdvances}
                        selectOnFocus
                        onFocus={selectInput}
                        aria-label={t('payrollAdvances')}
                      />
                    </td>
                    <td className="text-center px-1">
                      <label className="nx-checkbox nx-checkbox--cell-center inline-flex justify-center">
                        <Checkbox
                          checked={!!items[idx].deferAdvances}
                          onChange={() => toggleDefer(emp.id as string)}
                          aria-label={t('payrollDeferAdvanceDeduct')}
                        />
                      </label>
                    </td>
                    <td className="font-extrabold text-[12px] whitespace-nowrap text-center">
                      <FmtNum n={items[idx].netSalary} className="payroll-run-cell-num nx-font-numbers" />
                    </td>
                  </>
                ) : (
                  <td colSpan={7} className="text-noorix-muted text-[13px] text-center">
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
