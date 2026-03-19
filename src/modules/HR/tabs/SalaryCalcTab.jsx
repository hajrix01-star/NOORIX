/**
 * SalaryCalcTab — حاسبة الرواتب (عكسية + ديناميكية)
 *
 * مراجع قانونية:
 * - المادة 98: ساعات العمل المعيارية 8 ساعات يومياً.
 * - المادة 107: أجر الأوفر تايم = أجر الساعة الفعلي + 50% من أجر الساعة الأساسي.
 */
import React, { useMemo, useState, useEffect } from 'react';
import Decimal from 'decimal.js';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { useEmployees } from '../../../hooks/useEmployees';
import { useCustomAllowances } from '../../../hooks/useCustomAllowances';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateEmployee } from '../../../services/api';
import { fmt } from '../../../utils/format';
import Toast from '../../../components/Toast';

const SAUDI_STANDARD_HOURS = 8;
const SAUDI_DAYS_PER_MONTH = 30;   // المعيار السعودي: 30 يوم (بما فيها العطل)
const WORK_DAYS_PER_MONTH = 26;    // أيام العمل الفعلية شهرياً

/** استخراج عدد الساعات من نص (مثل "8" أو "8 ساعات يومياً") */
function parseWorkHours(str) {
  if (!str) return SAUDI_STANDARD_HOURS;
  const m = String(str).match(/(\d+(?:\.\d+)?)/);
  return m ? Math.max(1, Math.min(12, parseFloat(m[1]))) : SAUDI_STANDARD_HOURS;
}

function toDecimal(value) {
  return new Decimal(value || 0);
}

