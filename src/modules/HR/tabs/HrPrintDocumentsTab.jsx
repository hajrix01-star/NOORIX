/**
 * HrPrintDocumentsTab — طباعة مسير راتب ومخالصة (معزولة عن الحفظ في النظام).
 * تخطيط الطباعة مبني على نمط «مولّد المخالصة»: ترويسة زرقاء + ذهبي، شعار، شبكة بيانات، إقرار، توقيعات، تذييل.
 * أنواع: مسير شهر واحد، كشف رواتب سنوي (جدول)، خطاب استلام رواتب، خطاب استلام جميع المستحقات (نهاية خدمة).
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

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function n(v) {
  const x = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(x) ? x : 0;
}

function defaultPeriodLabel(lang) {
  return new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' });
}

function monthNameAr(m1to12) {
  return new Date(2000, m1to12 - 1, 1).toLocaleDateString('ar-SA', { month: 'long' });
}
function monthNameEn(m1to12) {
  return new Date(2000, m1to12 - 1, 1).toLocaleDateString('en-US', { month: 'long' });
}

function parseYmd(d) {
  if (!d || typeof d !== 'string') return null;
  const x = new Date(`${d.slice(0, 10)}T12:00:00`);
  return Number.isNaN(x.getTime()) ? null : x;
}

function formatDateLocale(d, loc) {
  const p = parseYmd(d);
  if (!p) return '—';
  return p.toLocaleDateString(loc, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function serviceDurationArEn(startStr, endStr) {
  const a = parseYmd(startStr);
  const b = parseYmd(endStr);
  if (!a || !b || b < a) return { ar: '—', en: '—' };
  const days = Math.max(0, Math.round((b - a) / 86400000));
  const mo = Math.floor(days / 30);
  const da = days % 30;
  return { ar: `${mo} شهر و ${da} يوم`, en: `${mo} month(s) and ${da} day(s)` };
}

function firstLastActiveMonthRange(monthOn, year) {
  let fi = -1;
  let li = -1;
  monthOn.forEach((on, i) => {
    if (on) {
      if (fi < 0) fi = i;
      li = i;
    }
  });
  if (fi < 0) return null;
  return {
    ar: `${monthNameAr(fi + 1)}–${monthNameAr(li + 1)} ${year}`,
    en: `${monthNameEn(fi + 1)}–${monthNameEn(li + 1)} ${year}`,
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
  slipTitle: 'Payroll slip — for review & signature',
  month: 'Month',
  empSig: 'Employee signature',
  emprSig: 'Employer / authorized signatory',
  totalYear: 'Year total',
  finalAck: 'Final acknowledgement — signatures',
};

const LABEL_EOS_EN = {
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

/** تنسيق وثيقة HR — صفحة A4 واحدة، عربي/إنجليزي، ألوان رسمية هادئة (مرجعية نظام عمل) */
const HR_SHEET_LEGAL_AR =
  'مرجع نظامي: نظام العمل الصادر بالمرسوم الملكي رقم (م/51) ولائحته التنفيذية — وثيقة توقيع إدارية لا تُحدّث السجلات المحاسبية آلياً.';
const HR_SHEET_LEGAL_EN =
  'Legal reference: Saudi Labor Law (Royal Decree M/51) and implementing regulations — administrative signature document; not an automated accounting payroll record.';

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
/* طباعة: ضغط ذكي لملاءمة A4 صفحة واحدة (عمودي أو عرضي) — بدون قص المحتوى المعتاد */
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

