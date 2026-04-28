import React from 'react';
import { formatSaudiDate } from '../../../../../utils/saudiDate';
import type { DocSalaryRow } from '../types';
import { DOC_GRID, DOC_SEP, DOC_BOX, DOC_H3 } from '../constants';
import { displayJobTitleEn } from '../utils/employeeDocFormatters';
import { EmployeeDocEmployeeInfoTable } from './EmployeeDocEmployeeInfoTable';
import { EmployeeDocSalaryBreakdownTable } from './EmployeeDocSalaryBreakdownTable';

export function ContractDocPreview({
  employee,
  rows,
  total,
  contractEnd,
}: {
  employee: Record<string, unknown>;
  rows: DocSalaryRow[];
  total: number;
  contractEnd: string;
}) {
  return (
    <>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--noorix-border)' }}>
        <EmployeeDocEmployeeInfoTable
          employee={employee}
          workHoursValue={employee?.workHours ? `${employee.workHours} ساعة / ${employee.workHours} hr` : '8 ساعات / 8 hr'}
          contractEnd={contractEnd}
        />
      </div>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--noorix-border)' }}>
        <EmployeeDocSalaryBreakdownTable rows={rows} total={total} />
      </div>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--noorix-border)' }}>
        <div className="bilingual" style={DOC_GRID}>
          <div style={{ ...DOC_BOX, direction: 'ltr', textAlign: 'left' }}>
            <h3 style={DOC_H3}>Key Terms</h3>
            <ol style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.45, fontSize: 10.5 }}>
              <li>The employee is appointed as {displayJobTitleEn(employee)}.</li>
              <li>The work location shall be as assigned by the company according to operational needs.</li>
              <li>Regular working hours are 8 hours per day. Any hours above that are treated as overtime, subject to employee approval and Saudi Labor Law.</li>
              <li>The employee shall receive the fixed compensation listed in the salary breakdown attached to this contract.</li>
              <li>This contract is governed by the applicable labor laws of the Kingdom of Saudi Arabia.</li>
            </ol>
          </div>
          <div className="hr-bilingual-sep" style={DOC_SEP} aria-hidden />
          <div style={{ ...DOC_BOX, direction: 'rtl', textAlign: 'right' }}>
            <h3 style={DOC_H3}>بنود أساسية</h3>
            <ol style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.45, fontSize: 10.5 }}>
              <li>تم تعيين الموظف في وظيفة {String(employee?.jobTitle || '—')}.</li>
              <li>يكون مكان العمل حسب متطلبات الشركة وتعليماتها التنظيمية.</li>
              <li>ساعات العمل الأساسية 8 ساعات يومياً، وأي ساعات إضافية فوق ذلك تعد أوفر تايم وتحسب وفق نظام العمل السعودي وبعد موافقة الموظف.</li>
              <li>يتقاضى الموظف التعويضات الثابتة الموضحة في كشف الراتب الملحق بهذا العقد.</li>
              <li>تطبق على هذا العقد أنظمة العمل المعمول بها في المملكة العربية السعودية.</li>
            </ol>
          </div>
        </div>
      </div>
      <div style={{ padding: '18px 22px' }}>
        <div style={{ color: '#64748b', fontSize: 12 }}>تاريخ الإصدار / Issue Date: {formatSaudiDate(new Date())}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginTop: 22 }}>
          <div style={{ paddingTop: 32, borderTop: '1px solid #cbd5e1' }}>صاحب العمل / Employer</div>
          <div style={{ paddingTop: 32, borderTop: '1px solid #cbd5e1' }}>الموظف / Employee</div>
          <div style={{ paddingTop: 32, borderTop: '1px solid #cbd5e1' }}>الختم / Company Stamp</div>
        </div>
      </div>
    </>
  );
}