export default function SalaryCalcTab() {
  const { t } = useTranslation();
  const { activeCompanyId, companies } = useApp();
  const companyId = activeCompanyId ?? '';
  const company = companies?.find((c) => c.id === companyId);
  const companyName = company?.nameAr || company?.name || 'الشركة';
  const queryClient = useQueryClient();
  const { employees } = useEmployees(companyId);
  const { allowances: customAllowances = [] } = useCustomAllowances(companyId);

  const [targetTotal, setTargetTotal] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState(String(SAUDI_STANDARD_HOURS));
  const [daysPerMonth, setDaysPerMonth] = useState(String(WORK_DAYS_PER_MONTH));
  const [vacationDays, setVacationDays] = useState('0');
  const [housingAllowance, setHousingAllowance] = useState('0');
  const [transportAllowance, setTransportAllowance] = useState('0');
  const [otherAllowance, setOtherAllowance] = useState('0');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const emp = employees.find((e) => e.id === selectedEmployee);
  const allowanceTotals = useMemo(() => {
    const map = new Map();
    for (const row of customAllowances) {
      const employeeId = row.employeeId;
      if (!employeeId) continue;
      map.set(employeeId, (map.get(employeeId) || 0) + (Number(row.amount) || 0));
    }
    return map;
  }, [customAllowances]);

  function computeTargetFromCurrentEmployee(employee, customTotal, hoursValue, workDaysValue) {
    const basic = toDecimal(employee?.basicSalary || 0);
    const editableAllowances = toDecimal(employee?.housingAllowance || 0)
      .plus(employee?.transportAllowance || 0)
      .plus(employee?.otherAllowance || 0);
    const actualWage = basic.plus(editableAllowances).plus(customTotal || 0);
    const dailyHours = Math.max(1, Math.min(12, parseFloat(hoursValue) || SAUDI_STANDARD_HOURS));
    const overtimeHoursPerDay = Math.max(0, dailyHours - SAUDI_STANDARD_HOURS);
    const workDays = Math.max(1, parseFloat(workDaysValue) || WORK_DAYS_PER_MONTH);
    if (overtimeHoursPerDay <= 0) return actualWage;
    const actualHourlyRate = actualWage.div(SAUDI_DAYS_PER_MONTH).div(SAUDI_STANDARD_HOURS);
    const basicHourlyRate = basic.div(SAUDI_DAYS_PER_MONTH).div(SAUDI_STANDARD_HOURS);
    const overtimeRate = actualHourlyRate.plus(basicHourlyRate.times(0.5));
    const overtimePay = overtimeRate.times(overtimeHoursPerDay).times(workDays);
    return actualWage.plus(overtimePay);
  }

  // عند اختيار موظف: تحميل بياناته الحالية داخل الحاسبة بشكل ديناميكي
  useEffect(() => {
    if (!selectedEmployee) return;
    const e = employees.find((x) => x.id === selectedEmployee);
    if (e) {
      const dailyHours = parseWorkHours(e.workHours);
      const customTotal = new Decimal(allowanceTotals.get(e.id) || 0);
      setHoursPerDay(String(dailyHours));
      setHousingAllowance(String(e.housingAllowance ?? 0));
      setTransportAllowance(String(e.transportAllowance ?? 0));
      setOtherAllowance(String(e.otherAllowance ?? 0));
      setTargetTotal(computeTargetFromCurrentEmployee(e, customTotal, dailyHours, daysPerMonth).toDecimalPlaces(2).toString());
    }
  }, [selectedEmployee, employees, allowanceTotals]);

  const hours = Math.max(1, Math.min(12, parseFloat(hoursPerDay) || SAUDI_STANDARD_HOURS));
  const workDays = Math.max(1, parseFloat(daysPerMonth) || WORK_DAYS_PER_MONTH);
  const vacDays = parseFloat(vacationDays) || 0;
  const overtimeHoursPerDay = Math.max(0, hours - SAUDI_STANDARD_HOURS);
  const totalTarget = toDecimal(targetTotal);
  const housing = toDecimal(housingAllowance);
  const transport = toDecimal(transportAllowance);
  const other = toDecimal(otherAllowance);
  const editableAllowances = housing.plus(transport).plus(other);
  const customAllowanceTotal = toDecimal(emp ? (allowanceTotals.get(emp.id) || 0) : 0);
  const totalAllowances = editableAllowances.plus(customAllowanceTotal);
  const overtimeFactor = new Decimal(overtimeHoursPerDay).times(workDays).div(SAUDI_DAYS_PER_MONTH * SAUDI_STANDARD_HOURS);
  const basicNumerator = totalTarget.minus(totalAllowances.times(new Decimal(1).plus(overtimeFactor)));
  const basicDenominator = new Decimal(1).plus(overtimeFactor.times(1.5));
  const basic = Decimal.max(basicNumerator.div(basicDenominator), 0);
  const actualWage = basic.plus(totalAllowances);
  const deduction = vacDays > 0 ? actualWage.times(vacDays).div(workDays) : new Decimal(0);
  const hourlyRate = actualWage.div(SAUDI_DAYS_PER_MONTH).div(SAUDI_STANDARD_HOURS);
  const basicHourlyRate = basic.div(SAUDI_DAYS_PER_MONTH).div(SAUDI_STANDARD_HOURS);
  const overtimeRate = hourlyRate.plus(basicHourlyRate.times(0.5));
  const overtimePay = overtimeRate.times(overtimeHoursPerDay).times(workDays);
  const calculatedTotal = actualWage.plus(overtimePay);
  const netSalary = calculatedTotal.minus(deduction);
  const inverseWarning = totalTarget.gt(0) && basicNumerator.lt(0);

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }) => {
      const res = await updateEmployee(id, body, companyId);
      if (!res?.success) {
        throw new Error(res?.error || t('updateFailed') || 'فشل تحديث الراتب');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', emp?.id, companyId] });
      setToast({ visible: true, message: t('salaryCalcUpdated') || 'تم تحديث الراتب بنجاح', type: 'success' });
    },
    onError: (e) => setToast({ visible: true, message: e?.message || t('saveFailed'), type: 'error' }),
  });

  function handleUpdateSalary() {
    if (!emp || !companyId || totalTarget.lte(0) || inverseWarning) return;
    updateMutation.mutate({
      id: emp.id,
      body: {
        basicSalary: basic.toDecimalPlaces(2).toNumber(),
        housingAllowance: housing.toDecimalPlaces(2).toNumber(),
        transportAllowance: transport.toDecimalPlaces(2).toNumber(),
        otherAllowance: other.toDecimalPlaces(2).toNumber(),
        workHours: String(Math.round(hours * 10) / 10),
      },
    });
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
    fontSize: 14, fontFamily: 'inherit',
  };

  const employeeAllowanceRows = useMemo(() => {
    if (!emp) return [];
    const rows = [];
    if (housing.gt(0)) rows.push({ label: t('housingAllowance'), amount: housing.toNumber() });
    if (transport.gt(0)) rows.push({ label: t('transportAllowance'), amount: transport.toNumber() });
    if (other.gt(0)) rows.push({ label: t('otherAllowance'), amount: other.toNumber() });
    const customRows = customAllowances
      .filter((row) => row.employeeId === emp.id && Number(row.amount) > 0)
      .map((row) => ({ label: row.nameAr || t('customAllowanceName'), amount: Number(row.amount) || 0 }));
    return [...rows, ...customRows];
  }, [emp, housing, transport, other, customAllowances, t]);

  function handlePrint() {
    const reportDate = new Date().toISOString().slice(0, 10);
    const allowanceRowsHtml = employeeAllowanceRows.length
      ? employeeAllowanceRows
          .map((row) => `<tr><td>${row.label}</td><td class="num">${fmt(row.amount)}</td></tr>`)
          .join('')
      : `<tr><td>لا توجد بدلات مخصصة</td><td class="num">0</td></tr>`;
    const html = `<!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>Salary Calculator</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>
          body{font-family:'Cairo',Arial,sans-serif;background:#fff;color:#111;padding:20px;line-height:1.6}
          .doc{border:1px solid #dbe1e8;border-radius:12px;overflow:hidden}
          .head{padding:14px 18px;border-bottom:1px solid #dbe1e8;background:#f8fafc;text-align:center}
          .section{padding:14px 18px;border-bottom:1px solid #e5e7eb}
          .bi{display:grid;grid-template-columns:1fr 1px 1fr;gap:12px;align-items:stretch}
          .sep{background:#cbd5e1;border-radius:999px}
          .box{border:1px solid #dbe1e8;border-radius:10px;padding:12px}
          .row{display:flex;justify-content:space-between;gap:12px;margin-bottom:6px}
          .en{direction:ltr;text-align:left}
          .num{font-family:'Cairo',Arial,sans-serif}
          table{width:100%;border-collapse:collapse}
          th,td{border:1px solid #dbe1e8;padding:8px;font-size:12px}
          th{background:#f8fafc}
        </style>
      </head>
      <body>
        <div class="doc">
          <div class="head">
            <div style="font-weight:800;font-size:18px">${companyName}</div>
            <div style="font-weight:700;margin-top:6px">تقرير حاسبة الرواتب / Salary Calculator Report</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px">Date: ${reportDate}</div>
          </div>
          <div class="section">
            <div class="bi">
              <div class="box">
                <div class="row"><strong>الموظف</strong><span>${emp?.name || '—'}</span></div>
                <div class="row"><strong>ساعات العمل اليومية</strong><span class="num">${fmt(hours)}</span></div>
                <div class="row"><strong>أيام العمل بالشهر</strong><span class="num">${fmt(workDays)}</span></div>
                <div class="row"><strong>أيام الإجازة غير المدفوعة</strong><span class="num">${fmt(vacDays)}</span></div>
                <div class="row"><strong>ساعات الأوفرتايم اليومية</strong><span class="num">${fmt(overtimeHoursPerDay)}</span></div>
                <div class="row"><strong>الإجمالي المستهدف</strong><span class="num">${fmt(totalTarget.toNumber())}</span></div>
                <div class="row"><strong>الراتب الأساسي</strong><span class="num">${fmt(basic.toNumber())}</span></div>
                <div class="row"><strong>البدلات الأساسية</strong><span class="num">${fmt(editableAllowances.toNumber())}</span></div>
                <div class="row"><strong>البدلات المخصصة</strong><span class="num">${fmt(customAllowanceTotal.toNumber())}</span></div>
                <div class="row"><strong>الأجر الفعلي</strong><span class="num">${fmt(actualWage.toNumber())}</span></div>
                <div class="row"><strong>أجر الساعة</strong><span class="num">${fmt(hourlyRate.toNumber())}</span></div>
                <div class="row"><strong>أجر ساعة الأوفرتايم</strong><span class="num">${fmt(overtimeRate.toNumber())}</span></div>
                <div class="row"><strong>قيمة الأوفرتايم</strong><span class="num">${fmt(overtimePay.toNumber())}</span></div>
                <div class="row"><strong>خصم الإجازة</strong><span class="num">${fmt(deduction.toNumber())}</span></div>
                <div class="row"><strong>الإجمالي المحسوب</strong><span class="num">${fmt(calculatedTotal.toNumber())}</span></div>
                <div class="row"><strong>صافي الراتب</strong><span class="num">${fmt(netSalary.toNumber())}</span></div>
              </div>
              <div class="sep"></div>
              <div class="box en">
                <div class="row"><strong>Employee</strong><span>${emp?.name || '—'}</span></div>
                <div class="row"><strong>Hours per day</strong><span class="num">${fmt(hours)}</span></div>
                <div class="row"><strong>Work days per month</strong><span class="num">${fmt(workDays)}</span></div>
                <div class="row"><strong>Unpaid leave days</strong><span class="num">${fmt(vacDays)}</span></div>
                <div class="row"><strong>Daily overtime hours</strong><span class="num">${fmt(overtimeHoursPerDay)}</span></div>
                <div class="row"><strong>Target Total</strong><span class="num">${fmt(totalTarget.toNumber())}</span></div>
                <div class="row"><strong>Basic Salary</strong><span class="num">${fmt(basic.toNumber())}</span></div>
                <div class="row"><strong>Base allowances</strong><span class="num">${fmt(editableAllowances.toNumber())}</span></div>
                <div class="row"><strong>Custom allowances</strong><span class="num">${fmt(customAllowanceTotal.toNumber())}</span></div>
                <div class="row"><strong>Actual wage</strong><span class="num">${fmt(actualWage.toNumber())}</span></div>
                <div class="row"><strong>Hourly rate</strong><span class="num">${fmt(hourlyRate.toNumber())}</span></div>
                <div class="row"><strong>Overtime hourly rate</strong><span class="num">${fmt(overtimeRate.toNumber())}</span></div>
                <div class="row"><strong>Overtime Pay</strong><span class="num">${fmt(overtimePay.toNumber())}</span></div>
                <div class="row"><strong>Leave deduction</strong><span class="num">${fmt(deduction.toNumber())}</span></div>
                <div class="row"><strong>Calculated total</strong><span class="num">${fmt(calculatedTotal.toNumber())}</span></div>
                <div class="row"><strong>Net Salary</strong><span class="num">${fmt(netSalary.toNumber())}</span></div>
              </div>
            </div>
          </div>
          <div class="section">
            <div class="bi">
              <div class="box">
                <div style="font-weight:700;margin-bottom:8px">تفاصيل البدلات</div>
                <table>
                  <thead><tr><th>البدل</th><th>القيمة</th></tr></thead>
                  <tbody>${allowanceRowsHtml}</tbody>
                </table>
              </div>
              <div class="sep"></div>
              <div class="box en">
                <div style="font-weight:700;margin-bottom:8px">Allowances Breakdown</div>
                <table>
                  <thead><tr><th>Allowance</th><th>Amount</th></tr></thead>
                  <tbody>${allowanceRowsHtml}</tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      win.onafterprint = () => win.close();
      win.print();
    };
  }

  return (
    <div className="noorix-surface-card" style={{ padding: 24, maxWidth: 520 }}>
      <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>{t('hrTabSalaryCalc')}</h3>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('selectEmployee')}</label>
        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          style={inputStyle}
        >
          <option value="">— {t('salaryCalcSelectOrEnter') || 'اختر أو أدخل يدوياً'} —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name || e.nameAr || e.id} — {fmt(computeTargetFromCurrentEmployee(e, new Decimal(allowanceTotals.get(e.id) || 0), parseWorkHours(e.workHours), workDays).toNumber())} ر.س
              {e.workHours ? ` (${parseWorkHours(e.workHours)} ${t('salaryCalcHour')})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          {t('salaryCalcGross')} <span style={{ fontSize: 11, color: 'var(--noorix-text-muted)', fontWeight: 400 }}>(الإجمالي الشهري شامل الأوفر تايم)</span>
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={targetTotal}
          onChange={(e) => setTargetTotal(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            {t('salaryCalcHoursPerDay')} <span style={{ fontSize: 11, color: 'var(--noorix-text-muted)', fontWeight: 400 }}>({t('salaryCalcSaudiStandard') || 'السعودية: 8'})</span>
          </label>
          <input
            type="number"
            min="1"
            max="12"
            step="0.5"
            value={hoursPerDay}
            onChange={(e) => setHoursPerDay(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('salaryCalcDaysPerMonth')} <span style={{ fontSize: 11, color: 'var(--noorix-text-muted)', fontWeight: 400 }}>({t('salaryCalcForDeduction') || 'للخصم'})</span></label>
          <input type="number" min="1" value={daysPerMonth} onChange={(e) => setDaysPerMonth(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('housingAllowance')}</label>
          <input type="number" step="0.01" min="0" value={housingAllowance} onChange={(e) => setHousingAllowance(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('transportAllowance')}</label>
          <input type="number" step="0.01" min="0" value={transportAllowance} onChange={(e) => setTransportAllowance(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('otherAllowance')}</label>
          <input type="number" step="0.01" min="0" value={otherAllowance} onChange={(e) => setOtherAllowance(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('salaryCalcVacationDays')}</label>
          <input type="number" min="0" value={vacationDays} onChange={(e) => setVacationDays(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>ساعات الأوفر تايم اليومية</label>
          <input type="number" value={overtimeHoursPerDay} readOnly style={{ ...inputStyle, background: 'var(--noorix-bg-muted)' }} />
        </div>
      </div>

      <div className="noorix-result-panel" style={{ marginBottom: 20 }}>
        <div className="noorix-result-panel__stripe" />
        <div className="noorix-result-panel__body">
          {[
            { label: t('salaryCalcGross'),               value: `${fmt(totalTarget.toNumber())} ﷼` },
            { label: t('salaryCalcBasic'),               value: `${fmt(basic.toNumber())} ﷼` },
            { label: t('salaryCalcAllowances'),          value: `${fmt(editableAllowances.toNumber())} ﷼` },
            { label: t('salaryCalcAdditionalAllowances'), value: `${fmt(customAllowanceTotal.toNumber())} ﷼` },
            { label: t('salaryCalcDeduction'),           value: `${fmt(deduction.toNumber())} ﷼` },
            { label: t('salaryCalcHourlyRate'),          value: `${fmt(hourlyRate.toNumber())} ﷼/${t('salaryCalcHour')}` },
            { label: t('salaryCalcBasicHourlyRate'),     value: `${fmt(basicHourlyRate.toNumber())} ﷼/${t('salaryCalcHour')}` },
            { label: `${t('salaryCalcOvertimeRate')} (م107)`, value: `${fmt(overtimeRate.toNumber())} ﷼/${t('salaryCalcHour')}` },
            { label: t('salaryCalcOvertimePay'),         value: `${fmt(overtimePay.toNumber())} ﷼` },
          ].map(({ label, value }) => (
            <div key={label} className="noorix-result-panel__row">
              <span className="noorix-result-panel__row-label">{label}</span>
              <span className="noorix-result-panel__row-value">{value}</span>
            </div>
          ))}
          <div className="noorix-result-panel__row noorix-result-panel__row--highlight">
            <span className="noorix-result-panel__row-label">{t('salaryCalcNetSalary')}</span>
            <span className="noorix-result-panel__row-value">{fmt(netSalary.toNumber())} ﷼</span>
          </div>
        </div>
        {inverseWarning && (
          <div className="noorix-result-panel__warn">
            الإجمالي المستهدف أقل من البدلات الحالية مع ساعات العمل المحددة. خفف البدلات أو زد الإجمالي حتى يمكن استخراج الأساسي.
          </div>
        )}
        <div className="noorix-result-panel__note">{t('salaryCalcLegalHint')}</div>
      </div>

      {emp && (
        <div style={{ marginBottom: 20, border: '1px solid var(--noorix-border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--noorix-border)', fontWeight: 700 }}>
            تفاصيل بدلات الموظف
          </div>
          <div style={{ display: 'grid' }}>
            {employeeAllowanceRows.length === 0 ? (
              <div style={{ padding: '12px', color: 'var(--noorix-text-muted)', fontSize: 12 }}>لا توجد بدلات مسجلة لهذا الموظف.</div>
            ) : employeeAllowanceRows.map((row, idx) => (
              <div
                key={`${row.label}-${idx}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr',
                  gap: 12,
                  padding: '10px 12px',
                  borderBottom: idx === employeeAllowanceRows.length - 1 ? 'none' : '1px solid var(--noorix-border)',
                }}
              >
                <div>{row.label}</div>
                <div style={{ fontFamily: 'var(--noorix-font-numbers)', textAlign: 'right', fontWeight: 600 }}>{fmt(row.amount, 2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {emp && (
        <button
          type="button"
          className="noorix-btn-nav noorix-btn-success"
          onClick={handleUpdateSalary}
          disabled={updateMutation.isPending || basic.lte(0) || inverseWarning}
          style={{ width: '100%', padding: 12, fontWeight: 700 }}
        >
          {updateMutation.isPending ? t('saving') : (t('salaryCalcUpdateEmployee') || 'تحديث الراتب للموظف')}
        </button>
      )}
      <button
        type="button"
        className="noorix-btn-nav"
        onClick={handlePrint}
        style={{ width: '100%', padding: 10, marginTop: 8 }}
      >
        {t('printCalc')}
      </button>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onClose={() => setToast((p) => ({ ...p, visible: false }))} />
    </div>
  );
}
