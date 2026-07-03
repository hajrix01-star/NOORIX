import React, { type ReactNode } from 'react';
import { formatSaudiDate } from '../../../../../utils/saudiDate';

export function EmployeeDocDocumentFrame({
  companyName,
  companyLogo,
  arabicTitle,
  englishTitle,
  children,
  compact = false,
}: {
  companyName?: string;
  companyLogo?: string;
  arabicTitle: string;
  englishTitle: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`doc hr-doc-frame${compact ? ' hr-doc-frame-compact' : ''}`}>
      <div className="hr-doc-frame-header">
        {companyLogo ? (
          <div className="hr-doc-logo-wrap">
            <img src={companyLogo} alt="company-logo" className="hr-doc-logo" />
          </div>
        ) : null}
        <div className="hr-doc-company-name">{companyName || 'الشركة'}</div>
        <div className="hr-doc-company-en">
          {companyName || 'Company'}
        </div>
        <div className="hr-doc-title-ar">{arabicTitle}</div>
        <div className="hr-doc-title-en">{englishTitle}</div>
        <div className="hr-doc-frame-date">
          التاريخ / Date: {formatSaudiDate(new Date())}
        </div>
      </div>
      {children}
    </div>
  );
}
