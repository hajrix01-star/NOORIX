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
body {
  font-family: 'Noto Sans Arabic', 'IBM Plex Sans', Tahoma, sans-serif;
  background: #f4f6f8;
}
.ps-wrap { direction: rtl; color: #17212b; }
.ps-slip {
  max-width: 210mm;
  margin: 0 auto 24px;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  border: 1px solid #dfe4ea;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  overflow: hidden;
  page-break-after: always;
  page-break-inside: avoid;
}
.ps-slip:last-child { page-break-after: auto; margin-bottom: 0; }
.ps-head {
  padding: 18px 20px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-top: 4px solid #185fa5;
  border-bottom: 1px solid #e5e9ee;
}
.ps-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ps-head-logo {
  width: 52px; height: 52px; flex-shrink: 0;
  border: 1px solid #e2e7ec; border-radius: 10px; display: flex; align-items: center; justify-content: center;
  padding: 5px; overflow: hidden;
}
.ps-head-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
.ps-logo-ph { font-size: 9px; color: #94a3b8; text-align: center; line-height: 1.3; }
.ps-brand-copy { min-width: 0; }
.ps-co-ar { font-size: 15px; font-weight: 800; color: #17212b; }
.ps-co-en { font-size: 10px; color: #6b7785; margin-top: 2px; direction: ltr; }
.ps-head-mid { text-align: left; min-width: 250px; }
.ps-title-ar { font-size: 18px; font-weight: 800; color: #17212b; }
.ps-title-en { font-size: 10px; color: #6b7785; margin-top: 2px; direction: ltr; }
.ps-sub { display: flex; justify-content: flex-start; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.ps-meta-chip {
  padding: 3px 8px; border-radius: 999px; background: #f3f6f9; color: #465465;
  font-size: 9px; font-weight: 700; white-space: nowrap;
}
.ps-body { padding: 17px 20px 18px; }
.ps-section { margin-top: 16px; }
.ps-section:first-child { margin-top: 0; }
.ps-sec-title {
  color: #17212b; font-size: 11px; font-weight: 800;
  padding: 0 0 7px; margin: 0 0 9px;
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  border-bottom: 1px solid #dfe4ea;
}
.ps-sec-title::before {
  content: ''; width: 4px; height: 16px; border-radius: 999px; background: #185fa5; flex-shrink: 0;
}
.ps-sec-title > span:first-of-type { margin-left: auto; }
.ps-sec-title-en { font-size: 9px; color: #7b8794; font-weight: 600; direction: ltr; }
.ps-emp-grid {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px;
  background: #e3e8ed; border: 1px solid #e3e8ed; border-radius: 8px; overflow: hidden;
}
.ps-emp-cell { background: #fff; padding: 9px 11px; min-height: 52px; }
.ps-emp-name { grid-column: span 2; }
.ps-emp-lbl { font-size: 8.5px; color: #728091; font-weight: 700; display: block; }
.ps-emp-val { font-size: 11.5px; font-weight: 800; color: #17212b; margin-top: 3px; display: block; }
.ps-net-card {
  display: flex; align-items: center; justify-content: space-between; gap: 18px;
  border: 1px solid #cfe0ef; border-radius: 10px; background: #f4f9fd; padding: 13px 16px;
}
.ps-net-label { color: #31506b; font-size: 11px; font-weight: 800; }
.ps-net-label-en { color: #7b8794; font-size: 8.5px; font-weight: 600; direction: ltr; margin-top: 2px; }
.ps-net-amount { color: #185fa5; font-size: 22px; font-weight: 800; direction: ltr; white-space: nowrap; letter-spacing: -0.2px; }
.ps-net-currency { font-size: 9px; color: #607386; font-weight: 700; margin-left: 3px; letter-spacing: 0; }
.ps-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 10.5px; border: 1px solid #dfe4ea; border-radius: 8px; overflow: hidden; }
.ps-table th, .ps-table td { border: 0; border-bottom: 1px solid #e8ecf0; padding: 7px 10px; text-align: right; }
.ps-table th + th, .ps-table td + td { border-right: 1px solid #e8ecf0; }
.ps-table tr:last-child td { border-bottom: 0; }
.ps-table thead th { background: #f3f6f9; color: #465465; font-weight: 800; }
.ps-table tfoot td { background: #f4f9fd; font-weight: 800; color: #185fa5; }
.ps-table .td-num { text-align: left; font-weight: 800; color: #17212b; direction: ltr; }
.ps-note { font-size: 8.5px; color: #6f7c8b; line-height: 1.55; margin: 8px 2px 0; }
.ps-declaration { border-right: 3px solid #d2dae2; padding: 2px 10px 2px 0; margin-top: 13px; }
.ps-declaration .ps-note { margin: 0; }
.ps-declaration .ps-note + .ps-note { margin-top: 4px; }
.ps-sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
.ps-sig-box { padding-top: 2px; page-break-inside: avoid; }
.ps-sig-hd { text-align: right; }
.ps-sig-t-ar { font-size: 10.5px; font-weight: 800; color: #2a3745; }
.ps-sig-t-en { font-size: 8.5px; color: #7b8794; margin-top: 1px; direction: ltr; text-align: right; }
.ps-sig-space { height: 48px; border-bottom: 1px solid #9ba7b3; }
.ps-sig-ft { padding-top: 6px; font-size: 8.5px; color: #7b8794; display: flex; justify-content: space-between; gap: 8px; }
.ps-sig-ft strong { color: #465465; font-size: 9px; font-weight: 700; }
.ps-foot {
  color: #718091; font-size: 8px; padding: 10px 20px 12px;
  display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px;
  border-top: 1px solid #e5e9ee;
}
.ps-foot-copy { max-width: 72%; }
.ps-legal { font-size: 7px; line-height: 1.45; color: #8793a0; margin-top: 4px; }
.print-footer { display: none; }
@media print {
  body { padding: 0 !important; background: #fff; }
  .ps-slip { border: 0; border-radius: 0; box-shadow: none; max-width: none; margin: 0; }
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

  const companyNameText = String(companyName || '').trim();
  const companyNameEnText = String(companyNameEn || '').trim();
  const coAr = esc(companyNameText || '—');
  const coEn = esc(companyNameEnText);
  const enLine =
    companyNameEnText && companyNameEnText.toLocaleLowerCase() !== companyNameText.toLocaleLowerCase()
      ? `<div class="ps-co-en">${coEn}</div>`
      : '';

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
        <section class="ps-section">
          <div class="ps-sec-title">
            <span>${esc(labels.sectionBreakdownAr)}</span>
            <span class="ps-sec-title-en">${esc(labels.sectionBreakdownEn)}</span>
          </div>
          <div class="ps-net-card">
            <div>
              <div class="ps-net-label">${esc(labels.netPayableTitle)}</div>
              <div class="ps-net-label-en">${esc(labels.netPayableTitleEn)}</div>
            </div>
            <div class="ps-net-amount"><span class="ps-net-currency">SAR</span>${esc(hrFmt(summary.netSalary))}</div>
          </div>
          <p class="ps-note" dir="rtl">${esc(labels.netOnlyNoteAr)}</p>
          <p class="ps-note" dir="ltr">${esc(labels.netOnlyNoteEn)}</p>
        </section>`;
      } else {
        const rows = [];
        rows.push(
          `<tr><td>${esc(labels.rowGross)}</td><td class="td-num">SAR ${esc(hrFmt(summary.grossSalary))}</td></tr>`,
        );
        if (summary.allowancesAdd > 0) {
          rows.push(
            `<tr><td>${esc(labels.rowAllowances)}</td><td class="td-num">SAR ${esc(hrFmt(summary.allowancesAdd))}</td></tr>`,
          );
        }
        rows.push(
          `<tr><td>${esc(labels.rowBeforeDed)}</td><td class="td-num">SAR ${esc(hrFmt(summary.beforeDeductions))}</td></tr>`,
        );
        if (summary.payrollDeductions > 0) {
          rows.push(`<tr><td>${esc(labels.rowDeductions)}</td><td class="td-num">SAR ${esc(hrFmt(summary.payrollDeductions))}</td></tr>`);
        }
        if (summary.advancesDeduct > 0) {
          rows.push(`<tr><td>${esc(labels.rowAdvances)}</td><td class="td-num">SAR ${esc(hrFmt(summary.advancesDeduct))}</td></tr>`);
        }
        breakdownHtml = `
        <section class="ps-section">
          <div class="ps-sec-title">
            <span>${esc(labels.sectionBreakdownAr)}</span>
            <span class="ps-sec-title-en">${esc(labels.sectionBreakdownEn)}</span>
          </div>
          <table class="ps-table">
            <thead><tr><th>${esc(labels.colItem)}</th><th>${esc(labels.colAmount)}</th></tr></thead>
            <tbody>${rows.join('')}</tbody>
            <tfoot><tr><td>${esc(labels.rowNet)}</td><td class="td-num">SAR ${esc(hrFmt(summary.netSalary))}</td></tr></tfoot>
          </table>
        </section>`;
      }

      const decl =
        labels.declarationAr || labels.declarationEn
          ? `<div class="ps-declaration"><p class="ps-note" dir="rtl">${esc(labels.declarationAr)}</p><p class="ps-note" dir="ltr">${esc(labels.declarationEn)}</p></div>`
          : '';

      const empNameEsc = esc(displayName);
      const sigs = `
        <section class="ps-section">
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
              <div class="ps-sig-ft"><strong>${empNameEsc}</strong><span>${esc(labels.sigDateLine)}</span></div>
            </div>
            <div class="ps-sig-box">
              <div class="ps-sig-hd">
                <div class="ps-sig-t-ar">${esc(labels.sigEmployerAr)}</div>
                <div class="ps-sig-t-en">${esc(labels.sigEmployerEn)}</div>
              </div>
              <div class="ps-sig-space"></div>
              <div class="ps-sig-ft"><strong>${coAr}</strong><span>${esc(labels.sigDateLine)}</span></div>
            </div>
          </div>
        </section>`;

      return `
      <div class="ps-slip">
        <header class="ps-head">
          <div class="ps-brand">
            <div class="ps-head-logo">${buildLogoInner(companyLogo)}</div>
            <div class="ps-brand-copy">
              <div class="ps-co-ar">${coAr}</div>
              ${enLine}
            </div>
          </div>
          <div class="ps-head-mid">
            <div class="ps-title-ar">${esc(labels.docTitleAr)}</div>
            <div class="ps-title-en">${esc(labels.docTitleEn)}</div>
            <div class="ps-sub">
              <span class="ps-meta-chip">${esc(labels.runLabel)}: ${esc(run.runNumber || '')}</span>
              <span class="ps-meta-chip">${esc(labels.lblPayrollMonth)}: ${esc(monthLabel)}</span>
            </div>
          </div>
        </header>
        <div class="ps-body">
          <section class="ps-section">
            <div class="ps-sec-title">
              <span>${esc(labels.sectionEmpAr)}</span>
              <span class="ps-sec-title-en">${esc(labels.sectionEmpEn)}</span>
            </div>
            <div class="ps-emp-grid">
              <div class="ps-emp-cell ps-emp-name"><span class="ps-emp-lbl">${esc(labels.lblName)}</span><span class="ps-emp-val">${empNameEsc}</span></div>
              <div class="ps-emp-cell"><span class="ps-emp-lbl">${esc(labels.lblSerial)}</span><span class="ps-emp-val">${serial}</span></div>
              <div class="ps-emp-cell"><span class="ps-emp-lbl">${esc(labels.lblIqama)}</span><span class="ps-emp-val">${iqama}</span></div>
              <div class="ps-emp-cell"><span class="ps-emp-lbl">${esc(labels.lblJob)}</span><span class="ps-emp-val">${job}</span></div>
              <div class="ps-emp-cell"><span class="ps-emp-lbl">${esc(labels.lblJoin)}</span><span class="ps-emp-val">${esc(join)}</span></div>
            </div>
          </section>
          ${breakdownHtml}
          ${decl}
          ${sigs}
        </div>
        <footer class="ps-foot">
          <div class="ps-foot-copy">
            <div>${esc(labels.footerLeft)}</div>
            <div class="ps-legal" dir="rtl">${esc(labels.legalRefAr)}<div dir="ltr">${esc(labels.legalRefEn)}</div></div>
          </div>
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
