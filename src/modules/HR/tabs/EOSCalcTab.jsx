/**
 * EOSCalcTab — حاسبة نهاية الخدمة
 *
 * مراجع قانونية:
 * - المادة 84: نصف شهر عن كل سنة من أول خمس سنوات، وشهر عن كل سنة بعدها.
 * - المادة 85: عند الاستقالة 0% قبل سنتين، 1/3 من سنتين إلى أقل من 5، 2/3 من 5 إلى أقل من 10، وكامل الاستحقاق بعد 10 سنوات.
 */
import React, { useEffect, useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { useEmployees } from '../../../hooks/useEmployees';
import { useCustomAllowances } from '../../../hooks/useCustomAllowances';
import { fmt } from '../../../utils/format';

const DAY_MS = 24 * 60 * 60 * 1000;
const SAUDI_STANDARD_HOURS = 8;

function parseWorkHours(str) {
  if (!str) return SAUDI_STANDARD_HOURS;
  const m = String(str).match(/(\d+(?:\.\d+)?)/);
  return m ? Math.max(1, Math.min(12, parseFloat(m[1]))) : SAUDI_STANDARD_HOURS;
}

function calculateServiceDays(joinDate, endDate) {
  const start = new Date(joinDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

function getEligibilityFactor(reason, serviceYears) {
  if (reason === 'article80') return new Decimal(0);
  if (reason === 'employer' || reason === 'article81') return new Decimal(1);
  if (serviceYears < 2) return new Decimal(0);
  if (serviceYears < 5) return new Decimal(1).div(3);
  if (serviceYears < 10) return new Decimal(2).div(3);
  return new Decimal(1);
}

export default function EOSCalcTab() {
  const { t } = useTranslation();
  const { activeCompanyId, companies } = useApp();
  const companyId = activeCompanyId ?? '';
  const company = companies?.find((c) => c.id === companyId);
  const companyName = company?.nameAr || company?.name || 'الشركة';
  const { employees } = useEmployees(companyId);
  const { allowances: customAllowances = [] } = useCustomAllowances(companyId);

  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lastSalary, setLastSalary] = useState('');
  const [terminationReason, setTerminationReason] = useState('employer');

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
  const jd = joinDate || emp?.joinDate;
  const ed = endDate;
  const sal = new Decimal(lastSalary || 0);

  useEffect(() => {
    if (!selectedEmployee) return;
    const em = employees.find((row) => row.id === selectedEmployee);
    if (!em) return;
    setJoinDate(em.joinDate ? em.joinDate.slice(0, 10) : '');
    const total = new Decimal(em.basicSalary || 0)
      .plus(em.housingAllowance || 0)
      .plus(em.transportAllowance || 0)
      .plus(em.otherAllowance || 0)
      .plus(allowanceTotals.get(em.id) || 0);
    setLastSalary(total.toString());
  }, [selectedEmployee, employees, allowanceTotals]);

  const serviceDays = jd && ed ? calculateServiceDays(jd, ed) : 0;
  const serviceYears = new Decimal(serviceDays).div(360);
  const firstFiveYears = Decimal.min(serviceYears, 5);
  const remainingYears = Decimal.max(serviceYears.minus(5), 0);
  const fullAward = sal.times(firstFiveYears).times(0.5).plus(sal.times(remainingYears));
  const eligibilityFactor = getEligibilityFactor(terminationReason, serviceYears.toNumber());
  const eosAmount = fullAward.times(eligibilityFactor);

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
    fontSize: 14, fontFamily: 'inherit',
  };

  const allowanceRows = useMemo(() => {
    if (!emp) return [];
    const rows = [];
    const housing = Number(emp.housingAllowance || 0);
    const transport = Number(emp.transportAllowance || 0);
    const other = Number(emp.otherAllowance || 0);
    const custom = Number(allowanceTotals.get(emp.id) || 0);
    if (housing > 0) rows.push({ ar: 'بدل السكن', en: 'Housing', amount: housing });
    if (transport > 0) rows.push({ ar: 'بدل المواصلات', en: 'Transport', amount: transport });
    if (other > 0) rows.push({ ar: 'بدل آخر', en: 'Other', amount: other });
    if (custom > 0) rows.push({ ar: 'بدلات مخصصة', en: 'Custom allowances', amount: custom });
    return rows;
  }, [allowanceTotals, emp]);

  function handlePrint() {
    const reportDate = new Date().toISOString().slice(0, 10);
    const allowanceRowsAr = allowanceRows.length
      ? allowanceRows.map((r) => `<tr><td>${r.ar}</td><td class="num">${fmt(r.amount)}</td></tr>`).join('')
      : '<tr><td>لا توجد بدلات</td><td class="num">0</td></tr>';
    const allowanceRowsEn = allowanceRows.length
      ? allowanceRows.map((r) => `<tr><td>${r.en}</td><td class="num">${fmt(r.amount)}</td></tr>`).join('')
      : '<tr><td>No allowances</td><td class="num">0</td></tr>';
    const html = `<!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>EOS Calculator</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>
          body{font-family:'Cairo',Arial,sans-serif;background:#fff;color:#111;padding:20px;line-height:1.6}
          .doc{border:1px solid #dbe1e8;border-radius:12px;overflow:hidden}
          .head{padding:14px 18px;border-bottom:1px solid #dbe1e8;background:#f8fafc;text-align:center}
          .section{padding:14px 18px}
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
            <div style="font-weight:700;margin-top:6px">تقرير حاسبة نهاية الخدمة / EOS Calculator Report</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px">Date: ${reportDate}</div>
          </div>
          <div class="section">
            <div class="bi">
              <div class="box">
                <div class="row"><strong>الموظف</strong><span>${emp?.name || '—'}</span></div>
                <div class="row"><strong>ساعات العمل اليومية</strong><span class="num">${fmt(parseWorkHours(emp?.workHours))}</span></div>
                <div class="row"><strong>تاريخ التعيين</strong><span>${jd || '—'}</span></div>
                <div class="row"><strong>تاريخ نهاية الخدمة</strong><span>${ed || '—'}</span></div>
                <div class="row"><strong>آخر أجر فعلي</strong><span class="num">${fmt(sal.toNumber())}</span></div>
                <div class="row"><strong>سبب الانتهاء</strong><span>${t(
                  terminationReason === 'employer'
                    ? 'eosCalcReasonEmployer'
                    : terminationReason === 'resignation'
                      ? 'eosCalcReasonResignation'
                      : terminationReason === 'article81'
                        ? 'eosCalcReasonArticle81'
                        : 'eosCalcReasonArticle80',
                )}</span></div>
                <div class="row"><strong>مدة الخدمة بالأيام</strong><span class="num">${serviceDays}</span></div>
                <div class="row"><strong>سنوات الخدمة</strong><span class="num">${serviceYears.toDecimalPlaces(2).toString()}</span></div>
                <div class="row"><strong>المكافأة الكاملة</strong><span class="num">${fmt(fullAward.toNumber())}</span></div>
                <div class="row"><strong>نسبة الاستحقاق</strong><span class="num">${eligibilityFactor.times(100).toDecimalPlaces(2).toString()}%</span></div>
                <div class="row"><strong>نهاية الخدمة</strong><span class="num">${fmt(eosAmount.toNumber())}</span></div>
              </div>
              <div class="sep"></div>
              <div class="box en">
                <div class="row"><strong>Employee</strong><span>${emp?.name || '—'}</span></div>
                <div class="row"><strong>Work hours/day</strong><span class="num">${fmt(parseWorkHours(emp?.workHours))}</span></div>
                <div class="row"><strong>Join date</strong><span>${jd || '—'}</span></div>
                <div class="row"><strong>End of service date</strong><span>${ed || '—'}</span></div>
                <div class="row"><strong>Last actual wage</strong><span class="num">${fmt(sal.toNumber())}</span></div>
                <div class="row"><strong>Reason</strong><span>${terminationReason}</span></div>
                <div class="row"><strong>Service days</strong><span class="num">${serviceDays}</span></div>
                <div class="row"><strong>Service Years</strong><span class="num">${serviceYears.toDecimalPlaces(2).toString()}</span></div>
                <div class="row"><strong>Full Award</strong><span class="num">${fmt(fullAward.toNumber())}</span></div>
                <div class="row"><strong>Eligibility</strong><span class="num">${eligibilityFactor.times(100).toDecimalPlaces(2).toString()}%</span></div>
                <div class="row"><strong>EOS Amount</strong><span class="num">${fmt(eosAmount.toNumber())}</span></div>
              </div>
            </div>
          </div>
          <div class="section">
            <div class="bi">
              <div class="box">
                <div style="font-weight:700;margin-bottom:8px">تفاصيل البدلات الداخلة في الأجر الفعلي</div>
                <table>
                  <thead><tr><th>البدل</th><th>القيمة</th></tr></thead>
                  <tbody>${allowanceRowsAr}</tbody>
                </table>
              </div>
              <div class="sep"></div>
              <div class="box en">
                <div style="font-weight:700;margin-bottom:8px">Allowances included in actual wage</div>
                <table>
                  <thead><tr><th>Allowance</th><th>Amount</th></tr></thead>
                  <tbody>${allowanceRowsEn}</tbody>
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
    <div className="noorix-surface-card" style={{ padding: 24, maxWidth: 480 }}>
      <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>{t('hrTabEOSCalc')}</h3>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('selectEmployee')}</label>
        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          style={inputStyle}
        >
          <option value="">—</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name || e.nameAr || e.id}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('eosCalcJoinDate')}</label>
        <input type="date" value={jd ? jd.slice(0, 10) : ''} onChange={(e) => setJoinDate(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('eosCalcEndDate')}</label>
        <input type="date" value={ed ? ed.slice(0, 10) : ''} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('eosCalcSalary')}</label>
        <input type="number" min="0" step="0.01" value={lastSalary} onChange={(e) => setLastSalary(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('eosCalcReason')}</label>
        <select value={terminationReason} onChange={(e) => setTerminationReason(e.target.value)} style={inputStyle}>
          <option value="employer">{t('eosCalcReasonEmployer')}</option>
          <option value="resignation">{t('eosCalcReasonResignation')}</option>
          <option value="article81">{t('eosCalcReasonArticle81')}</option>
          <option value="article80">{t('eosCalcReasonArticle80')}</option>
        </select>
      </div>

      <div className="noorix-result-panel noorix-result-panel--green">
        <div className="noorix-result-panel__stripe" />
        <div className="noorix-result-panel__body">
          <div className="noorix-result-panel__row">
            <span className="noorix-result-panel__row-label">{t('eosCalcServiceDays')}</span>
            <span className="noorix-result-panel__row-value">{serviceDays}</span>
          </div>
          <div className="noorix-result-panel__row">
            <span className="noorix-result-panel__row-label">{t('eosCalcYears')}</span>
            <span className="noorix-result-panel__row-value">{serviceYears.toDecimalPlaces(2).toString()}</span>
          </div>
          <div className="noorix-result-panel__row">
            <span className="noorix-result-panel__row-label">{t('eosCalcFullAward')}</span>
            <span className="noorix-result-panel__row-value">{fmt(fullAward.toNumber())} ﷼</span>
          </div>
          <div className="noorix-result-panel__row">
            <span className="noorix-result-panel__row-label">{t('eosCalcEligibilityFactor')}</span>
            <span className="noorix-result-panel__row-value">{eligibilityFactor.times(100).toDecimalPlaces(2).toString()}%</span>
          </div>
          <div className="noorix-result-panel__row noorix-result-panel__row--highlight">
            <span className="noorix-result-panel__row-label">{t('eosCalcResult')}</span>
            <span className="noorix-result-panel__row-value">{fmt(eosAmount.toNumber())} ﷼</span>
          </div>
        </div>
        <div className="noorix-result-panel__note">
          {eligibilityFactor.eq(0) ? t('eosCalcNoEntitlement') : t('eosCalcLegalNote')}
        </div>
      </div>
      <button
        type="button"
        className="noorix-btn-nav"
        onClick={handlePrint}
        style={{ width: '100%', marginTop: 12, padding: 10 }}
      >
        {t('printCalc')}
      </button>
    </div>
  );
}
