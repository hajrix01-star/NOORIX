/**
 * EOSCalcTab — حاسبة نهاية الخدمة
 *
 * مراجع قانونية:
 * - المادة 84: نصف شهر عن كل سنة من أول خمس سنوات، وشهر عن كل سنة بعدها.
 * - المادة 85: عند الاستقالة 0% قبل سنتين، 1/3 من سنتين إلى أقل من 5، 2/3 من 5 إلى أقل من 10، وكامل الاستحقاق بعد 10 سنوات.
 *
 * منهجية حساب مدة الخدمة (متوافقة مع حاسبة وزارة الموارد البشرية):
 * - عدد الأيام = الفرق الفعلي بين التاريخين (بدون +1 — نحسب من يوم إلى يوم)
 * - سنوات الخدمة = الأيام ÷ 365 (ليس ÷360 لأن 360 مخصص لحسابات الأجر اليومي م61 فقط)
 * - أجر EOS = أساسي + بدلات (الأوفر تايم لا يدخل في حساب المكافأة)
 */
import React, { useEffect, useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { useEmployees } from '../../../hooks/useEmployees';
import { useCustomAllowances } from '../../../hooks/useCustomAllowances';
import { hrFmt } from '../utils/hrFmt';
import { parseWorkHours } from '../utils/employeeSalaryMath';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Input , FmtNum } from '../../../ui';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * عدد الأيام بين تاريخين (الفرق الفعلي — بدون +1).
 * مثال: من 09-Jan إلى 09-Apr = 90 يوماً فعلياً.
 */
function calculateServiceDays(joinDate, endDate) {
  const start = new Date(joinDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS);
}

/**
 * تفصيل مدة الخدمة بالسنوات والشهور والأيام (للعرض فقط).
 */
