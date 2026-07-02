import React from 'react';
import { formatSaudiDate } from '../../../../../utils/saudiDate';
import { displayJobTitleEn } from '../utils/employeeDocFormatters';

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
    <div className="bilingual">
      <table className="hr-doc-table" dir="ltr">
        <thead>
          <tr>
            <th className="hr-doc-th w-[38%]">Item</th>
            <th className="hr-doc-th w-[62%]">Value</th>
          </tr>
        </thead>
        <tbody>
          {infoRows.map((row) => (
            <tr key={row.enLabel}>
              <td className="hr-doc-td text-left" dir="ltr">{row.enLabel}</td>
              <td className="hr-doc-td text-left" dir="ltr">{row.enVal}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="hr-bilingual-sep" aria-hidden />
      <table className="hr-doc-table" dir="rtl">
        <thead>
          <tr>
            <th className="hr-doc-th w-[38%]">العنصر</th>
            <th className="hr-doc-th w-[62%]">البيان</th>
          </tr>
        </thead>
        <tbody>
          {infoRows.map((row) => (
            <tr key={row.arLabel}>
              <td className="hr-doc-td text-right">{row.arLabel}</td>
              <td className="hr-doc-td text-right">{row.arVal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
