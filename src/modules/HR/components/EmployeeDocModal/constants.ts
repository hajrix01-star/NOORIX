import type { CSSProperties } from 'react';

export const DAY_MS = 24 * 60 * 60 * 1000;

export const ALLOWANCE_NAME_EN_MAP: Record<string, string> = {
  'بدل سكن': 'Housing Allowance',
  'السكن': 'Housing Allowance',
  'بدل مواصلات': 'Transport Allowance',
  'المواصلات': 'Transport Allowance',
  'بدل نقل': 'Transport Allowance',
  'بدل اكل': 'Meal Allowance',
  'بدل أكل': 'Meal Allowance',
  'الاكل': 'Meal Allowance',
  'الأكل': 'Meal Allowance',
  'بدل طعام': 'Meal Allowance',
  'بدل اوفر تايم': 'Overtime Allowance',
  'بدل أوفر تايم': 'Overtime Allowance',
  'اوفر تايم': 'Overtime Allowance',
  'أوفر تايم': 'Overtime Allowance',
  'بدل إضافي': 'Additional Allowance',
  'بدل اضافي': 'Additional Allowance',
};

export const DOC_GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 1px minmax(0, 1fr)',
  columnGap: 10,
  direction: 'ltr',
  alignItems: 'stretch',
};

export const DOC_SEP: CSSProperties = {
  background: '#cbd5e1',
  borderRadius: 999,
  width: 1,
  minWidth: 1,
  alignSelf: 'stretch',
};

export const DOC_TABLE_BASE: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 11,
  tableLayout: 'fixed',
};

export const DOC_TH: CSSProperties = {
  background: '#f1f5f9',
  border: '1px solid #dbe1e8',
  padding: '5px 6px',
  fontWeight: 700,
  fontSize: 10,
  textAlign: 'center',
  color: '#334155',
};

export const DOC_TD: CSSProperties = {
  border: '1px solid #e2e8f0',
  padding: '5px 7px',
  fontSize: 11,
  verticalAlign: 'top',
  wordBreak: 'break-word',
};

export const DOC_BOX: CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--noorix-border)',
  borderRadius: 8,
  background: '#fff',
};

export const DOC_H3: CSSProperties = {
  margin: '0 0 6px',
  fontSize: 12,
  fontWeight: 800,
  textAlign: 'center',
  color: '#0f172a',
};

export const SETTLE_SECTION: CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--noorix-border)',
};

export const EMPLOYEE_DOC_EXTRA_CSS = `
  body{font-size:11px;line-height:1.45}
  .doc{border:1px solid #d6dbe3;border-radius:10px;overflow:hidden}
  .header{padding:12px 14px;border-bottom:2px solid #0f172a;background:#f8fafc}
  .title{font-size:18px;font-weight:800;text-align:center;margin:0}
  .subtitle{font-size:11px;text-align:center;color:#475569;margin-top:4px}
  .section{padding:10px 14px;border-bottom:1px solid #e5e7eb}
  .section:last-child{border-bottom:none}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .bilingual{display:grid;grid-template-columns:minmax(0,1fr) 1px minmax(0,1fr);column-gap:10px;direction:ltr;align-items:stretch}
  .hr-bilingual-sep{background:#cbd5e1;border-radius:999px;width:1px;min-width:1px}
  .box{padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff}
  .box h3{margin:0 0 6px;font-size:12px;text-align:center;font-weight:800}
  .box p,.box li{margin:0 0 6px;line-height:1.5;font-size:10.5px}
  table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.5px}
  th,td{padding:4px 6px;border:1px solid #dbe1e8}
  th{background:#f1f5f9;font-weight:700;text-align:center;color:#334155}
  .num{font-family:'Cairo',Arial,sans-serif}
  .footer{padding:10px 14px}
  .signatures{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:12px}
  .sig{padding-top:24px;border-top:1px solid #cbd5e1;font-size:10px}
  .hr-doc-frame{border:1px solid #d6dbe3;border-radius:14px;overflow:hidden;background:#fff}
  .hr-doc-frame-compact{border-radius:10px;max-width:190mm;margin:0 auto}
  .hr-doc-frame-header{padding:18px 22px;border-bottom:2px solid #0f172a;background:#f8fafc}
  .hr-doc-frame-compact .hr-doc-frame-header{padding:10px 14px}
  .hr-doc-logo-wrap{display:flex;justify-content:center;margin-bottom:8px}
  .hr-doc-frame-compact .hr-doc-logo-wrap{margin-bottom:4px}
  .hr-doc-logo{max-height:56px;object-fit:contain}
  .hr-doc-frame-compact .hr-doc-logo{max-height:40px}
  .hr-doc-company-name{text-align:center;font-size:20px;font-weight:800}
  .hr-doc-frame-compact .hr-doc-company-name{font-size:15px}
  .hr-doc-company-en{text-align:center;margin-top:6px;color:#475569}
  .hr-doc-frame-compact .hr-doc-company-en{margin-top:2px;font-size:11px}
  .hr-doc-title-ar{text-align:center;margin-top:14px;font-size:20px;font-weight:800}
  .hr-doc-frame-compact .hr-doc-title-ar{margin-top:8px;font-size:14px}
  .hr-doc-title-en{text-align:center;color:#475569;margin-top:2px;font-size:12px}
  .hr-doc-frame-compact .hr-doc-title-en{font-size:11px}
  .hr-doc-frame-date{text-align:center;margin-top:2px;color:#64748b;font-size:12px}
  .hr-doc-frame-compact .hr-doc-frame-date{font-size:10px}
  .hr-doc-section{padding:18px 22px;border-bottom:1px solid #e5e7eb}
  .hr-doc-section-compact{padding:10px 14px;border-bottom:1px solid #e5e7eb}
  .hr-doc-panel-section{padding:12px 22px;border-bottom:1px solid #e5e7eb;background:#f8fafc}
  .hr-doc-box{padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff}
  .hr-doc-h3{margin:0 0 6px;font-size:12px;font-weight:800;text-align:center;color:#0f172a}
  .hr-doc-copy{line-height:1.45;margin:0;font-size:10.5px}
  .hr-doc-copy-follow{line-height:1.45;margin-top:8px;font-size:10.5px}
  .hr-doc-terms{margin:0;padding-inline-start:18px;line-height:1.45;font-size:10.5px}
  .hr-doc-calc-grid{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;font-size:10.5px;line-height:1.3}
  .hr-doc-num{font-variant-numeric:tabular-nums;white-space:nowrap}
  .hr-doc-num-rtl{font-variant-numeric:tabular-nums;white-space:nowrap;direction:ltr;unicode-bidi:embed}
  .hr-doc-signatures-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;margin-top:22px;direction:ltr}
  .hr-doc-signatures-2{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:22px}
  .hr-doc-signature{padding-top:32px;border-top:1px solid #cbd5e1}
  .hr-doc-signature-sm{padding-top:20px;border-top:1px solid #cbd5e1;font-size:10px;text-align:center}
  .hr-doc-date{color:#64748b;font-size:12px}
  .hr-doc-date-sm{color:#64748b;font-size:10px;text-align:center}
  .hr-doc-footer{padding:18px 22px}
  .hr-doc-footer-compact{padding:10px 14px}
  @media print{.doc{border:none;border-radius:0}}
`;
