import React from 'react';
import { formatSaudiDate } from '../../../../../utils/saudiDate';
import { displayJobTitleEn } from '../utils/employeeDocFormatters';
import type { DocSalaryRow } from '../types';
import { EmployeeDocEmployeeInfoTable } from './EmployeeDocEmployeeInfoTable';
import { EmployeeDocSalaryBreakdownTable } from './EmployeeDocSalaryBreakdownTable';

export function SalaryCertificatePreview({
  employee,
  rows,
  total,
}: {
  employee: Record<string, unknown>;
  rows: DocSalaryRow[];
  total: number;
}) {
  return (
    <>
      <div className="section hr-doc-section-compact">
        <div className="bilingual">
          <div className="hr-doc-box text-left" dir="ltr">
            <h3 className="hr-doc-h3">Certification</h3>
            <p className="hr-doc-copy">
              This is to certify that <strong>{String(employee?.nameEn || employee?.name || employee?.nameAr || '—')}</strong> is employed by the company as
              <strong> {displayJobTitleEn(employee)}</strong> since <strong>{formatSaudiDate(employee?.joinDate)}</strong> and remains employed as of the issue date of this certificate.
            </p>
          </div>
          <div className="hr-bilingual-sep" aria-hidden />
          <div className="hr-doc-box text-right" dir="rtl">
            <h3 className="hr-doc-h3">إفادة</h3>
            <p className="hr-doc-copy">
              تشهد الشركة بأن الموظف/ة <strong>{String(employee?.name || employee?.nameAr || '—')}</strong> يعمل/تعمل لدينا بوظيفة
              <strong> {String(employee?.jobTitle || '—')}</strong> منذ تاريخ <strong>{formatSaudiDate(employee?.joinDate)}</strong>
              ، وما زال/تزال على رأس العمل حتى تاريخ إصدار هذه الشهادة.
            </p>
          </div>
        </div>
      </div>
      <div className="section hr-doc-section">
        <EmployeeDocEmployeeInfoTable employee={employee} />
      </div>
      <div className="section hr-doc-section">
        <EmployeeDocSalaryBreakdownTable rows={rows} total={total} />
      </div>
      <div className="footer hr-doc-footer">
        <div className="hr-doc-date">تاريخ الإصدار / Issue Date: {formatSaudiDate(new Date())}</div>
        <div className="hr-doc-signatures-2">
          <div className="hr-doc-signature">اعتماد الشركة / Company Authorization</div>
          <div className="hr-doc-signature">الختم / Stamp</div>
        </div>
      </div>
    </>
  );
}
