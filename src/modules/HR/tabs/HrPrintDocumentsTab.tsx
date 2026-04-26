/**
 * HrPrintDocumentsTab ظ¤ ╪╖╪ذ╪د╪╣╪ر ┘à╪│┘è╪▒ ╪▒╪د╪ز╪ذ ┘ê┘à╪«╪د┘╪╡╪ر (┘à╪╣╪▓┘ê┘╪ر ╪╣┘ ╪د┘╪ص┘╪╕ ┘┘è ╪د┘┘╪╕╪د┘à).
 * ╪ز╪«╪╖┘è╪╖ ╪د┘╪╖╪ذ╪د╪╣╪ر ┘à╪ذ┘┘è ╪╣┘┘ë ┘┘à╪╖ ┬س┘à┘ê┘┘ّ╪» ╪د┘┘à╪«╪د┘╪╡╪ر┬╗: ╪ز╪▒┘ê┘è╪│╪ر ╪▓╪▒┘é╪د╪ة + ╪░┘ç╪ذ┘è╪î ╪┤╪╣╪د╪▒╪î ╪┤╪ذ┘â╪ر ╪ذ┘è╪د┘╪د╪ز╪î ╪ح┘é╪▒╪د╪▒╪î ╪ز┘ê┘é┘è╪╣╪د╪ز╪î ╪ز╪░┘è┘è┘.
 * ╪ث┘┘ê╪د╪╣: ┘à╪│┘è╪▒ ╪┤┘ç╪▒ ┘ê╪د╪ص╪»╪î ┘â╪┤┘ ╪▒┘ê╪د╪ز╪ذ ╪│┘┘ê┘è (╪ش╪»┘ê┘)╪î ╪«╪╖╪د╪ذ ╪د╪│╪ز┘╪د┘à ╪▒┘ê╪د╪ز╪ذ╪î ╪«╪╖╪د╪ذ ╪د╪│╪ز┘╪د┘à ╪ش┘à┘è╪╣ ╪د┘┘à╪│╪ز╪ص┘é╪د╪ز (┘┘ç╪د┘è╪ر ╪«╪»┘à╪ر).
 */
