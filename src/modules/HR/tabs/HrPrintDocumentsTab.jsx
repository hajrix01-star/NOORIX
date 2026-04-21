/**
 * HrPrintDocumentsTab — طباعة مسير راتب ومخالصة (معزولة عن الحفظ في النظام).
 * يدعم: مسير شهر واحد، جدول شهري (سنة / أشهر مختارة) مع توقيع لكل صف، وطباعة عربي/إنجليزي.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { useEmployees } from '../../../hooks/useEmployees';
import { useCustomAllowances } from '../../../hooks/useCustomAllowances';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { openPrintWindow } from '../../../utils/printUtils';
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

const HR_SHEET_CSS = `
.hr-sheet{--ink:#0f172a;--muted:#475569;--line:#94a3b8;--hdr:#0f3d2f;--hdr-light:#ecfdf5;max-width:100%}
.hr-sheet .doc{border:1px solid var(--line);border-radius:2px;background:#fff;overflow:hidden;box-shadow:none}
.hr-sheet .legal-ref{font-size:6.5pt;line-height:1.35;color:#64748b;text-align:center;padding:2px 6px 4px;border-bottom:1px dotted var(--line);margin:0}
.hr-sheet .legal-ref-en{margin-top:2px;font-size:6pt;color:#64748b}
.hr-sheet .doc-table .th-sub{display:block;font-weight:500;font-size:6.5pt;line-height:1.2;margin-top:1px;opacity:.95}
.hr-sheet .doc-table col.col-n{width:5%}
.hr-sheet .doc-table col.col-mid-ar{width:24%}
.hr-sheet .doc-table col.col-mid-en{width:24%}
.hr-sheet .doc-table col.col-amt{width:14%}
.hr-sheet .doc-table col.col-sig{width:33%}
.hr-sheet .doc-h{padding:5px 8px 4px;background:linear-gradient(180deg,var(--hdr-light) 0%,#f8fafc 100%);border-bottom:2px solid var(--hdr)}
.hr-sheet .doc-h .ttl{margin:0;font-weight:800;color:var(--hdr);letter-spacing:-0.02em;line-height:1.2}
.hr-sheet .doc-h .sub{margin-top:2px;font-weight:600;color:var(--muted);line-height:1.25}
.hr-sheet .doc-b{padding:5px 8px 4px}
.hr-sheet .bi-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:start}
.hr-sheet .bi-col{border:1px solid var(--line);border-radius:3px;padding:5px 7px;background:#fff}
.hr-sheet .bi-col h4{margin:0 0 3px;font-size:7.5pt;font-weight:800;color:var(--hdr);padding-bottom:2px;border-bottom:1px solid var(--line)}
.hr-sheet .doc-table{width:100%;border-collapse:collapse;margin:0 0 5px;table-layout:fixed;font-size:7.5pt}
.hr-sheet .doc-table th,.hr-sheet .doc-table td{border:1px solid var(--line);padding:2px 4px;text-align:right;vertical-align:middle;word-wrap:break-word}
.hr-sheet .doc-table thead th{background:var(--hdr);color:#fff;font-weight:700}
.hr-sheet .doc-table tbody tr:nth-child(even) td{background:#f8fafc}
.hr-sheet .doc-table tfoot td{font-weight:700;background:#e2e8f0}
.hr-sheet .doc-table .td-num,.hr-sheet .doc-table .td-center{text-align:center;font-weight:600}
.hr-sheet .doc-table .td-en{text-align:left;direction:ltr}
.hr-sheet .doc-table .td-amt-blue{color:#2c5282;font-weight:800}
.hr-sheet .doc-note{white-space:pre-wrap;font-size:6.5pt;line-height:1.3;color:#334155;margin:3px 0;padding:3px 4px;background:#fafafa;border:1px dashed var(--line)}
.hr-sheet .sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:5px;padding-top:3px}
.hr-sheet .sign-box{text-align:center;border-top:1.5px solid var(--ink);padding-top:2px;font-size:7pt;font-weight:700;color:var(--muted)}
.hr-sheet .sig-line{min-height:14px;border-bottom:1px dashed #64748b;margin-top:1px}
.hr-sheet .final-sign{margin-top:4px;padding:5px;border:1px solid var(--line);border-radius:3px;background:#f1f5f9;page-break-inside:avoid}
.hr-sheet .final-sign .ttl{font-weight:800;font-size:7.5pt;margin-bottom:3px;color:var(--ink)}
.hr-sheet .final-sig-line{min-height:18px}
.hr-sheet .final-sign-name{font-size:6.5pt;color:#64748b;margin-top:2px;line-height:1.2}
.hr-sheet.hr-sheet--landscape .doc-h .ttl{font-size:11pt}
.hr-sheet.hr-sheet--landscape .doc-h .sub{font-size:8pt}
.hr-sheet.hr-sheet--portrait .doc-h .ttl{font-size:10pt}
.hr-sheet.hr-sheet--portrait .doc-h .sub{font-size:7.5pt}
.hr-sheet.hr-sheet--portrait .doc-table{font-size:7pt}
.hr-sheet.hr-sheet--portrait .doc-table th,.hr-sheet.hr-sheet--portrait .doc-table td{padding:1px 3px}
.hr-sheet .tpl-doc{color:#0a0a0a}
.hr-sheet .tpl-topbar{position:relative;padding:4px 0 6px;text-align:center}
.hr-sheet .tpl-logo-ph{position:absolute;top:0;inset-inline-end:0;font-size:7pt;color:#64748b;border:1px dashed #cbd5e1;padding:4px 8px;min-width:52px}
.hr-sheet .tpl-logo-en{font-size:6.5pt;opacity:.85}
.hr-sheet .tpl-co-ar{font-size:11pt;font-weight:800;margin:0;padding-inline-end:72px}
.hr-sheet .tpl-co-en{font-size:8.5pt;font-weight:600;color:#334155;margin-top:2px;padding-inline-end:72px}
.hr-sheet .tpl-gold-line{height:2px;background:linear-gradient(90deg,transparent,#c9a227,#c9a227,transparent);max-width:220px;margin:4px auto 6px;border-radius:1px}
.hr-sheet .tpl-title{margin:0;font-size:12pt;font-weight:800;line-height:1.2}
.hr-sheet .tpl-title-en{margin:2px 0 0;font-size:10pt;font-weight:700;line-height:1.2;color:#0f172a}
.hr-sheet .tpl-sub-rtl{margin:3px 0 0;font-size:8.5pt;color:#475569;font-weight:600}
.hr-sheet .tpl-sub-ltr{margin:2px 0 0;font-size:8pt;color:#475569}
.hr-sheet .tpl-bar-thick{height:3px;background:#111827;margin:6px 0 8px;border-radius:1px}
.hr-sheet .tpl-sec{border:1px solid #e2e8f0;margin:0 0 6px;background:#fff;page-break-inside:avoid}
.hr-sheet .tpl-sec-h{background:#f1f5f9;border-bottom:1px solid #e2e8f0;padding:4px 8px;font-size:8.5pt;font-weight:800;color:#0f172a;text-align:right}
.hr-sheet .tpl-sec-h-en{display:block;font-size:7pt;font-weight:600;color:#475569;margin-top:1px;text-align:left;direction:ltr}
.hr-sheet .tpl-kvgrid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:6px 8px}
.hr-sheet .tpl-cell{display:flex;flex-direction:column;align-items:stretch;text-align:right;gap:2px;border:1px solid #e8ecf1;padding:4px 6px;border-radius:2px;background:#fff}
.hr-sheet .tpl-lbl{font-size:7pt;font-weight:700;color:#2c5282}
.hr-sheet .tpl-val{font-size:8.5pt;font-weight:800;color:#0a0a0a;word-break:break-word}
.hr-sheet .tpl-contract{width:100%;border-collapse:collapse;font-size:7.5pt;margin:0}
.hr-sheet .tpl-contract td,.hr-sheet .tpl-contract th{border:1px solid #e2e8f0;padding:3px 6px;vertical-align:middle}
.hr-sheet .tpl-contract .c-lbl{background:#f8fafc;font-weight:700;color:#0f172a;width:34%;text-align:right}
.hr-sheet .tpl-contract .c-val{text-align:left;direction:ltr;font-weight:600;color:#0f172a}
.hr-sheet .tpl-contract .c-val-rtl{text-align:right;direction:rtl;font-weight:700;color:#0f172a}
.hr-sheet .tpl-contract tr:nth-child(even) .c-lbl{background:#eef2f7}
.hr-sheet .tpl-declare{border:1px solid #cbd5e1;background:#f8fafc;padding:6px 8px;margin:0 0 6px;page-break-inside:avoid}
.hr-sheet .tpl-declare .d-ar{font-size:7.5pt;line-height:1.45;text-align:right;margin:0 0 5px}
.hr-sheet .tpl-declare .d-en{font-size:7pt;line-height:1.4;color:#334155;text-align:left;direction:ltr;margin:0}
.hr-sheet .tpl-sign-sec-h{font-size:8.5pt;font-weight:800;margin:4px 0 4px;text-align:right}
.hr-sheet .tpl-sig2{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:2px}
.hr-sheet .tpl-sigbox{border:1px solid #1e293b;min-height:52mm;display:flex;flex-direction:column;padding:5px 6px;background:#fff;page-break-inside:avoid}
.hr-sheet .tpl-sigbox-h{font-size:8pt;font-weight:800;text-align:center;margin-bottom:4px;line-height:1.25}
.hr-sheet .tpl-sigbox-h-en{display:block;font-size:6.5pt;font-weight:600;color:#475569;margin-top:2px}
.hr-sheet .tpl-sigbox-body{flex:1;min-height:22mm;border:1px dashed #cbd5e1;margin:2px 0;border-radius:2px;background:#fff}
.hr-sheet .tpl-sigbox-foot{font-size:7.5pt;font-weight:700;text-align:center;margin-top:auto;padding-top:4px;color:#0f172a}
.hr-sheet .tpl-date-line{margin-top:3px;font-size:7pt;color:#475569;font-weight:600}
.hr-sheet .annual-ar-table{width:100%;border-collapse:collapse;font-size:8pt;table-layout:fixed;margin:0 0 6px}
.hr-sheet .annual-ar-table th,.hr-sheet .annual-ar-table td{border:1px solid #e2e8f0;padding:3px 5px;text-align:center;vertical-align:middle}
.hr-sheet .annual-ar-table thead th{background:#f1f5f9;font-weight:800;color:#0f172a}
.hr-sheet .annual-ar-table tbody td:first-child{text-align:right;font-weight:600}
.hr-sheet .annual-ar-table .td-amt-blue{color:#2c5282;font-weight:800}
.hr-sheet .annual-ar-table .td-sig-dash{color:#64748b;font-family:monospace;letter-spacing:1px}
.hr-sheet .annual-ar-table tfoot td{font-weight:800;background:#e2e8f0}
.hr-sheet .annual-ar-table tfoot td:first-child{text-align:right}
.hr-sheet .tpl-bi-mini{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px}
@media print{
  body{padding:2mm 3mm!important;font-size:7.5pt!important;line-height:1.28!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .hr-sheet .doc{border:none!important;box-shadow:none!important}
  .hr-sheet .doc-table th,.hr-sheet .doc-table td{padding:1px 3px!important;font-size:7pt!important}
  .hr-sheet .doc-h .ttl{font-size:10pt!important}
  .hr-sheet .legal-ref{font-size:6pt!important;padding:1px 4px!important}
  .hr-sheet .sig-line{min-height:11px!important}
  .hr-sheet .final-sig-line{min-height:13px!important}
  .hr-sheet .final-sign-name{font-size:6pt!important}
  .hr-sheet .doc-note{font-size:6pt!important;max-height:none!important;margin:2px 0!important;padding:2px 3px!important}
  .hr-sheet tr,.hr-sheet .final-sign,.hr-sheet .sign-grid,.hr-sheet .tpl-sigbox{page-break-inside:avoid}
  .hr-sheet .tpl-sigbox{min-height:38mm!important}
  .hr-sheet .tpl-sigbox-body{min-height:16mm!important}
  .hr-sheet .tpl-kvgrid3{grid-template-columns:1fr 1fr 1fr!important;padding:4px 6px!important}
  .print-footer{margin-top:0!important;padding-top:1px!important;border-top:none!important;font-size:5.5pt!important;color:#94a3b8!important}
}
`.trim();

function wrapHrPrintBody(innerHtml, landscape) {
  const cls = landscape ? 'hr-sheet hr-sheet--landscape' : 'hr-sheet hr-sheet--portrait';
  return `
<div class="${cls}">
  <div class="legal-ref">
    <div dir="rtl">${esc(HR_SHEET_LEGAL_AR)}</div>
    <div class="legal-ref-en" dir="ltr">${esc(HR_SHEET_LEGAL_EN)}</div>
  </div>
${innerHtml}
</div>`;
}

function buildTplHeader({ companyAr, companyEn, titleAr, titleEn, subtitleAr, subtitleEn }) {
  const enCo = companyEn && String(companyEn).trim() && companyEn !== companyAr
    ? `<div class="tpl-co-en" dir="ltr">${esc(companyEn)}</div>`
    : '';
  const titleEnHtml = titleEn ? `<h2 class="tpl-title-en" dir="ltr">${esc(titleEn)}</h2>` : '';
  const subEn = subtitleEn ? `<p class="tpl-sub-ltr" dir="ltr">${esc(subtitleEn)}</p>` : '';
  return `
  <header class="tpl-topbar">
    <div class="tpl-logo-ph" dir="rtl">شعار<span class="tpl-logo-en"> / Logo</span></div>
    <div class="tpl-co-ar" dir="rtl">${esc(companyAr)}</div>
    ${enCo}
    <div class="tpl-gold-line" aria-hidden="true"></div>
    <h1 class="tpl-title" dir="rtl">${esc(titleAr)}</h1>
    ${titleEnHtml}
    <p class="tpl-sub-rtl" dir="rtl">${esc(subtitleAr)}</p>
    ${subEn}
    <div class="tpl-bar-thick" aria-hidden="true"></div>
  </header>`;
}

function buildTplEmployee3({ nameAr, nameEn, iqama, jobTitle, sectionTitleAr, sectionTitleEn }) {
  const displayName = String(nameAr || nameEn || '').trim() || '—';
  return `
  <section class="tpl-sec" dir="rtl">
    <div class="tpl-sec-h">${esc(sectionTitleAr)}${sectionTitleEn ? `<span class="tpl-sec-h-en">${esc(sectionTitleEn)}</span>` : ''}</div>
    <div class="tpl-kvgrid3">
      <div class="tpl-cell"><span class="tpl-lbl">الاسم</span><span class="tpl-val">${esc(displayName)}</span></div>
      <div class="tpl-cell"><span class="tpl-lbl">الإقامة</span><span class="tpl-val">${esc(iqama || '—')}</span></div>
      <div class="tpl-cell"><span class="tpl-lbl">المسمى</span><span class="tpl-val">${esc(jobTitle || '—')}</span></div>
    </div>
  </section>`;
}

function buildTplContractTable(rows) {
  const body = rows
    .map(
      (r) =>
        `<tr><td class="c-lbl" dir="rtl">${esc(r.labelAr)}<div style="font-size:6.5pt;font-weight:600;color:#64748b;margin-top:1px" dir="ltr">${esc(r.labelEn)}</div></td><td class="${r.rtlVal ? 'c-val-rtl' : 'c-val'}" ${r.rtlVal ? 'dir="rtl"' : 'dir="ltr"'}>${esc(r.value)}</td></tr>`,
    )
    .join('');
  return `<table class="tpl-contract" dir="rtl">${body}</table>`;
}

function buildTplDeclaration(arText, enText) {
  if (!String(arText || '').trim() && !String(enText || '').trim()) return '';
  return `
  <section class="tpl-sec" dir="rtl">
    <div class="tpl-sec-h">نص الإقرار<span class="tpl-sec-h-en">${esc(LABEL_LETTER_EN.declarationSection)}</span></div>
    <div class="tpl-declare">
      ${String(arText || '').trim() ? `<p class="d-ar" dir="rtl">${esc(arText)}</p>` : ''}
      ${String(enText || '').trim() ? `<p class="d-en" dir="ltr">${esc(enText)}</p>` : ''}
    </div>
  </section>`;
}

function buildTplSignaturePair({ employeeName, companyAr, dateLabelAr, dateLabelEn }) {
  const emp = String(employeeName || '').trim() || '—';
  const co = String(companyAr || '').trim() || '—';
  return `
  <div class="tpl-sign-sec-h" dir="rtl">التوقيعات<span class="tpl-sec-h-en" style="display:inline;margin-inline-start:6px">${esc(LABEL_LETTER_EN.signaturesSection)}</span></div>
  <div class="tpl-sig2">
    <div class="tpl-sigbox" dir="rtl">
      <div class="tpl-sigbox-h">توقيع الموظف<span class="tpl-sigbox-h-en">Employee signature</span></div>
      <div class="tpl-sigbox-body"></div>
      <div class="tpl-sigbox-foot">${esc(emp)}<div class="tpl-date-line">${esc(dateLabelAr)}: ........................</div></div>
    </div>
    <div class="tpl-sigbox" dir="rtl">
      <div class="tpl-sigbox-h">ختم المنشأة وتوقيع المفوّض<span class="tpl-sigbox-h-en">${esc(LABEL_LETTER_EN.stampSignatory)}</span></div>
      <div class="tpl-sigbox-body"></div>
      <div class="tpl-sigbox-foot">${esc(co)}<div class="tpl-date-line">${esc(dateLabelAr)} / ${esc(dateLabelEn)}: ........................</div></div>
    </div>
  </div>`;
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
  };
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
    setAnnual((a) => ({ ...a, amounts: a.amounts.map((v, i) => (a.monthOn[i] ? s : v)) }));
  };

  const printPayrollSingle = () => {
    const rowsAr = [];
    const rowsEn = [];
    const push = (ar, en, val) => {
      rowsAr.push(`<tr><td>${esc(ar)}</td><td class="td-num td-amt-blue">${esc(hrFmt(val))} SR</td></tr>`);
      rowsEn.push(`<tr><td class="td-en">${esc(en)}</td><td class="td-num td-amt-blue">${esc(hrFmt(val))} SR</td></tr>`);
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
    const head = buildTplHeader({
      companyAr: coAr,
      companyEn: coEn,
      titleAr: `مسير راتب — ${payroll.nameAr || payroll.nameEn || ''}`.trim(),
      titleEn: LABEL_PAYROLL_EN.slipTitle,
      subtitleAr: `${coAr} — ${payroll.periodLabel}`,
      subtitleEn: `${coEn} — ${payroll.periodLabel}`,
    });
    const emp = buildTplEmployee3({
      nameAr: payroll.nameAr,
      nameEn: payroll.nameEn,
      iqama: payroll.iqama,
      jobTitle: payroll.jobTitle,
      sectionTitleAr: 'بيانات الموظف',
      sectionTitleEn: LABEL_PAYROLL_EN.employee,
    });
    const detail = `
  <section class="tpl-sec" dir="rtl">
    <div class="tpl-sec-h">تفاصيل الراتب للفترة<span class="tpl-sec-h-en">Salary breakdown</span></div>
    <div class="tpl-bi-mini">
      <div dir="rtl">
        <table class="doc-table"><tbody>
          <tr><td>${esc(t('employeeSerial'))}</td><td>${esc(payroll.employeeSerial)}</td></tr>
          <tr><td>${esc(t('joinDate'))}</td><td>${esc(formatDateLocale(payroll.joinDate, 'ar-SA'))}</td></tr>
        </tbody></table>
        <table class="doc-table"><thead><tr><th>البند</th><th>المبلغ</th></tr></thead><tbody>${rowsAr.join('')}</tbody>
        <tfoot><tr><td>${esc(t('totalSalary'))}</td><td class="td-num td-amt-blue">${esc(hrFmt(payrollTotal))} SR</td></tr></tfoot></table>
        ${notesAr}
      </div>
      <div dir="ltr">
        <table class="doc-table"><tbody>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.serial)}</td><td class="td-en">${esc(payroll.employeeSerial)}</td></tr>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.join)}</td><td class="td-en">${esc(formatDateLocale(payroll.joinDate, 'en-US'))}</td></tr>
        </tbody></table>
        <table class="doc-table"><thead><tr><th class="td-en">${esc(LABEL_PAYROLL_EN.item)}</th><th>Amount</th></tr></thead><tbody>${rowsEn.join('')}</tbody>
        <tfoot><tr><td class="td-en">${esc(LABEL_PAYROLL_EN.total)}</td><td class="td-num td-amt-blue">${esc(hrFmt(payrollTotal))} SR</td></tr></tfoot></table>
        ${notesEn}
      </div>
    </div>
  </section>`;
    const sigs = buildTplSignaturePair({
      employeeName: payroll.nameAr || payroll.nameEn,
      companyAr: coAr,
      dateLabelAr: 'التاريخ',
      dateLabelEn: 'Date',
    });
    const inner = `<div class="doc tpl-doc">${head}${emp}${detail}${sigs}</div>`;
    openPrintWindow({
      title: 'Payroll slip / مسير راتب',
      companyName: '',
      subtitle: '',
      landscape: printLandscape,
      extraCss: HR_SHEET_CSS,
      showPageCounter: false,
      pageMarginMm: printLandscape ? 7 : 6,
      body: wrapHrPrintBody(inner, printLandscape),
    });
  };

  const printPayrollAnnual = () => {
    const rows = [];
    let any = false;
    for (let i = 0; i < 12; i += 1) {
      if (!annual.monthOn[i]) continue;
      any = true;
      const m = i + 1;
      const amt = n(annual.amounts[i]);
      rows.push(`<tr>
        <td>${esc(monthNameAr(m))} ${annual.year}</td>
        <td class="td-amt-blue">${esc(hrFmt(amt))} SR</td>
        <td class="td-sig-dash">…………………………</td>
      </tr>`);
    }
    if (!any) {
      window.alert(lang === 'ar' ? 'فعّل شهراً واحداً على الأقل للطباعة.' : 'Enable at least one month to print.');
      return;
    }
    const range = firstLastActiveMonthRange(annual.monthOn, annual.year);
    const coAr = payroll.companyName || companyNameArDefault;
    const coEn = payroll.companyNameEn || companyNameEnDefault;
    const subAr = range ? `مسير رواتب ${range.ar} — ${coAr}` : `السنة ${annual.year} — ${coAr}`;
    const subEn = range ? `Payroll ${range.en} — ${coEn}` : `Year ${annual.year} — ${coEn}`;
    const head = buildTplHeader({
      companyAr: coAr,
      companyEn: coEn,
      titleAr: `كشف راتب سنوي — ${payroll.nameAr || payroll.nameEn || ''}`.trim(),
      titleEn: `${LABEL_LETTER_EN.annualTitle} — ${payroll.nameEn || payroll.nameAr || ''}`.trim(),
      subtitleAr: subAr,
      subtitleEn: subEn,
    });
    const emp = buildTplEmployee3({
      nameAr: payroll.nameAr,
      nameEn: payroll.nameEn,
      iqama: payroll.iqama,
      jobTitle: payroll.jobTitle,
      sectionTitleAr: 'بيانات الموظف',
      sectionTitleEn: LABEL_PAYROLL_EN.employee,
    });
    const table = `
  <section class="tpl-sec" dir="rtl">
    <div class="tpl-sec-h">جدول الرواتب الشهرية<span class="tpl-sec-h-en">Monthly payroll table</span></div>
    <table class="annual-ar-table">
      <thead>
        <tr>
          <th style="width:42%">الشهر</th>
          <th style="width:28%">${esc(LABEL_LETTER_EN.grossSalary)}</th>
          <th style="width:30%">${esc(LABEL_LETTER_EN.receiptSigCol)}</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
      <tfoot>
        <tr>
          <td>${esc(LABEL_LETTER_EN.annualTotal)} / الإجمالي السنوي</td>
          <td class="td-amt-blue">${esc(hrFmt(annualSum))} SR</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </section>`;
    const sigs = buildTplSignaturePair({
      employeeName: payroll.nameAr || payroll.nameEn,
      companyAr: coAr,
      dateLabelAr: 'التاريخ',
      dateLabelEn: 'Date',
    });
    const inner = `<div class="doc tpl-doc">${head}${emp}${table}${sigs}</div>`;
    openPrintWindow({
      title: `Annual salary ${annual.year} / كشف سنوي ${annual.year}`,
      companyName: '',
      subtitle: '',
      landscape: printLandscape,
      extraCss: HR_SHEET_CSS,
      showPageCounter: false,
      pageMarginMm: printLandscape ? 7 : 6,
      body: wrapHrPrintBody(inner, printLandscape),
    });
  };

  const printPayrollSalaryLetter = () => {
    const dur = serviceDurationArEn(payroll.letterStartDate, payroll.letterEndDate);
    const coAr = payroll.companyName || companyNameArDefault;
    const coEn = payroll.companyNameEn || companyNameEnDefault;
    const nameDisp = [payroll.nameEn, payroll.nameAr].filter(Boolean).join(' / ') || '—';
    const contractRows = [
      { labelAr: 'اسم الموظف', labelEn: LABEL_PAYROLL_EN.name, value: nameDisp, rtlVal: true },
      { labelAr: 'رقم الإقامة', labelEn: LABEL_PAYROLL_EN.iqama, value: payroll.iqama || '—', rtlVal: true },
      { labelAr: 'تاريخ البدء', labelEn: LABEL_PAYROLL_EN.join, value: `${formatDateLocale(payroll.letterStartDate, 'ar-SA')} / ${formatDateLocale(payroll.letterStartDate, 'en-US')}`, rtlVal: false },
      { labelAr: 'تاريخ الإنهاء', labelEn: 'End date', value: `${formatDateLocale(payroll.letterEndDate, 'ar-SA')} / ${formatDateLocale(payroll.letterEndDate, 'en-US')}`, rtlVal: false },
      { labelAr: 'مدة الخدمة', labelEn: LABEL_LETTER_EN.serviceDuration, value: `${dur.ar} / ${dur.en}`, rtlVal: false },
      { labelAr: 'الراتب الشهري', labelEn: LABEL_LETTER_EN.monthlySalary, value: `${hrFmt(payrollTotal)} SR`, rtlVal: false },
      { labelAr: 'اسم المنشأة', labelEn: LABEL_LETTER_EN.establishment, value: `${coAr} / ${coEn}`, rtlVal: true },
    ];
    const head = buildTplHeader({
      companyAr: coAr,
      companyEn: coEn,
      titleAr: 'خطاب استلام الرواتب',
      titleEn: LABEL_LETTER_EN.salaryLetterTitle,
      subtitleAr: `${coAr} — ${payroll.periodLabel || defaultPeriodLabel(lang)}`,
      subtitleEn: `${coEn} — ${payroll.periodLabel || defaultPeriodLabel(lang)}`,
    });
    const emp = buildTplEmployee3({
      nameAr: payroll.nameAr,
      nameEn: payroll.nameEn,
      iqama: payroll.iqama,
      jobTitle: payroll.jobTitle,
      sectionTitleAr: 'بيانات الموظف',
      sectionTitleEn: LABEL_PAYROLL_EN.employee,
    });
    const contract = `
  <section class="tpl-sec" dir="rtl">
    <div class="tpl-sec-h">بيانات العقد<span class="tpl-sec-h-en">${esc(LABEL_LETTER_EN.contractSection)}</span></div>
    ${buildTplContractTable(contractRows)}
  </section>`;
    const decl = buildTplDeclaration(
      payroll.declarationSalariesAr || DEFAULT_DECL_SALARY_AR,
      payroll.declarationSalariesEn || DEFAULT_DECL_SALARY_EN,
    );
    const sigs = buildTplSignaturePair({
      employeeName: payroll.nameAr || payroll.nameEn,
      companyAr: coAr,
      dateLabelAr: 'التاريخ',
      dateLabelEn: 'Date',
    });
    const inner = `<div class="doc tpl-doc">${head}${emp}${contract}${decl}${sigs}</div>`;
    openPrintWindow({
      title: 'Salary receipt letter / خطاب استلام الرواتب',
      companyName: '',
      subtitle: '',
      landscape: printLandscape,
      extraCss: HR_SHEET_CSS,
      showPageCounter: false,
      pageMarginMm: printLandscape ? 7 : 6,
      body: wrapHrPrintBody(inner, printLandscape),
    });
  };

  const printPayroll = () => {
    if (payroll.payrollFormat === 'annual') printPayrollAnnual();
    else if (payroll.payrollFormat === 'salaryLetter') printPayrollSalaryLetter();
    else printPayrollSingle();
  };

  const eosWageTotal =
    n(eos.basic) + n(eos.housing) + n(eos.transport) + n(eos.other) +
    (eos.customRows || []).reduce((s, r) => s + n(r.amount), 0);

  const printEos = () => {
    const coAr = eos.companyName || companyNameArDefault;
    const coEn = eos.companyNameEn || companyNameEnDefault;
    const nameDisp = [eos.nameEn, eos.nameAr].filter(Boolean).join(' / ') || '—';
    const dur = serviceDurationArEn(eos.joinDate, eos.endDate);
    const customLines = (eos.customRows || [])
      .map((r) => `${r.label || '—'}: ${hrFmt(n(r.amount))} SR`)
      .join('؛ ');
    const wageExtra = customLines ? ` (${customLines})` : '';
    const contractRows = [
      { labelAr: 'اسم الموظف', labelEn: LABEL_PAYROLL_EN.name, value: nameDisp, rtlVal: true },
      { labelAr: 'رقم الإقامة', labelEn: LABEL_PAYROLL_EN.iqama, value: eos.iqama || '—', rtlVal: true },
      { labelAr: 'تاريخ البدء', labelEn: LABEL_PAYROLL_EN.join, value: `${formatDateLocale(eos.joinDate, 'ar-SA')} / ${formatDateLocale(eos.joinDate, 'en-US')}`, rtlVal: false },
      { labelAr: 'تاريخ نهاية الخدمة', labelEn: LABEL_EOS_EN.endDate, value: `${formatDateLocale(eos.endDate, 'ar-SA')} / ${formatDateLocale(eos.endDate, 'en-US')}`, rtlVal: false },
      { labelAr: 'مدة الخدمة', labelEn: LABEL_LETTER_EN.serviceDuration, value: `${dur.ar} / ${dur.en}`, rtlVal: false },
      { labelAr: 'أجر آخر شهر (مجموع البدلات)', labelEn: LABEL_EOS_EN.wageTitle, value: `${hrFmt(eosWageTotal)} SR${wageExtra}`, rtlVal: true },
      { labelAr: 'مكافأة نهاية الخدمة', labelEn: LABEL_LETTER_EN.eosGratuity, value: `${hrFmt(n(eos.eosAmount))} SR`, rtlVal: false },
      { labelAr: 'مستحقات أخرى', labelEn: LABEL_EOS_EN.other, value: `${hrFmt(n(eos.otherAccrued))} SR`, rtlVal: false },
      { labelAr: 'خصومات', labelEn: LABEL_EOS_EN.ded, value: `${hrFmt(n(eos.deductions))} SR`, rtlVal: false },
      { labelAr: 'صافي المستحق', labelEn: LABEL_LETTER_EN.netPayable, value: `${hrFmt(n(eos.netPayable))} SR`, rtlVal: false },
      { labelAr: 'اسم المنشأة', labelEn: LABEL_LETTER_EN.establishment, value: `${coAr} / ${coEn}`, rtlVal: true },
    ];
    const head = buildTplHeader({
      companyAr: coAr,
      companyEn: coEn,
      titleAr: 'خطاب استلام جميع المستحقات',
      titleEn: LABEL_LETTER_EN.entitlementsLetterTitle,
      subtitleAr: `${coAr} — ${formatDateLocale(eos.endDate, 'ar-SA')}`,
      subtitleEn: `${coEn} — ${formatDateLocale(eos.endDate, 'en-US')}`,
    });
    const emp = buildTplEmployee3({
      nameAr: eos.nameAr,
      nameEn: eos.nameEn,
      iqama: eos.iqama,
      jobTitle: eos.jobTitle,
      sectionTitleAr: 'بيانات الموظف',
      sectionTitleEn: LABEL_PAYROLL_EN.employee,
    });
    const contract = `
  <section class="tpl-sec" dir="rtl">
    <div class="tpl-sec-h">بيانات العقد والتسوية<span class="tpl-sec-h-en">${esc(LABEL_LETTER_EN.contractSection)} & settlement</span></div>
    ${buildTplContractTable(contractRows)}
  </section>`;
    const decl = buildTplDeclaration(eos.settlementNotesAr, eos.settlementNotesEn);
    const sigs = buildTplSignaturePair({
      employeeName: eos.nameAr || eos.nameEn,
      companyAr: coAr,
      dateLabelAr: 'التاريخ',
      dateLabelEn: 'Date',
    });
    const inner = `<div class="doc tpl-doc">${head}${emp}${contract}${decl}${sigs}</div>`;
    openPrintWindow({
      title: 'Full entitlements letter / خطاب استلام المستحقات',
      companyName: '',
      subtitle: '',
      landscape: printLandscape,
      extraCss: HR_SHEET_CSS,
      showPageCounter: false,
      pageMarginMm: printLandscape ? 7 : 6,
      body: wrapHrPrintBody(inner, printLandscape),
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
    <div className="noorix-surface-card p-5 space-y-5">
      <div>
        <h3 className="m-0 text-[17px] font-bold text-noorix-text">{t('hrTabPrintDocs')}</h3>
        <p className="mt-1.5 mb-0 text-[13px] text-noorix-muted">{t('hrTabPrintDocsDesc')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={docKind === 'payroll' ? 'primary' : 'ghost'} onClick={() => setDocKind('payroll')}>
          {t('hrPrintDocPayroll')}
        </Button>
        <Button type="button" size="sm" variant={docKind === 'eos' ? 'primary' : 'ghost'} onClick={() => setDocKind('eos')}>
          {t('hrPrintDocEos')}
        </Button>
      </div>

      <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/30 p-3 space-y-2">
        <p className="m-0 text-[12px] font-semibold text-noorix-text">{t('hrPrintOrientation')}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={!printLandscape ? 'primary' : 'ghost'} onClick={() => setPrintLandscape(false)}>
            {t('hrPrintOrientationPortrait')}
          </Button>
          <Button type="button" size="sm" variant={printLandscape ? 'primary' : 'ghost'} onClick={() => setPrintLandscape(true)}>
            {t('hrPrintOrientationLandscape')}
          </Button>
        </div>
        <p className="m-0 text-[11px] text-noorix-muted">{t('hrPrintOrientationHint')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <Input type="select" label={t('selectEmployee')} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">—</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{employeeDisplayName(e, lang, e.id)}</option>
          ))}
        </Input>
        <Button type="button" size="sm" variant="primary" disabled={!emp} onClick={docKind === 'payroll' ? importPayroll : importEos}>
          {t('hrPrintImportFromHr')}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={!emp} onClick={docKind === 'payroll' ? printPayroll : printEos}>
          {t('print')}
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

          {(payroll.payrollFormat === 'single' || payroll.payrollFormat === 'salaryLetter') && (
            <>
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
                <div className="space-y-3 rounded-lg border border-dashed border-noorix-blue/30 bg-noorix-bg-muted/20 p-4">
                  <p className="m-0 text-[12px] font-semibold text-noorix-text">{t('hrPrintFormatSalaryLetter')}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input type="date" label={t('hrPrintLetterStart')} value={payroll.letterStartDate} onChange={(e) => updatePayroll({ letterStartDate: e.target.value })} />
                    <Input type="date" label={t('hrPrintLetterEnd')} value={payroll.letterEndDate} onChange={(e) => updatePayroll({ letterEndDate: e.target.value })} />
                  </div>
                  <Input multiline rows={4} label={t('hrPrintSalaryLetterDeclAr')} value={payroll.declarationSalariesAr} onChange={(e) => updatePayroll({ declarationSalariesAr: e.target.value })} />
                  <Input multiline rows={4} label={t('hrPrintSalaryLetterDeclEn')} value={payroll.declarationSalariesEn} onChange={(e) => updatePayroll({ declarationSalariesEn: e.target.value })} />
                </div>
              )}
            </>
          )}

          {payroll.payrollFormat === 'annual' && (
            <div className="space-y-3 rounded-lg border border-noorix-border bg-noorix-bg-muted/40 p-4">
              <p className="m-0 text-[13px] font-semibold text-noorix-text">{t('hrPrintAnnualSection')}</p>
              <div className="flex flex-wrap items-end gap-3">
                <Input type="number" label={t('hrPrintYear')} min={2000} max={2100} step={1} value={annual.year} onChange={(e) => setAnnual((a) => ({ ...a, year: Number(e.target.value) || a.year }))} className="w-[120px]" />
                <Button type="button" size="sm" variant="ghost" onClick={fillAnnualWithMonthlyTotal}>{t('hrPrintFillAllMonths')}</Button>
              </div>
              <p className="m-0 text-[11px] text-noorix-muted">{t('hrPrintAnnualHint')}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {monthShortAr.map((label, i) => (
                  <label key={label} className="flex items-center gap-2 text-[12px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={annual.monthOn[i]}
                      onChange={(e) => {
                        const monthOn = [...annual.monthOn];
                        monthOn[i] = e.target.checked;
                        setAnnual((a) => ({ ...a, monthOn }));
                      }}
                      className="h-4 w-4 accent-noorix-blue"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-noorix-border bg-[var(--noorix-table-header-bg)]">
                      <th className="py-2 px-2 text-start">{t('hrPrintMonthCol')}</th>
                      <th className="py-2 px-2 text-end">{t('hrPrintAmountCol')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthShortAr.map((label, i) => (
                      <tr key={label} className="border-b border-noorix-border">
                        <td className="py-2 px-2">{label} {annual.year}</td>
                        <td className="py-2 px-2 text-end">
                          <Input
                            type="text"
                            inputMode="decimal"
                            size="sm"
                            value={annual.amounts[i]}
                            onChange={(e) => {
                              const amounts = [...annual.amounts];
                              amounts[i] = e.target.value;
                              setAnnual((a) => ({ ...a, amounts }));
                            }}
                            disabled={!annual.monthOn[i]}
                            className="max-w-[140px] ms-auto"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between text-[14px] font-bold">
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
  );
}
