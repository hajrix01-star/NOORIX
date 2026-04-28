import React from 'react';
import { formatSaudiDate } from '../../../../../utils/saudiDate';
import { displayJobTitleEn } from '../utils/employeeDocFormatters';
import type { DocSalaryRow } from '../types';
import { DOC_GRID, DOC_SEP, DOC_BOX, DOC_H3 } from '../constants';
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
      <div className="section" style={{ padding: '10px 14px', borderBottom: '1px solid var(--noorix-border)' }}>
        <div className="bilingual" style={DOC_GRID}>
          <div style={{ ...DOC_BOX, direction: 'ltr', textAlign: 'left' }}>
            <h3 style={DOC_H3}>Certification</h3>
            <p style={{ lineHeight: 1.5, margin: 0, fontSize: 11 }}>
              This is to certify that <strong>{String(employee?.nameEn || employee?.name || employee?.nameAr || '—')}</strong> is employed by the company as
              <strong> {displayJobTitleEn(employee)}</strong> since <strong>{formatSaudiDate(employee?.joinDate)}</strong> and remains employed as of the issue date of this certificate.
            </p>
          </div>
          <div className="hr-bilingual-sep" style={DOC_SEP} aria-hidden />
          <div style={{ ...DOC_BOX, direction: 'rtl', textAlign: 'right' }}>
            <h3 style={DOC_H3}>إفادة</h3>
            <p style={{ lineHeight: 1.5, margin: 0, fontSize: 11 }}>
              تشهد الشركة بأن الموظف/ة <strong>{String(employee?.name || employee?.nameAr || '—')}</strong> يعمل/تعمل لدينا بوظيفة
              <strong> {String(employee?.jobTitle || '—')}</strong> منذ تاريخ <strong>{formatSaudiDate(employee?.joinDate)}</strong>
              ، وما زال/تزال على رأس العمل حتى تاريخ إصدار هذه الشهادة.
            </p>
          </div>
        </div>
      </div>
      <div className="section" style={{ padding: '18px 22px', borderBottom: '1px solid var(--noorix-border)' }}>
        <EmployeeDocEmployeeInfoTable employee={employee} />
      </div>
      <div className="section" style={{ padding: '18px 22px', borderBottom: '1px solid var(--noorix-border)' }}>
        <EmployeeDocSalaryBreakdownTable rows={rows} total={total} />
      </div>
      <div className="footer" style={{ padding: '18px 22px' }}>
        <div style={{ color: '#64748b', fontSize: 12 }}>تاريخ الإصدار / Issue Date: {formatSaudiDate(new Date())}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginTop: 22 }}>
          <div style={{ paddingTop: 32, borderTop: '1px solid #cbd5e1' }}>اعتماد الشركة / Company Authorization</div>
          <div style={{ paddingTop: 32, borderTop: '1px solid #cbd5e1' }}>الختم / Stamp</div>
        </div>
      </div>
    </>
  );
}