function wrapHrPrintBody(innerHtml, landscape) {
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

function safeImgSrc(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  return u.replace(/"/g, '%22').replace(/'/g, '%27');
}

function buildGenLogoInner(logoUrl) {
  const u = safeImgSrc(logoUrl);
  if (u.startsWith('http') || u.startsWith('data:image'))
    return `<img src="${u}" alt="" />`;
  return `<div class="gen-logo-placeholder">شعار<br/><span style="font-size:9px">Logo</span></div>`;
}

function buildGenHeader({ logoUrl, companyAr, companyEn, titleAr, titleEn, subtitleAr, subtitleEn }) {
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

function buildGenEmployeeStrip(displayName, iqama, jobTitle) {
  const n = esc(String(displayName || '').trim() || '—');
  const i = esc(String(iqama || '').trim() || '—');
  const j = esc(String(jobTitle || '').trim() || '—');
  return `
  <div class="doc-section-title"><span>بيانات الموظف</span><span class="doc-section-title-en">${esc(LABEL_PAYROLL_EN.employee)}</span></div>
  <div class="doc-emp-strip">
    <div class="doc-emp-cell"><span class="doc-emp-lbl">الاسم</span><span class="doc-emp-val">${n}</span></div>
    <div class="doc-emp-cell"><span class="doc-emp-lbl">الإقامة</span><span class="doc-emp-val">${i}</span></div>
    <div class="doc-emp-cell"><span class="doc-emp-lbl">المسمى</span><span class="doc-emp-val">${j}</span></div>
  </div>`;
}

function buildGenContractGrid(rows) {
  const cells = rows
    .map(
      (r) => `<div class="doc-info-cell">
      <span class="doc-info-label">${esc(r.labelAr)}<br/><span style="font-size:9px;font-weight:600;color:#94a3b8">${esc(r.labelEn)}</span></span>
      <span class="doc-info-value ${r.ltr ? 'v-ltr' : ''}" ${r.ltr ? 'dir="ltr"' : 'dir="rtl"'}>${esc(r.value)}</span>
    </div>`,
    )
    .join('');
  return `<div class="doc-info-grid">${cells}</div>`;
}

function buildGenContractBlock(titleAr, titleEn, rows) {
  return `
  <div class="doc-section-title"><span>${esc(titleAr)}</span><span class="doc-section-title-en">${esc(titleEn)}</span></div>
  ${buildGenContractGrid(rows)}`;
}

function buildGenDeclarationBlock(arText, enText) {
  const a = String(arText || '').trim();
  const e = String(enText || '').trim();
  if (!a && !e) return '';
  return `
  <div class="doc-section-title"><span>نص الإقرار</span><span class="doc-section-title-en">${esc(LABEL_LETTER_EN.declarationSection)}</span></div>
  <div class="doc-declaration">
    ${a ? `<p dir="rtl">${esc(a)}</p>` : ''}
    ${e ? `<p class="dec-en" dir="ltr">${esc(e)}</p>` : ''}
  </div>`;
}

function buildGenSignaturesBlock(empName, companyAr) {
  const e = esc(String(empName || '').trim() || '—');
  const c = esc(String(companyAr || '').trim() || '—');
  return `
  <div class="doc-section-title"><span>التوقيعات</span><span class="doc-section-title-en">${esc(LABEL_LETTER_EN.signaturesSection)}</span></div>
  <div class="doc-sig-grid">
    <div class="doc-sig-box">
      <div class="doc-sig-header">
        <div class="doc-sig-title-ar">توقيع الموظف</div>
        <div class="doc-sig-title-en">Employee signature</div>
      </div>
      <div class="doc-sig-space"></div>
      <div class="doc-sig-footer"><strong>${e}</strong>التاريخ: ____________________</div>
    </div>
    <div class="doc-sig-box">
      <div class="doc-sig-header">
        <div class="doc-sig-title-ar">ختم المنشأة وتوقيع المفوَّض</div>
        <div class="doc-sig-title-en">${esc(LABEL_LETTER_EN.stampSignatory)}</div>
      </div>
      <div class="doc-sig-space"></div>
      <div class="doc-sig-footer"><strong>${c}</strong>التاريخ: ____________________</div>
    </div>
  </div>`;
}

function buildGenFooter(issueDateStr, langIsAr) {
  const left = langIsAr
    ? 'هذا الخطاب وثيقة للاطلاع والتوقيع وفق نظام العمل السعودي (مرسوم م/51).'
    : 'Signature document under Saudi Labor Law (Royal Decree M/51).';
  const dlab = langIsAr ? 'تاريخ الإصدار' : 'Issue date';
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
    customRows: [],
    showBreakdown: true,
    notes: '',
    letterStartDate: '',
    letterEndDate: '',
    declarationSalariesAr: '',
    declarationSalariesEn: '',
  };
}

const DEFAULT_DECL_SALARY_AR =
  'أقر أنا الموقع أدناه بأنني استلمت رواتبي الشهرية كاملة دون أي حسم أو تأخير عن الفترة المحددة أعلاه، وأبرئ ذمة المنشأة من أي مطالبة متعلقة بالرواتب.';
const DEFAULT_DECL_SALARY_EN =
  'I, the undersigned, acknowledge that I have received all my monthly salaries in full, without any deduction or delay, for the period stated above, and I release the establishment from any claims relating to salaries.';

function emptyAnnual() {
  const y = new Date().getFullYear();
  return {
    year: y,
    monthOn: Array.from({ length: 12 }, () => true),
    amounts: Array.from({ length: 12 }, () => ''),
    /** مبلغ واحد لكل شهر مفعّل؛ إن فارغ يُستخدم amounts[i] */
    perMonthGross: '',
  };
}

/**
 * يبني HTML الوثيقة للطباعة والمعاينة (مصدر واحد لتفادي الاختلاف).
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
}) {
  const issueDate = new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  if (docKind === 'eos') {
    const coAr = eos.companyName || companyNameArDefault;
    const coEn = eos.companyNameEn || companyNameEnDefault;
    const nameDisp = [eos.nameEn, eos.nameAr].filter(Boolean).join(' / ') || '—';
    const dur = serviceDurationArEn(eos.joinDate, eos.endDate);
    const customLines = (eos.customRows || [])
      .map((r) => `${r.label || '—'}: ${hrFmt(n(r.amount))} SR`)
      .join('؛ ');
    const wageExtra = customLines ? ` (${customLines})` : '';
    const contractRows = [
      { labelAr: 'اسم الموظف', labelEn: LABEL_PAYROLL_EN.name, value: nameDisp, ltr: false },
      { labelAr: 'رقم الإقامة', labelEn: LABEL_PAYROLL_EN.iqama, value: eos.iqama || '—', ltr: false },
      { labelAr: 'تاريخ البدء', labelEn: LABEL_PAYROLL_EN.join, value: `${formatDateLocale(eos.joinDate, 'ar-SA')} / ${formatDateLocale(eos.joinDate, 'en-US')}`, ltr: true },
      { labelAr: 'تاريخ نهاية الخدمة', labelEn: LABEL_EOS_EN.endDate, value: `${formatDateLocale(eos.endDate, 'ar-SA')} / ${formatDateLocale(eos.endDate, 'en-US')}`, ltr: true },
      { labelAr: 'مدة الخدمة', labelEn: LABEL_LETTER_EN.serviceDuration, value: `${dur.ar} / ${dur.en}`, ltr: true },
      { labelAr: 'أجر آخر شهر (مجموع البدلات)', labelEn: LABEL_EOS_EN.wageTitle, value: `${hrFmt(eosWageTotal)} SR${wageExtra}`, ltr: false },
      { labelAr: 'مكافأة نهاية الخدمة', labelEn: LABEL_LETTER_EN.eosGratuity, value: `${hrFmt(n(eos.eosAmount))} SR`, ltr: true },
      { labelAr: 'مستحقات أخرى', labelEn: LABEL_EOS_EN.other, value: `${hrFmt(n(eos.otherAccrued))} SR`, ltr: true },
      { labelAr: 'خصومات', labelEn: LABEL_EOS_EN.ded, value: `${hrFmt(n(eos.deductions))} SR`, ltr: true },
      { labelAr: 'صافي المستحق', labelEn: LABEL_LETTER_EN.netPayable, value: `${hrFmt(n(eos.netPayable))} SR`, ltr: true },
      { labelAr: 'اسم المنشأة', labelEn: LABEL_LETTER_EN.establishment, value: `${coAr} / ${coEn}`, ltr: false },
    ];
    const head = buildGenHeader({
      logoUrl,
      companyAr: coAr,
      companyEn: coEn,
      titleAr: 'خطاب استلام جميع المستحقات',
      titleEn: LABEL_LETTER_EN.entitlementsLetterTitle,
      subtitleAr: formatDateLocale(eos.endDate, 'ar-SA'),
      subtitleEn: formatDateLocale(eos.endDate, 'en-US'),
    });
    const contract = buildGenContractBlock('بيانات العقد والتسوية', `${LABEL_LETTER_EN.contractSection} & settlement`, contractRows);
    const decl = buildGenDeclarationBlock(eos.settlementNotesAr, eos.settlementNotesEn);
    const sigs = buildGenSignaturesBlock(eos.nameAr || eos.nameEn, coAr);
    const foot = buildGenFooter(issueDate, lang === 'ar');
    const inner = `<div class="document">${head}<div class="doc-body">${contract}${decl}${sigs}</div>${foot}</div>`;
    return { inner, err: null, title: 'Full entitlements letter / خطاب استلام المستحقات' };
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
    const subAr = range ? `مسير رواتب ${range.ar}` : `السنة ${annual.year}`;
    const subEn = range ? `Payroll ${range.en}` : `Year ${annual.year}`;
    const head = buildGenHeader({
      logoUrl,
      companyAr: coAr,
      companyEn: coEn,
      titleAr: `كشف رواتب سنة ${annual.year}`,
      titleEn: `Annual Payroll Statement — ${annual.year}`,
      subtitleAr: subAr,
      subtitleEn: subEn,
    });
    const emp = buildGenEmployeeStrip(payroll.nameAr || payroll.nameEn, payroll.iqama, payroll.jobTitle);
    const table = `
    <div class="doc-section-title"><span>تفاصيل الرواتب</span><span class="doc-section-title-en">Salary breakdown</span></div>
    <table class="pr-table">
      <thead>
        <tr>
          <th>الشهر</th>
          <th>${esc(LABEL_LETTER_EN.grossSalary)}</th>
          <th>${esc(LABEL_LETTER_EN.receiptSigCol)}</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
      <tfoot>
        <tr>
          <td>الإجمالي السنوي / ${esc(LABEL_LETTER_EN.annualTotal)}</td>
          <td class="cell-amt">${esc(hrFmt(annualSum))} SR</td>
          <td></td>
        </tr>
      </tfoot>
    </table>`;
    const sigs = buildGenSignaturesBlock(payroll.nameAr || payroll.nameEn, coAr);
    const foot = buildGenFooter(issueDate, lang === 'ar');
    const inner = `<div class="document">${head}<div class="doc-body">${emp}${table}${sigs}</div>${foot}</div>`;
    return { inner, err: null, title: `Annual salary ${annual.year} / كشف سنوي ${annual.year}` };
  }

  if (payrollFormat === 'salaryLetter') {
    const dur = serviceDurationArEn(payroll.letterStartDate, payroll.letterEndDate);
    const coAr = payroll.companyName || companyNameArDefault;
    const coEn = payroll.companyNameEn || companyNameEnDefault;
    const nameDisp = [payroll.nameEn, payroll.nameAr].filter(Boolean).join(' / ') || '—';
    const contractRows = [
      { labelAr: 'اسم الموظف', labelEn: LABEL_PAYROLL_EN.name, value: nameDisp, ltr: false },
      { labelAr: 'رقم الإقامة', labelEn: LABEL_PAYROLL_EN.iqama, value: payroll.iqama || '—', ltr: false },
      { labelAr: 'تاريخ البدء', labelEn: LABEL_PAYROLL_EN.join, value: `${formatDateLocale(payroll.letterStartDate, 'ar-SA')} / ${formatDateLocale(payroll.letterStartDate, 'en-US')}`, ltr: true },
      { labelAr: 'تاريخ الإنهاء', labelEn: 'End date', value: `${formatDateLocale(payroll.letterEndDate, 'ar-SA')} / ${formatDateLocale(payroll.letterEndDate, 'en-US')}`, ltr: true },
      { labelAr: 'مدة الخدمة', labelEn: LABEL_LETTER_EN.serviceDuration, value: `${dur.ar} / ${dur.en}`, ltr: true },
      { labelAr: 'الراتب الشهري', labelEn: LABEL_LETTER_EN.monthlySalary, value: `${hrFmt(payrollTotal)} SR`, ltr: true },
      { labelAr: 'اسم المنشأة', labelEn: LABEL_LETTER_EN.establishment, value: `${coAr} / ${coEn}`, ltr: false },
    ];
    const head = buildGenHeader({
      logoUrl,
      companyAr: coAr,
      companyEn: coEn,
      titleAr: 'خطاب استلام الرواتب',
      titleEn: LABEL_LETTER_EN.salaryLetterTitle,
      subtitleAr: payroll.periodLabel || defaultPeriodLabel(lang),
      subtitleEn: payroll.periodLabel || defaultPeriodLabel(lang),
    });
    const contract = buildGenContractBlock('بيانات العقد', LABEL_LETTER_EN.contractSection, contractRows);
    const decl = buildGenDeclarationBlock(
      payroll.declarationSalariesAr || DEFAULT_DECL_SALARY_AR,
      payroll.declarationSalariesEn || DEFAULT_DECL_SALARY_EN,
    );
    const sigs = buildGenSignaturesBlock(payroll.nameAr || payroll.nameEn, coAr);
    const foot = buildGenFooter(issueDate, lang === 'ar');
    const inner = `<div class="document">${head}<div class="doc-body">${contract}${decl}${sigs}</div>${foot}</div>`;
    return { inner, err: null, title: 'Salary receipt letter / خطاب استلام الرواتب' };
  }

  const rowsAr = [];
  const rowsEn = [];
  const push = (ar, en, val) => {
    rowsAr.push(`<tr><td>${esc(ar)}</td><td class="td-num">${esc(hrFmt(val))} SR</td></tr>`);
    rowsEn.push(`<tr><td class="td-en">${esc(en)}</td><td class="td-num">${esc(hrFmt(val))} SR</td></tr>`);
  };
  push(t('basicSalary'), LABEL_PAYROLL_EN.basic, n(payroll.basic));
  push(t('housingAllowance'), LABEL_PAYROLL_EN.housing, n(payroll.housing));
  push(t('transportAllowance'), LABEL_PAYROLL_EN.transport, n(payroll.transport));
  push(t('otherAllowance'), LABEL_PAYROLL_EN.other, n(payroll.other));
  push('تقدير الأوفر تايم (شهري)', LABEL_PAYROLL_EN.overtime, n(payroll.overtime));
  if (payroll.showBreakdown) {
    (payroll.customRows || []).forEach((r) => push(r.label || '—', r.label || LABEL_PAYROLL_EN.custom, n(r.amount)));
  } else {
    const csum = (payroll.customRows || []).reduce((s, r) => s + n(r.amount), 0);
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
    titleAr: `مسير راتب — ${payroll.nameAr || payroll.nameEn || ''}`.trim(),
    titleEn: LABEL_PAYROLL_EN.slipTitle,
    subtitleAr: `${payroll.periodLabel} — ${coAr}`,
    subtitleEn: `${payroll.periodLabel} — ${coEn}`,
  });
  const empStrip = buildGenEmployeeStrip(payroll.nameAr || payroll.nameEn, payroll.iqama, payroll.jobTitle);
  const detail = `
    <div class="doc-section-title"><span>تفاصيل الراتب للفترة</span><span class="doc-section-title-en">Salary breakdown</span></div>
    <div class="gen-breakdown">
      <div dir="rtl">
        <table class="doc-table"><tbody>
          <tr><td>${esc(t('employeeSerial'))}</td><td>${esc(payroll.employeeSerial)}</td></tr>
          <tr><td>${esc(t('joinDate'))}</td><td>${esc(formatDateLocale(payroll.joinDate, 'ar-SA'))}</td></tr>
        </tbody></table>
        <table class="doc-table"><thead><tr><th>البند</th><th>المبلغ</th></tr></thead><tbody>${rowsAr.join('')}</tbody>
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
  return { inner, err: null, title: 'Payroll slip / مسير راتب' };
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
  const company = companies?.find((c) => c.id === companyId);
  const companyNameArDefault = company?.nameAr || company?.name || '';
  const companyNameEnDefault = company?.nameEn || company?.nameAr || company?.name || '';
  const companyLogoUrl = String(company?.logoUrl || getBrandLogo() || '').trim();

  const [docKind, setDocKind] = useState('payroll');
  const [employeeId, setEmployeeId] = useState('');
  const [payroll, setPayroll] = useState(emptyPayrollDraft);
  const [annual, setAnnual] = useState(emptyAnnual);
  const [eos, setEos] = useState(emptyEosDraft);
  /** اتجاه صفحة الطباعة — يُمرَّر إلى @page في printUtils */
  const [printLandscape, setPrintLandscape] = useState(false);

  const { employees } = useEmployees(companyId, { includeTerminated: true, fetchEnabled: !!companyId });
  const { allowances: customAllowances = [] } = useCustomAllowances(companyId);

  const emp = useMemo(() => employees.find((e) => e.id === employeeId), [employees, employeeId]);

  const customTotal = useMemo(() => {
    if (!emp) return 0;
    return sumCustomAllowancesForEmployee(customAllowances, emp.id);
  }, [emp, customAllowances]);

  const payrollTotal = useMemo(() => {
    let sum = n(payroll.basic) + n(payroll.housing) + n(payroll.transport) + n(payroll.other) + n(payroll.overtime);
    (payroll.customRows || []).forEach((r) => { sum += n(r.amount); });
    return sum;
  }, [payroll]);

  const annualSum = useMemo(() => {
    let s = 0;
    annual.monthOn.forEach((on, i) => {
      if (on) s += n(annual.amounts[i]);
    });
    return s;
  }, [annual]);

  const eosWageTotal =
    n(eos.basic) + n(eos.housing) + n(eos.transport) + n(eos.other) +
    (eos.customRows || []).reduce((s, r) => s + n(r.amount), 0);

  const importPayroll = useCallback(() => {
    if (!emp) return;
    const customRows = customAllowances
      .filter((a) => a.employeeId === emp.id)
      .map((a) => ({ key: a.id, label: a.nameAr || t('customAllowanceName'), amount: String(n(a.amount)) }));
    const tot =
      n(emp.basicSalary) + n(emp.housingAllowance) + n(emp.transportAllowance) + n(emp.otherAllowance) +
      overtimePay(emp, sumCustomAllowancesForEmployee(customAllowances, emp.id)) +
      customRows.reduce((a, r) => a + n(r.amount), 0);
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
    setAnnual((a) => ({
      year: a.year,
      monthOn: Array(12).fill(true),
      amounts: Array(12).fill(totStr),
      perMonthGross: totStr,
    }));
  }, [emp, customAllowances, companyNameArDefault, companyNameEnDefault, lang, t, payroll.payrollFormat]);

  const importEos = useCallback(() => {
    if (!emp) return;
    const customRows = customAllowances
      .filter((a) => a.employeeId === emp.id)
      .map((a) => ({ key: a.id, label: a.nameAr || t('customAllowanceName'), amount: String(n(a.amount)) }));
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
        'أقر أنا الموقع أدناه بأنني استلمت كافة مستحقاتي النظامية من صاحب العمل، وأبرئ ذمته من أي مطالبة لاحقة تتعلق بعقد العمل أو نهاية الخدمة، وفق ما هو مبين أعلاه.',
      settlementNotesEn:
        'I, the undersigned, acknowledge receipt of all statutory dues from the employer and release the employer from any further claims relating to employment or end of service, as stated above.',
    });
  }, [emp, customAllowances, companyNameArDefault, companyNameEnDefault, t]);

  const fillAnnualWithMonthlyTotal = () => {
    const s = String(Math.round(payrollTotal * 100) / 100);
    setAnnual((a) => ({
      ...a,
      perMonthGross: s,
      amounts: a.amounts.map((_, i) => (a.monthOn[i] ? s : '')),
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
      window.alert(lang === 'ar' ? 'فعّل شهراً واحداً على الأقل للطباعة.' : 'Enable at least one month to print.');
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
      /** هامش ضيق لاستغلال A4 صفحة واحدة مع CSS الطباعة المضغوط */
      pageMarginMm: printLandscape ? 5 : 4,
      body: wrapHrPrintBody(hrPrintComposed.inner, printLandscape),
    });
  };

  const updatePayroll = (patch) => setPayroll((p) => ({ ...p, ...patch }));
  const updateEos = (patch) => setEos((p) => ({ ...p, ...patch }));

  const addCustomRowPayroll = () => {
    setPayroll((p) => ({
      ...p,
      customRows: [...(p.customRows || []), { key: `n-${Date.now()}`, label: '', amount: '' }],
    }));
  };
  const addCustomRowEos = () => {
    setEos((p) => ({
      ...p,
      customRows: [...(p.customRows || []), { key: `n-${Date.now()}`, label: '', amount: '' }],
    }));
  };

  const monthShortAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

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
            <Input type="select" label={t('selectEmployee')} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">—</option>
              {employees.map((e) => (
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
              <Input type="text" label={t('hrPrintCompanyName')} value={payroll.companyName} onChange={(e) => updatePayroll({ companyName: e.target.value })} />
              <Input type="text" label={t('hrPrintCompanyNameEn')} value={payroll.companyNameEn} onChange={(e) => updatePayroll({ companyNameEn: e.target.value })} />
              <Input type="text" label={t('hrPrintNameAr')} value={payroll.nameAr} onChange={(e) => updatePayroll({ nameAr: e.target.value })} />
              <Input type="text" label={t('hrPrintNameEn')} value={payroll.nameEn} onChange={(e) => updatePayroll({ nameEn: e.target.value })} />
              <Input type="text" label={t('employeeSerial')} value={payroll.employeeSerial} onChange={(e) => updatePayroll({ employeeSerial: e.target.value })} />
              <Input type="text" label={t('jobTitle')} value={payroll.jobTitle} onChange={(e) => updatePayroll({ jobTitle: e.target.value })} />
              <Input type="text" label={t('iqamaNumber')} value={payroll.iqama} onChange={(e) => updatePayroll({ iqama: e.target.value })} />
              <Input type="date" label={t('joinDate')} value={payroll.joinDate} onChange={(e) => updatePayroll({ joinDate: e.target.value })} />
            </div>
          </div>

          {(payroll.payrollFormat === 'single' || payroll.payrollFormat === 'salaryLetter') && (
            <div className="space-y-3 rounded-lg border border-noorix-border/80 bg-noorix-bg-muted/15 p-3 sm:p-4">
              <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-noorix-muted">{t('hrPrintSectionPayPackage')}</p>
              <Input type="text" label={t('hrPrintPeriodLabel')} value={payroll.periodLabel} onChange={(e) => updatePayroll({ periodLabel: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Input type="text" inputMode="decimal" label={t('basicSalary')} value={payroll.basic} onChange={(e) => updatePayroll({ basic: e.target.value })} />
                <Input type="text" inputMode="decimal" label={t('housingAllowance')} value={payroll.housing} onChange={(e) => updatePayroll({ housing: e.target.value })} />
                <Input type="text" inputMode="decimal" label={t('transportAllowance')} value={payroll.transport} onChange={(e) => updatePayroll({ transport: e.target.value })} />
                <Input type="text" inputMode="decimal" label={t('otherAllowance')} value={payroll.other} onChange={(e) => updatePayroll({ other: e.target.value })} />
                <Input type="text" inputMode="decimal" label={lang === 'ar' ? 'أوفر تايم (تقدير شهري)' : 'Overtime (monthly est.)'} value={payroll.overtime} onChange={(e) => updatePayroll({ overtime: e.target.value })} />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
                <input type="checkbox" checked={payroll.showBreakdown} onChange={(e) => updatePayroll({ showBreakdown: e.target.checked })} className="h-4 w-4 accent-noorix-blue" />
                {t('hrPrintShowAllowanceDetail')}
              </label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold">{t('customAllowances')}</span>
                  <Button type="button" size="sm" variant="ghost" onClick={addCustomRowPayroll}>{t('addCustomAllowance')}</Button>
                </div>
                {(payroll.customRows || []).map((row, idx) => (
                  <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-center">
                    <Input type="text" label={t('customAllowanceName')} value={row.label} onChange={(e) => {
                      const next = [...payroll.customRows];
                      next[idx] = { ...row, label: e.target.value };
                      updatePayroll({ customRows: next });
                    }}
                    />
                    <Input type="text" inputMode="decimal" label={t('customAllowanceAmount')} value={row.amount} onChange={(e) => {
                      const next = [...payroll.customRows];
                      next[idx] = { ...row, amount: e.target.value };
                      updatePayroll({ customRows: next });
                    }}
                    />
                    <Button type="button" size="sm" variant="danger" onClick={() => updatePayroll({ customRows: payroll.customRows.filter((_, i) => i !== idx) })}>{t('delete')}</Button>
                  </div>
                ))}
              </div>
              <Input multiline rows={3} label={t('note')} value={payroll.notes} onChange={(e) => updatePayroll({ notes: e.target.value })} />
              <div className="flex items-center justify-between rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2">
                <span className="text-[13px] font-semibold">{t('totalSalary')}</span>
                <span className="nx-font-numbers text-[16px] font-bold"><FmtNum n={payrollTotal} /> <span className="nx-sar">SR</span></span>
              </div>
              {payroll.payrollFormat === 'salaryLetter' && (
                <div className="space-y-3 rounded-lg border border-dashed border-noorix-blue/30 bg-noorix-bg-muted/20 p-3 sm:p-4">
                  <p className="m-0 text-[12px] font-semibold text-noorix-text">{t('hrPrintFormatSalaryLetter')}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input type="date" label={t('hrPrintLetterStart')} value={payroll.letterStartDate} onChange={(e) => updatePayroll({ letterStartDate: e.target.value })} />
                    <Input type="date" label={t('hrPrintLetterEnd')} value={payroll.letterEndDate} onChange={(e) => updatePayroll({ letterEndDate: e.target.value })} />
                  </div>
                  <Input multiline rows={4} label={t('hrPrintSalaryLetterDeclAr')} value={payroll.declarationSalariesAr} onChange={(e) => updatePayroll({ declarationSalariesAr: e.target.value })} />
                  <Input multiline rows={4} label={t('hrPrintSalaryLetterDeclEn')} value={payroll.declarationSalariesEn} onChange={(e) => updatePayroll({ declarationSalariesEn: e.target.value })} />
                </div>
              )}
            </div>
          )}

          {payroll.payrollFormat === 'annual' && (
            <div className="space-y-3 rounded-lg border border-noorix-border/80 bg-noorix-bg-muted/15 p-3 sm:p-4">
              <p className="m-0 text-[13px] font-semibold text-noorix-text">{t('hrPrintAnnualSection')}</p>
              <div className="flex flex-wrap items-end gap-3">
                <Input type="number" label={t('hrPrintYear')} min={2000} max={2100} step={1} value={annual.year} onChange={(e) => setAnnual((a) => ({ ...a, year: Number(e.target.value) || a.year }))} className="w-[120px]" />
                <Button type="button" size="sm" variant="ghost" onClick={fillAnnualWithMonthlyTotal}>{t('hrPrintFillAllMonths')}</Button>
              </div>
              <p className="m-0 text-[11px] leading-relaxed text-noorix-muted">{t('hrPrintAnnualHint')}</p>
              <div>
                <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-wide text-noorix-muted">{t('hrPrintAnnualMonthsOnly')}</p>
                <div className="grid grid-cols-3 gap-x-2 gap-y-2 sm:grid-cols-4 md:grid-cols-6">
                  {monthShortAr.map((label, i) => (
                    <label key={label} className="flex cursor-pointer items-center gap-2 rounded-md border border-noorix-border/60 bg-white/80 px-2 py-1.5 text-[12px] shadow-sm">
                      <input
                        type="checkbox"
                        checked={annual.monthOn[i]}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setAnnual((a) => {
                            const monthOn = [...a.monthOn];
                            monthOn[i] = checked;
                            const g = String(a.perMonthGross ?? '').trim();
                            const amounts = a.amounts.map((amt, j) => {
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
                onChange={(e) => {
                  const v = e.target.value;
                  setAnnual((a) => ({
                    ...a,
                    perMonthGross: v,
                    amounts: a.monthOn.map((on) => (on ? v : '')),
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
            <Input type="text" label={t('hrPrintCompanyName')} value={eos.companyName} onChange={(e) => updateEos({ companyName: e.target.value })} />
            <Input type="text" label={t('hrPrintCompanyNameEn')} value={eos.companyNameEn} onChange={(e) => updateEos({ companyNameEn: e.target.value })} />
            <Input type="text" label={t('hrPrintNameAr')} value={eos.nameAr} onChange={(e) => updateEos({ nameAr: e.target.value })} />
            <Input type="text" label={t('hrPrintNameEn')} value={eos.nameEn} onChange={(e) => updateEos({ nameEn: e.target.value })} />
            <Input type="text" label={t('employeeSerial')} value={eos.employeeSerial} onChange={(e) => updateEos({ employeeSerial: e.target.value })} />
            <Input type="text" label={t('jobTitle')} value={eos.jobTitle} onChange={(e) => updateEos({ jobTitle: e.target.value })} />
            <Input type="text" label={t('iqamaNumber')} value={eos.iqama} onChange={(e) => updateEos({ iqama: e.target.value })} />
            <Input type="date" label={t('joinDate')} value={eos.joinDate} onChange={(e) => updateEos({ joinDate: e.target.value })} />
            <Input type="date" label={lang === 'ar' ? 'تاريخ نهاية الخدمة' : 'End of service date'} value={eos.endDate} onChange={(e) => updateEos({ endDate: e.target.value })} />
          </div>
          <p className="m-0 text-[11px] text-noorix-muted">{t('hrPrintEosWageHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input type="text" inputMode="decimal" label={t('basicSalary')} value={eos.basic} onChange={(e) => updateEos({ basic: e.target.value })} />
            <Input type="text" inputMode="decimal" label={t('housingAllowance')} value={eos.housing} onChange={(e) => updateEos({ housing: e.target.value })} />
            <Input type="text" inputMode="decimal" label={t('transportAllowance')} value={eos.transport} onChange={(e) => updateEos({ transport: e.target.value })} />
            <Input type="text" inputMode="decimal" label={t('otherAllowance')} value={eos.other} onChange={(e) => updateEos({ other: e.target.value })} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold">{t('customAllowances')}</span>
              <Button type="button" size="sm" variant="ghost" onClick={addCustomRowEos}>{t('addCustomAllowance')}</Button>
            </div>
            {(eos.customRows || []).map((row, idx) => (
              <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-center">
                <Input type="text" value={row.label} onChange={(e) => {
                  const next = [...eos.customRows];
                  next[idx] = { ...row, label: e.target.value };
                  updateEos({ customRows: next });
                }}
                />
                <Input type="text" inputMode="decimal" value={row.amount} onChange={(e) => {
                  const next = [...eos.customRows];
                  next[idx] = { ...row, amount: e.target.value };
                  updateEos({ customRows: next });
                }}
                />
                <Button type="button" size="sm" variant="danger" onClick={() => updateEos({ customRows: eos.customRows.filter((_, i) => i !== idx) })}>{t('delete')}</Button>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="text" inputMode="decimal" label={t('hrPrintEosAmount')} value={eos.eosAmount} onChange={(e) => updateEos({ eosAmount: e.target.value })} />
            <Input type="text" inputMode="decimal" label={t('hrPrintOtherDues')} value={eos.otherAccrued} onChange={(e) => updateEos({ otherAccrued: e.target.value })} />
            <Input type="text" inputMode="decimal" label={t('hrPrintDeductions')} value={eos.deductions} onChange={(e) => updateEos({ deductions: e.target.value })} />
            <Input type="text" inputMode="decimal" label={t('hrPrintNetPayable')} value={eos.netPayable} onChange={(e) => updateEos({ netPayable: e.target.value })} />
          </div>
          <Input multiline rows={4} label={t('hrPrintSettlementTextAr')} value={eos.settlementNotesAr} onChange={(e) => updateEos({ settlementNotesAr: e.target.value })} />
          <Input multiline rows={4} label={t('hrPrintSettlementTextEn')} value={eos.settlementNotesEn} onChange={(e) => updateEos({ settlementNotesEn: e.target.value })} />
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
