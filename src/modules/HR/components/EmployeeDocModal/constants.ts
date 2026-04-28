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
  @media print{.doc{border:none;border-radius:0}}
`;
