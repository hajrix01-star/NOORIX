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
  const pad = compact ? '10px 14px' : '18px 22px';
  const logoH = compact ? 40 : 56;
  const nameFs = compact ? 15 : 20;
  const titleFs = compact ? 14 : 20;
  const subFs = compact ? 11 : 12;
  return (
    <div
      className="doc"
      style={{
        border: '1px solid var(--noorix-border)',
        borderRadius: compact ? 10 : 14,
        overflow: 'hidden',
        background: '#fff',
        maxWidth: compact ? '190mm' : undefined,
        margin: compact ? '0 auto' : undefined,
      }}
    >
      <div style={{ padding: pad, borderBottom: '2px solid #0f172a', background: '#f8fafc' }}>
        {companyLogo ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: compact ? 4 : 8 }}>
            <img src={companyLogo} alt="company-logo" style={{ maxHeight: logoH, objectFit: 'contain' }} />
          </div>
        ) : null}
        <div style={{ textAlign: 'center', fontSize: nameFs, fontWeight: 800 }}>{companyName || 'الشركة'}</div>
        <div style={{ textAlign: 'center', marginTop: compact ? 2 : 6, color: '#475569', fontSize: compact ? 11 : undefined }}>
          {companyName || 'Company'}
        </div>
        <div style={{ textAlign: 'center', marginTop: compact ? 8 : 14, fontWeight: 800, fontSize: titleFs }}>{arabicTitle}</div>
        <div style={{ textAlign: 'center', color: '#475569', marginTop: 2, fontSize: subFs }}>{englishTitle}</div>
        <div style={{ textAlign: 'center', marginTop: 2, color: '#64748b', fontSize: compact ? 10 : 12 }}>
          التاريخ / Date: {formatSaudiDate(new Date())}
        </div>
      </div>
      {children}
    </div>
  );
}
