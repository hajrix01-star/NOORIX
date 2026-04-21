/**
 * HrPrintDocumentsTab — طباعة مسير راتب ومخالصة نهاية خدمة (معزولة: لا تحفظ في النظام).
 * تستورد من بيانات HR وتسمح بالتعديل ثم الطباعة فقط.
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

function emptyPayrollDraft() {
  return {
    periodLabel: '',
    companyName: '',
    employeeSerial: '',
    displayName: '',
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

function emptyEosDraft() {
  return {
    companyName: '',
    displayName: '',
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
    settlementNotes: '',
  };
}

const PRINT_DOC_CSS = `
.doc{max-width:820px;margin:0 auto;border:1px solid #dbe1e8;border-radius:12px;overflow:hidden;background:#fff}
.doc-h{padding:16px 20px;background:#f8fafc;border-bottom:2px solid #185FA5;text-align:center}
.doc-h h2{margin:0;font-size:18px;font-weight:800;color:#0f172a}
.doc-h .sub{margin-top:6px;font-size:13px;color:#475569}
.doc-b{padding:16px 20px}
.doc-table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:14px}
.doc-table th,.doc-table td{border:1px solid #e2e8f0;padding:8px 10px;text-align:right}
.doc-table th{background:#f1f5f9;font-weight:700}
.doc-table .td-num{text-align:center;font-weight:700}
.doc-note{white-space:pre-wrap;font-size:12px;color:#334155;margin:12px 0;padding:10px;background:#fafafa;border-radius:8px;border:1px dashed #cbd5e1}
.sign-row{display:flex;justify-content:space-between;gap:20px;margin-top:36px;padding-top:8px}
.sign-box{flex:1;text-align:center;border-top:2px solid #1e293b;padding-top:10px;font-size:12px;font-weight:600;color:#334155}
@media print{.doc{border:none;border-radius:0}}
`.trim();

export default function HrPrintDocumentsTab() {
  const { t, lang } = useTranslation();
  const { activeCompanyId, companies } = useApp();
  const companyId = activeCompanyId ?? '';
  const company = companies?.find((c) => c.id === companyId);
  const companyNameDefault = lang === 'en' ? (company?.nameEn || company?.nameAr || '') : (company?.nameAr || company?.nameEn || '');

  const [docKind, setDocKind] = useState('payroll');
  const [employeeId, setEmployeeId] = useState('');
  const [payroll, setPayroll] = useState(emptyPayrollDraft);
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

  const importPayroll = useCallback(() => {
    if (!emp) return;
    const customRows = customAllowances
      .filter((a) => a.employeeId === emp.id)
      .map((a) => ({ key: a.id, label: a.nameAr || t('customAllowanceName'), amount: String(n(a.amount)) }));
    setPayroll({
      ...emptyPayrollDraft(),
      periodLabel: defaultPeriodLabel(lang),
      companyName: companyNameDefault,
      employeeSerial: emp.employeeSerial || '',
      displayName: employeeDisplayName(emp, lang),
      jobTitle: emp.jobTitle || '',
      iqama: emp.iqamaNumber || '',
      joinDate: emp.joinDate ? emp.joinDate.slice(0, 10) : '',
      basic: String(n(emp.basicSalary)),
      housing: String(n(emp.housingAllowance)),
      transport: String(n(emp.transportAllowance)),
      other: String(n(emp.otherAllowance)),
      overtime: String(overtimePay(emp, customTotal)),
      customRows,
      showBreakdown: true,
    });
  }, [emp, customAllowances, companyNameDefault, lang, t, customTotal]);

  const importEos = useCallback(() => {
    if (!emp) return;
    const customRows = customAllowances
      .filter((a) => a.employeeId === emp.id)
      .map((a) => ({ key: a.id, label: a.nameAr || t('customAllowanceName'), amount: String(n(a.amount)) }));
    setEos({
      ...emptyEosDraft(),
      companyName: companyNameDefault,
      displayName: employeeDisplayName(emp, lang),
      employeeSerial: emp.employeeSerial || '',
      jobTitle: emp.jobTitle || '',
      iqama: emp.iqamaNumber || '',
      joinDate: emp.joinDate ? emp.joinDate.slice(0, 10) : '',
      basic: String(n(emp.basicSalary)),
      housing: String(n(emp.housingAllowance)),
      transport: String(n(emp.transportAllowance)),
      other: String(n(emp.otherAllowance)),
      customRows,
      settlementNotes:
        lang === 'ar'
          ? 'أقر أنا الموقع أدناه بأنني استلمت كافة مستحقاتي النظامية من صاحب العمل، وأبرئ ذمته من أي مطالبة لاحقة تتعلق بعقد العمل أو نهاية الخدمة، وفق ما هو مبين أعلاه.'
          : 'I, the undersigned, acknowledge receipt of all statutory dues from the employer and release the employer from any further claims relating to employment or end of service, as stated above.',
    });
  }, [emp, customAllowances, companyNameDefault, lang, t]);

  const printPayroll = () => {
    const rows = [];
    const push = (label, val) => rows.push(`<tr><td>${esc(label)}</td><td class="td-num">${esc(hrFmt(val))} SR</td></tr>`);
    push(t('basicSalary'), n(payroll.basic));
    push(t('housingAllowance'), n(payroll.housing));
    push(t('transportAllowance'), n(payroll.transport));
    push(t('otherAllowance'), n(payroll.other));
    push(lang === 'ar' ? 'تقدير الأوفر تايم (شهري)' : 'Overtime (monthly est.)', n(payroll.overtime));
    if (payroll.showBreakdown) {
      (payroll.customRows || []).forEach((r) => push(r.label || '—', n(r.amount)));
    } else {
      const csum = (payroll.customRows || []).reduce((s, r) => s + n(r.amount), 0);
      if (csum > 0) push(t('customAllowances'), csum);
    }
    const notesBlock = payroll.notes?.trim()
      ? `<div class="doc-note">${esc(payroll.notes)}</div>`
      : '';
    const body = `
<div class="doc">
  <div class="doc-h">
    <h2>${esc(lang === 'ar' ? 'مسير راتب — للاطلاع والتوقيع' : 'Payroll slip — for review & signature')}</h2>
    <div class="sub">${esc(payroll.periodLabel)}</div>
  </div>
  <div class="doc-b">
    <table class="doc-table"><tbody>
      <tr><th colspan="2">${esc(lang === 'ar' ? 'بيانات الموظف' : 'Employee')}</th></tr>
      <tr><td>${esc(t('employeeSerial'))}</td><td>${esc(payroll.employeeSerial)}</td></tr>
      <tr><td>${esc(t('employeeName'))}</td><td>${esc(payroll.displayName)}</td></tr>
      <tr><td>${esc(t('jobTitle'))}</td><td>${esc(payroll.jobTitle)}</td></tr>
      <tr><td>${esc(t('iqamaNumber'))}</td><td>${esc(payroll.iqama)}</td></tr>
      <tr><td>${esc(t('joinDate'))}</td><td>${esc(payroll.joinDate)}</td></tr>
    </tbody></table>
    <table class="doc-table"><thead><tr><th>${esc(lang === 'ar' ? 'البند' : 'Item')}</th><th>${esc(lang === 'ar' ? 'المبلغ (ر.س)' : 'Amount (SAR)')}</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
    <tfoot><tr><td>${esc(t('totalSalary'))}</td><td class="td-num">${esc(hrFmt(payrollTotal))} SR</td></tr></tfoot></table>
    ${notesBlock}
    <div class="sign-row">
      <div class="sign-box">${esc(lang === 'ar' ? 'توقيع الموظف' : 'Employee signature')}</div>
      <div class="sign-box">${esc(lang === 'ar' ? 'توقيع صاحب العمل / المفوّض' : 'Employer / authorized signatory')}</div>
    </div>
  </div>
</div>`;
    openPrintWindow({
      title: lang === 'ar' ? 'مسير راتب' : 'Payroll slip',
      companyName: payroll.companyName || companyNameDefault,
      subtitle: payroll.periodLabel,
      extraCss: PRINT_DOC_CSS,
      body,
    });
  };

  const eosWageTotal =
    n(eos.basic) + n(eos.housing) + n(eos.transport) + n(eos.other) +
    (eos.customRows || []).reduce((s, r) => s + n(r.amount), 0);

  const printEos = () => {
    const allowRows = (eos.customRows || [])
      .map((r) => `<tr><td>${esc(r.label)}</td><td>${esc(hrFmt(n(r.amount)))}</td></tr>`)
      .join('');
    const notesBlock = eos.settlementNotes?.trim()
      ? `<div class="doc-note">${esc(eos.settlementNotes)}</div>`
      : '';
    const body = `
<div class="doc">
  <div class="doc-h">
    <h2>${esc(lang === 'ar' ? 'مخالصة / نهاية خدمة — للاطلاع والتوقيع' : 'End-of-service settlement — for review & signature')}</h2>
    <div class="sub">${esc(eos.companyName)}</div>
  </div>
  <div class="doc-b">
    <table class="doc-table"><tbody>
      <tr><th colspan="2">${esc(lang === 'ar' ? 'بيانات الموظف' : 'Employee')}</th></tr>
      <tr><td>${esc(t('employeeSerial'))}</td><td>${esc(eos.employeeSerial)}</td></tr>
      <tr><td>${esc(t('employeeName'))}</td><td>${esc(eos.displayName)}</td></tr>
      <tr><td>${esc(t('jobTitle'))}</td><td>${esc(eos.jobTitle)}</td></tr>
      <tr><td>${esc(t('iqamaNumber'))}</td><td>${esc(eos.iqama)}</td></tr>
      <tr><td>${esc(t('joinDate'))}</td><td>${esc(eos.joinDate)}</td></tr>
      <tr><td>${esc(lang === 'ar' ? 'تاريخ نهاية الخدمة' : 'End of service date')}</td><td>${esc(eos.endDate)}</td></tr>
    </tbody></table>
    <table class="doc-table"><thead><tr><th>${esc(lang === 'ar' ? 'أجر آخر شهر (بدون أوفر تايم — قابل للتعديل)' : 'Last wage components (excl. OT — editable)')}</th><th>${esc(lang === 'ar' ? 'ر.س' : 'SAR')}</th></tr></thead>
    <tbody>
      <tr><td>${esc(t('basicSalary'))}</td><td>${esc(hrFmt(n(eos.basic)))}</td></tr>
      <tr><td>${esc(t('housingAllowance'))}</td><td>${esc(hrFmt(n(eos.housing)))}</td></tr>
      <tr><td>${esc(t('transportAllowance'))}</td><td>${esc(hrFmt(n(eos.transport)))}</td></tr>
      <tr><td>${esc(t('otherAllowance'))}</td><td>${esc(hrFmt(n(eos.other)))}</td></tr>
      ${allowRows}
      <tr><td><strong>${esc(lang === 'ar' ? 'مجموع الأجر للمخالصة' : 'Wage package total')}</strong></td><td><strong>${esc(hrFmt(eosWageTotal))}</strong></td></tr>
    </tbody></table>
    <table class="doc-table"><thead><tr><th>${esc(lang === 'ar' ? 'بند التسوية' : 'Settlement line')}</th><th>${esc(lang === 'ar' ? 'ر.س' : 'SAR')}</th></tr></thead>
    <tbody>
      <tr><td>${esc(lang === 'ar' ? 'مكافأة نهاية الخدمة (يدوي)' : 'EOS gratuity (manual)')}</td><td>${esc(hrFmt(n(eos.eosAmount)))}</td></tr>
      <tr><td>${esc(lang === 'ar' ? 'مستحقات أخرى' : 'Other dues')}</td><td>${esc(hrFmt(n(eos.otherAccrued)))}</td></tr>
      <tr><td>${esc(lang === 'ar' ? 'خصومات' : 'Deductions')}</td><td>${esc(hrFmt(n(eos.deductions)))}</td></tr>
      <tr><td><strong>${esc(lang === 'ar' ? 'صافي المستحق' : 'Net payable')}</strong></td><td><strong>${esc(hrFmt(n(eos.netPayable)))}</strong></td></tr>
    </tbody></table>
    ${notesBlock}
    <div class="sign-row">
      <div class="sign-box">${esc(lang === 'ar' ? 'توقيع الموظف' : 'Employee signature')}</div>
      <div class="sign-box">${esc(lang === 'ar' ? 'توقيع صاحب العمل / المفوّض' : 'Employer / authorized signatory')}</div>
    </div>
  </div>
</div>`;
    openPrintWindow({
      title: lang === 'ar' ? 'مخالصة نهاية خدمة' : 'End-of-service settlement',
      companyName: eos.companyName || companyNameDefault,
      subtitle: eos.displayName,
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
        <div className="space-y-3 border-t border-noorix-border pt-4">
          <p className="m-0 text-[12px] font-semibold text-noorix-blue">{t('hrPrintPayrollSection')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="text" label={t('hrPrintCompanyName')} value={payroll.companyName} onChange={(e) => updatePayroll({ companyName: e.target.value })} />
            <Input type="text" label={t('hrPrintPeriodLabel')} value={payroll.periodLabel} onChange={(e) => updatePayroll({ periodLabel: e.target.value })} />
            <Input type="text" label={t('employeeSerial')} value={payroll.employeeSerial} onChange={(e) => updatePayroll({ employeeSerial: e.target.value })} />
            <Input type="text" label={t('employeeName')} value={payroll.displayName} onChange={(e) => updatePayroll({ displayName: e.target.value })} />
            <Input type="text" label={t('jobTitle')} value={payroll.jobTitle} onChange={(e) => updatePayroll({ jobTitle: e.target.value })} />
            <Input type="text" label={t('iqamaNumber')} value={payroll.iqama} onChange={(e) => updatePayroll({ iqama: e.target.value })} />
            <Input type="date" label={t('joinDate')} value={payroll.joinDate} onChange={(e) => updatePayroll({ joinDate: e.target.value })} />
          </div>
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
        </div>
      )}

      {docKind === 'eos' && (
        <div className="space-y-3 border-t border-noorix-border pt-4">
          <p className="m-0 text-[12px] font-semibold text-noorix-blue">{t('hrPrintEosSection')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="text" label={t('hrPrintCompanyName')} value={eos.companyName} onChange={(e) => updateEos({ companyName: e.target.value })} />
            <Input type="text" label={t('employeeSerial')} value={eos.employeeSerial} onChange={(e) => updateEos({ employeeSerial: e.target.value })} />
            <Input type="text" label={t('employeeName')} value={eos.displayName} onChange={(e) => updateEos({ displayName: e.target.value })} />
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
          <Input multiline rows={5} label={t('hrPrintSettlementText')} value={eos.settlementNotes} onChange={(e) => updateEos({ settlementNotes: e.target.value })} />
          <div className="text-[12px] text-noorix-muted">
            {t('hrPrintPackageTotal')}: <FmtNum n={eosWageTotal} /> SR
          </div>
        </div>
      )}
    </div>
  );
}
