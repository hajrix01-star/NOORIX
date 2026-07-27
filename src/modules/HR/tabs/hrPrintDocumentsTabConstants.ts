export const LABEL_PAYROLL_EN = {
  basic: 'Basic salary',
  housing: 'Housing allowance',
  transport: 'Transport allowance',
  other: 'Other allowances',
  overtime: 'Overtime (monthly estimate)',
  custom: 'Custom allowances',
  total: 'Total salary',
  employee: 'Employee',
  serial: 'Employee serial',
  name: 'Name',
  job: 'Job title',
  iqama: 'Iqama number',
  join: 'Join date',
  item: 'Item',
  amount: 'Amount (SAR)',
  slipTitle: 'Payroll slip — for review & signature',
  month: 'Month',
  empSig: 'Employee signature',
  emprSig: 'Employer / authorized signatory',
  totalYear: 'Year total',
  finalAck: 'Final acknowledgement — signatures',
};

export const LABEL_EOS_EN = {
  title: 'End-of-service settlement — for review & signature',
  employee: 'Employee',
  endDate: 'End of service date',
  wageTitle: 'Last wage components (excl. OT — editable)',
  wageTotal: 'Wage package total',
  settlement: 'Settlement line',
  eos: 'EOS gratuity (manual)',
  other: 'Other dues',
  ded: 'Deductions',
  net: 'Net payable',
};

export const LABEL_LETTER_EN = {
  contractSection: 'Contract details',
  declarationSection: 'Declaration',
  signaturesSection: 'Signatures',
  establishment: 'Establishment name',
  serviceDuration: 'Service duration',
  monthlySalary: 'Monthly salary (package)',
  netPayable: 'Net payable',
  eosGratuity: 'End-of-service gratuity',
  annualTitle: 'Annual salary statement',
  salaryLetterTitle: 'Salary Receipt Letter',
  entitlementsLetterTitle: 'Full Entitlements Receipt Letter',
  receiptSigCol: 'Receipt signature',
  grossSalary: 'Gross salary',
  annualTotal: 'Annual total',
  stampSignatory: 'Establishment stamp & authorized signatory',
};

/** HR print sheet: A4 portrait/landscape, bilingual header, neutral numerals. */
export const HR_SHEET_LEGAL_AR =
  'مرجع نظامي: نظام العمل الصادر بالمرسوم الملكي رقم (م/51) ولائحته التنفيذية — وثيقة توقيع إدارية؛ لا تُحدّث السجلات المحاسبية آلياً.';
export const HR_SHEET_LEGAL_EN =
  'Legal reference: Saudi Labor Law (Royal Decree M/51) and implementing regulations — administrative signature document; not an automated accounting payroll record.';

