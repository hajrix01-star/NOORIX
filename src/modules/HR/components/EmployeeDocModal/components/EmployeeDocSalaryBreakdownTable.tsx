import React from 'react';
import { hrFmt } from '../../../utils/hrFmt';
import type { DocSalaryRow } from '../types';
import { DOC_GRID, DOC_SEP, DOC_TABLE_BASE, DOC_TH, DOC_TD } from '../constants';

export function EmployeeDocSalaryBreakdownTable({ rows, total }: { rows: DocSalaryRow[]; total: number }) {
  return (
    <div className="bilingual" style={DOC_GRID}>
      <table style={{ ...DOC_TABLE_BASE, direction: 'ltr' }}>
        <thead>
          <tr>
            <th style={{ ...DOC_TH, width: '58%' }}>Component</th>
            <th style={{ ...DOC_TH, width: '42%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`en-${row.en}-${idx}`}>
              <td style={{ ...DOC_TD, textAlign: 'left' }}>{row.en}</td>
              <td style={{ ...DOC_TD, textAlign: 'right', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>
                {hrFmt(row.amount)}
              </td>
            </tr>
          ))}
          <tr>
            <td style={{ ...DOC_TD, textAlign: 'left', fontWeight: 800 }}>Total Compensation</td>
            <td style={{ ...DOC_TD, textAlign: 'right', direction: 'ltr', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              {hrFmt(total)}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="hr-bilingual-sep" style={DOC_SEP} aria-hidden />
      <table style={{ ...DOC_TABLE_BASE, direction: 'rtl' }}>
        <thead>
          <tr>
            <th style={{ ...DOC_TH, width: '58%' }}>المكون</th>
            <th style={{ ...DOC_TH, width: '42%' }}>المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`ar-${row.ar}-${idx}`}>
              <td style={{ ...DOC_TD, textAlign: 'right' }}>{row.ar}</td>
              <td style={{ ...DOC_TD, textAlign: 'center', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>
                {hrFmt(row.amount)}
              </td>
            </tr>
          ))}
          <tr>
            <td style={{ ...DOC_TD, textAlign: 'right', fontWeight: 800 }}>إجمالي الراتب</td>
            <td style={{ ...DOC_TD, textAlign: 'center', direction: 'ltr', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              {hrFmt(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
