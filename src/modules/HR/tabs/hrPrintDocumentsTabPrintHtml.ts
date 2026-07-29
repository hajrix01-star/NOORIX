import { hrFmt } from '../utils/hrFmt';
import {
  esc,
  n,
  defaultPeriodLabel,
  monthNameAr,
  formatDateLocale,
  serviceDurationArEn,
  firstLastActiveMonthRange,
} from './hrPrintDocumentsTabFormat';
import {
  LABEL_PAYROLL_EN,
  LABEL_EOS_EN,
  LABEL_LETTER_EN,
  DEFAULT_DECL_SALARY_AR,
  DEFAULT_DECL_SALARY_EN,
} from './hrPrintDocumentsTabConstants';
import { HR_PRINT_AR, HR_PRINT_EMPTY_FIELD } from './hrPrintDocumentsTabLabelsAr';
import type { HrEosCustomRow, HrPayrollCustomRow } from './hrPrintDocumentsTabDrafts';
import {
  buildGenContractBlock,
  buildGenDeclarationBlock,
  buildGenEmployeeStrip,
  buildGenFooter,
  buildGenHeader,
  buildGenSettlementDeclarationBlock,
  buildGenSignaturesBlock,
  formatIssueDateEnglish,
} from './hrPrintDocumentsTabPrintHtmlParts';
import type {
  ComposeHrPrintDocumentInput,
  ContractGridRow,
  HrPrintComposeResult,
} from './hrPrintDocumentsTabPrintHtmlParts';

export { buildHrPrintPreviewSrcDoc, wrapHrPrintBody } from './hrPrintDocumentsTabPrintHtmlParts';
export type { ComposeHrPrintDocumentInput, HrPrintComposeResult } from './hrPrintDocumentsTabPrintHtmlParts';


