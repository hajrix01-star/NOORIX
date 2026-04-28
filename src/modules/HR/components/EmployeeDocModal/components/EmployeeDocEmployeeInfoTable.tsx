import React from 'react';
import { formatSaudiDate } from '../../../../../utils/saudiDate';
import { displayJobTitleEn } from '../utils/employeeDocFormatters';
import { DOC_GRID, DOC_SEP, DOC_TABLE_BASE, DOC_TH, DOC_TD } from '../constants';

export function EmployeeDocEmployeeInfoTable({
  employee,
  workHoursValue = '',
  contractEnd = '',
}: {
  employee: Record<string, unknown>;
  workHoursValue?: string;
  contractEnd?: string;
}) {
  const wh = workHoursValue || String(employee?.workHours || '') || '8';
  const baseRows = [
    {
      arLabel: 'اسم الموظف',
      enLabel: 'Employee Name',
      arVal: String(employee?.name || employee?.nameAr || '—'),
      enVal: String(employee?.nameEn || '—'),
    },
    {
      arLabel: 'المسمى الوظيفي',
      enLabel: 'Job Title',
      arVal: String(employee?.jobTitle || '—'),
      enVal: displayJobTitleEn(employee),
    },
    {
      arLabel: 'رقم الإقامة',
      enLabel: 'Iqama Number',
      arVal: String(employee?.iqamaNumber || '—'),
      enVal: String(employee?.iqamaNumber || '—'),
    },
    {
      arLabel: 'تاريخ التعيين',
      enLabel: 'Join Date',
      arVal: formatSaudiDate(employee?.joinDate) || '—',
      enVal: formatSaudiDate(employee?.joinDate) || '—',
    },
    {
      arLabel: 'ساعات العمل',
      enLabel: 'Working Hours',
      arVal: wh,
      enVal: wh,
    },
  ];
  const infoRows = contractEnd
    ? [
        ...baseRows,
        {
          arLabel: 'تاريخ انتهاء العقد',
          enLabel: 'Contract End Date',
          arVal: formatSaudiDate(contractEnd) || contractEnd,
          enVal: formatSaudiDate(contractEnd) || contractEnd,
        },
      ]
    : baseRows;
  return (
    <div className="bilingual" style={DOC_GRID}>
      <table style={{ ...DOC_TABLE_BASE, direction: 'ltr' }}>
        <thead>
          <tr>
            <th style={{ ...DOC_TH, width: '38%' }}>Item</th>
            <th style={{ ...DOC_TH, width: '62%' }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {infoRows.map((row) => (
            <tr key={row.enLabel}>
              <td style={{ ...DOC_TD, textAlign: 'left', direction: 'ltr' }}>{row.enLabel}</td>
              <td style={{ ...DOC_TD, textAlign: 'left', direction: 'ltr' }}>{row.enVal}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="hr-bilingual-sep" style={DOC_SEP} aria-hidden />
      <table style={{ ...DOC_TABLE_BASE, direction: 'rtl' }}>
        <thead>
          <tr>
            <th style={{ ...DOC_TH, width: '38%' }}>العنصر</th>
            <th style={{ ...DOC_TH, width: '62%' }}>البيان</th>
          </tr>
        </thead>
        <tbody>
          {infoRows.map((row) => (
            <tr key={row.arLabel}>
              <td style={{ ...DOC_TD, textAlign: 'right' }}>{row.arLabel}</td>
              <td style={{ ...DOC_TD, textAlign: 'right' }}>{row.arVal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