function serviceComponents(joinDate, endDate) {
  const start = new Date(joinDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return { years: 0, months: 0, days: 0 };
  }
  let years  = end.getFullYear() - start.getFullYear();
  let months = end.getMonth()    - start.getMonth();
  let days   = end.getDate()     - start.getDate();
  if (days < 0) {
    months--;
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) { years--; months += 12; }
  return { years, months, days };
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
  const { t, lang } = useTranslation();
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

  const serviceDays   = jd && ed ? calculateServiceDays(jd, ed) : 0;
  const serviceComp   = jd && ed ? serviceComponents(jd, ed) : { years: 0, months: 0, days: 0 };
  // ÷365 (وليس ÷360) لأن المعيار الوزاري لمدة الخدمة يعتمد السنة الميلادية
  const serviceYears  = new Decimal(serviceDays).div(365);
  const firstFiveYears = Decimal.min(serviceYears, 5);
  const remainingYears = Decimal.max(serviceYears.minus(5), 0);
  const fullAward = sal.times(firstFiveYears).times(0.5).plus(sal.times(remainingYears));
  const eligibilityFactor = getEligibilityFactor(terminationReason, serviceYears.toNumber());
  const eosAmount = fullAward.times(eligibilityFactor);

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
      ? allowanceRows.map((r) => `<tr><td class="td-ar">${r.ar}</td><td class="td-num">${hrFmt(r.amount)}</td></tr>`).join('')
      : '<tr><td class="td-ar" style="color:#94a3b8">لا توجد بدلات</td><td class="td-num" style="color:#94a3b8">—</td></tr>';
    const allowanceRowsEn = allowanceRows.length
      ? allowanceRows.map((r) => `<tr><td class="td-en">${r.en}</td><td class="td-num">${hrFmt(r.amount)}</td></tr>`).join('')
      : '<tr><td class="td-en" style="color:#94a3b8">No allowances</td><td class="td-num" style="color:#94a3b8">—</td></tr>';
    const html = `<!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>EOS Calculator</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>
          *{box-sizing:border-box;margin:0;padding:0}
          body{font-family:'Cairo',Arial,sans-serif;background:#f8fafc;color:#111;padding:24px;line-height:1.6;font-size:13px}
          .doc{background:#fff;border:1px solid #dbe1e8;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);max-width:900px;margin:0 auto}
          /* ── رأس المستند ── */
          .head{padding:20px 24px;border-bottom:2px solid #dbe1e8;background:#f8fafc;text-align:center}
          .head-title{font-size:20px;font-weight:800;color:#0a1f44}
          .head-sub{font-size:13px;font-weight:700;color:#374151;margin-top:6px}
          .head-date{font-size:11px;color:#64748b;margin-top:4px}
          /* ── التخطيط الثنائي ── */
          .section{padding:16px 24px}
          .bi{display:grid;grid-template-columns:1fr 1px 1fr;gap:0;align-items:stretch}
          .sep{background:#e2e8f0;width:1px}
          /* ── صناديق البيانات ── */
          .box-ar{padding:0 16px 0 12px;direction:rtl;text-align:right}
          .box-en{padding:0 12px 0 16px;direction:ltr;text-align:left}
          .box-title{font-size:13px;font-weight:800;color:#0a1f44;padding:10px 0 8px;border-bottom:2px solid #dbe1e8;margin-bottom:10px;text-align:center}
          /* ── صفوف البيانات ── */
          .row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px dashed #e2e8f0;gap:8px;font-size:12px}
          .row:last-child{border-bottom:none}
          .row-label{color:#64748b;font-weight:600}
          .row-val{font-weight:700;color:#1a2332;white-space:nowrap}
          .row-highlight{background:#f0fdf4;border-radius:6px;padding:6px 8px;margin-top:4px;font-size:13px}
          .row-highlight .row-label{color:#15803d;font-weight:700}
          .row-highlight .row-val{color:#15803d;font-size:15px}
          /* ── جداول البدلات ── */
          .tbl-section{padding:16px 24px;border-top:1px solid #dbe1e8;background:#fafcff}
          table{width:100%;border-collapse:collapse;font-size:12px}
          thead th{background:#f1f5f9;padding:8px 12px;font-weight:700;color:#374151;border:1px solid #dbe1e8;text-align:center}
          tbody td{padding:7px 12px;border:1px solid #dbe1e8;color:#1a2332}
          tbody tr:nth-child(even) td{background:#f8fafc}
          .td-ar{text-align:right;direction:rtl}
          .td-en{text-align:left;direction:ltr}
          .td-num{text-align:center;font-weight:600;font-family:'Cairo',Arial,sans-serif}
          /* ── تذييل ── */
          .foot{padding:12px 24px;border-top:1px solid #dbe1e8;background:#f8fafc;text-align:center;font-size:11px;color:#94a3b8}
          @media print{body{padding:0;background:#fff}.doc{box-shadow:none;border:none}}
        </style>
      </head>
      <body>
        <div class="doc">
          <!-- رأس المستند -->
          <div class="head">
            <div class="head-title">${companyName}</div>
            <div class="head-sub">وثيقة تسوية نهاية الخدمة &nbsp;/&nbsp; End of Service Settlement</div>
            <div class="head-date">تاريخ الإصدار / Issue Date: ${reportDate}</div>
          </div>

          <!-- بيانات الموظف والحساب -->
          <div class="section">
            <div class="bi">
              <!-- العربية — يمين -->
              <div class="box-ar">
                <div class="box-title">بيانات الموظف والاستحقاق</div>
                <div class="row"><span class="row-label">الموظف</span><span class="row-val">${emp?.name || '—'}</span></div>
                <div class="row"><span class="row-label">ساعات العمل / يوم</span><span class="row-val">${hrFmt(parseWorkHours(emp?.workHours))}</span></div>
                <div class="row"><span class="row-label">تاريخ التعيين</span><span class="row-val">${jd || '—'}</span></div>
                <div class="row"><span class="row-label">تاريخ نهاية الخدمة</span><span class="row-val">${ed || '—'}</span></div>
                <div class="row"><span class="row-label">آخر أجر فعلي</span><span class="row-val">${hrFmt(sal.toNumber())} SR</span></div>
                <div class="row"><span class="row-label">سبب الانتهاء</span><span class="row-val">${t(terminationReason === 'employer' ? 'eosCalcReasonEmployer' : terminationReason === 'resignation' ? 'eosCalcReasonResignation' : terminationReason === 'article81' ? 'eosCalcReasonArticle81' : 'eosCalcReasonArticle80')}</span></div>
                <div class="row"><span class="row-label">مدة الخدمة بالأيام</span><span class="row-val">${serviceDays}</span></div>
                <div class="row"><span class="row-label">مدة الخدمة</span><span class="row-val">${serviceComp.years} سنة ${serviceComp.months} شهر ${serviceComp.days} يوم</span></div>
                <div class="row"><span class="row-label">سنوات الخدمة (إجمالي)</span><span class="row-val">${serviceYears.toDecimalPlaces(2).toString()} سنة</span></div>
                <div class="row"><span class="row-label">نصف شهر × ${firstFiveYears.toDecimalPlaces(2)} سنة</span><span class="row-val">${hrFmt(sal.times(firstFiveYears).times(0.5).toNumber())} SR</span></div>
                ${remainingYears.gt(0) ? `<div class="row"><span class="row-label">شهر كامل × ${remainingYears.toDecimalPlaces(2)} سنة</span><span class="row-val">${hrFmt(sal.times(remainingYears).toNumber())} SR</span></div>` : ''}
                <div class="row"><span class="row-label">المكافأة الكاملة</span><span class="row-val">${hrFmt(fullAward.toNumber())} SR</span></div>
                <div class="row"><span class="row-label">نسبة الاستحقاق</span><span class="row-val">${eligibilityFactor.times(100).toDecimalPlaces(0)}%</span></div>
                <div class="row row-highlight"><span class="row-label">مكافأة نهاية الخدمة</span><span class="row-val">${hrFmt(eosAmount.toNumber())} SR</span></div>
              </div>

              <div class="sep"></div>

              <!-- الإنجليزية — يسار -->
              <div class="box-en">
                <div class="box-title">Employee Data &amp; Entitlement</div>
                <div class="row"><span class="row-label">Employee</span><span class="row-val">${emp?.nameEn || emp?.name || '—'}</span></div>
                <div class="row"><span class="row-label">Work hours / day</span><span class="row-val">${hrFmt(parseWorkHours(emp?.workHours))}</span></div>
                <div class="row"><span class="row-label">Join date</span><span class="row-val">${jd || '—'}</span></div>
                <div class="row"><span class="row-label">End of service date</span><span class="row-val">${ed || '—'}</span></div>
                <div class="row"><span class="row-label">Last actual wage</span><span class="row-val">SAR ${hrFmt(sal.toNumber())}</span></div>
                <div class="row"><span class="row-label">Termination reason</span><span class="row-val">${terminationReason === 'employer' ? 'By Employer' : terminationReason === 'resignation' ? 'Resignation' : terminationReason === 'article81' ? 'Article 81' : 'Article 80'}</span></div>
                <div class="row"><span class="row-label">Service days</span><span class="row-val">${serviceDays} days</span></div>
                <div class="row"><span class="row-label">Service duration</span><span class="row-val">${serviceComp.years}y ${serviceComp.months}m ${serviceComp.days}d</span></div>
                <div class="row"><span class="row-label">Service years (total)</span><span class="row-val">${serviceYears.toDecimalPlaces(2).toString()} yr</span></div>
                <div class="row"><span class="row-label">Half-month × ${firstFiveYears.toDecimalPlaces(2)} yr</span><span class="row-val">SAR ${hrFmt(sal.times(firstFiveYears).times(0.5).toNumber())}</span></div>
                ${remainingYears.gt(0) ? `<div class="row"><span class="row-label">Full month × ${remainingYears.toDecimalPlaces(2)} yr</span><span class="row-val">SAR ${hrFmt(sal.times(remainingYears).toNumber())}</span></div>` : ''}
                <div class="row"><span class="row-label">Full award</span><span class="row-val">SAR ${hrFmt(fullAward.toNumber())}</span></div>
                <div class="row"><span class="row-label">Eligibility factor</span><span class="row-val">${eligibilityFactor.times(100).toDecimalPlaces(0)}%</span></div>
                <div class="row row-highlight"><span class="row-label">EOS Amount</span><span class="row-val">SAR ${hrFmt(eosAmount.toNumber())}</span></div>
              </div>
            </div>
          </div>

          <!-- جدول البدلات -->
          <div class="tbl-section">
            <div class="bi">
              <div style="padding:0 16px 0 0">
                <div style="font-weight:800;font-size:12px;color:#374151;margin-bottom:8px;text-align:center">تفاصيل البدلات المحتسبة في الأجر الفعلي</div>
                <table>
                  <thead><tr><th class="td-ar">البدل</th><th>القيمة (SR)</th></tr></thead>
                  <tbody>${allowanceRowsAr}</tbody>
                </table>
              </div>
              <div class="sep"></div>
              <div style="padding:0 0 0 16px">
                <div style="font-weight:800;font-size:12px;color:#374151;margin-bottom:8px;text-align:center">Allowances Included in Actual Wage</div>
                <table>
                  <thead><tr><th class="td-en">Allowance</th><th>Amount (SAR)</th></tr></thead>
                  <tbody>${allowanceRowsEn}</tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- تذييل -->
          <div class="foot">
            ${companyName} &nbsp;·&nbsp; ${reportDate} &nbsp;·&nbsp; وثيقة آلية / Auto-generated Document
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
    <div className="noorix-surface-card p-6" style={{ maxWidth: 480 }}>
      <h3 className="text-[18px] m-0 mb-5">{t('hrTabEOSCalc')}</h3>

      <div className="mb-4">
        <Input type="select" label={t('selectEmployee')} value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}>
          <option value="">—</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{employeeDisplayName(e, lang, e.id)}</option>
          ))}
        </Input>
      </div>

      <div className="mb-4">
        <Input type="date" label={t('eosCalcJoinDate')} value={jd ? jd.slice(0, 10) : ''} onChange={(e) => setJoinDate(e.target.value)} />
      </div>

      <div className="mb-4">
        <Input type="date" label={t('eosCalcEndDate')} value={ed ? ed.slice(0, 10) : ''} onChange={(e) => setEndDate(e.target.value)} />
      </div>

      <div className="mb-5">
        <Input type="number" label={t('eosCalcSalary')} min="0" step="0.01" value={lastSalary} onChange={(e) => setLastSalary(e.target.value)} />
      </div>

      <div className="mb-5">
        <Input type="select" label={t('eosCalcReason')} value={terminationReason} onChange={(e) => setTerminationReason(e.target.value)}>
          <option value="employer">{t('eosCalcReasonEmployer')}</option>
          <option value="resignation">{t('eosCalcReasonResignation')}</option>
          <option value="article81">{t('eosCalcReasonArticle81')}</option>
          <option value="article80">{t('eosCalcReasonArticle80')}</option>
        </Input>
      </div>

      <div className="noorix-result-panel noorix-result-panel--green">
        <div className="noorix-result-panel__stripe" />
        <div className="noorix-result-panel__body">
          <div className="noorix-result-panel__row">
            <span className="noorix-result-panel__row-label">{t('eosCalcServiceDays')}</span>
            <span className="noorix-result-panel__row-value">{serviceDays}</span>
          </div>
          <div className="noorix-result-panel__row">
            <span className="noorix-result-panel__row-label">مدة الخدمة</span>
            <span className="noorix-result-panel__row-value ltr">
              {serviceComp.years} سنة {serviceComp.months} شهر {serviceComp.days} يوم
            </span>
          </div>
          <div className="noorix-result-panel__row">
            <span className="noorix-result-panel__row-label">{t('eosCalcYears')} (إجمالي)</span>
            <span className="noorix-result-panel__row-value">{serviceYears.toDecimalPlaces(2).toString()} سنة</span>
          </div>
          {/* تفصيل حسابي: نصف شهر للخمس الأولى + شهر كامل لما بعدها — م84 */}
          <div className="noorix-result-panel__row text-[12px]" style={{ opacity: 0.82 }}>
            <span className="noorix-result-panel__row-label">
              نصف شهر × {firstFiveYears.toDecimalPlaces(2).toString()} سنة (≤5)
            </span>
            <span className="noorix-result-panel__row-value">
              {hrFmt(sal.times(firstFiveYears).times(0.5).toNumber())} <span className="nx-sar">SR</span>
            </span>
          </div>
          {remainingYears.gt(0) && (
            <div className="noorix-result-panel__row text-[12px]" style={{ opacity: 0.82 }}>
              <span className="noorix-result-panel__row-label">
                شهر كامل × {remainingYears.toDecimalPlaces(2).toString()} سنة ({'>'}5)
              </span>
              <span className="noorix-result-panel__row-value">
                {hrFmt(sal.times(remainingYears).toNumber())} <span className="nx-sar">SR</span>
              </span>
            </div>
          )}
          <div className="noorix-result-panel__row">
            <span className="noorix-result-panel__row-label">{t('eosCalcFullAward')}</span>
            <span className="noorix-result-panel__row-value"><FmtNum n={fullAward.toNumber()} /> <span className="nx-sar">SR</span></span>
          </div>
          <div className="noorix-result-panel__row">
            <span className="noorix-result-panel__row-label">{t('eosCalcEligibilityFactor')}</span>
            <span className="noorix-result-panel__row-value">{eligibilityFactor.times(100).toDecimalPlaces(2).toString()}%</span>
          </div>
          <div className="noorix-result-panel__row noorix-result-panel__row--highlight">
            <span className="noorix-result-panel__row-label">{t('eosCalcResult')}</span>
            <span className="noorix-result-panel__row-value"><FmtNum n={eosAmount.toNumber()} /> <span className="nx-sar">SR</span></span>
          </div>
        </div>
        <div className="noorix-result-panel__note">
          {eligibilityFactor.eq(0) ? t('eosCalcNoEntitlement') : t('eosCalcLegalNote')}
        </div>
      </div>
      <Button
        onClick={handlePrint}
        className="w-full mt-3 p-2.5"
      >
        {t('printCalc')}
      </Button>
    </div>
  );
}
