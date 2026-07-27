/**
 * طباعة مسير توقيع لكل موظف في المسيرة — ورقة A4 لكل موظف، أمر طباعة واحد.
 */
import { buildPrintDocumentHtml } from '../../../utils/printUtils';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { hrFmt } from '../utils/hrFmt';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { computePayrollLineSummary } from './hrCalculations/payroll';

type PayrollSlipEmployee = {
  iqamaNumber?: string | number | null;
  employeeSerial?: string | number | null;
  jobTitle?: string | null;
  joinDate?: string | Date | null;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

type PayrollSlipLine = {
  employee?: PayrollSlipEmployee | null;
  employeeName?: string | null;
  grossSalary?: number | string | null;
  allowancesAdd?: number | string | null;
  deductions?: number | string | null;
  advancesDeduct?: number | string | null;
  netSalary?: number | string | null;
  notes?: string | null;
};

type PayrollSlipRun = {
  runNumber?: string | number | null;
  payrollMonth?: string | Date | null;
  items?: PayrollSlipLine[] | null;
};

type PayrollSlipPrintOptions = {
  run: PayrollSlipRun;
  companyName?: string;
  companyNameEn?: string;
  companyLogo?: string;
  lang: string;
  labels: Record<string, string>;
  netOnly: boolean;
};

function esc(v: unknown) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function safeImgSrc(url: unknown) {
  const u = String(url || '').trim();
  if (!u) return '';
  return u.replace(/"/g, '%22').replace(/'/g, '%27');
}

function buildLogoInner(logoUrl: unknown) {
  const u = safeImgSrc(logoUrl);
  if (u.startsWith('http') || u.startsWith('data:image')) return `<img src="${u}" alt="" />`;
  return `<div class="ps-logo-ph">شعار<br/><span>Logo</span></div>`;
}

const SLIP_PRINT_CSS = `
body { font-family: 'Noto Sans Arabic', 'IBM Plex Sans', Tahoma, sans-serif; }
.ps-wrap { direction: rtl; color: #1a2a3a; }
.ps-slip {
  max-width: 210mm;
  margin: 0 auto 24px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  page-break-after: always;
  page-break-inside: avoid;
}
.ps-slip:last-child { page-break-after: auto; margin-bottom: 0; }
.ps-head {
  background: #1a3c5e;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 4px solid #c9a227;
}
.ps-head-logo {
  width: 64px; height: 64px; flex-shrink: 0;
  background: #fff; border-radius: 8px; display: flex; align-items: center; justify-content: center;
  padding: 4px; overflow: hidden;
}
.ps-head-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
.ps-logo-ph { font-size: 9px; color: #94a3b8; text-align: center; line-height: 1.3; }
.ps-head-spacer { width: 64px; flex-shrink: 0; }
.ps-head-mid { flex: 1; text-align: center; min-width: 0; }
.ps-co-ar { font-size: 15px; font-weight: 800; color: #c9a227; }
.ps-co-en { font-size: 11px; color: #c8d8e8; margin-top: 3px; direction: ltr; }
.ps-title-ar { font-size: 15px; font-weight: 700; color: #fff; margin-top: 6px; }
.ps-title-en { font-size: 10px; color: #aac4de; margin-top: 4px; direction: ltr; }
.ps-sub { font-size: 10px; color: #c8e0f0; margin-top: 4px; }
.ps-body { padding: 16px 18px 12px; }
.ps-emp-grid {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px;
  background: #d0d8e4; border: 1px solid #d0d8e4; border-radius: 4px; overflow: hidden; margin-bottom: 14px;
}
.ps-emp-cell { background: #fff; padding: 8px 10px; }
.ps-emp-lbl { font-size: 9px; color: #5a7a9a; font-weight: 700; display: block; }
.ps-emp-val { font-size: 12px; font-weight: 800; color: #1a2a3a; margin-top: 2px; }
.ps-sec-title {
  background: #1a3c5e; color: #fff; font-size: 11px; font-weight: 700;
  padding: 6px 12px; border-radius: 4px; margin: 0 0 10px;
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
}
.ps-sec-title-en { font-size: 9px; color: #dbeafe; font-weight: 600; }
.ps-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
.ps-table th, .ps-table td { border: 1px solid #d0d8e4; padding: 7px 10px; text-align: right; }
.ps-table thead th { background: #1a3c5e; color: #fff; font-weight: 700; }
.ps-table tfoot td { background: #eef2f7; font-weight: 800; }
.ps-table .td-num { text-align: center; font-weight: 800; color: #1a3c5e; }
.ps-note { font-size: 10px; color: #64748b; line-height: 1.5; margin-bottom: 12px; text-align: justify; }
.ps-sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 4px; }
.ps-sig-box { border: 1px solid #d0d8e4; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
.ps-sig-hd { background: #dce6f1; padding: 7px 10px; text-align: center; }
.ps-sig-t-ar { font-size: 11px; font-weight: 700; color: #1a3c5e; }
.ps-sig-t-en { font-size: 9px; color: #6a8aaa; margin-top: 2px; direction: ltr; }
.ps-sig-space { height: 56px; }
.ps-sig-ft { background: #f9fbfd; border-top: 1px solid #e0e8f0; padding: 7px 10px; font-size: 9px; color: #6a8aaa; text-align: center; }
.ps-sig-ft strong { display: block; font-size: 10px; color: #1a3c5e; font-weight: 800; margin-bottom: 3px; }
.ps-foot {
  background: #1a3c5e; color: #8ab0d0; font-size: 9px; padding: 8px 16px;
  display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px; border-top: 3px solid #c9a227;
}
.ps-legal { font-size: 6.5pt; line-height: 1.35; color: #64748b; text-align: center; padding: 6px 8px 4px; border-bottom: 1px dotted #cbd5e1; }
@media print {
  body { padding: 0 !important; }
  .ps-slip { border: none; border-radius: 0; max-width: none; margin: 0; }
}
`.trim();

/**
 * @param {object} opts
 * @param {object} opts.run — نتيجة getPayrollRun (يشمل items + employee)
 * @param {string} opts.companyName
 * @param {string} [opts.companyNameEn]
 * @param {string} [opts.companyLogo]
 * @param {'ar'|'en'} opts.lang
 * @param {Record<string, string>} opts.labels — نصوص جاهزة من t()
 * @param {boolean} opts.netOnly — إخفاء البدلات وتفاصيل الاستحقاق؛ الصافي فقط
 */
export function buildPayrollRunEmployeeSlipsPrintHtml({
  run,
  companyName,
  companyNameEn = '',
  companyLogo = '',
  lang,
  labels,
  netOnly,
}: PayrollSlipPrintOptions) {
  const items = Array.isArray(run?.items) ? run.items : [];
  if (!items.length) return '';

  const monthLabel = formatSaudiDate(run.payrollMonth);
  const issueDate = new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const coAr = esc(companyName || '—');
  const coEn = esc(String(companyNameEn || '').trim());
  const enLine = coEn ? `<div class="ps-co-en">${coEn}</div>` : '';

  const pages = items
    .map((row) => {
      const emp = row.employee;
      const displayName = employeeDisplayName(emp || { name: row.employeeName }, lang);
      const iqama = esc(emp?.iqamaNumber || '—');
      const serial = esc(emp?.employeeSerial || '—');
      const job = esc(emp?.jobTitle || '—');
      const join = formatSaudiDate(emp?.joinDate);

      const summary = computePayrollLineSummary(row);

      let breakdownHtml = '';
      if (netOnly) {
        breakdownHtml = `
        <div class="ps-sec-title">
          <span>${esc(labels.sectionBreakdownAr)}</span>
          <span class="ps-sec-title-en">${esc(labels.sectionBreakdownEn)}</span>
        </div>
        <table class="ps-table">
          <thead><tr><th>${esc(labels.colItem)}</th><th>${esc(labels.colAmount)}</th></tr></thead>
          <tbody>
            <tr><td>${esc(labels.netPayableTitle)}</td><td class="td-num">${esc(hrFmt(summary.netSalary))} SR</td></tr>
          </tbody>
        </table>
        <p class="ps-note" dir="rtl">${esc(labels.netOnlyNoteAr)}</p>
        <p class="ps-note" dir="ltr">${esc(labels.netOnlyNoteEn)}</p>`;
      } else {
        const rows = [];
        rows.push(
          `<tr><td>${esc(labels.rowGross)}</td><td class="td-num">${esc(hrFmt(summary.grossSalary))} SR</td></tr>`,
        );
        if (summary.allowancesAdd > 0) {
          rows.push(
            `<tr><td>${esc(labels.rowAllowances)}</td><td class="td-num">${esc(hrFmt(summary.allowancesAdd))} SR</td></tr>`,
          );
        }
        rows.push(
          `<tr><td>${esc(labels.rowBeforeDed)}</td><td class="td-num">${esc(hrFmt(summary.beforeDeductions))} SR</td></tr>`,
        );
        if (summary.payrollDeductions > 0) {
          rows.push(`<tr><td>${esc(labels.rowDeductions)}</td><td class="td-num">${esc(hrFmt(summary.payrollDeductions))} SR</td></tr>`);
        }
        if (summary.advancesDeduct > 0) {
          rows.push(`<tr><td>${esc(labels.rowAdvances)}</td><td class="td-num">${esc(hrFmt(summary.advancesDeduct))} SR</td></tr>`);
        }
        breakdownHtml = `
        <div class="ps-sec-title">
          <span>${esc(labels.sectionBreakdownAr)}</span>
          <span class="ps-sec-title-en">${esc(labels.sectionBreakdownEn)}</span>
        </div>
        <table class="ps-table">
          <thead><tr><th>${esc(labels.colItem)}</th><th>${esc(labels.colAmount)}</th></tr></thead>
          <tbody>${rows.join('')}</tbody>
          <tfoot><tr><td>${esc(labels.rowNet)}</td><td class="td-num">${esc(hrFmt(summary.netSalary))} SR</td></tr></tfoot>
        </table>`;
      }

      const decl =
        labels.declarationAr || labels.declarationEn
          ? `<p class="ps-note" dir="rtl">${esc(labels.declarationAr)}</p><p class="ps-note" dir="ltr">${esc(labels.declarationEn)}</p>`
          : '';

      const empNameEsc = esc(displayName);
      const sigs = `
        <div class="ps-sec-title">
          <span>${esc(labels.sectionSigAr)}</span>
          <span class="ps-sec-title-en">${esc(labels.sectionSigEn)}</span>
        </div>
        <div class="ps-sig-grid">
          <div class="ps-sig-box">
            <div class="ps-sig-hd">
              <div class="ps-sig-t-ar">${esc(labels.sigEmployeeAr)}</div>
              <div class="ps-sig-t-en">${esc(labels.sigEmployeeEn)}</div>
            </div>
            <div class="ps-sig-space"></div>
            <div class="ps-sig-ft"><strong>${empNameEsc}</strong>${esc(labels.sigDateLine)}</div>
          </div>
          <div class="ps-sig-box">
            <div class="ps-sig-hd">
              <div class="ps-sig-t-ar">${esc(labels.sigEmployerAr)}</div>
              <div class="ps-sig-t-en">${esc(labels.sigEmployerEn)}</div>
            </div>
            <div class="ps-sig-space"></div>
            <div class="ps-sig-ft"><strong>${coAr}</strong>${esc(labels.sigDateLine)}</div>
          </div>
        </div>`;

      return `
      <div class="ps-slip">
        <div class="ps-legal" dir="rtl">${esc(labels.legalRefAr)}<div dir="ltr" style="margin-top:2px">${esc(labels.legalRefEn)}</div></div>
        <header class="ps-head">
          <div class="ps-head-logo">${buildLogoInner(companyLogo)}</div>
          <div class="ps-head-mid">
            <div class="ps-co-ar">${coAr}</div>
            ${enLine}
            <div class="ps-title-ar">${esc(labels.docTitleAr)} — ${empNameEsc}</div>
            <div class="ps-title-en">${esc(labels.docTitleEn)} — ${empNameEsc}</div>
            <div class="ps-sub">${esc(labels.runLabel)}: ${esc(run.runNumber || '')} · ${esc(labels.lblPayrollMonth)}: ${esc(monthLabel)}</div>
          </div>
          <div class="ps-head-spacer" aria-hidden="true"></div>
        </header>
        <div class="ps-body">
          <div class="ps-sec-title">
            <span>${esc(labels.sectionEmpAr)}</span>
            <span class="ps-sec-title-en">${esc(labels.sectionEmpEn)}</span>
          </div>
          <div class="ps-emp-grid">
            <div class="ps-emp-cell"><span class="ps-emp-lbl">${esc(labels.lblName)}</span><span class="ps-emp-val">${empNameEsc}</span></div>
            <div class="ps-emp-cell"><span class="ps-emp-lbl">${esc(labels.lblIqama)}</span><span class="ps-emp-val">${iqama}</span></div>
            <div class="ps-emp-cell"><span class="ps-emp-lbl">${esc(labels.lblJob)}</span><span class="ps-emp-val">${job}</span></div>
            <div class="ps-emp-cell"><span class="ps-emp-lbl">${esc(labels.lblSerial)}</span><span class="ps-emp-val">${serial}</span></div>
            <div class="ps-emp-cell" style="grid-column: span 2"><span class="ps-emp-lbl">${esc(labels.lblJoin)}</span><span class="ps-emp-val">${esc(join)}</span></div>
          </div>
          ${breakdownHtml}
          ${decl}
          ${sigs}
        </div>
        <footer class="ps-foot">
          <span>${esc(labels.footerLeft)}</span>
          <span>${esc(labels.issueLabel)}: ${esc(issueDate)}</span>
        </footer>
      </div>`;
    })
    .join('');

  const body = `<div class="ps-wrap">${pages}</div>`;

  return buildPrintDocumentHtml({
    title: labels.windowTitle || String(run.runNumber || 'Payroll slips'),
    subtitle: `${esc(labels.runLabel)}: ${esc(run.runNumber || '')} - ${esc(labels.lblPayrollMonth)}: ${esc(monthLabel)}`,
    landscape: false,
    extraCss: SLIP_PRINT_CSS,
    showPageCounter: true,
    pageMarginMm: 10,
    body,
  });
}
