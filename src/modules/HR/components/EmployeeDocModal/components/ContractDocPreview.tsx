import React from 'react';
import { formatSaudiDate } from '../../../../../utils/saudiDate';
import type { DocSalaryRow } from '../types';
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
      <div className="hr-doc-section">
        <EmployeeDocEmployeeInfoTable
          employee={employee}
          workHoursValue={String(employee?.workHours || 8)}
          contractEnd={contractEnd}
        />
      </div>
      <div className="hr-doc-section">
        <EmployeeDocSalaryBreakdownTable rows={rows} total={total} />
      </div>
      <div className="hr-doc-section-compact">
        <div className="bilingual">
          <div className="hr-doc-box text-left" dir="ltr">
            <h3 className="hr-doc-h3">Key Terms</h3>
            <ol className="hr-doc-terms">
              <li>The employee is appointed as {displayJobTitleEn(employee)}.</li>
              <li>The work location shall be as assigned by the company according to operational needs.</li>
              <li>Regular working hours are 8 hours per day. Any hours above that are treated as overtime, subject to employee approval and Saudi Labor Law.</li>
              <li>The employee shall receive the fixed compensation listed in the salary breakdown attached to this contract.</li>
              <li>This contract is governed by the applicable labor laws of the Kingdom of Saudi Arabia.</li>
            </ol>
          </div>
          <div className="hr-bilingual-sep" aria-hidden />
          <div className="hr-doc-box text-right" dir="rtl">
            <h3 className="hr-doc-h3">بنود أساسية</h3>
            <ol className="hr-doc-terms">
              <li>تم تعيين الموظف في وظيفة {String(employee?.jobTitle || '—')}.</li>
              <li>يكون مكان العمل حسب متطلبات الشركة وتعليماتها التنظيمية.</li>
              <li>ساعات العمل الأساسية 8 ساعات يومياً، وأي ساعات إضافية فوق ذلك تعد أوفر تايم وتحسب وفق نظام العمل السعودي وبعد موافقة الموظف.</li>
              <li>يتقاضى الموظف التعويضات الثابتة الموضحة في كشف الراتب الملحق بهذا العقد.</li>
              <li>تطبق على هذا العقد أنظمة العمل المعمول بها في المملكة العربية السعودية.</li>
            </ol>
          </div>
        </div>
      </div>
      <div className="hr-doc-footer">
        <div className="hr-doc-date">تاريخ الإصدار / Issue Date: {formatSaudiDate(new Date())}</div>
        <div className="hr-doc-signatures-3">
          <div className="hr-doc-signature">صاحب العمل / Employer</div>
          <div className="hr-doc-signature">الموظف / Employee</div>
          <div className="hr-doc-signature">الختم / Company Stamp</div>
        </div>
      </div>
    </>
  );
}