import React, { useMemo, useState, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { useEmployees } from '../../../hooks/useEmployees';
import { useCustomAllowances } from '../../../hooks/useCustomAllowances';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { openPrintWindow } from '../../../utils/printUtils';
import { getBrandLogo } from '../../../utils/appBranding';
import { hrFmt } from '../utils/hrFmt';
import { overtimePay, sumCustomAllowancesForEmployee } from '../utils/employeeSalaryMath';
import { Button, Input, FmtNum } from '../../../ui';

function esc(v: any) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function n(v: any) {
  const x = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(x) ? x : 0;
}

function defaultPeriodLabel(lang: any) {
  return new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' });
}

function monthNameAr(m1to12: any) {
  return new Date(2000, m1to12 - 1, 1).toLocaleDateString('ar-SA', { month: 'long' });
}
function monthNameEn(m1to12: any) {
  return new Date(2000, m1to12 - 1, 1).toLocaleDateString('en-US', { month: 'long' });
}

function parseYmd(d: any) {
  if (!d || typeof d !== 'string') return null;
  const x = new Date(`${d.slice(0, 10)}T12:00:00`);
  return Number.isNaN(x.getTime()) ? null : x;
}

function formatDateLocale(d: any, loc: any) {
  const p = parseYmd(d);
  if (!p) return 'ظ¤';
  return p.toLocaleDateString(loc, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function serviceDurationArEn(startStr: any, endStr: any) {
  const a = parseYmd(startStr);
  const b = parseYmd(endStr);
  if (!a || !b || b < a) return { ar: 'ظ¤', en: 'ظ¤' };
  const days = Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
  const mo = Math.floor(days / 30);
  const da = days % 30;
  return { ar: `${mo} ╪┤┘ç╪▒ ┘ê ${da} ┘è┘ê┘à`, en: `${mo} month(s) and ${da} day(s)` };
}

function firstLastActiveMonthRange(monthOn: any, year: any) {
  let fi = -1;
  let li = -1;
  monthOn.forEach((on: any, i: any) => {
    if (on) {
      if (fi < 0) fi = i;
      li = i;
    }
  });
  if (fi < 0) return null;
  return {
    ar: `${monthNameAr(fi + 1)}ظô${monthNameAr(li + 1)} ${year}`,
    en: `${monthNameEn(fi + 1)}ظô${monthNameEn(li + 1)} ${year}`,
  };
}

const LABEL_PAYROLL_EN = {
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
  slipTitle: 'Payroll slip ظ¤ for review & signature',
  month: 'Month',
  empSig: 'Employee signature',
  emprSig: 'Employer / authorized signatory',
  totalYear: 'Year total',
  finalAck: 'Final acknowledgement ظ¤ signatures',
};

const LABEL_EOS_EN = {
  title: 'End-of-service settlement ظ¤ for review & signature',
  employee: 'Employee',
  endDate: 'End of service date',
  wageTitle: 'Last wage components (excl. OT ظ¤ editable)',
  wageTotal: 'Wage package total',
  settlement: 'Settlement line',
  eos: 'EOS gratuity (manual)',
  other: 'Other dues',
  ded: 'Deductions',
  net: 'Net payable',
};

const LABEL_LETTER_EN = {
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

/** ╪ز┘╪│┘è┘é ┘ê╪س┘è┘é╪ر HR ظ¤ ╪╡┘╪ص╪ر A4 ┘ê╪د╪ص╪»╪ر╪î ╪╣╪▒╪ذ┘è/╪ح┘╪ش┘┘è╪▓┘è╪î ╪ث┘┘ê╪د┘ ╪▒╪│┘à┘è╪ر ┘ç╪د╪»╪خ╪ر (┘à╪▒╪ش╪╣┘è╪ر ┘╪╕╪د┘à ╪╣┘à┘) */
const HR_SHEET_LEGAL_AR =
  '┘à╪▒╪ش╪╣ ┘╪╕╪د┘à┘è: ┘╪╕╪د┘à ╪د┘╪╣┘à┘ ╪د┘╪╡╪د╪»╪▒ ╪ذ╪د┘┘à╪▒╪│┘ê┘à ╪د┘┘à┘┘â┘è ╪▒┘é┘à (┘à/51) ┘ê┘╪د╪خ╪ص╪ز┘ç ╪د┘╪ز┘┘┘è╪░┘è╪ر ظ¤ ┘ê╪س┘è┘é╪ر ╪ز┘ê┘é┘è╪╣ ╪ح╪»╪د╪▒┘è╪ر ┘╪د ╪ز┘╪ص╪»┘ّ╪س ╪د┘╪│╪ش┘╪د╪ز ╪د┘┘à╪ص╪د╪│╪ذ┘è╪ر ╪ت┘┘è╪د┘ï.';
const HR_SHEET_LEGAL_EN =
  'Legal reference: Saudi Labor Law (Royal Decree M/51) and implementing regulations ظ¤ administrative signature document; not an automated accounting payroll record.';

const HR_GEN_PRINT_CSS = `
.hr-sheet.gen-print{--doc-primary:#1a3c5e;--doc-accent:#c9a227;--doc-light:#dce6f1;--doc-gray:#f5f7fa;--doc-border:#d0d8e4;--gen-amt:#1a3c5e}
.hr-sheet.gen-print{font-family:'Tajawal','Cairo',Tahoma,sans-serif}
.hr-sheet .legal-ref{font-size:6.5pt;line-height:1.35;color:#64748b;text-align:center;padding:4px 8px 8px;border-bottom:1px dotted #cbd5e1;margin:0}
.hr-sheet .legal-ref-en{margin-top:2px;font-size:6pt;color:#64748b}
.hr-sheet.gen-print .document{width:100%;max-width:210mm;margin:0 auto;background:#fff;border-radius:4px;direction:rtl;color:#1a2a3a;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;border:1px solid #e2e8f0}
.hr-sheet.gen-print .doc-header{background:var(--doc-primary);padding:18px 22px 16px;display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:4px solid var(--doc-accent)}
.hr-sheet.gen-print .doc-header-logo{width:76px;height:76px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;padding:4px}
.hr-sheet.gen-print .doc-header-logo img{max-width:100%;max-height:100%;object-fit:contain}
.hr-sheet.gen-print .gen-logo-placeholder{font-size:10px;color:#94a3b8;text-align:center;line-height:1.35}
.hr-sheet.gen-print .doc-header-center{flex:1;text-align:center;min-width:0}
.hr-sheet.gen-print .doc-company-ar{font-size:17px;font-weight:800;color:var(--doc-accent);font-family:'Cairo',sans-serif;line-height:1.2}
.hr-sheet.gen-print .doc-company-en{font-size:12px;color:#c8d8e8;margin-top:4px;font-weight:500}
.hr-sheet.gen-print .doc-divider{border:none;border-top:1px solid rgba(201,162,39,.45);margin:8px auto;width:82%;max-width:280px}
.hr-sheet.gen-print .doc-title-ar{font-size:16px;font-weight:700;color:#fff;font-family:'Cairo',sans-serif;line-height:1.25;margin-top:2px}
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
/* ╪╖╪ذ╪د╪╣╪ر: ╪╢╪║╪╖ ╪░┘â┘è ┘┘à┘╪د╪ة┘à╪ر A4 ╪╡┘╪ص╪ر ┘ê╪د╪ص╪»╪ر (╪╣┘à┘ê╪»┘è ╪ث┘ê ╪╣╪▒╪╢┘è) ظ¤ ╪ذ╪»┘ê┘ ┘é╪╡ ╪د┘┘à╪ص╪ز┘ê┘ë ╪د┘┘à╪╣╪ز╪د╪» */
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

function wrapHrPrintBody(innerHtml: any, landscape: any) {
  const cls = landscape ? 'hr-sheet gen-print hr-sheet--landscape' : 'hr-sheet gen-print hr-sheet--portrait';
  return `
<div class="${cls}">
  <div class="legal-ref">
    <div dir="rtl">${esc(HR_SHEET_LEGAL_AR)}</div>
    <div class="legal-ref-en" dir="ltr">${esc(HR_SHEET_LEGAL_EN)}</div>
  </div>
${innerHtml}
</div>`;
}

function safeImgSrc(url: any) {
  const u = String(url || '').trim();
  if (!u) return '';
  return u.replace(/"/g, '%22').replace(/'/g, '%27');
}

function buildGenLogoInner(logoUrl: any) {
  const u = safeImgSrc(logoUrl);
  if (u.startsWith('http') || u.startsWith('data:image'))
    return `<img src="${u}" alt="" />`;
  return `<div class="gen-logo-placeholder">╪┤╪╣╪د╪▒<br/><span style="font-size:9px">Logo</span></div>`;
}

function buildGenHeader({ logoUrl, companyAr, companyEn, titleAr, titleEn, subtitleAr, subtitleEn }: any) {
  const enLine =
    companyEn && String(companyEn).trim()
      ? `<div class="doc-company-en" dir="ltr">${esc(companyEn)}</div>`
      : '';
  const tEn = titleEn ? `<div class="doc-title-en" dir="ltr">${esc(titleEn)}</div>` : '';
  const sub = subtitleAr ? `<div class="doc-header-sub" dir="rtl">${esc(subtitleAr)}</div>` : '';
  const subE = subtitleEn ? `<div class="doc-header-sub doc-header-sub-en" dir="ltr">${esc(subtitleEn)}</div>` : '';
  return `<header class="doc-header">
    <div class="doc-header-logo">${buildGenLogoInner(logoUrl)}</div>
    <div class="doc-header-center">
      <div class="doc-company-ar" dir="rtl">${esc(companyAr)}</div>
      ${enLine}
      <hr class="doc-divider" />
      <div class="doc-title-ar" dir="rtl">${esc(titleAr)}</div>
      ${tEn}
      ${sub}${subE}
    </div>
    <div class="doc-header-space" aria-hidden="true"></div>
  </header>`;
}

function buildGenEmployeeStrip(displayName: any, iqama: any, jobTitle: any) {
  const n = esc(String(displayName || '').trim() || 'ظ¤');
  const i = esc(String(iqama || '').trim() || 'ظ¤');
  const j = esc(String(jobTitle || '').trim() || 'ظ¤');
  return `
  <div class="doc-section-title"><span>╪ذ┘è╪د┘╪د╪ز ╪د┘┘à┘ê╪╕┘</span><span class="doc-section-title-en">${esc(LABEL_PAYROLL_EN.employee)}</span></div>
  <div class="doc-emp-strip">
    <div class="doc-emp-cell"><span class="doc-emp-lbl">╪د┘╪د╪│┘à</span><span class="doc-emp-val">${n}</span></div>
    <div class="doc-emp-cell"><span class="doc-emp-lbl">╪د┘╪ح┘é╪د┘à╪ر</span><span class="doc-emp-val">${i}</span></div>
    <div class="doc-emp-cell"><span class="doc-emp-lbl">╪د┘┘à╪│┘à┘ë</span><span class="doc-emp-val">${j}</span></div>
  </div>`;
}

function buildGenContractGrid(rows: any) {
  const cells = rows
    .map(
      (r: any) => `<div class="doc-info-cell">
      <span class="doc-info-label">${esc(r.labelAr)}<br/><span style="font-size:9px;font-weight:600;color:#94a3b8">${esc(r.labelEn)}</span></span>
      <span class="doc-info-value ${r.ltr ? 'v-ltr' : ''}" ${r.ltr ? 'dir="ltr"' : 'dir="rtl"'}>${esc(r.value)}</span>
    </div>`,
    )
    .join('');
  return `<div class="doc-info-grid">${cells}</div>`;
}

function buildGenContractBlock(titleAr: any, titleEn: any, rows: any) {
  return `
  <div class="doc-section-title"><span>${esc(titleAr)}</span><span class="doc-section-title-en">${esc(titleEn)}</span></div>
  ${buildGenContractGrid(rows)}`;
}

function buildGenDeclarationBlock(arText: any, enText: any) {
  const a = String(arText || '').trim();
  const e = String(enText || '').trim();
  if (!a && !e) return '';
  return `
  <div class="doc-section-title"><span>┘╪╡ ╪د┘╪ح┘é╪▒╪د╪▒</span><span class="doc-section-title-en">${esc(LABEL_LETTER_EN.declarationSection)}</span></div>
  <div class="doc-declaration">
    ${a ? `<p dir="rtl">${esc(a)}</p>` : ''}
    ${e ? `<p class="dec-en" dir="ltr">${esc(e)}</p>` : ''}
  </div>`;
}

/** ╪ح┘é╪▒╪د╪▒ ╪د┘┘à╪«╪د┘╪╡╪ر: ╪د┘╪╣╪▒╪ذ┘è╪ر ┘ê╪د┘╪ح┘╪ش┘┘è╪▓┘è╪ر ┘┘è ┘â╪ز┘╪ر ┘ê╪د╪ص╪»╪ر ╪ذ┘┘╪│ ╪ث╪│┘┘ê╪ذ ╪ز╪│┘à┘è╪د╪ز ╪د┘╪╣┘é╪» */
function buildGenSettlementDeclarationBlock(arText: any, enText: any) {
  const a = String(arText || '').trim();
  const e = String(enText || '').trim();
  if (!a && !e) return '';
  const arBlock = a
    ? `<div class="doc-decl-lang" dir="rtl">
      <div class="doc-decl-lang-lbl"><span>╪د┘╪╣╪▒╪ذ┘è╪ر</span><span class="doc-decl-lang-lbl-en">Arabic</span></div>
      <p class="doc-decl-lang-body">${esc(a)}</p>
    </div>`
    : '';
  const sep = a && e ? '<hr class="doc-declaration-unified-sep" />' : '';
  const enBlock = e
    ? `<div class="doc-decl-lang doc-decl-lang--ltr" dir="ltr">
      <div class="doc-decl-lang-lbl" dir="ltr"><span>English</span><span class="doc-decl-lang-lbl-en">╪د┘╪ح┘╪ش┘┘è╪▓┘è╪ر</span></div>
      <p class="doc-decl-lang-body doc-decl-lang-body--en">${esc(e)}</p>
    </div>`
    : '';
  return `
  <div class="doc-section-title"><span>┘╪╡ ╪د┘╪ح┘é╪▒╪د╪▒</span><span class="doc-section-title-en">${esc(LABEL_LETTER_EN.declarationSection)}</span></div>
  <div class="doc-declaration doc-declaration--eos-unified">
    ${arBlock}${sep}${enBlock}
  </div>`;
}

function buildGenSignaturesBlock(empName: any, companyAr: any) {
  const e = esc(String(empName || '').trim() || 'ظ¤');
  const c = esc(String(companyAr || '').trim() || 'ظ¤');
  return `
  <div class="doc-section-title"><span>╪د┘╪ز┘ê┘é┘è╪╣╪د╪ز</span><span class="doc-section-title-en">${esc(LABEL_LETTER_EN.signaturesSection)}</span></div>
  <div class="doc-sig-grid">
    <div class="doc-sig-box">
      <div class="doc-sig-header">
        <div class="doc-sig-title-ar">╪ز┘ê┘é┘è╪╣ ╪د┘┘à┘ê╪╕┘</div>
        <div class="doc-sig-title-en">Employee signature</div>
      </div>
      <div class="doc-sig-space"></div>
      <div class="doc-sig-footer"><strong>${e}</strong>╪د┘╪ز╪د╪▒┘è╪«: ____________________</div>
    </div>
    <div class="doc-sig-box">
      <div class="doc-sig-header">
        <div class="doc-sig-title-ar">╪«╪ز┘à ╪د┘┘à┘╪┤╪ث╪ر ┘ê╪ز┘ê┘é┘è╪╣ ╪د┘┘à┘┘ê┘┘ّ╪╢</div>
        <div class="doc-sig-title-en">${esc(LABEL_LETTER_EN.stampSignatory)}</div>
      </div>
      <div class="doc-sig-space"></div>
      <div class="doc-sig-footer"><strong>${c}</strong>╪د┘╪ز╪د╪▒┘è╪«: ____________________</div>
    </div>
  </div>`;
}

function buildGenFooter(issueDateStr: any, langIsAr: any) {
  const left = langIsAr
    ? '┘ç╪░╪د ╪د┘╪«╪╖╪د╪ذ ┘ê╪س┘è┘é╪ر ┘┘╪د╪╖┘╪د╪╣ ┘ê╪د┘╪ز┘ê┘é┘è╪╣ ┘ê┘┘é ┘╪╕╪د┘à ╪د┘╪╣┘à┘ ╪د┘╪│╪╣┘ê╪»┘è (┘à╪▒╪│┘ê┘à ┘à/51).'
    : 'Signature document under Saudi Labor Law (Royal Decree M/51).';
  const dlab = langIsAr ? '╪ز╪د╪▒┘è╪« ╪د┘╪ح╪╡╪»╪د╪▒' : 'Issue date';
  return `<footer class="doc-footer">
    <span class="doc-footer-text" dir="${langIsAr ? 'rtl' : 'ltr'}">${esc(left)}</span>
    <span class="doc-footer-date">${esc(dlab)}: ${esc(issueDateStr)}</span>
  </footer>`;
}

function emptyPayrollDraft() {
  return {
    payrollFormat: 'single',
    periodLabel: '',
    companyName: '',
    companyNameEn: '',
    nameAr: '',
    nameEn: '',
    employeeSerial: '',
    jobTitle: '',
    iqama: '',
    joinDate: '',
    basic: '',
    housing: '',
    transport: '',
    other: '',
    overtime: '',
    customRows: [] as any[],
    showBreakdown: true,
    notes: '',
    letterStartDate: '',
    letterEndDate: '',
    declarationSalariesAr: '',
    declarationSalariesEn: '',
  };
}

const DEFAULT_DECL_SALARY_AR =
  '╪ث┘é╪▒ ╪ث┘╪د ╪د┘┘à┘ê┘é╪╣ ╪ث╪»┘╪د┘ç ╪ذ╪ث┘┘┘è ╪د╪│╪ز┘┘à╪ز ╪▒┘ê╪د╪ز╪ذ┘è ╪د┘╪┤┘ç╪▒┘è╪ر ┘â╪د┘à┘╪ر ╪»┘ê┘ ╪ث┘è ╪ص╪│┘à ╪ث┘ê ╪ز╪ث╪«┘è╪▒ ╪╣┘ ╪د┘┘╪ز╪▒╪ر ╪د┘┘à╪ص╪»╪»╪ر ╪ث╪╣┘╪د┘ç╪î ┘ê╪ث╪ذ╪▒╪خ ╪░┘à╪ر ╪د┘┘à┘╪┤╪ث╪ر ┘à┘ ╪ث┘è ┘à╪╖╪د┘╪ذ╪ر ┘à╪ز╪╣┘┘é╪ر ╪ذ╪د┘╪▒┘ê╪د╪ز╪ذ.';
const DEFAULT_DECL_SALARY_EN =
  'I, the undersigned, acknowledge that I have received all my monthly salaries in full, without any deduction or delay, for the period stated above, and I release the establishment from any claims relating to salaries.';

function emptyAnnual() {
  const y = new Date().getFullYear();
  return {
    year: y,
    monthOn: Array.from({ length: 12 }, () => true),
    amounts: Array.from({ length: 12 }, () => ''),
    /** ┘à╪ذ┘╪║ ┘ê╪د╪ص╪» ┘┘â┘ ╪┤┘ç╪▒ ┘à┘╪╣┘ّ┘╪ؤ ╪ح┘ ┘╪د╪▒╪║ ┘è┘╪│╪ز╪«╪»┘à amounts[i] */
    perMonthGross: '',
  };
}

/**
 * ┘è╪ذ┘┘è HTML ╪د┘┘ê╪س┘è┘é╪ر ┘┘╪╖╪ذ╪د╪╣╪ر ┘ê╪د┘┘à╪╣╪د┘è┘╪ر (┘à╪╡╪»╪▒ ┘ê╪د╪ص╪» ┘╪ز┘╪د╪»┘è ╪د┘╪د╪«╪ز┘╪د┘).
 * @returns {{ inner: string | null, err: null | 'annual_empty', title: string }}
 */
function composeHrPrintDocument({
  docKind,
  payrollFormat,
  logoUrl,
  lang,
  payroll,
  annual,
  eos,
  companyNameArDefault,
  companyNameEnDefault,
  payrollTotal,
  annualSum,
  eosWageTotal,
  t,
}: any) {
  const issueDate = new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  if (docKind === 'eos') {
    const coAr = eos.companyName || companyNameArDefault;
    const coEn = eos.companyNameEn || companyNameEnDefault;
    const nameDisp = [eos.nameEn, eos.nameAr].filter(Boolean).join(' / ') || 'ظ¤';
    const dur = serviceDurationArEn(eos.joinDate, eos.endDate);
    const customLines = (eos.customRows || [])
      .map((r: any) => `${r.label || 'ظ¤'}: ${hrFmt(n(r.amount))} SR`)
      .join('╪ؤ ');
    const wageExtra = customLines ? ` (${customLines})` : '';
    const contractRows = [
      { labelAr: '╪د╪│┘à ╪د┘┘à┘ê╪╕┘', labelEn: LABEL_PAYROLL_EN.name, value: nameDisp, ltr: false },
      { labelAr: '╪▒┘é┘à ╪د┘╪ح┘é╪د┘à╪ر', labelEn: LABEL_PAYROLL_EN.iqama, value: eos.iqama || 'ظ¤', ltr: false },
      { labelAr: '╪ز╪د╪▒┘è╪« ╪د┘╪ذ╪»╪ة', labelEn: LABEL_PAYROLL_EN.join, value: `${formatDateLocale(eos.joinDate, 'ar-SA')} / ${formatDateLocale(eos.joinDate, 'en-US')}`, ltr: true },
      { labelAr: '╪ز╪د╪▒┘è╪« ┘┘ç╪د┘è╪ر ╪د┘╪«╪»┘à╪ر', labelEn: LABEL_EOS_EN.endDate, value: `${formatDateLocale(eos.endDate, 'ar-SA')} / ${formatDateLocale(eos.endDate, 'en-US')}`, ltr: true },
      { labelAr: '┘à╪»╪ر ╪د┘╪«╪»┘à╪ر', labelEn: LABEL_LETTER_EN.serviceDuration, value: `${dur.ar} / ${dur.en}`, ltr: true },
      { labelAr: '╪ث╪ش╪▒ ╪ت╪«╪▒ ╪┤┘ç╪▒ (┘à╪ش┘à┘ê╪╣ ╪د┘╪ذ╪»┘╪د╪ز)', labelEn: LABEL_EOS_EN.wageTitle, value: `${hrFmt(eosWageTotal)} SR${wageExtra}`, ltr: false },
      { labelAr: '┘à┘â╪د┘╪ث╪ر ┘┘ç╪د┘è╪ر ╪د┘╪«╪»┘à╪ر', labelEn: LABEL_LETTER_EN.eosGratuity, value: `${hrFmt(n(eos.eosAmount))} SR`, ltr: true },
      { labelAr: '┘à╪│╪ز╪ص┘é╪د╪ز ╪ث╪«╪▒┘ë', labelEn: LABEL_EOS_EN.other, value: `${hrFmt(n(eos.otherAccrued))} SR`, ltr: true },
      { labelAr: '╪«╪╡┘ê┘à╪د╪ز', labelEn: LABEL_EOS_EN.ded, value: `${hrFmt(n(eos.deductions))} SR`, ltr: true },
      { labelAr: '╪╡╪د┘┘è ╪د┘┘à╪│╪ز╪ص┘é', labelEn: LABEL_LETTER_EN.netPayable, value: `${hrFmt(n(eos.netPayable))} SR`, ltr: true },
      { labelAr: '╪د╪│┘à ╪د┘┘à┘╪┤╪ث╪ر', labelEn: LABEL_LETTER_EN.establishment, value: `${coAr} / ${coEn}`, ltr: false },
    ];
    const head = buildGenHeader({
      logoUrl,
      companyAr: coAr,
      companyEn: coEn,
      titleAr: '╪«╪╖╪د╪ذ ╪د╪│╪ز┘╪د┘à ╪ش┘à┘è╪╣ ╪د┘┘à╪│╪ز╪ص┘é╪د╪ز',
      titleEn: LABEL_LETTER_EN.entitlementsLetterTitle,
      subtitleAr: formatDateLocale(eos.endDate, 'ar-SA'),
      subtitleEn: formatDateLocale(eos.endDate, 'en-US'),
    });
    const contract = buildGenContractBlock('╪ذ┘è╪د┘╪د╪ز ╪د┘╪╣┘é╪» ┘ê╪د┘╪ز╪│┘ê┘è╪ر', `${LABEL_LETTER_EN.contractSection} & settlement`, contractRows);
    const decl = buildGenSettlementDeclarationBlock(eos.settlementNotesAr, eos.settlementNotesEn);
    const sigs = buildGenSignaturesBlock(eos.nameAr || eos.nameEn, coAr);
    const foot = buildGenFooter(issueDate, lang === 'ar');
    const inner = `<div class="document">${head}<div class="doc-body">${contract}${decl}${sigs}</div>${foot}</div>`;
    return { inner, err: null, title: 'Full entitlements letter / ╪«╪╖╪د╪ذ ╪د╪│╪ز┘╪د┘à ╪د┘┘à╪│╪ز╪ص┘é╪د╪ز' };
  }

  if (payrollFormat === 'annual') {
    const rows = [];
    let any = false;
    for (let i = 0; i < 12; i += 1) {
      if (!annual.monthOn[i]) continue;
      any = true;
      const m = i + 1;
      const uniform = String(annual.perMonthGross ?? '').trim();
      const amt = uniform !== '' ? n(uniform) : n(annual.amounts[i]);
      rows.push(`<tr>
        <td>${esc(monthNameAr(m))} ${annual.year}</td>
        <td class="cell-amt">${esc(hrFmt(amt))} SR</td>
        <td class="cell-sig">____________</td>
      </tr>`);
    }
    if (!any) {
      return { inner: null, err: 'annual_empty', title: '' };
    }
    const range = firstLastActiveMonthRange(annual.monthOn, annual.year);
    const coAr = payroll.companyName || companyNameArDefault;
    const coEn = payroll.companyNameEn || companyNameEnDefault;
    const subAr = range ? `┘à╪│┘è╪▒ ╪▒┘ê╪د╪ز╪ذ ${range.ar}` : `╪د┘╪│┘╪ر ${annual.year}`;
    const subEn = range ? `Payroll ${range.en}` : `Year ${annual.year}`;
    const head = buildGenHeader({
      logoUrl,
      companyAr: coAr,
      companyEn: coEn,
      titleAr: `┘â╪┤┘ ╪▒┘ê╪د╪ز╪ذ ╪│┘╪ر ${annual.year}`,
      titleEn: `Annual Payroll Statement ظ¤ ${annual.year}`,
      subtitleAr: subAr,
      subtitleEn: subEn,
    });
    const emp = buildGenEmployeeStrip(payroll.nameAr || payroll.nameEn, payroll.iqama, payroll.jobTitle);
    const table = `
    <div class="doc-section-title"><span>╪ز┘╪د╪╡┘è┘ ╪د┘╪▒┘ê╪د╪ز╪ذ</span><span class="doc-section-title-en">Salary breakdown</span></div>
    <table class="pr-table">
      <thead>
        <tr>
          <th>╪د┘╪┤┘ç╪▒</th>
          <th>${esc(LABEL_LETTER_EN.grossSalary)}</th>
          <th>${esc(LABEL_LETTER_EN.receiptSigCol)}</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
      <tfoot>
        <tr>
          <td>╪د┘╪ح╪ش┘à╪د┘┘è ╪د┘╪│┘┘ê┘è / ${esc(LABEL_LETTER_EN.annualTotal)}</td>
          <td class="cell-amt">${esc(hrFmt(annualSum))} SR</td>
          <td></td>
        </tr>
      </tfoot>
    </table>`;
    const sigs = buildGenSignaturesBlock(payroll.nameAr || payroll.nameEn, coAr);
    const foot = buildGenFooter(issueDate, lang === 'ar');
    const inner = `<div class="document">${head}<div class="doc-body">${emp}${table}${sigs}</div>${foot}</div>`;
    return { inner, err: null, title: `Annual salary ${annual.year} / ┘â╪┤┘ ╪│┘┘ê┘è ${annual.year}` };
  }

  if (payrollFormat === 'salaryLetter') {
    const dur = serviceDurationArEn(payroll.letterStartDate, payroll.letterEndDate);
    const coAr = payroll.companyName || companyNameArDefault;
    const coEn = payroll.companyNameEn || companyNameEnDefault;
    const nameDisp = [payroll.nameEn, payroll.nameAr].filter(Boolean).join(' / ') || 'ظ¤';
    const contractRows = [
      { labelAr: '╪د╪│┘à ╪د┘┘à┘ê╪╕┘', labelEn: LABEL_PAYROLL_EN.name, value: nameDisp, ltr: false },
      { labelAr: '╪▒┘é┘à ╪د┘╪ح┘é╪د┘à╪ر', labelEn: LABEL_PAYROLL_EN.iqama, value: payroll.iqama || 'ظ¤', ltr: false },
      { labelAr: '╪ز╪د╪▒┘è╪« ╪د┘╪ذ╪»╪ة', labelEn: LABEL_PAYROLL_EN.join, value: `${formatDateLocale(payroll.letterStartDate, 'ar-SA')} / ${formatDateLocale(payroll.letterStartDate, 'en-US')}`, ltr: true },
      { labelAr: '╪ز╪د╪▒┘è╪« ╪د┘╪ح┘┘ç╪د╪ة', labelEn: 'End date', value: `${formatDateLocale(payroll.letterEndDate, 'ar-SA')} / ${formatDateLocale(payroll.letterEndDate, 'en-US')}`, ltr: true },
      { labelAr: '┘à╪»╪ر ╪د┘╪«╪»┘à╪ر', labelEn: LABEL_LETTER_EN.serviceDuration, value: `${dur.ar} / ${dur.en}`, ltr: true },
      { labelAr: '╪د┘╪▒╪د╪ز╪ذ ╪د┘╪┤┘ç╪▒┘è', labelEn: LABEL_LETTER_EN.monthlySalary, value: `${hrFmt(payrollTotal)} SR`, ltr: true },
      { labelAr: '╪د╪│┘à ╪د┘┘à┘╪┤╪ث╪ر', labelEn: LABEL_LETTER_EN.establishment, value: `${coAr} / ${coEn}`, ltr: false },
    ];
    const head = buildGenHeader({
      logoUrl,
      companyAr: coAr,
      companyEn: coEn,
      titleAr: '╪«╪╖╪د╪ذ ╪د╪│╪ز┘╪د┘à ╪د┘╪▒┘ê╪د╪ز╪ذ',
      titleEn: LABEL_LETTER_EN.salaryLetterTitle,
      subtitleAr: payroll.periodLabel || defaultPeriodLabel(lang),
      subtitleEn: payroll.periodLabel || defaultPeriodLabel(lang),
    });
    const contract = buildGenContractBlock('╪ذ┘è╪د┘╪د╪ز ╪د┘╪╣┘é╪»', LABEL_LETTER_EN.contractSection, contractRows);
    const decl = buildGenDeclarationBlock(
      payroll.declarationSalariesAr || DEFAULT_DECL_SALARY_AR,
      payroll.declarationSalariesEn || DEFAULT_DECL_SALARY_EN,
    );
    const sigs = buildGenSignaturesBlock(payroll.nameAr || payroll.nameEn, coAr);
    const foot = buildGenFooter(issueDate, lang === 'ar');
    const inner = `<div class="document">${head}<div class="doc-body">${contract}${decl}${sigs}</div>${foot}</div>`;
    return { inner, err: null, title: 'Salary receipt letter / ╪«╪╖╪د╪ذ ╪د╪│╪ز┘╪د┘à ╪د┘╪▒┘ê╪د╪ز╪ذ' };
  }

  const rowsAr: string[] = [];
  const rowsEn: string[] = [];
  const push = (ar: any, en: any, val: any) => {
    rowsAr.push(`<tr><td>${esc(ar)}</td><td class="td-num">${esc(hrFmt(val))} SR</td></tr>`);
    rowsEn.push(`<tr><td class="td-en">${esc(en)}</td><td class="td-num">${esc(hrFmt(val))} SR</td></tr>`);
  };
  push(t('basicSalary'), LABEL_PAYROLL_EN.basic, n(payroll.basic));
  push(t('housingAllowance'), LABEL_PAYROLL_EN.housing, n(payroll.housing));
  push(t('transportAllowance'), LABEL_PAYROLL_EN.transport, n(payroll.transport));
  push(t('otherAllowance'), LABEL_PAYROLL_EN.other, n(payroll.other));
  push('╪ز┘é╪»┘è╪▒ ╪د┘╪ث┘ê┘╪▒ ╪ز╪د┘è┘à (╪┤┘ç╪▒┘è)', LABEL_PAYROLL_EN.overtime, n(payroll.overtime));
  if (payroll.showBreakdown) {
    (payroll.customRows || []).forEach((r: any) => push(r.label || 'ظ¤', r.label || LABEL_PAYROLL_EN.custom, n(r.amount)));
  } else {
    const csum = (payroll.customRows || []).reduce((s: any, r: any) => s + n(r.amount), 0);
    if (csum > 0) push(t('customAllowances'), LABEL_PAYROLL_EN.custom, csum);
  }
  const notesAr = payroll.notes?.trim() ? `<div class="doc-note" dir="rtl">${esc(payroll.notes)}</div>` : '';
  const notesEn = payroll.notes?.trim() ? `<div class="doc-note" dir="ltr">${esc(payroll.notes)}</div>` : '';
  const coAr = payroll.companyName || companyNameArDefault;
  const coEn = payroll.companyNameEn || companyNameEnDefault;
  const head = buildGenHeader({
    logoUrl,
    companyAr: coAr,
    companyEn: coEn,
    titleAr: `┘à╪│┘è╪▒ ╪▒╪د╪ز╪ذ ظ¤ ${payroll.nameAr || payroll.nameEn || ''}`.trim(),
    titleEn: LABEL_PAYROLL_EN.slipTitle,
    subtitleAr: `${payroll.periodLabel} ظ¤ ${coAr}`,
    subtitleEn: `${payroll.periodLabel} ظ¤ ${coEn}`,
  });
  const empStrip = buildGenEmployeeStrip(payroll.nameAr || payroll.nameEn, payroll.iqama, payroll.jobTitle);
  const detail = `
    <div class="doc-section-title"><span>╪ز┘╪د╪╡┘è┘ ╪د┘╪▒╪د╪ز╪ذ ┘┘┘╪ز╪▒╪ر</span><span class="doc-section-title-en">Salary breakdown</span></div>
    <div class="gen-breakdown">
      <div dir="rtl">
        <table class="doc-table"><tbody>
          <tr><td>${esc(t('employeeSerial'))}</td><td>${esc(payroll.employeeSerial)}</td></tr>
          <tr><td>${esc(t('joinDate'))}</td><td>${esc(formatDateLocale(payroll.joinDate, 'ar-SA'))}</td></tr>
        </tbody></table>
        <table class="doc-table"><thead><tr><th>╪د┘╪ذ┘╪»</th><th>╪د┘┘à╪ذ┘╪║</th></tr></thead><tbody>${rowsAr.join('')}</tbody>
        <tfoot><tr><td>${esc(t('totalSalary'))}</td><td class="td-num">${esc(hrFmt(payrollTotal))} SR</td></tr></tfoot></table>
        ${notesAr}
      </div>
      <div dir="ltr">
        <table class="doc-table"><tbody>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.serial)}</td><td class="td-en">${esc(payroll.employeeSerial)}</td></tr>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.join)}</td><td class="td-en">${esc(formatDateLocale(payroll.joinDate, 'en-US'))}</td></tr>
        </tbody></table>
        <table class="doc-table"><thead><tr><th class="td-en">${esc(LABEL_PAYROLL_EN.item)}</th><th>Amount</th></tr></thead><tbody>${rowsEn.join('')}</tbody>
        <tfoot><tr><td class="td-en">${esc(LABEL_PAYROLL_EN.total)}</td><td class="td-num">${esc(hrFmt(payrollTotal))} SR</td></tr></tfoot></table>
        ${notesEn}
      </div>
    </div>`;
  const sigs = buildGenSignaturesBlock(payroll.nameAr || payroll.nameEn, coAr);
  const foot = buildGenFooter(issueDate, lang === 'ar');
  const inner = `<div class="document">${head}<div class="doc-body">${empStrip}${detail}${sigs}</div>${foot}</div>`;
  return { inner, err: null, title: 'Payroll slip / ┘à╪│┘è╪▒ ╪▒╪د╪ز╪ذ' };
}

function emptyEosDraft() {
  return {
    companyName: '',
    companyNameEn: '',
    nameAr: '',
    nameEn: '',
    employeeSerial: '',
    jobTitle: '',
    iqama: '',
    joinDate: '',
    endDate: '',
    basic: '',
    housing: '',
    transport: '',
    other: '',
    customRows: [],
    eosAmount: '',
    otherAccrued: '',
    deductions: '',
    netPayable: '',
    settlementNotesAr: '',
    settlementNotesEn: '',
  };
}

export default function HrPrintDocumentsTab() {
  const { t, lang } = useTranslation();
  const { activeCompanyId, companies } = useApp();
  const companyId = activeCompanyId ?? '';
  const company = companies?.find((c: any) => c.id === companyId);
  const companyNameArDefault = company?.nameAr || company?.name || '';
  const companyNameEnDefault = company?.nameEn || company?.nameAr || company?.name || '';
  const companyLogoUrl = String(company?.logoUrl || getBrandLogo() || '').trim();

  const [docKind, setDocKind] = useState('payroll');
  const [employeeId, setEmployeeId] = useState('');
  const [payroll, setPayroll] = useState(emptyPayrollDraft);
  const [annual, setAnnual] = useState(emptyAnnual);
  const [eos, setEos] = useState(emptyEosDraft);
  /** ╪د╪ز╪ش╪د┘ç ╪╡┘╪ص╪ر ╪د┘╪╖╪ذ╪د╪╣╪ر ظ¤ ┘è┘┘à╪▒┘ّ┘╪▒ ╪ح┘┘ë @page ┘┘è printUtils */
  const [printLandscape, setPrintLandscape] = useState(false);

  const { employees } = useEmployees(companyId, { includeTerminated: true, fetchEnabled: !!companyId });
  const { allowances: customAllowances = [] } = useCustomAllowances(companyId);

  const emp = useMemo(() => employees.find((e: any) => e.id === employeeId), [employees, employeeId]);

  const customTotal = useMemo(() => {
    if (!emp) return 0;
    return sumCustomAllowancesForEmployee(customAllowances, emp.id);
  }, [emp, customAllowances]);

  const payrollTotal = useMemo(() => {
    let sum = n(payroll.basic) + n(payroll.housing) + n(payroll.transport) + n(payroll.other) + n(payroll.overtime);
    (payroll.customRows || []).forEach((r: any) => { sum += n(r.amount); });
    return sum;
  }, [payroll]);

  const annualSum = useMemo(() => {
    let s = 0;
    annual.monthOn.forEach((on: any, i: any) => {
      if (on) s += n(annual.amounts[i]);
    });
    return s;
  }, [annual]);

  const eosWageTotal =
    n(eos.basic) + n(eos.housing) + n(eos.transport) + n(eos.other) +
    (eos.customRows || []).reduce((s: any, r: any) => s + n(r.amount), 0);

  const importPayroll = useCallback(() => {
    if (!emp) return;
    const customRows = customAllowances
      .filter((a: any) => a.employeeId === emp.id)
      .map((a: any) => ({ key: a.id, label: a.nameAr || t('customAllowanceName'), amount: String(n(a.amount)) }));
    const tot =
      n(emp.basicSalary) + n(emp.housingAllowance) + n(emp.transportAllowance) + n(emp.otherAllowance) +
      overtimePay(emp, sumCustomAllowancesForEmployee(customAllowances, emp.id)) +
      customRows.reduce((a: any, r: any) => a + n(r.amount), 0);
    const totStr = String(Math.round(tot * 100) / 100);
    setPayroll({
      ...emptyPayrollDraft(),
      payrollFormat: payroll.payrollFormat,
      periodLabel: defaultPeriodLabel(lang),
      companyName: companyNameArDefault,
      companyNameEn: companyNameEnDefault,
      nameAr: String(emp.nameAr || emp.name || '').trim(),
      nameEn: String(emp.nameEn || '').trim(),
      employeeSerial: emp.employeeSerial || '',
      jobTitle: emp.jobTitle || '',
      iqama: emp.iqamaNumber || '',
      joinDate: emp.joinDate ? emp.joinDate.slice(0, 10) : '',
      letterStartDate: emp.joinDate ? emp.joinDate.slice(0, 10) : '',
      letterEndDate: '',
      declarationSalariesAr: DEFAULT_DECL_SALARY_AR,
      declarationSalariesEn: DEFAULT_DECL_SALARY_EN,
      basic: String(n(emp.basicSalary)),
      housing: String(n(emp.housingAllowance)),
      transport: String(n(emp.transportAllowance)),
      other: String(n(emp.otherAllowance)),
      overtime: String(overtimePay(emp, sumCustomAllowancesForEmployee(customAllowances, emp.id))),
      customRows,
      showBreakdown: true,
    });
    setAnnual((a: any) => ({
      year: a.year,
      monthOn: Array(12).fill(true),
      amounts: Array(12).fill(totStr),
      perMonthGross: totStr,
    }));
  }, [emp, customAllowances, companyNameArDefault, companyNameEnDefault, lang, t, payroll.payrollFormat]);

  const importEos = useCallback(() => {
    if (!emp) return;
    const customRows = customAllowances
      .filter((a: any) => a.employeeId === emp.id)
      .map((a: any) => ({ key: a.id, label: a.nameAr || t('customAllowanceName'), amount: String(n(a.amount)) }));
    const ct = sumCustomAllowancesForEmployee(customAllowances, emp.id);
    setEos({
      ...emptyEosDraft(),
      companyName: companyNameArDefault,
      companyNameEn: companyNameEnDefault,
      nameAr: String(emp.nameAr || emp.name || '').trim(),
      nameEn: String(emp.nameEn || '').trim(),
      employeeSerial: emp.employeeSerial || '',
      jobTitle: emp.jobTitle || '',
      iqama: emp.iqamaNumber || '',
      joinDate: emp.joinDate ? emp.joinDate.slice(0, 10) : '',
      basic: String(n(emp.basicSalary)),
      housing: String(n(emp.housingAllowance)),
      transport: String(n(emp.transportAllowance)),
      other: String(n(emp.otherAllowance)),
      customRows,
      settlementNotesAr:
        '╪ث┘é╪▒ ╪ث┘╪د ╪د┘┘à┘ê┘é╪╣ ╪ث╪»┘╪د┘ç ╪ذ╪ث┘┘┘è ╪د╪│╪ز┘┘à╪ز ┘â╪د┘╪ر ┘à╪│╪ز╪ص┘é╪د╪ز┘è ╪د┘┘╪╕╪د┘à┘è╪ر ┘à┘ ╪╡╪د╪ص╪ذ ╪د┘╪╣┘à┘╪î ┘ê╪ث╪ذ╪▒╪خ ╪░┘à╪ز┘ç ┘à┘ ╪ث┘è ┘à╪╖╪د┘╪ذ╪ر ┘╪د╪ص┘é╪ر ╪ز╪ز╪╣┘┘é ╪ذ╪╣┘é╪» ╪د┘╪╣┘à┘ ╪ث┘ê ┘┘ç╪د┘è╪ر ╪د┘╪«╪»┘à╪ر╪î ┘ê┘┘é ┘à╪د ┘ç┘ê ┘à╪ذ┘è┘ ╪ث╪╣┘╪د┘ç.',
      settlementNotesEn:
        'I, the undersigned, acknowledge receipt of all statutory dues from the employer and release the employer from any further claims relating to employment or end of service, as stated above.',
    });
  }, [emp, customAllowances, companyNameArDefault, companyNameEnDefault, t]);

  const fillAnnualWithMonthlyTotal = () => {
    const s = String(Math.round(payrollTotal * 100) / 100);
    setAnnual((a: any) => ({
      ...a,
      perMonthGross: s,
      amounts: a.amounts.map((_: any, i: any) => (a.monthOn[i] ? s : '')),
    }));
  };

  const hrPrintComposed = useMemo(
    () =>
      composeHrPrintDocument({
        docKind,
        payrollFormat: payroll.payrollFormat,
        logoUrl: companyLogoUrl,
        lang,
        payroll,
        annual,
        eos,
        companyNameArDefault,
        companyNameEnDefault,
        payrollTotal,
        annualSum,
        eosWageTotal,
        t,
      }),
    [
      docKind,
      payroll,
      annual,
      eos,
      lang,
      companyLogoUrl,
      companyNameArDefault,
      companyNameEnDefault,
      payrollTotal,
      annualSum,
      eosWageTotal,
      t,
    ],
  );

  const hrPrintPreviewSrcDoc = useMemo(() => {
    if (!hrPrintComposed.inner) return '';
    const wrapped = wrapHrPrintBody(hrPrintComposed.inner, printLandscape);
    return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet"><style>${HR_GEN_PRINT_CSS}</style></head><body style="margin:0;background:#e8eef5;padding:8px 6px">${wrapped}</body></html>`;
  }, [hrPrintComposed, printLandscape]);

  const runHrPrint = () => {
    if (hrPrintComposed.err === 'annual_empty') {
      window.alert(lang === 'ar' ? '┘╪╣┘ّ┘ ╪┤┘ç╪▒╪د┘ï ┘ê╪د╪ص╪»╪د┘ï ╪╣┘┘ë ╪د┘╪ث┘é┘ ┘┘╪╖╪ذ╪د╪╣╪ر.' : 'Enable at least one month to print.');
      return;
    }
    if (!hrPrintComposed.inner) return;
    openPrintWindow({
      title: hrPrintComposed.title,
      companyName: '',
      subtitle: '',
      landscape: printLandscape,
      extraCss: HR_GEN_PRINT_CSS,
      showPageCounter: false,
      /** ┘ç╪د┘à╪┤ ╪╢┘è┘é ┘╪د╪│╪ز╪║┘╪د┘ A4 ╪╡┘╪ص╪ر ┘ê╪د╪ص╪»╪ر ┘à╪╣ CSS ╪د┘╪╖╪ذ╪د╪╣╪ر ╪د┘┘à╪╢╪║┘ê╪╖ */
      pageMarginMm: printLandscape ? 5 : 4,
      body: wrapHrPrintBody(hrPrintComposed.inner, printLandscape),
    });
  };

  const updatePayroll = (patch: any) => setPayroll((p: any) => ({ ...p, ...patch }));
  const updateEos = (patch: any) => setEos((p: any) => ({ ...p, ...patch }));

  const addCustomRowPayroll = () => {
    setPayroll((p: any) => ({
      ...p,
      customRows: [...(p.customRows || []), { key: `n-${Date.now()}`, label: '', amount: '' }],
    }));
  };
  const addCustomRowEos = () => {
    setEos((p: any) => ({
      ...p,
      customRows: [...(p.customRows || []), { key: `n-${Date.now()}`, label: '', amount: '' }],
    }));
  };

  const monthShortAr = ['┘è┘╪د┘è╪▒', '┘╪ذ╪▒╪د┘è╪▒', '┘à╪د╪▒╪│', '╪ث╪ذ╪▒┘è┘', '┘à╪د┘è┘ê', '┘è┘ê┘┘è┘ê', '┘è┘ê┘┘è┘ê', '╪ث╪║╪│╪╖╪│', '╪│╪ذ╪ز┘à╪ذ╪▒', '╪ث┘â╪ز┘ê╪ذ╪▒', '┘┘ê┘┘à╪ذ╪▒', '╪»┘è╪│┘à╪ذ╪▒'];

  if (!companyId) {
    return <div className="noorix-surface-card p-5 text-center text-noorix-muted">{t('pleaseSelectCompany')}</div>;
  }

  return (
    <div className="noorix-surface-card p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="m-0 text-[17px] font-bold text-noorix-text">{t('hrTabPrintDocs')}</h3>
        <p className="mt-1.5 mb-0 text-[13px] text-noorix-muted">{t('hrTabPrintDocsDesc')}</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,36%)_minmax(0,64%)] xl:items-start 2xl:gap-6">
        <div className="min-w-0 max-w-lg space-y-4 sm:max-w-xl">
          <div className="flex flex-col gap-3 border-b border-noorix-border pb-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={docKind === 'payroll' ? 'primary' : 'ghost'} onClick={() => setDocKind('payroll')}>
                {t('hrPrintDocPayroll')}
              </Button>
              <Button type="button" size="sm" variant={docKind === 'eos' ? 'primary' : 'ghost'} onClick={() => setDocKind('eos')}>
                {t('hrPrintDocEos')}
              </Button>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-md sm:items-end">
              <div className="w-full sm:w-auto">
                <p className="m-0 mb-1.5 text-[11px] font-semibold text-noorix-text sm:text-end">{t('hrPrintOrientation')}</p>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button type="button" size="sm" variant={!printLandscape ? 'primary' : 'ghost'} onClick={() => setPrintLandscape(false)}>
                    {t('hrPrintOrientationPortrait')}
                  </Button>
                  <Button type="button" size="sm" variant={printLandscape ? 'primary' : 'ghost'} onClick={() => setPrintLandscape(true)}>
                    {t('hrPrintOrientationLandscape')}
                  </Button>
                </div>
              </div>
              <p className="m-0 text-[11px] leading-snug text-noorix-muted sm:text-end">{t('hrPrintOrientationHint')}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Input type="select" label={t('selectEmployee')} value={employeeId} onChange={(e: any) => setEmployeeId(e.target.value)}>
              <option value="">ظ¤</option>
              {employees.map((e: any) => (
                <option key={e.id} value={e.id}>{employeeDisplayName(e, lang, e.id)}</option>
              ))}
            </Input>
            <Button type="button" size="sm" variant="primary" disabled={!emp} onClick={docKind === 'payroll' ? importPayroll : importEos}>
              {t('hrPrintImportFromHr')}
            </Button>
          </div>

      {docKind === 'payroll' && (
        <div className="space-y-4 border-t border-noorix-border pt-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={payroll.payrollFormat === 'single' ? 'primary' : 'ghost'} onClick={() => updatePayroll({ payrollFormat: 'single' })}>
              {t('hrPrintFormatSingle')}
            </Button>
            <Button type="button" size="sm" variant={payroll.payrollFormat === 'annual' ? 'primary' : 'ghost'} onClick={() => updatePayroll({ payrollFormat: 'annual' })}>
              {t('hrPrintFormatAnnual')}
            </Button>
            <Button type="button" size="sm" variant={payroll.payrollFormat === 'salaryLetter' ? 'primary' : 'ghost'} onClick={() => updatePayroll({ payrollFormat: 'salaryLetter' })}>
              {t('hrPrintFormatSalaryLetter')}
            </Button>
          </div>

          <p className="m-0 text-[12px] font-semibold text-noorix-blue">{t('hrPrintPayrollSection')}</p>
          <div className="space-y-3 rounded-lg border border-noorix-border/80 bg-noorix-bg-muted/15 p-3 sm:p-4">
            <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-noorix-muted">{t('hrPrintSectionDocParty')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="text" label={t('hrPrintCompanyName')} value={payroll.companyName} onChange={(e: any) => updatePayroll({ companyName: e.target.value })} />
              <Input type="text" label={t('hrPrintCompanyNameEn')} value={payroll.companyNameEn} onChange={(e: any) => updatePayroll({ companyNameEn: e.target.value })} />
              <Input type="text" label={t('hrPrintNameAr')} value={payroll.nameAr} onChange={(e: any) => updatePayroll({ nameAr: e.target.value })} />
              <Input type="text" label={t('hrPrintNameEn')} value={payroll.nameEn} onChange={(e: any) => updatePayroll({ nameEn: e.target.value })} />
              <Input type="text" label={t('employeeSerial')} value={payroll.employeeSerial} onChange={(e: any) => updatePayroll({ employeeSerial: e.target.value })} />
              <Input type="text" label={t('jobTitle')} value={payroll.jobTitle} onChange={(e: any) => updatePayroll({ jobTitle: e.target.value })} />
              <Input type="text" label={t('iqamaNumber')} value={payroll.iqama} onChange={(e: any) => updatePayroll({ iqama: e.target.value })} />
              <Input type="date" label={t('joinDate')} value={payroll.joinDate} onChange={(e: any) => updatePayroll({ joinDate: e.target.value })} />
            </div>
          </div>

          {(payroll.payrollFormat === 'single' || payroll.payrollFormat === 'salaryLetter') && (
            <div className="space-y-3 rounded-lg border border-noorix-border/80 bg-noorix-bg-muted/15 p-3 sm:p-4">
              <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-noorix-muted">{t('hrPrintSectionPayPackage')}</p>
              <Input type="text" label={t('hrPrintPeriodLabel')} value={payroll.periodLabel} onChange={(e: any) => updatePayroll({ periodLabel: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Input type="text" inputMode="decimal" label={t('basicSalary')} value={payroll.basic} onChange={(e: any) => updatePayroll({ basic: e.target.value })} />
                <Input type="text" inputMode="decimal" label={t('housingAllowance')} value={payroll.housing} onChange={(e: any) => updatePayroll({ housing: e.target.value })} />
                <Input type="text" inputMode="decimal" label={t('transportAllowance')} value={payroll.transport} onChange={(e: any) => updatePayroll({ transport: e.target.value })} />
                <Input type="text" inputMode="decimal" label={t('otherAllowance')} value={payroll.other} onChange={(e: any) => updatePayroll({ other: e.target.value })} />
                <Input type="text" inputMode="decimal" label={lang === 'ar' ? '╪ث┘ê┘╪▒ ╪ز╪د┘è┘à (╪ز┘é╪»┘è╪▒ ╪┤┘ç╪▒┘è)' : 'Overtime (monthly est.)'} value={payroll.overtime} onChange={(e: any) => updatePayroll({ overtime: e.target.value })} />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
                <input type="checkbox" checked={payroll.showBreakdown} onChange={(e: any) => updatePayroll({ showBreakdown: e.target.checked })} className="h-4 w-4 accent-noorix-blue" />
                {t('hrPrintShowAllowanceDetail')}
              </label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold">{t('customAllowances')}</span>
                  <Button type="button" size="sm" variant="ghost" onClick={addCustomRowPayroll}>{t('addCustomAllowance')}</Button>
                </div>
                {(payroll.customRows || []).map((row: any, idx: any) => (
                  <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-center">
                    <Input type="text" label={t('customAllowanceName')} value={row.label} onChange={(e: any) => {
                      const next = [...(payroll.customRows || [])];
                      next[idx] = { ...row, label: e.target.value };
                      updatePayroll({ customRows: next });
                    }}
                    />
                    <Input type="text" inputMode="decimal" label={t('customAllowanceAmount')} value={row.amount} onChange={(e: any) => {
                      const next = [...(payroll.customRows || [])];
                      next[idx] = { ...row, amount: e.target.value };
                      updatePayroll({ customRows: next });
                    }}
                    />
                    <Button type="button" size="sm" variant="danger" onClick={() => updatePayroll({ customRows: payroll.customRows.filter((_: any, i: any) => i !== idx) })}>{t('delete')}</Button>
                  </div>
                ))}
              </div>
              <Input multiline rows={3} label={t('note')} value={payroll.notes} onChange={(e: any) => updatePayroll({ notes: e.target.value })} />
              <div className="flex items-center justify-between rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2">
                <span className="text-[13px] font-semibold">{t('totalSalary')}</span>
                <span className="nx-font-numbers text-[16px] font-bold"><FmtNum n={payrollTotal} /> <span className="nx-sar">SR</span></span>
              </div>
              {payroll.payrollFormat === 'salaryLetter' && (
                <div className="space-y-3 rounded-lg border border-dashed border-noorix-blue/30 bg-noorix-bg-muted/20 p-3 sm:p-4">
                  <p className="m-0 text-[12px] font-semibold text-noorix-text">{t('hrPrintFormatSalaryLetter')}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input type="date" label={t('hrPrintLetterStart')} value={payroll.letterStartDate} onChange={(e: any) => updatePayroll({ letterStartDate: e.target.value })} />
                    <Input type="date" label={t('hrPrintLetterEnd')} value={payroll.letterEndDate} onChange={(e: any) => updatePayroll({ letterEndDate: e.target.value })} />
                  </div>
                  <Input multiline rows={4} label={t('hrPrintSalaryLetterDeclAr')} value={payroll.declarationSalariesAr} onChange={(e: any) => updatePayroll({ declarationSalariesAr: e.target.value })} />
                  <Input multiline rows={4} label={t('hrPrintSalaryLetterDeclEn')} value={payroll.declarationSalariesEn} onChange={(e: any) => updatePayroll({ declarationSalariesEn: e.target.value })} />
                </div>
              )}
            </div>
          )}

          {payroll.payrollFormat === 'annual' && (
            <div className="space-y-3 rounded-lg border border-noorix-border/80 bg-noorix-bg-muted/15 p-3 sm:p-4">
              <p className="m-0 text-[13px] font-semibold text-noorix-text">{t('hrPrintAnnualSection')}</p>
              <div className="flex flex-wrap items-end gap-3">
                <Input type="number" label={t('hrPrintYear')} min={2000} max={2100} step={1} value={annual.year} onChange={(e: any) => setAnnual((a: any) => ({ ...a, year: Number(e.target.value) || a.year }))} className="w-[120px]" />
                <Button type="button" size="sm" variant="ghost" onClick={fillAnnualWithMonthlyTotal}>{t('hrPrintFillAllMonths')}</Button>
              </div>
              <p className="m-0 text-[11px] leading-relaxed text-noorix-muted">{t('hrPrintAnnualHint')}</p>
              <div>
                <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-wide text-noorix-muted">{t('hrPrintAnnualMonthsOnly')}</p>
                <div className="grid grid-cols-3 gap-x-2 gap-y-2 sm:grid-cols-4 md:grid-cols-6">
                  {monthShortAr.map((label: any, i: any) => (
                    <label key={label} className="flex cursor-pointer items-center gap-2 rounded-md border border-noorix-border/60 bg-white/80 px-2 py-1.5 text-[12px] shadow-sm">
                      <input
                        type="checkbox"
                        checked={annual.monthOn[i]}
                        onChange={(e: any) => {
                          const checked = e.target.checked;
                          setAnnual((a: any) => {
                            const monthOn = [...a.monthOn];
                            monthOn[i] = checked;
                            const g = String(a.perMonthGross ?? '').trim();
                            const amounts = a.amounts.map((amt: any, j: any) => {
                              if (!monthOn[j]) return '';
                              return g !== '' ? g : amt;
                            });
                            return { ...a, monthOn, amounts };
                          });
                        }}
                        className="h-4 w-4 shrink-0 accent-noorix-blue"
                      />
                      <span className="min-w-0 truncate">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Input
                type="text"
                inputMode="decimal"
                label={t('hrPrintAnnualPerMonthGross')}
                value={annual.perMonthGross ?? ''}
                onChange={(e: any) => {
                  const v = e.target.value;
                  setAnnual((a: any) => ({
                    ...a,
                    perMonthGross: v,
                    amounts: a.monthOn.map((on: any) => (on ? v : '')),
                  }));
                }}
              />
              <div className="flex items-center justify-between rounded-md border border-noorix-border bg-noorix-bg-muted/40 px-3 py-2 text-[14px] font-bold">
                <span>{t('hrPrintAnnualTotal')}</span>
                <span className="nx-font-numbers"><FmtNum n={annualSum} /> SR</span>
              </div>
            </div>
          )}
        </div>
      )}

      {docKind === 'eos' && (
        <div className="space-y-3 border-t border-noorix-border pt-4">
          <p className="m-0 text-[12px] font-semibold text-noorix-blue">{t('hrPrintEosSection')}</p>
          <p className="m-0 text-[11px] text-noorix-muted">{t('hrPrintEosLetterTitleHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="text" label={t('hrPrintCompanyName')} value={eos.companyName} onChange={(e: any) => updateEos({ companyName: e.target.value })} />
            <Input type="text" label={t('hrPrintCompanyNameEn')} value={eos.companyNameEn} onChange={(e: any) => updateEos({ companyNameEn: e.target.value })} />
            <Input type="text" label={t('hrPrintNameAr')} value={eos.nameAr} onChange={(e: any) => updateEos({ nameAr: e.target.value })} />
            <Input type="text" label={t('hrPrintNameEn')} value={eos.nameEn} onChange={(e: any) => updateEos({ nameEn: e.target.value })} />
            <Input type="text" label={t('employeeSerial')} value={eos.employeeSerial} onChange={(e: any) => updateEos({ employeeSerial: e.target.value })} />
            <Input type="text" label={t('jobTitle')} value={eos.jobTitle} onChange={(e: any) => updateEos({ jobTitle: e.target.value })} />
            <Input type="text" label={t('iqamaNumber')} value={eos.iqama} onChange={(e: any) => updateEos({ iqama: e.target.value })} />
            <Input type="date" label={t('joinDate')} value={eos.joinDate} onChange={(e: any) => updateEos({ joinDate: e.target.value })} />
            <Input type="date" label={lang === 'ar' ? '╪ز╪د╪▒┘è╪« ┘┘ç╪د┘è╪ر ╪د┘╪«╪»┘à╪ر' : 'End of service date'} value={eos.endDate} onChange={(e: any) => updateEos({ endDate: e.target.value })} />
          </div>
          <p className="m-0 text-[11px] text-noorix-muted">{t('hrPrintEosWageHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input type="text" inputMode="decimal" label={t('basicSalary')} value={eos.basic} onChange={(e: any) => updateEos({ basic: e.target.value })} />
            <Input type="text" inputMode="decimal" label={t('housingAllowance')} value={eos.housing} onChange={(e: any) => updateEos({ housing: e.target.value })} />
            <Input type="text" inputMode="decimal" label={t('transportAllowance')} value={eos.transport} onChange={(e: any) => updateEos({ transport: e.target.value })} />
            <Input type="text" inputMode="decimal" label={t('otherAllowance')} value={eos.other} onChange={(e: any) => updateEos({ other: e.target.value })} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold">{t('customAllowances')}</span>
              <Button type="button" size="sm" variant="ghost" onClick={addCustomRowEos}>{t('addCustomAllowance')}</Button>
            </div>
            {(eos.customRows || []).map((row: any, idx: any) => (
              <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-center">
                <Input type="text" value={row.label} onChange={(e: any) => {
                  const next = [...(eos.customRows || [])] as any[];
                  next[idx] = { ...row, label: e.target.value };
                  updateEos({ customRows: next });
                }}
                />
                <Input type="text" inputMode="decimal" value={row.amount} onChange={(e: any) => {
                  const next = [...(eos.customRows || [])] as any[];
                  next[idx] = { ...row, amount: e.target.value };
                  updateEos({ customRows: next });
                }}
                />
                <Button type="button" size="sm" variant="danger" onClick={() => updateEos({ customRows: eos.customRows.filter((_: any, i: any) => i !== idx) })}>{t('delete')}</Button>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="text" inputMode="decimal" label={t('hrPrintEosAmount')} value={eos.eosAmount} onChange={(e: any) => updateEos({ eosAmount: e.target.value })} />
            <Input type="text" inputMode="decimal" label={t('hrPrintOtherDues')} value={eos.otherAccrued} onChange={(e: any) => updateEos({ otherAccrued: e.target.value })} />
            <Input type="text" inputMode="decimal" label={t('hrPrintDeductions')} value={eos.deductions} onChange={(e: any) => updateEos({ deductions: e.target.value })} />
            <Input type="text" inputMode="decimal" label={t('hrPrintNetPayable')} value={eos.netPayable} onChange={(e: any) => updateEos({ netPayable: e.target.value })} />
          </div>
          <Input multiline rows={4} label={t('hrPrintSettlementTextAr')} value={eos.settlementNotesAr} onChange={(e: any) => updateEos({ settlementNotesAr: e.target.value })} />
          <Input multiline rows={4} label={t('hrPrintSettlementTextEn')} value={eos.settlementNotesEn} onChange={(e: any) => updateEos({ settlementNotesEn: e.target.value })} />
          <div className="text-[12px] text-noorix-muted">
            {t('hrPrintPackageTotal')}: <FmtNum n={eosWageTotal} /> SR
          </div>
        </div>
      )}
        </div>

        <aside className="min-w-0 space-y-3 rounded-xl border border-noorix-border bg-noorix-bg-muted/25 p-3 xl:sticky xl:top-4 xl:self-start">
          <p className="m-0 text-[13px] font-semibold text-noorix-text">{t('hrPrintPreview')}</p>
          <p className="m-0 text-[11px] leading-relaxed text-noorix-muted">{t('hrPrintPreviewNote')}</p>
          {hrPrintComposed.err === 'annual_empty' ? (
            <p className="m-0 rounded-lg border border-dashed border-noorix-border bg-noorix-bg-muted/50 p-4 text-center text-[12px] text-noorix-muted">{t('hrPrintPreviewEmpty')}</p>
          ) : (
            <iframe
              title={t('hrPrintPreview')}
              className="h-[min(72vh,560px)] w-full rounded-lg border border-noorix-border bg-white shadow-sm"
              srcDoc={hrPrintPreviewSrcDoc}
              sandbox="allow-same-origin"
            />
          )}
          <Button type="button" size="sm" variant="primary" className="w-full" disabled={!emp || !hrPrintComposed.inner} onClick={runHrPrint}>
            {t('print')}
          </Button>
        </aside>
      </div>
    </div>
  );
}