export function composeHrPrintDocument({
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
}: ComposeHrPrintDocumentInput): HrPrintComposeResult {
  const issueDate = formatIssueDateEnglish();

  if (docKind === 'eos') {
    const coAr = eos.companyName || companyNameArDefault;
    const coEn = eos.companyNameEn || companyNameEnDefault;
    const nameDisp = [eos.nameEn, eos.nameAr].filter(Boolean).join(' / ') || HR_PRINT_EMPTY_FIELD;
    const dur = serviceDurationArEn(eos.joinDate, eos.endDate);
    const customLines = (eos.customRows || [])
      .map((r: HrEosCustomRow) => `${r.label || HR_PRINT_EMPTY_FIELD}: ${hrFmt(n(r.amount))} SR`)
      .join('، ');
    const wageExtra = customLines ? ` (${customLines})` : '';
    const contractRows: ContractGridRow[] = [
      { labelAr: HR_PRINT_AR.eosName, labelEn: LABEL_PAYROLL_EN.name, value: nameDisp, ltr: false },
      { labelAr: HR_PRINT_AR.eosIqama, labelEn: LABEL_PAYROLL_EN.iqama, value: eos.iqama || HR_PRINT_EMPTY_FIELD, ltr: false },
      {
        labelAr: HR_PRINT_AR.eosJoin,
        labelEn: LABEL_PAYROLL_EN.join,
        value: `${formatDateLocale(eos.joinDate, 'ar-SA')} / ${formatDateLocale(eos.joinDate, 'en-US')}`,
        ltr: true,
      },
      {
        labelAr: HR_PRINT_AR.eosEnd,
        labelEn: LABEL_EOS_EN.endDate,
        value: `${formatDateLocale(eos.endDate, 'ar-SA')} / ${formatDateLocale(eos.endDate, 'en-US')}`,
        ltr: true,
      },
      { labelAr: HR_PRINT_AR.eosServiceDuration, labelEn: LABEL_LETTER_EN.serviceDuration, value: `${dur.ar} / ${dur.en}`, ltr: true },
      {
        labelAr: HR_PRINT_AR.eosWageComponents,
        labelEn: LABEL_EOS_EN.wageTitle,
        value: `${hrFmt(eosWageTotal)} SR${wageExtra}`,
        ltr: false,
      },
      { labelAr: HR_PRINT_AR.eosGratuity, labelEn: LABEL_LETTER_EN.eosGratuity, value: `${hrFmt(n(eos.eosAmount))} SR`, ltr: true },
      { labelAr: HR_PRINT_AR.eosOtherDues, labelEn: LABEL_EOS_EN.other, value: `${hrFmt(n(eos.otherAccrued))} SR`, ltr: true },
      { labelAr: HR_PRINT_AR.eosDeductions, labelEn: LABEL_EOS_EN.ded, value: `${hrFmt(n(eos.deductions))} SR`, ltr: true },
      { labelAr: HR_PRINT_AR.eosNet, labelEn: LABEL_LETTER_EN.netPayable, value: `${hrFmt(n(eos.netPayable))} SR`, ltr: true },
      { labelAr: HR_PRINT_AR.eosEstablishment, labelEn: LABEL_LETTER_EN.establishment, value: `${coAr} / ${coEn}`, ltr: false },
    ];
    const head = buildGenHeader({
      logoUrl,
      companyAr: coAr,
      companyEn: coEn,
      titleAr: HR_PRINT_AR.eosLetterTitle,
      titleEn: LABEL_LETTER_EN.entitlementsLetterTitle,
      subtitleAr: formatDateLocale(eos.endDate, 'ar-SA'),
      subtitleEn: formatDateLocale(eos.endDate, 'en-US'),
    });
    const contract = buildGenContractBlock(
      HR_PRINT_AR.eosContractBlock,
      `${LABEL_LETTER_EN.contractSection} & settlement`,
      contractRows,
    );
    const decl = buildGenSettlementDeclarationBlock(eos.settlementNotesAr, eos.settlementNotesEn);
    const sigs = buildGenSignaturesBlock(eos.nameAr || eos.nameEn, coAr);
    const foot = buildGenFooter(issueDate, lang === 'ar');
    const inner = `<div class="document">${head}<div class="doc-body">${contract}${decl}${sigs}</div>${foot}</div>`;
    return {
      inner,
      err: null,
      title: `Full entitlements letter / ${HR_PRINT_AR.eosLetterTitle}`,
    };
  }

  if (payrollFormat === 'annual') {
    const rows: string[] = [];
    let hasMonth = false;
    for (let i = 0; i < 12; i += 1) {
      if (!annual.monthOn[i]) continue;
      hasMonth = true;
      const m = i + 1;
      const uniform = String(annual.perMonthGross ?? '').trim();
      const amt = uniform !== '' ? n(uniform) : n(annual.amounts[i]);
      rows.push(`<tr>
        <td>${esc(monthNameAr(m))} ${annual.year}</td>
        <td class="cell-amt">${esc(hrFmt(amt))} SR</td>
        <td class="cell-sig">____________</td>
      </tr>`);
    }
    if (!hasMonth) {
      return { inner: null, err: 'annual_empty', title: '' };
    }
    const range = firstLastActiveMonthRange(annual.monthOn, annual.year);
    const coAr = payroll.companyName || companyNameArDefault;
    const coEn = payroll.companyNameEn || companyNameEnDefault;
    const subAr = range ? HR_PRINT_AR.annualPayrollRange(range.ar) : HR_PRINT_AR.annualYearOnly(annual.year);
    const subEn = range ? `Payroll ${range.en}` : `Year ${annual.year}`;
    const head = buildGenHeader({
      logoUrl,
      companyAr: coAr,
      companyEn: coEn,
      titleAr: HR_PRINT_AR.annualTitle(annual.year),
      titleEn: `Annual Payroll Statement — ${annual.year}`,
      subtitleAr: subAr,
      subtitleEn: subEn,
    });
    const emp = buildGenEmployeeStrip(payroll.nameAr || payroll.nameEn, payroll.iqama, payroll.jobTitle);
    const table = `
    <div class="doc-section-title"><span>${esc(HR_PRINT_AR.annualSalaryDetail)}</span><span class="doc-section-title-en">Salary breakdown</span></div>
    <table class="pr-table">
      <thead>
        <tr>
          <th>${esc(HR_PRINT_AR.annualMonthCol)}</th>
          <th>${esc(LABEL_LETTER_EN.grossSalary)}</th>
          <th>${esc(LABEL_LETTER_EN.receiptSigCol)}</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
      <tfoot>
        <tr>
          <td>${esc(HR_PRINT_AR.annualTotalRow(LABEL_LETTER_EN.annualTotal))}</td>
          <td class="cell-amt">${esc(hrFmt(annualSum))} SR</td>
          <td></td>
        </tr>
      </tfoot>
    </table>`;
    const sigs = buildGenSignaturesBlock(payroll.nameAr || payroll.nameEn, coAr);
    const foot = buildGenFooter(issueDate, lang === 'ar');
    const inner = `<div class="document">${head}<div class="doc-body">${emp}${table}${sigs}</div>${foot}</div>`;
    return {
      inner,
      err: null,
      title: `Annual salary ${annual.year} / ${HR_PRINT_AR.annualTitle(annual.year)}`,
    };
  }

  if (payrollFormat === 'salaryLetter') {
    const dur = serviceDurationArEn(payroll.letterStartDate, payroll.letterEndDate);
    const coAr = payroll.companyName || companyNameArDefault;
    const coEn = payroll.companyNameEn || companyNameEnDefault;
    const nameDisp = [payroll.nameEn, payroll.nameAr].filter(Boolean).join(' / ') || HR_PRINT_EMPTY_FIELD;
    const contractRows: ContractGridRow[] = [
      { labelAr: HR_PRINT_AR.eosName, labelEn: LABEL_PAYROLL_EN.name, value: nameDisp, ltr: false },
      { labelAr: HR_PRINT_AR.eosIqama, labelEn: LABEL_PAYROLL_EN.iqama, value: payroll.iqama || HR_PRINT_EMPTY_FIELD, ltr: false },
      {
        labelAr: HR_PRINT_AR.eosJoin,
        labelEn: LABEL_PAYROLL_EN.join,
        value: `${formatDateLocale(payroll.letterStartDate, 'ar-SA')} / ${formatDateLocale(payroll.letterStartDate, 'en-US')}`,
        ltr: true,
      },
      {
        labelAr: HR_PRINT_AR.salaryEndDate,
        labelEn: 'End date',
        value: `${formatDateLocale(payroll.letterEndDate, 'ar-SA')} / ${formatDateLocale(payroll.letterEndDate, 'en-US')}`,
        ltr: true,
      },
      { labelAr: HR_PRINT_AR.eosServiceDuration, labelEn: LABEL_LETTER_EN.serviceDuration, value: `${dur.ar} / ${dur.en}`, ltr: true },
      { labelAr: HR_PRINT_AR.monthlySalaryAr, labelEn: LABEL_LETTER_EN.monthlySalary, value: `${hrFmt(payrollTotal)} SR`, ltr: true },
      { labelAr: HR_PRINT_AR.eosEstablishment, labelEn: LABEL_LETTER_EN.establishment, value: `${coAr} / ${coEn}`, ltr: false },
    ];
    const head = buildGenHeader({
      logoUrl,
      companyAr: coAr,
      companyEn: coEn,
      titleAr: HR_PRINT_AR.salaryLetterTitle,
      titleEn: LABEL_LETTER_EN.salaryLetterTitle,
      subtitleAr: payroll.periodLabel || defaultPeriodLabel(lang),
      subtitleEn: payroll.periodLabel || defaultPeriodLabel(lang),
    });
    const contract = buildGenContractBlock(HR_PRINT_AR.salaryLetterContract, LABEL_LETTER_EN.contractSection, contractRows);
    const decl = buildGenDeclarationBlock(
      payroll.declarationSalariesAr || DEFAULT_DECL_SALARY_AR,
      payroll.declarationSalariesEn || DEFAULT_DECL_SALARY_EN,
    );
    const sigs = buildGenSignaturesBlock(payroll.nameAr || payroll.nameEn, coAr);
    const foot = buildGenFooter(issueDate, lang === 'ar');
    const inner = `<div class="document">${head}<div class="doc-body">${contract}${decl}${sigs}</div>${foot}</div>`;
    return {
      inner,
      err: null,
      title: `Salary receipt letter / ${HR_PRINT_AR.salaryLetterTitle}`,
    };
  }

  const rowsAr: string[] = [];
  const rowsEn: string[] = [];
  const push = (ar: string, en: string, val: number) => {
    rowsAr.push(`<tr><td>${esc(ar)}</td><td class="td-num">${esc(hrFmt(val))} SR</td></tr>`);
    rowsEn.push(`<tr><td class="td-en">${esc(en)}</td><td class="td-num">${esc(hrFmt(val))} SR</td></tr>`);
  };
  push(t('basicSalary'), LABEL_PAYROLL_EN.basic, n(payroll.basic));
  push(t('housingAllowance'), LABEL_PAYROLL_EN.housing, n(payroll.housing));
  push(t('transportAllowance'), LABEL_PAYROLL_EN.transport, n(payroll.transport));
  push(t('otherAllowance'), LABEL_PAYROLL_EN.other, n(payroll.other));
  push(HR_PRINT_AR.overtimeEstimateAr, LABEL_PAYROLL_EN.overtime, n(payroll.overtime));
  if (payroll.showBreakdown) {
    (payroll.customRows || []).forEach((r: HrPayrollCustomRow) =>
      push(r.label || HR_PRINT_EMPTY_FIELD, r.label || LABEL_PAYROLL_EN.custom, n(r.amount)),
    );
  } else {
    const csum = (payroll.customRows || []).reduce((sum: number, row: HrPayrollCustomRow) => sum + n(row.amount), 0);
    if (csum > 0) push(t('customAllowances'), LABEL_PAYROLL_EN.custom, csum);
  }
  const notesAr = payroll.notes?.trim() ? `<div class="doc-note" dir="rtl">${esc(payroll.notes)}</div>` : '';
  const notesEn = payroll.notes?.trim() ? `<div class="doc-note" dir="ltr">${esc(payroll.notes)}</div>` : '';
  const coAr = payroll.companyName || companyNameArDefault;
  const coEn = payroll.companyNameEn || companyNameEnDefault;
  const empDisplay = payroll.nameAr || payroll.nameEn || '';
  const head = buildGenHeader({
    logoUrl,
    companyAr: coAr,
    companyEn: coEn,
    titleAr: `${HR_PRINT_AR.slipTitlePrefix} — ${empDisplay}`.trim(),
    titleEn: LABEL_PAYROLL_EN.slipTitle,
    subtitleAr: `${payroll.periodLabel} — ${coAr}`,
    subtitleEn: `${payroll.periodLabel} — ${coEn}`,
  });
  const empStrip = buildGenEmployeeStrip(payroll.nameAr || payroll.nameEn, payroll.iqama, payroll.jobTitle);
  const detail = `
    <div class="doc-section-title"><span>${esc(HR_PRINT_AR.slipDetailHeading)}</span><span class="doc-section-title-en">Salary breakdown</span></div>
    <div class="gen-breakdown">
      <div dir="rtl">
        <table class="doc-table"><tbody>
          <tr><td>${esc(t('employeeSerial'))}</td><td>${esc(payroll.employeeSerial)}</td></tr>
          <tr><td>${esc(t('joinDate'))}</td><td>${esc(formatDateLocale(payroll.joinDate, 'ar-SA'))}</td></tr>
        </tbody></table>
        <table class="doc-table"><thead><tr><th>${esc(HR_PRINT_AR.slipItemCol)}</th><th>${esc(HR_PRINT_AR.slipAmountCol)}</th></tr></thead><tbody>${rowsAr.join('')}</tbody>
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
  return { inner, err: null, title: `Payroll slip / ${HR_PRINT_AR.slipTitlePrefix}` };
}
