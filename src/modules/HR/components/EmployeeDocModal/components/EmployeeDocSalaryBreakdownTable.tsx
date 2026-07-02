import React from 'react';
import { hrFmt } from '../../../utils/hrFmt';
import type { DocSalaryRow } from '../types';

export function EmployeeDocSalaryBreakdownTable({ rows, total }: { rows: DocSalaryRow[]; total: number }) {
  return (
    <div className="bilingual">
      <table className="hr-doc-table" dir="ltr">
        <thead>
          <tr>
            <th className="hr-doc-th w-[58%]">Component</th>
            <th className="hr-doc-th w-[42%]">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`en-${row.en}-${idx}`}>
              <td className="hr-doc-td text-left">{row.en}</td>
              <td className="hr-doc-td text-right tabular-nums" dir="ltr">
                {hrFmt(row.amount)}
              </td>
            </tr>
          ))}
          <tr>
            <td className="hr-doc-td text-left font-extrabold">Total Compensation</td>
            <td className="hr-doc-td text-right font-extrabold tabular-nums" dir="ltr">
              {hrFmt(total)}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="hr-bilingual-sep" aria-hidden />
      <table className="hr-doc-table" dir="rtl">
        <thead>
          <tr>
            <th className="hr-doc-th w-[58%]">المكون</th>
            <th className="hr-doc-th w-[42%]">المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`ar-${row.ar}-${idx}`}>
              <td className="hr-doc-td text-right">{row.ar}</td>
              <td className="hr-doc-td text-center tabular-nums" dir="ltr">
                {hrFmt(row.amount)}
              </td>
            </tr>
          ))}
          <tr>
            <td className="hr-doc-td text-right font-extrabold">إجمالي الراتب</td>
            <td className="hr-doc-td text-center font-extrabold tabular-nums" dir="ltr">
              {hrFmt(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