export const HR_GEN_PRINT_CSS = `
.hr-sheet.gen-print{--doc-primary:#1a3c5e;--doc-accent:#c9a227;--doc-light:#dce6f1;--doc-gray:#f5f7fa;--doc-border:#d0d8e4;--gen-amt:#1a3c5e}
.hr-sheet.gen-print{font-family:'Noto Sans Arabic','IBM Plex Sans',Tahoma,sans-serif}
.hr-sheet .legal-ref{font-size:6.5pt;line-height:1.35;color:#64748b;text-align:center;padding:4px 8px 8px;border-bottom:1px dotted #cbd5e1;margin:0}
.hr-sheet .legal-ref-en{margin-top:2px;font-size:6pt;color:#64748b}
.hr-sheet.gen-print .document{width:100%;max-width:210mm;margin:0 auto;background:#fff;border-radius:4px;direction:rtl;color:#1a2a3a;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;border:1px solid #e2e8f0}
.hr-sheet.gen-print .doc-header{background:var(--doc-primary);padding:18px 22px 16px;display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:4px solid var(--doc-accent)}
.hr-sheet.gen-print .doc-header-logo{width:76px;height:76px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;padding:4px}
.hr-sheet.gen-print .doc-header-logo img{max-width:100%;max-height:100%;object-fit:contain}
.hr-sheet.gen-print .gen-logo-placeholder{font-size:10px;color:#94a3b8;text-align:center;line-height:1.35}
.hr-sheet.gen-print .doc-header-center{flex:1;text-align:center;min-width:0}
.hr-sheet.gen-print .doc-company-ar{font-size:17px;font-weight:800;color:var(--doc-accent);font-family:'Noto Sans Arabic',sans-serif;line-height:1.2}
.hr-sheet.gen-print .doc-company-en{font-size:12px;color:#c8d8e8;margin-top:4px;font-weight:500}
.hr-sheet.gen-print .doc-divider{border:none;border-top:1px solid rgba(201,162,39,.45);margin:8px auto;width:82%;max-width:280px}
.hr-sheet.gen-print .doc-title-ar{font-size:16px;font-weight:700;color:#fff;font-family:'Noto Sans Arabic',sans-serif;line-height:1.25;margin-top:2px}
.hr-sheet.gen-print .doc-title-en{font-size:11px;color:#aac4de;margin-top:4px;font-weight:500}
.hr-sheet.gen-print .doc-header-sub{font-size:10px;color:#c8dce8;margin-top:6px;font-weight:600}
.hr-sheet.gen-print .doc-header-sub-en{font-size:10px;color:#aac4de;margin-top:2px}
.hr-sheet.gen-print .doc-header-space{width:76px;flex-shrink:0}
.hr-sheet.gen-print .doc-body{padding:18px 22px 10px;flex:1}
.hr-sheet.gen-print .doc-section-title{background:var(--doc-primary);color:#fff;font-size:12px;font-weight:700;padding:8px 14px;border-radius:4px;margin:0 0 10px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.hr-sheet.gen-print .doc-section-title-en{font-size:10px;font-weight:600;color:#dbeafe;opacity:.95}
.hr-sheet.gen-print .doc-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--doc-border);border:1px solid var(--doc-border);border-radius:4px;overflow:hidden;margin-bottom:16px}
.hr-sheet.gen-print .doc-info-cell{background:#fff;padding:8px 12px;display:flex;gap:10px;align-items:center}
.hr-sheet.gen-print .doc-info-label{font-size:10px;color:#5a7a9a;font-weight:700;white-space:nowrap;min-width:72px}
.hr-sheet.gen-print .doc-info-value{font-size:12px;color:#1a2a3a;font-weight:700;flex:1;word-break:break-word}
.hr-sheet.gen-print .doc-info-value.v-ltr{direction:ltr;text-align:left}
.hr-sheet.gen-print .doc-emp-strip{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--doc-border);border:1px solid var(--doc-border);border-radius:4px;overflow:hidden;margin-bottom:16px}
.hr-sheet.gen-print .doc-emp-cell{background:#fff;padding:8px 10px;display:flex;flex-direction:column;gap:2px;text-align:right}
.hr-sheet.gen-print .doc-emp-lbl{font-size:10px;color:#5a7a9a;font-weight:700}
.hr-sheet.gen-print .doc-emp-val{font-size:12px;color:#1a2a3a;font-weight:800}
.hr-sheet.gen-print .doc-declaration{background:var(--doc-gray);border:1px solid var(--doc-border);border-right:4px solid var(--doc-primary);border-radius:4px;padding:14px 16px;margin-bottom:16px}
.hr-sheet.gen-print .doc-declaration p{font-size:11.5px;line-height:1.85;color:#1a2a3a;margin:0 0 10px;text-align:justify}
.hr-sheet.gen-print .doc-declaration p:last-child{margin-bottom:0}
.hr-sheet.gen-print .doc-declaration .dec-en{direction:ltr;text-align:justify;color:#334155;font-size:11px}
.hr-sheet.gen-print .doc-declaration--eos-unified{padding:12px 14px}
.hr-sheet.gen-print .doc-decl-lang{margin:0 0 12px}
.hr-sheet.gen-print .doc-decl-lang:last-child{margin-bottom:0}
.hr-sheet.gen-print .doc-decl-lang--ltr{margin-bottom:0}
.hr-sheet.gen-print .doc-decl-lang-lbl{font-size:10px;font-weight:800;color:#5a7a9a;margin:0 0 6px;display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}
.hr-sheet.gen-print .doc-decl-lang-lbl-en{font-size:9px;font-weight:600;color:#94a3b8}
.hr-sheet.gen-print .doc-decl-lang-body{margin:0;font-size:11.5px;line-height:1.8;color:#1a2a3a;text-align:justify;white-space:pre-wrap}
.hr-sheet.gen-print .doc-decl-lang-body--en{color:#334155;font-size:11px}
.hr-sheet.gen-print .doc-declaration-unified-sep{border:none;height:0;margin:10px 0 12px;padding:0;border-top:1px dashed var(--doc-border);background:transparent}
.hr-sheet.gen-print .doc-sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:4px}
.hr-sheet.gen-print .doc-sig-box{border:1px solid var(--doc-border);border-radius:6px;overflow:hidden;page-break-inside:avoid}
.hr-sheet.gen-print .doc-sig-header{background:var(--doc-light);padding:8px 12px;text-align:center}
.hr-sheet.gen-print .doc-sig-title-ar{font-size:12px;font-weight:700;color:var(--doc-primary)}
.hr-sheet.gen-print .doc-sig-title-en{font-size:10px;color:#6a8aaa;margin-top:2px}
.hr-sheet.gen-print .doc-sig-space{height:64px}
.hr-sheet.gen-print .doc-sig-footer{background:#f9fbfd;border-top:1px solid #e0e8f0;padding:8px 12px;font-size:10px;color:#6a8aaa;text-align:center}
.hr-sheet.gen-print .doc-sig-footer strong{display:block;font-size:11px;color:#1a3c5e;font-weight:800;margin-bottom:4px}
.hr-sheet.gen-print .doc-footer{background:var(--doc-primary);margin-top:auto;padding:10px 22px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;border-top:3px solid var(--doc-accent)}
.hr-sheet.gen-print .doc-footer-text{font-size:10px;color:#8ab0d0;max-width:72%}
.hr-sheet.gen-print .doc-footer-date{font-size:10px;color:#6a90b0}
.hr-sheet.gen-print .pr-table{width:100%;border-collapse:collapse;margin:0 0 8px;border:1px solid var(--doc-border);border-radius:4px;overflow:hidden;font-size:11px}
.hr-sheet.gen-print .pr-table th,.hr-sheet.gen-print .pr-table td{border:1px solid var(--doc-border);padding:6px 8px;text-align:center;vertical-align:middle}
.hr-sheet.gen-print .pr-table thead th{background:var(--doc-primary);color:#fff;font-weight:700}
.hr-sheet.gen-print .pr-table tbody td:first-child{text-align:right;font-weight:600;color:#1a2a3a}
.hr-sheet.gen-print .pr-table .cell-amt{color:var(--gen-amt);font-weight:800}
.hr-sheet.gen-print .pr-table .cell-sig{color:#94a3b8;font-family:monospace;font-size:9px;letter-spacing:.5px}
.hr-sheet.gen-print .pr-table tfoot td{background:#eef2f7;font-weight:800}
.hr-sheet.gen-print .pr-table tfoot td:first-child{text-align:right}
.hr-sheet.gen-print .gen-breakdown{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.hr-sheet.gen-print .doc-table{width:100%;border-collapse:collapse;font-size:10.5px;table-layout:fixed}
.hr-sheet.gen-print .doc-table th,.hr-sheet.gen-print .doc-table td{border:1px solid var(--doc-border);padding:4px 6px;text-align:right;vertical-align:middle}
.hr-sheet.gen-print .doc-table thead th{background:var(--doc-primary);color:#fff;font-weight:700}
.hr-sheet.gen-print .doc-table .td-num{text-align:center;font-weight:700;color:var(--gen-amt)}
.hr-sheet.gen-print .doc-table .td-en{text-align:left;direction:ltr}
.hr-sheet.gen-print .doc-note{white-space:pre-wrap;font-size:10px;line-height:1.45;color:#334155;margin-top:8px;padding:8px;background:#fafafa;border:1px dashed var(--doc-border);border-radius:4px}
.hr-sheet.gen-print.hr-sheet--landscape .document{max-width:297mm}
.hr-sheet.gen-print.hr-sheet--landscape .doc-body{padding:14px 18px}
/* Print: tuned density for A4 portrait/landscape without clipping the footer */
@media print{
  body{padding:0!important;margin:0!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .print-footer{display:none!important}
  .hr-sheet.gen-print{page-break-after:avoid;font-size:9.25pt;line-height:1.25}
  .hr-sheet.gen-print .legal-ref{padding:2px 6px 4px!important;font-size:5.8pt!important;line-height:1.2!important}
  .hr-sheet.gen-print .legal-ref-en{font-size:5.5pt!important;margin-top:0!important}
  .hr-sheet.gen-print .document{border:none!important;border-radius:0!important;max-width:none!important;width:100%!important}
  .hr-sheet.gen-print .doc-header{padding:8px 12px 8px!important;gap:10px!important;border-bottom-width:3px!important}
  .hr-sheet.gen-print .doc-header-logo{width:52px!important;height:52px!important;padding:2px!important}
  .hr-sheet.gen-print .doc-header-space{width:52px!important}
  .hr-sheet.gen-print .gen-logo-placeholder{font-size:8px!important}
  .hr-sheet.gen-print .doc-company-ar{font-size:13.5pt!important;line-height:1.15!important}
  .hr-sheet.gen-print .doc-company-en{font-size:9pt!important;margin-top:2px!important}
  .hr-sheet.gen-print .doc-divider{margin:4px auto!important;width:78%!important}
  .hr-sheet.gen-print .doc-title-ar{font-size:12.5pt!important;margin-top:0!important}
  .hr-sheet.gen-print .doc-title-en{font-size:9pt!important;margin-top:2px!important}
  .hr-sheet.gen-print .doc-header-sub,.hr-sheet.gen-print .doc-header-sub-en{font-size:8.5pt!important;margin-top:3px!important}
  .hr-sheet.gen-print .doc-body{padding:8px 10px 4px!important}
  .hr-sheet.gen-print .doc-section-title{font-size:9.5pt!important;padding:5px 10px!important;margin:0 0 6px!important;border-radius:3px!important}
  .hr-sheet.gen-print .doc-section-title-en{font-size:8pt!important}
  .hr-sheet.gen-print .doc-info-grid{margin-bottom:8px!important}
  .hr-sheet.gen-print .doc-info-cell{padding:4px 8px!important;gap:6px!important}
  .hr-sheet.gen-print .doc-info-label{font-size:8pt!important;min-width:58px!important}
  .hr-sheet.gen-print .doc-info-value{font-size:9.5pt!important}
  .hr-sheet.gen-print .doc-emp-strip{margin-bottom:8px!important}
  .hr-sheet.gen-print .doc-emp-cell{padding:4px 6px!important}
  .hr-sheet.gen-print .doc-emp-lbl{font-size:8pt!important}
  .hr-sheet.gen-print .doc-emp-val{font-size:9.5pt!important}
  .hr-sheet.gen-print .doc-declaration{padding:8px 10px!important;margin-bottom:8px!important;border-right-width:3px!important}
  .hr-sheet.gen-print .doc-declaration p{font-size:9pt!important;line-height:1.4!important;margin:0 0 6px!important}
  .hr-sheet.gen-print .doc-declaration .dec-en{font-size:8.5pt!important;line-height:1.35!important}
  .hr-sheet.gen-print .doc-declaration--eos-unified{padding:6px 8px!important}
  .hr-sheet.gen-print .doc-decl-lang{margin:0 0 8px!important}
  .hr-sheet.gen-print .doc-decl-lang-lbl{font-size:8pt!important;margin:0 0 3px!important}
  .hr-sheet.gen-print .doc-decl-lang-lbl-en{font-size:7.5pt!important}
  .hr-sheet.gen-print .doc-decl-lang-body{font-size:9pt!important;line-height:1.38!important}
  .hr-sheet.gen-print .doc-decl-lang-body--en{font-size:8.5pt!important}
  .hr-sheet.gen-print .doc-declaration-unified-sep{margin:6px 0 8px!important}
  .hr-sheet.gen-print .gen-breakdown{gap:6px!important;margin-bottom:6px!important}
  .hr-sheet.gen-print .doc-table{font-size:8.5pt!important}
  .hr-sheet.gen-print .doc-table th,.hr-sheet.gen-print .doc-table td{padding:2px 4px!important}
  .hr-sheet.gen-print .doc-note{font-size:8.5pt!important;padding:5px 6px!important;margin-top:4px!important;line-height:1.35!important}
  .hr-sheet.gen-print .pr-table{font-size:8.5pt!important;margin:0 0 4px!important}
  .hr-sheet.gen-print .pr-table th,.hr-sheet.gen-print .pr-table td{padding:2px 4px!important}
  .hr-sheet.gen-print .pr-table .cell-sig{font-size:7.5pt!important}
  .hr-sheet.gen-print .doc-sig-grid{gap:8px!important;margin-top:2px!important;page-break-inside:avoid}
  .hr-sheet.gen-print .doc-sig-header{padding:5px 8px!important}
  .hr-sheet.gen-print .doc-sig-title-ar{font-size:9.5pt!important}
  .hr-sheet.gen-print .doc-sig-title-en{font-size:8pt!important}
  .hr-sheet.gen-print .doc-sig-space{height:36px!important}
  .hr-sheet.gen-print .doc-sig-footer{padding:5px 8px!important;font-size:8.5pt!important}
  .hr-sheet.gen-print .doc-sig-footer strong{font-size:9pt!important;margin-bottom:2px!important}
  .hr-sheet.gen-print .doc-footer{padding:6px 12px!important;border-top-width:2px!important;flex-wrap:nowrap!important}
  .hr-sheet.gen-print .doc-footer-text{font-size:8pt!important;max-width:78%!important;line-height:1.25!important}
  .hr-sheet.gen-print .doc-footer-date{font-size:8pt!important;white-space:nowrap}
  .hr-sheet.gen-print.hr-sheet--landscape .doc-body{padding:6px 10px 4px!important}
  .hr-sheet.gen-print.hr-sheet--landscape .doc-header{padding:6px 10px 6px!important}
  .hr-sheet.gen-print.hr-sheet--landscape .doc-sig-space{height:32px!important}
}
`.trim();

