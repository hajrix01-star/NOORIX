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

const PRINT_DOC_CSS = `
.doc{max-width:900px;margin:0 auto;border:1px solid #dbe1e8;border-radius:12px;overflow:hidden;background:#fff}
.doc-h{padding:14px 16px;background:#f8fafc;border-bottom:2px solid #185FA5}
.doc-h .ttl{margin:0;font-size:17px;font-weight:800;color:#0f172a}
.doc-h .sub{margin-top:4px;font-size:12px;color:#475569}
.doc-b{padding:14px 16px}
.bi-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start}
.bi-col{border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;background:#fff}
.bi-col h4{margin:0 0 8px;font-size:13px;font-weight:800;color:#185FA5;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
.doc-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px}
.doc-table th,.doc-table td{border:1px solid #e2e8f0;padding:6px 8px;text-align:right}
.doc-table th{background:#f1f5f9;font-weight:700}
.doc-table .td-num,.doc-table .td-center{text-align:center;font-weight:600}
.doc-table .td-en{text-align:left;direction:ltr}
.doc-note{white-space:pre-wrap;font-size:11px;color:#334155;margin:10px 0;padding:8px;background:#fafafa;border-radius:6px;border:1px dashed #cbd5e1}
.sign-row{display:flex;justify-content:space-between;gap:16px;margin-top:28px;padding-top:8px}
.sign-box{flex:1;text-align:center;border-top:2px solid #1e293b;padding-top:8px;font-size:11px;font-weight:600;color:#334155}
.sig-line{min-height:32px;border-bottom:1px dashed #64748b;margin-top:4px}
.final-sign{margin-top:20px;padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc}
.final-sign .ttl{font-weight:800;font-size:12px;margin-bottom:8px;color:#0f172a}
@media print{.doc{border:none;border-radius:0}}
`.trim();

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
  };
}

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
      rowsAr.push(`<tr><td>${esc(ar)}</td><td class="td-num">${esc(hrFmt(val))}</td></tr>`);
      rowsEn.push(`<tr><td class="td-en">${esc(en)}</td><td class="td-num">${esc(hrFmt(val))}</td></tr>`);
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

    const body = `
<div class="doc">
  <div class="doc-h">
    <div class="bi-grid">
      <div dir="rtl">
        <h2 class="ttl">مسير راتب — للاطلاع والتوقيع</h2>
        <div class="sub">${esc(payroll.companyName || companyNameArDefault)} — ${esc(payroll.periodLabel)}</div>
      </div>
      <div dir="ltr">
        <h2 class="ttl">${esc(LABEL_PAYROLL_EN.slipTitle)}</h2>
        <div class="sub">${esc(payroll.companyNameEn || companyNameEnDefault)} — ${esc(payroll.periodLabel)}</div>
      </div>
    </div>
  </div>
  <div class="doc-b">
    <div class="bi-grid">
      <div class="bi-col" dir="rtl">
        <h4>بيانات الموظف</h4>
        <table class="doc-table"><tbody>
          <tr><td>${esc(t('employeeSerial'))}</td><td>${esc(payroll.employeeSerial)}</td></tr>
          <tr><td>${esc(t('employeeName'))}</td><td>${esc(payroll.nameAr || payroll.nameEn)}</td></tr>
          <tr><td>${esc(t('jobTitle'))}</td><td>${esc(payroll.jobTitle)}</td></tr>
          <tr><td>${esc(t('iqamaNumber'))}</td><td>${esc(payroll.iqama)}</td></tr>
          <tr><td>${esc(t('joinDate'))}</td><td>${esc(payroll.joinDate)}</td></tr>
        </tbody></table>
        <table class="doc-table"><thead><tr><th>البند</th><th>المبلغ (ر.س)</th></tr></thead><tbody>${rowsAr.join('')}</tbody>
        <tfoot><tr><td>${esc(t('totalSalary'))}</td><td class="td-num">${esc(hrFmt(payrollTotal))}</td></tr></tfoot></table>
        ${notesAr}
      </div>
      <div class="bi-col" dir="ltr">
        <h4>${esc(LABEL_PAYROLL_EN.employee)}</h4>
        <table class="doc-table"><tbody>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.serial)}</td><td class="td-en">${esc(payroll.employeeSerial)}</td></tr>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.name)}</td><td class="td-en">${esc(payroll.nameEn || payroll.nameAr)}</td></tr>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.job)}</td><td class="td-en">${esc(payroll.jobTitle)}</td></tr>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.iqama)}</td><td class="td-en">${esc(payroll.iqama)}</td></tr>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.join)}</td><td class="td-en">${esc(payroll.joinDate)}</td></tr>
        </tbody></table>
        <table class="doc-table"><thead><tr><th class="td-en">${esc(LABEL_PAYROLL_EN.item)}</th><th>${esc(LABEL_PAYROLL_EN.amount)}</th></tr></thead><tbody>${rowsEn.join('')}</tbody>
        <tfoot><tr><td class="td-en">${esc(LABEL_PAYROLL_EN.total)}</td><td class="td-num">${esc(hrFmt(payrollTotal))}</td></tr></tfoot></table>
        ${notesEn}
      </div>
    </div>
    <div class="bi-grid" style="margin-top:16px">
      <div class="sign-box" dir="rtl">توقيع الموظف<div class="sig-line"></div></div>
      <div class="sign-box" dir="ltr">${esc(LABEL_PAYROLL_EN.empSig)}<div class="sig-line"></div></div>
    </div>
    <div class="bi-grid">
      <div class="sign-box" dir="rtl">توقيع صاحب العمل / المفوّض<div class="sig-line"></div></div>
      <div class="sign-box" dir="ltr">${esc(LABEL_PAYROLL_EN.emprSig)}<div class="sig-line"></div></div>
    </div>
  </div>
</div>`;
    openPrintWindow({
      title: 'Payroll slip / مسير راتب',
      companyName: payroll.companyName || companyNameArDefault,
      subtitle: `${payroll.nameAr || payroll.nameEn} — ${payroll.periodLabel}`,
      extraCss: PRINT_DOC_CSS,
      body,
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
        <td class="td-center">${m}</td>
        <td>${esc(monthNameAr(m))} ${annual.year}</td>
        <td class="td-en">${esc(monthNameEn(m))} ${annual.year}</td>
        <td class="td-num">${esc(hrFmt(amt))}</td>
        <td><div class="sig-line"></div></td>
      </tr>`);
    }
    if (!any) {
      window.alert(lang === 'ar' ? 'فعّل شهراً واحداً على الأقل للطباعة.' : 'Enable at least one month to print.');
      return;
    }
    const body = `
<div class="doc">
  <div class="doc-h">
    <div class="bi-grid">
      <div dir="rtl">
        <h2 class="ttl">جدول مسير رواتب — للاطلاع والتوقيع</h2>
        <div class="sub">${esc(payroll.companyName || companyNameArDefault)} — السنة ${annual.year}</div>
        <div class="sub" style="font-weight:700;margin-top:6px">الموظف: ${esc(payroll.nameAr || payroll.nameEn)}</div>
      </div>
      <div dir="ltr">
        <h2 class="ttl">Payroll schedule — for review & signature</h2>
        <div class="sub">${esc(payroll.companyNameEn || companyNameEnDefault)} — Year ${annual.year}</div>
        <div class="sub" style="font-weight:700;margin-top:6px">Employee: ${esc(payroll.nameEn || payroll.nameAr)}</div>
      </div>
    </div>
  </div>
  <div class="doc-b" dir="rtl">
    <table class="doc-table">
      <thead>
        <tr>
          <th class="td-center">#</th>
          <th>الشهر</th>
          <th class="td-en">Month</th>
          <th>المبلغ (ر.س)</th>
          <th>توقيع الموظف<br/><span style="font-size:10px;font-weight:400">Employee signature</span></th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
      <tfoot>
        <tr>
          <td colspan="3"><strong>الإجمالي / ${esc(LABEL_PAYROLL_EN.totalYear)}</strong></td>
          <td class="td-num"><strong>${esc(hrFmt(annualSum))}</strong></td>
          <td></td>
        </tr>
      </tfoot>
    </table>
    <div class="final-sign">
      <div class="bi-grid">
        <div dir="rtl">
          <div class="ttl">إقرار نهائي وتوقيع الموظف</div>
          <div class="sig-line" style="min-height:40px"></div>
          <div style="font-size:11px;color:#64748b;margin-top:4px">${esc(payroll.nameAr || payroll.nameEn)}</div>
        </div>
        <div dir="ltr">
          <div class="ttl">Final acknowledgement — employee</div>
          <div class="sig-line" style="min-height:40px"></div>
          <div style="font-size:11px;color:#64748b;margin-top:4px">${esc(payroll.nameEn || payroll.nameAr)}</div>
        </div>
      </div>
      <div class="bi-grid" style="margin-top:12px">
        <div dir="rtl">
          <div class="ttl">توقيع صاحب العمل / المفوّض</div>
          <div class="sig-line" style="min-height:40px"></div>
        </div>
        <div dir="ltr">
          <div class="ttl">${esc(LABEL_PAYROLL_EN.emprSig)}</div>
          <div class="sig-line" style="min-height:40px"></div>
        </div>
      </div>
    </div>
  </div>
</div>`;
    openPrintWindow({
      title: `Payroll schedule ${annual.year} / مسير ${annual.year}`,
      companyName: payroll.companyName || companyNameArDefault,
      subtitle: `${payroll.nameAr || payroll.nameEn} — ${annual.year}`,
      extraCss: PRINT_DOC_CSS,
      body,
    });
  };

  const printPayroll = () => {
    if (payroll.payrollFormat === 'annual') printPayrollAnnual();
    else printPayrollSingle();
  };

  const eosWageTotal =
    n(eos.basic) + n(eos.housing) + n(eos.transport) + n(eos.other) +
    (eos.customRows || []).reduce((s, r) => s + n(r.amount), 0);

  const printEos = () => {
    const allowAr = (eos.customRows || [])
      .map((r) => `<tr><td>${esc(r.label)}</td><td class="td-num">${esc(hrFmt(n(r.amount)))}</td></tr>`)
      .join('');
    const allowEn = (eos.customRows || [])
      .map((r) => `<tr><td class="td-en">${esc(r.label)}</td><td class="td-num">${esc(hrFmt(n(r.amount)))}</td></tr>`)
      .join('');
    const notesAr = eos.settlementNotesAr?.trim() ? `<div class="doc-note" dir="rtl">${esc(eos.settlementNotesAr)}</div>` : '';
    const notesEn = eos.settlementNotesEn?.trim() ? `<div class="doc-note" dir="ltr">${esc(eos.settlementNotesEn)}</div>` : '';

    const body = `
<div class="doc">
  <div class="doc-h">
    <div class="bi-grid">
      <div dir="rtl">
        <h2 class="ttl">مخالصة / نهاية خدمة — للاطلاع والتوقيع</h2>
        <div class="sub">${esc(eos.companyName || companyNameArDefault)}</div>
      </div>
      <div dir="ltr">
        <h2 class="ttl">${esc(LABEL_EOS_EN.title)}</h2>
        <div class="sub">${esc(eos.companyNameEn || companyNameEnDefault)}</div>
      </div>
    </div>
  </div>
  <div class="doc-b">
    <div class="bi-grid">
      <div class="bi-col" dir="rtl">
        <h4>بيانات الموظف</h4>
        <table class="doc-table"><tbody>
          <tr><td>${esc(t('employeeSerial'))}</td><td>${esc(eos.employeeSerial)}</td></tr>
          <tr><td>${esc(t('employeeName'))}</td><td>${esc(eos.nameAr || eos.nameEn)}</td></tr>
          <tr><td>${esc(t('jobTitle'))}</td><td>${esc(eos.jobTitle)}</td></tr>
          <tr><td>${esc(t('iqamaNumber'))}</td><td>${esc(eos.iqama)}</td></tr>
          <tr><td>${esc(t('joinDate'))}</td><td>${esc(eos.joinDate)}</td></tr>
          <tr><td>تاريخ نهاية الخدمة</td><td>${esc(eos.endDate)}</td></tr>
        </tbody></table>
        <h4>أجر آخر شهر (بدون أوفر تايم)</h4>
        <table class="doc-table"><tbody>
          <tr><td>${esc(t('basicSalary'))}</td><td class="td-num">${esc(hrFmt(n(eos.basic)))}</td></tr>
          <tr><td>${esc(t('housingAllowance'))}</td><td class="td-num">${esc(hrFmt(n(eos.housing)))}</td></tr>
          <tr><td>${esc(t('transportAllowance'))}</td><td class="td-num">${esc(hrFmt(n(eos.transport)))}</td></tr>
          <tr><td>${esc(t('otherAllowance'))}</td><td class="td-num">${esc(hrFmt(n(eos.other)))}</td></tr>
          ${allowAr}
          <tr><td><strong>مجموع الأجر</strong></td><td class="td-num"><strong>${esc(hrFmt(eosWageTotal))}</strong></td></tr>
        </tbody></table>
        <h4>التسوية</h4>
        <table class="doc-table"><tbody>
          <tr><td>مكافأة نهاية الخدمة</td><td class="td-num">${esc(hrFmt(n(eos.eosAmount)))}</td></tr>
          <tr><td>مستحقات أخرى</td><td class="td-num">${esc(hrFmt(n(eos.otherAccrued)))}</td></tr>
          <tr><td>خصومات</td><td class="td-num">${esc(hrFmt(n(eos.deductions)))}</td></tr>
          <tr><td><strong>صافي المستحق</strong></td><td class="td-num"><strong>${esc(hrFmt(n(eos.netPayable)))}</strong></td></tr>
        </tbody></table>
        ${notesAr}
      </div>
      <div class="bi-col" dir="ltr">
        <h4>${esc(LABEL_EOS_EN.employee)}</h4>
        <table class="doc-table"><tbody>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.serial)}</td><td class="td-en">${esc(eos.employeeSerial)}</td></tr>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.name)}</td><td class="td-en">${esc(eos.nameEn || eos.nameAr)}</td></tr>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.job)}</td><td class="td-en">${esc(eos.jobTitle)}</td></tr>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.iqama)}</td><td class="td-en">${esc(eos.iqama)}</td></tr>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.join)}</td><td class="td-en">${esc(eos.joinDate)}</td></tr>
          <tr><td class="td-en">${esc(LABEL_EOS_EN.endDate)}</td><td class="td-en">${esc(eos.endDate)}</td></tr>
        </tbody></table>
        <h4>${esc(LABEL_EOS_EN.wageTitle)}</h4>
        <table class="doc-table"><tbody>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.basic)}</td><td class="td-num">${esc(hrFmt(n(eos.basic)))}</td></tr>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.housing)}</td><td class="td-num">${esc(hrFmt(n(eos.housing)))}</td></tr>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.transport)}</td><td class="td-num">${esc(hrFmt(n(eos.transport)))}</td></tr>
          <tr><td class="td-en">${esc(LABEL_PAYROLL_EN.other)}</td><td class="td-num">${esc(hrFmt(n(eos.other)))}</td></tr>
          ${allowEn}
          <tr><td class="td-en"><strong>${esc(LABEL_EOS_EN.wageTotal)}</strong></td><td class="td-num"><strong>${esc(hrFmt(eosWageTotal))}</strong></td></tr>
        </tbody></table>
        <h4>${esc(LABEL_EOS_EN.settlement)}</h4>
        <table class="doc-table"><tbody>
          <tr><td class="td-en">${esc(LABEL_EOS_EN.eos)}</td><td class="td-num">${esc(hrFmt(n(eos.eosAmount)))}</td></tr>
          <tr><td class="td-en">${esc(LABEL_EOS_EN.other)}</td><td class="td-num">${esc(hrFmt(n(eos.otherAccrued)))}</td></tr>
          <tr><td class="td-en">${esc(LABEL_EOS_EN.ded)}</td><td class="td-num">${esc(hrFmt(n(eos.deductions)))}</td></tr>
          <tr><td class="td-en"><strong>${esc(LABEL_EOS_EN.net)}</strong></td><td class="td-num"><strong>${esc(hrFmt(n(eos.netPayable)))}</strong></td></tr>
        </tbody></table>
        ${notesEn}
      </div>
    </div>
    <div class="bi-grid" style="margin-top:16px">
      <div class="sign-box" dir="rtl">توقيع الموظف<div class="sig-line"></div></div>
      <div class="sign-box" dir="ltr">${esc(LABEL_PAYROLL_EN.empSig)}<div class="sig-line"></div></div>
    </div>
    <div class="bi-grid">
      <div class="sign-box" dir="rtl">توقيع صاحب العمل / المفوّض<div class="sig-line"></div></div>
      <div class="sign-box" dir="ltr">${esc(LABEL_PAYROLL_EN.emprSig)}<div class="sig-line"></div></div>
    </div>
  </div>
</div>`;
    openPrintWindow({
      title: 'EOS settlement / مخالصة',
      companyName: eos.companyName || companyNameArDefault,
      subtitle: `${eos.nameAr || eos.nameEn}`,
      extraCss: PRINT_DOC_CSS,
      body,
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

          {payroll.payrollFormat === 'single' && (
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