export const DEFAULT_DECL_SALARY_AR =
  'أقر أنا الموقع أدناه بأنني استلمت رواتبي الشهرية كاملة دون أي خصم أو تأخير عن الفترة المحددة أعلاه، وأبرئ ذمة المنشأة من أي مطالبة متعلقة بالرواتب.';
export const DEFAULT_DECL_SALARY_EN =
  'I, the undersigned, acknowledge that I have received all my monthly salaries in full, without any deduction or delay, for the period stated above, and I release the establishment from any claims relating to salaries.';

/** Default Arabic settlement paragraph when importing EOS from HR (paired with {@link DEFAULT_EOS_SETTLEMENT_EN}). */
export const DEFAULT_EOS_SETTLEMENT_AR =
  'أقر أنا الموقع أدناه بأنني استلمت كافة مستحقاتي النظامية من صاحب العمل، وأبرئ ذمته من أي مطالبة لاحقة تتعلق بعقد العمل أو نهاية الخدمة، وفق ما هو مبين أعلاه.';

export const DEFAULT_EOS_SETTLEMENT_EN =
  'I, the undersigned, acknowledge receipt of all statutory dues from the employer and release the employer from any further claims relating to employment or end of service, as stated above.';

export const HR_PRINT_ALERT_ANNUAL_EMPTY_AR =
  'فعّل شهراً واحداً على الأقل لإظهار المعاينة والطباعة.';

export const HR_PRINT_ALERT_ANNUAL_EMPTY_EN = 'Enable at least one month to print.';

