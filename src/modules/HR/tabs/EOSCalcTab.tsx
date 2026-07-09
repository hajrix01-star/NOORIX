/**
 * EOSCalcTab â€” Ø­Ø§Ø³Ø¨Ø© Ù†Ù‡Ø§ÙŠØ© Ø§Ù„Ø®Ø¯Ù…Ø©
 *
 * Ù…Ø±Ø§Ø¬Ø¹ Ù‚Ø§Ù†ÙˆÙ†ÙŠØ©:
 * - Ø§Ù„Ù…Ø§Ø¯Ø© 84: Ù†ØµÙ Ø´Ù‡Ø± Ø¹Ù† ÙƒÙ„ Ø³Ù†Ø© Ù…Ù† Ø£ÙˆÙ„ Ø®Ù…Ø³ Ø³Ù†ÙˆØ§ØªØŒ ÙˆØ´Ù‡Ø± Ø¹Ù† ÙƒÙ„ Ø³Ù†Ø© Ø¨Ø¹Ø¯Ù‡Ø§.
 * - Ø§Ù„Ù…Ø§Ø¯Ø© 85: Ø¹Ù†Ø¯ Ø§Ù„Ø§Ø³ØªÙ‚Ø§Ù„Ø© 0% Ù‚Ø¨Ù„ Ø³Ù†ØªÙŠÙ†ØŒ 1/3 Ù…Ù† Ø³Ù†ØªÙŠÙ† Ø¥Ù„Ù‰ Ø£Ù‚Ù„ Ù…Ù† 5ØŒ 2/3 Ù…Ù† 5 Ø¥Ù„Ù‰ Ø£Ù‚Ù„ Ù…Ù† 10ØŒ ÙˆÙƒØ§Ù…Ù„ Ø§Ù„Ø§Ø³ØªØ­Ù‚Ø§Ù‚ Ø¨Ø¹Ø¯ 10 Ø³Ù†ÙˆØ§Øª.
 *
 * Ù…Ù†Ù‡Ø¬ÙŠØ© Ø­Ø³Ø§Ø¨ Ù…Ø¯Ø© Ø§Ù„Ø®Ø¯Ù…Ø© (Ù…ØªÙˆØ§ÙÙ‚Ø© Ù…Ø¹ Ø­Ø§Ø³Ø¨Ø© ÙˆØ²Ø§Ø±Ø© Ø§Ù„Ù…ÙˆØ§Ø±Ø¯ Ø§Ù„Ø¨Ø´Ø±ÙŠØ©):
 * - Ø¹Ø¯Ø¯ Ø§Ù„Ø£ÙŠØ§Ù… = Ø§Ù„ÙØ±Ù‚ Ø§Ù„ÙØ¹Ù„ÙŠ Ø¨ÙŠÙ† Ø§Ù„ØªØ§Ø±ÙŠØ®ÙŠÙ† (Ø¨Ø¯ÙˆÙ† +1 â€” Ù†Ø­Ø³Ø¨ Ù…Ù† ÙŠÙˆÙ… Ø¥Ù„Ù‰ ÙŠÙˆÙ…)
 * - Ø³Ù†ÙˆØ§Øª Ø§Ù„Ø®Ø¯Ù…Ø© = Ø§Ù„Ø£ÙŠØ§Ù… Ã· 365 (Ù„ÙŠØ³ Ã·360 Ù„Ø£Ù† 360 Ù…Ø®ØµØµ Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„Ø£Ø¬Ø± Ø§Ù„ÙŠÙˆÙ…ÙŠ Ù…61 ÙÙ‚Ø·)
 * - Ø£Ø¬Ø± EOS = Ø£Ø³Ø§Ø³ÙŠ + Ø¨Ø¯Ù„Ø§Øª (Ø§Ù„Ø£ÙˆÙØ± ØªØ§ÙŠÙ… Ù„Ø§ ÙŠØ¯Ø®Ù„ ÙÙŠ Ø­Ø³Ø§Ø¨ Ø§Ù„Ù…ÙƒØ§ÙØ£Ø©)
 */
import React, { useEffect, useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { useEmployees } from '../../../hooks/useEmployees';
import { getEmployeeCompensationSnapshot } from '../../../services/api';
import { hrKeys } from '../../../services/queryKeys';
import { hrFmt } from '../utils/hrFmt';
import { parseWorkHours } from '../utils/employeeSalaryMath';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, DateField, Input , FmtNum, usePrintPreview } from '../../../ui';
import { getSaudiToday, toYmd } from '../../../utils/saudiDate';
import { HR_TOOLS_ROOT_CLASS } from '../hrWorkspaceLayout';
import {
  computeEos,
  getEosServiceComponents,
} from '../utils/hrCalculations/eos';
import type { HrCompensationSnapshot, HrEmployee } from '../../../types/api';

type HrCompanyRef = {
  id?: string | null;
  name?: string | null;
  nameAr?: string | null;
  logoUrl?: string | null;
};
type AllowanceRow = {
  ar: string;
  en: string;
  amount: number;
};
type EosInputChange = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

export default function EOSCalcTab() {
  const { t, lang } = useTranslation();
  const { activeCompanyId, companies } = useApp();
  const companyId = activeCompanyId ?? '';
  const company = (companies as HrCompanyRef[] | undefined)?.find((c) => c.id === companyId);
  const companyName = company?.nameAr || company?.name || 'Ø§Ù„Ø´Ø±ÙƒØ©';
  const companyLogoUrl = String(company?.logoUrl || '').trim();
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: t('hrTabEOSCalc'),
    closeLabel: t('close') || 'Close',
    printLabel: `${t('print')} / PDF`,
  });
  const { employees } = useEmployees(companyId);

  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lastSalary, setLastSalary] = useState('');
  const [terminationReason, setTerminationReason] = useState('employer');

  const emp = employees.find((e) => e.id === selectedEmployee);
  const {
    data: compensationSnapshot,
    isLoading: compensationSnapshotLoading,
    error: compensationSnapshotError,
  } = useApiQuery<HrCompensationSnapshot>({
    queryKey: hrKeys.compensationSnapshot(companyId, selectedEmployee),
    queryFn: () => getEmployeeCompensationSnapshot(companyId, selectedEmployee),
    enabled: !!companyId && !!selectedEmployee,
    fallbackMessage: t('loadingError'),
  });
  const jd = joinDate || emp?.joinDate;
  const ed = endDate;
  const sal = new Decimal(lastSalary || 0);
  const centralSalaryNumber = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  useEffect(() => {
    if (!selectedEmployee) return;
    setJoinDate('');
    setLastSalary('');
  }, [selectedEmployee]);

  useEffect(() => {
    if (!selectedEmployee) return;
    const em = employees.find((row) => row.id === selectedEmployee);
    if (!em || !compensationSnapshot?.salaryPackage) return;
    const fixedTotal = centralSalaryNumber(compensationSnapshot.salaryPackage.fixedTotal);
    setJoinDate(toYmd(em.joinDate));
    setLastSalary(fixedTotal == null ? '' : String(fixedTotal));
  }, [selectedEmployee, employees, compensationSnapshot]);

  const eosCalc = computeEos({ joinDate: jd, endDate: ed, wage: sal, reason: terminationReason });
  const serviceDays = jd && ed ? eosCalc.serviceDays : 0;
  const serviceComp = jd && ed ? getEosServiceComponents(jd, ed) : { years: 0, months: 0, days: 0 };
  const serviceYears = jd && ed ? eosCalc.serviceYears : new Decimal(0);
  const firstFiveYears = eosCalc.firstFiveYears;
  const remainingYears = eosCalc.remainingYears;
  const fullAward = eosCalc.fullAward;
  const eligibilityFactor = eosCalc.eligibilityFactor;
  const eosAmount = eosCalc.eosAmount;

  const allowanceRows = useMemo(() => {
    if (!emp || !compensationSnapshot?.salaryPackage) return [];
    const rows: AllowanceRow[] = [];
    const housing = centralSalaryNumber(compensationSnapshot.salaryPackage.housingAllowance);
    const transport = centralSalaryNumber(compensationSnapshot.salaryPackage.transportAllowance);
    const other = centralSalaryNumber(compensationSnapshot.salaryPackage.otherAllowance);
    const custom = centralSalaryNumber(compensationSnapshot.salaryPackage.customAllowanceTotal);
    if (housing == null || transport == null || other == null || custom == null) return [];
    if (housing > 0) rows.push({ ar: 'Ø¨Ø¯Ù„ Ø§Ù„Ø³ÙƒÙ†', en: 'Housing', amount: housing });
    if (transport > 0) rows.push({ ar: 'Ø¨Ø¯Ù„ Ø§Ù„Ù…ÙˆØ§ØµÙ„Ø§Øª', en: 'Transport', amount: transport });
    if (other > 0) rows.push({ ar: 'Ø¨Ø¯Ù„ Ø¢Ø®Ø±', en: 'Other', amount: other });
    if (custom > 0) rows.push({ ar: 'Ø¨Ø¯Ù„Ø§Øª Ù…Ø®ØµØµØ©', en: 'Custom allowances', amount: custom });
    return rows;
  }, [compensationSnapshot, emp]);

  function handlePrint() {
    const reportDate = getSaudiToday();
    const allowanceRowsAr = allowanceRows.length
      ? allowanceRows.map((r) => `<tr><td class="td-ar">${r.ar}</td><td class="td-num">${hrFmt(r.amount)}</td></tr>`).join('')
      : '<tr><td class="td-ar" style="color:#94a3b8">Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨Ø¯Ù„Ø§Øª</td><td class="td-num" style="color:#94a3b8">â€”</td></tr>';
    const allowanceRowsEn = allowanceRows.length
      ? allowanceRows.map((r) => `<tr><td class="td-en">${r.en}</td><td class="td-num">${hrFmt(r.amount)}</td></tr>`).join('')
      : '<tr><td class="td-en" style="color:#94a3b8">No allowances</td><td class="td-num" style="color:#94a3b8">â€”</td></tr>';
    const extraCss = `
          *{box-sizing:border-box;margin:0;padding:0}
          .doc{background:#fff;border:1px solid #dbe1e8;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);max-width:900px;margin:0 auto}
          /* â”€â”€ Ø±Ø£Ø³ Ø§Ù„Ù…Ø³ØªÙ†Ø¯ â”€â”€ */
          .head{padding:20px 24px;border-bottom:2px solid #dbe1e8;background:#f8fafc;text-align:center}
          .head-sub{font-size:13px;font-weight:700;color:#374151;margin-top:6px}
          .head-date{font-size:11px;color:#64748b;margin-top:4px}
          /* â”€â”€ Ø§Ù„ØªØ®Ø·ÙŠØ· Ø§Ù„Ø«Ù†Ø§Ø¦ÙŠ â”€â”€ */
          .section{padding:16px 24px}
          .bi{display:grid;grid-template-columns:1fr 1px 1fr;gap:0;align-items:stretch}
          .sep{background:#e2e8f0;width:1px}
          /* â”€â”€ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª â”€â”€ */
          .box-ar{padding:0 16px 0 12px;direction:rtl;text-align:right}
          .box-en{padding:0 12px 0 16px;direction:ltr;text-align:left}
          .box-title{font-size:13px;font-weight:800;color:#0a1f44;padding:10px 0 8px;border-bottom:2px solid #dbe1e8;margin-bottom:10px;text-align:center}
          /* â”€â”€ ØµÙÙˆÙ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª â”€â”€ */
          .row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px dashed #e2e8f0;gap:8px;font-size:12px}
          .row:last-child{border-bottom:none}
          .row-label{color:#64748b;font-weight:600}
          .row-val{font-weight:700;color:#1a2332;white-space:nowrap}
          .row-highlight{background:#f0fdf4;border-radius:6px;padding:6px 8px;margin-top:4px;font-size:13px}
          .row-highlight .row-label{color:#15803d;font-weight:700}
          .row-highlight .row-val{color:#15803d;font-size:15px}
          /* â”€â”€ Ø¬Ø¯Ø§ÙˆÙ„ Ø§Ù„Ø¨Ø¯Ù„Ø§Øª â”€â”€ */
          .tbl-section{padding:16px 24px;border-top:1px solid #dbe1e8;background:#fafcff}
          table{width:100%;border-collapse:collapse;font-size:12px}
          thead th{background:#f1f5f9;padding:8px 12px;font-weight:700;color:#374151;border:1px solid #dbe1e8;text-align:center}
          tbody td{padding:7px 12px;border:1px solid #dbe1e8;color:#1a2332}
          tbody tr:nth-child(even) td{background:#f8fafc}
          .td-ar{text-align:right;direction:rtl}
          .td-en{text-align:left;direction:ltr}
          .td-num{text-align:center;font-weight:600;font-family:'Cairo',Arial,sans-serif}
          /* â”€â”€ ØªØ°ÙŠÙŠÙ„ â”€â”€ */
          .foot{padding:12px 24px;border-top:1px solid #dbe1e8;background:#f8fafc;text-align:center;font-size:11px;color:#94a3b8}
          @media print{.doc{box-shadow:none;border:none}}
    `;
    const bodyHtml = `<div class="doc">
          <!-- Ø±Ø£Ø³ Ø§Ù„Ù…Ø³ØªÙ†Ø¯ -->
          <div class="head">
            <div class="head-sub">ÙˆØ«ÙŠÙ‚Ø© ØªØ³ÙˆÙŠØ© Ù†Ù‡Ø§ÙŠØ© Ø§Ù„Ø®Ø¯Ù…Ø© &nbsp;/&nbsp; End of Service Settlement</div>
            <div class="head-date">ØªØ§Ø±ÙŠØ® Ø§Ù„Ø¥ØµØ¯Ø§Ø± / Issue Date: ${reportDate}</div>
          </div>

          <!-- Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…ÙˆØ¸Ù ÙˆØ§Ù„Ø­Ø³Ø§Ø¨ -->
          <div class="section">
            <div class="bi">
              <!-- Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© â€” ÙŠÙ…ÙŠÙ† -->
              <div class="box-ar">
                <div class="box-title">Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…ÙˆØ¸Ù ÙˆØ§Ù„Ø§Ø³ØªØ­Ù‚Ø§Ù‚</div>
                <div class="row"><span class="row-label">Ø§Ù„Ù…ÙˆØ¸Ù</span><span class="row-val">${emp?.name || 'â€”'}</span></div>
                <div class="row"><span class="row-label">Ø³Ø§Ø¹Ø§Øª Ø§Ù„Ø¹Ù…Ù„ / ÙŠÙˆÙ…</span><span class="row-val">${hrFmt(parseWorkHours(emp?.workHours))}</span></div>
                <div class="row"><span class="row-label">ØªØ§Ø±ÙŠØ® Ø§Ù„ØªØ¹ÙŠÙŠÙ†</span><span class="row-val">${jd || 'â€”'}</span></div>
                <div class="row"><span class="row-label">ØªØ§Ø±ÙŠØ® Ù†Ù‡Ø§ÙŠØ© Ø§Ù„Ø®Ø¯Ù…Ø©</span><span class="row-val">${ed || 'â€”'}</span></div>
                <div class="row"><span class="row-label">Ø¢Ø®Ø± Ø£Ø¬Ø± ÙØ¹Ù„ÙŠ</span><span class="row-val">${hrFmt(sal.toNumber())} SR</span></div>
                <div class="row"><span class="row-label">Ø³Ø¨Ø¨ Ø§Ù„Ø§Ù†ØªÙ‡Ø§Ø¡</span><span class="row-val">${
  terminationReason === 'employer'      ? 'Ø¥Ù†Ù‡Ø§Ø¡ Ù…Ù† ØµØ§Ø­Ø¨ Ø§Ù„Ø¹Ù…Ù„ (Ù…84 â€” ÙƒØ§Ù…Ù„Ø©)' :
  terminationReason === 'resignation'   ? 'Ø§Ø³ØªÙ‚Ø§Ù„Ø© (Ù…85 â€” Ù†Ø³Ø¨Ø© Ø­Ø³Ø¨ Ø§Ù„Ù…Ø¯Ø©)' :
  terminationReason === 'article81'     ? 'Ù…81 â€” ØªØ±Ùƒ Ù…Ø¨Ø±Ø± (ÙƒØ§Ù…Ù„Ø©)' :
  terminationReason === 'force_majeure' ? 'Ù‚ÙˆØ© Ù‚Ø§Ù‡Ø±Ø© (Ù…85 â€” ÙƒØ§Ù…Ù„Ø©)' :
  terminationReason === 'maternity'     ? 'Ø¹Ø§Ù…Ù„Ø© / Ø²ÙˆØ§Ø¬ Ø£Ùˆ ÙˆØ¶Ø¹ (Ù…85 â€” ÙƒØ§Ù…Ù„Ø©)' :
                                          'Ù…80 â€” Ù…Ø®Ø§Ù„ÙØ© Ø¬Ø³ÙŠÙ…Ø© (Ù„Ø§ Ø§Ø³ØªØ­Ù‚Ø§Ù‚)'
}</span></div>
                <div class="row"><span class="row-label">Ù…Ø¯Ø© Ø§Ù„Ø®Ø¯Ù…Ø© Ø¨Ø§Ù„Ø£ÙŠØ§Ù…</span><span class="row-val">${serviceDays}</span></div>
                <div class="row"><span class="row-label">Ù…Ø¯Ø© Ø§Ù„Ø®Ø¯Ù…Ø©</span><span class="row-val">${serviceComp.years} Ø³Ù†Ø© ${serviceComp.months} Ø´Ù‡Ø± ${serviceComp.days} ÙŠÙˆÙ…</span></div>
                <div class="row"><span class="row-label">Ø³Ù†ÙˆØ§Øª Ø§Ù„Ø®Ø¯Ù…Ø© (Ø¥Ø¬Ù…Ø§Ù„ÙŠ)</span><span class="row-val">${serviceYears.toDecimalPlaces(2).toString()} Ø³Ù†Ø©</span></div>
                <div class="row"><span class="row-label">Ù†ØµÙ Ø´Ù‡Ø± Ã— ${firstFiveYears.toDecimalPlaces(2)} Ø³Ù†Ø©</span><span class="row-val">${hrFmt(sal.times(firstFiveYears).times(0.5).toNumber())} SR</span></div>
                ${remainingYears.gt(0) ? `<div class="row"><span class="row-label">Ø´Ù‡Ø± ÙƒØ§Ù…Ù„ Ã— ${remainingYears.toDecimalPlaces(2)} Ø³Ù†Ø©</span><span class="row-val">${hrFmt(sal.times(remainingYears).toNumber())} SR</span></div>` : ''}
                <div class="row"><span class="row-label">Ø§Ù„Ù…ÙƒØ§ÙØ£Ø© Ø§Ù„ÙƒØ§Ù…Ù„Ø©</span><span class="row-val">${hrFmt(fullAward.toNumber())} SR</span></div>
                <div class="row"><span class="row-label">Ù†Ø³Ø¨Ø© Ø§Ù„Ø§Ø³ØªØ­Ù‚Ø§Ù‚</span><span class="row-val">${eligibilityFactor.times(100).toDecimalPlaces(0)}%</span></div>
                <div class="row row-highlight"><span class="row-label">Ù…ÙƒØ§ÙØ£Ø© Ù†Ù‡Ø§ÙŠØ© Ø§Ù„Ø®Ø¯Ù…Ø©</span><span class="row-val">${hrFmt(eosAmount.toNumber())} SR</span></div>
              </div>

              <div class="sep"></div>

              <!-- Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ© â€” ÙŠØ³Ø§Ø± -->
              <div class="box-en">
                <div class="box-title">Employee Data &amp; Entitlement</div>
                <div class="row"><span class="row-label">Employee</span><span class="row-val">${emp?.nameEn || emp?.name || 'â€”'}</span></div>
                <div class="row"><span class="row-label">Work hours / day</span><span class="row-val">${hrFmt(parseWorkHours(emp?.workHours))}</span></div>
                <div class="row"><span class="row-label">Join date</span><span class="row-val">${jd || 'â€”'}</span></div>
                <div class="row"><span class="row-label">End of service date</span><span class="row-val">${ed || 'â€”'}</span></div>
                <div class="row"><span class="row-label">Last actual wage</span><span class="row-val">SAR ${hrFmt(sal.toNumber())}</span></div>
                <div class="row"><span class="row-label">Termination reason</span><span class="row-val">${
  terminationReason === 'employer'      ? 'By Employer (Art.84 â€” Full)' :
  terminationReason === 'resignation'   ? 'Resignation (Art.85)' :
  terminationReason === 'article81'     ? 'Art.81 â€” Justified Quit (Full)' :
  terminationReason === 'force_majeure' ? 'Force Majeure (Art.85 â€” Full)' :
  terminationReason === 'maternity'     ? 'Maternity/Marriage (Art.85 â€” Full)' :
                                          'Art.80 â€” Gross Misconduct (None)'
}</span></div>
                <div class="row"><span class="row-label">Service days</span><span class="row-val">${serviceDays} days</span></div>
                <div class="row"><span class="row-label">Service duration</span><span class="row-val">${serviceComp.years}y ${serviceComp.months}m ${serviceComp.days}d</span></div>
                <div class="row"><span class="row-label">Service years (total)</span><span class="row-val">${serviceYears.toDecimalPlaces(2).toString()} yr</span></div>
                <div class="row"><span class="row-label">Half-month Ã— ${firstFiveYears.toDecimalPlaces(2)} yr</span><span class="row-val">SAR ${hrFmt(sal.times(firstFiveYears).times(0.5).toNumber())}</span></div>
                ${remainingYears.gt(0) ? `<div class="row"><span class="row-label">Full month Ã— ${remainingYears.toDecimalPlaces(2)} yr</span><span class="row-val">SAR ${hrFmt(sal.times(remainingYears).toNumber())}</span></div>` : ''}
                <div class="row"><span class="row-label">Full award</span><span class="row-val">SAR ${hrFmt(fullAward.toNumber())}</span></div>
                <div class="row"><span class="row-label">Eligibility factor</span><span class="row-val">${eligibilityFactor.times(100).toDecimalPlaces(0)}%</span></div>
                <div class="row row-highlight"><span class="row-label">EOS Amount</span><span class="row-val">SAR ${hrFmt(eosAmount.toNumber())}</span></div>
              </div>
            </div>
          </div>

          <!-- Ø¬Ø¯ÙˆÙ„ Ø§Ù„Ø¨Ø¯Ù„Ø§Øª -->
          <div class="tbl-section">
            <div class="bi">
              <div style="padding:0 16px 0 0">
                <div style="font-weight:800;font-size:12px;color:#374151;margin-bottom:8px;text-align:center">ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø¨Ø¯Ù„Ø§Øª Ø§Ù„Ù…Ø­ØªØ³Ø¨Ø© ÙÙŠ Ø§Ù„Ø£Ø¬Ø± Ø§Ù„ÙØ¹Ù„ÙŠ</div>
                <table>
                  <thead><tr><th class="td-ar">Ø§Ù„Ø¨Ø¯Ù„</th><th>Ø§Ù„Ù‚ÙŠÙ…Ø© (SR)</th></tr></thead>
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

          <!-- ØªØ°ÙŠÙŠÙ„ -->
          <div class="foot">
            ${reportDate} &nbsp;Â·&nbsp; ÙˆØ«ÙŠÙ‚Ø© Ø¢Ù„ÙŠØ© / Auto-generated Document
          </div>
        </div>`;
    openPrintDocumentPreview({
      title: 'EOS Calculator',
      companyName,
      logoUrl: companyLogoUrl,
      subtitle: t('hrTabEOSCalc'),
      extraCss,
      body: bodyHtml,
    });
  }

  return (
    <div className={HR_TOOLS_ROOT_CLASS}>
      {printPreviewModal}
      <div className="noorix-surface-card w-full min-w-0 max-w-xl p-6">
      <h3 className="text-[18px] m-0 mb-5">{t('hrTabEOSCalc')}</h3>

      <div className="mb-4">
        <Input type="select" label={t('selectEmployee')} value={selectedEmployee} onChange={(e: EosInputChange) => setSelectedEmployee(e.target.value)}>
          <option value="">â€”</option>
          {employees.map((e: HrEmployee) => (
            <option key={e.id} value={e.id}>{employeeDisplayName(e, lang, e.id)}</option>
          ))}
        </Input>
      </div>

      <div className="mb-4">
        <DateField label={t('eosCalcJoinDate')} value={jd ? toYmd(jd) : ''} onValueChange={setJoinDate} />
      </div>

      <div className="mb-4">
        <DateField label={t('eosCalcEndDate')} value={ed ? toYmd(ed) : ''} onValueChange={setEndDate} />
      </div>

      <div className="mb-5">
        <Input
          type="number"
          label={t('eosCalcSalary')}
          min="0"
          step="0.01"
          value={lastSalary}
          onChange={(e: EosInputChange) => setLastSalary(e.target.value)}
          readOnly={!!selectedEmployee}
          className={selectedEmployee ? 'bg-noorix-bg-muted' : undefined}
        />
        {selectedEmployee && compensationSnapshotLoading && (
          <div className="mt-1.5 text-[11px] text-noorix-muted">{t('loading')}</div>
        )}
        {selectedEmployee && compensationSnapshotError && (
          <div className="mt-1.5 text-[11px] text-noorix-red">
            {compensationSnapshotError instanceof Error ? compensationSnapshotError.message : t('loadingError')}
          </div>
        )}
      </div>

      <div className="mb-5">
        <Input type="select" label={t('eosCalcReason')} value={terminationReason} onChange={(e: EosInputChange) => setTerminationReason(e.target.value)}>
          <optgroup label="â€” Ø¥Ù†Ù‡Ø§Ø¡ Ù…Ù† ØµØ§Ø­Ø¨ Ø§Ù„Ø¹Ù…Ù„ (Ù…ÙƒØ§ÙØ£Ø© ÙƒØ§Ù…Ù„Ø©)">
            <option value="employer">{t('eosCalcReasonEmployer')}</option>
            <option value="article81">{t('eosCalcReasonArticle81')}</option>
          </optgroup>
          <optgroup label="â€” Ø§Ø³ØªÙ‚Ø§Ù„Ø© (Ù†Ø³Ø¨Ø© Ø­Ø³Ø¨ Ø§Ù„Ù…Ø¯Ø©)">
            <option value="resignation">{t('eosCalcReasonResignation')}</option>
          </optgroup>
          <optgroup label="â€” Ø­Ø§Ù„Ø§Øª Ø§Ø³ØªØ«Ù†Ø§Ø¦ÙŠØ© (Ù…ÙƒØ§ÙØ£Ø© ÙƒØ§Ù…Ù„Ø© â€” Ù…85)">
            <option value="force_majeure">Ù‚ÙˆØ© Ù‚Ø§Ù‡Ø±Ø© â€” ØªØ±Ùƒ Ø§Ù„Ø¹Ù…Ù„ Ù„Ø£Ø³Ø¨Ø§Ø¨ Ø®Ø§Ø±Ø¬Ø© Ø¹Ù† Ø§Ù„Ø¥Ø±Ø§Ø¯Ø©</option>
            <option value="maternity">Ø¹Ø§Ù…Ù„Ø© â€” Ø§Ø³ØªÙ‚Ø§Ù„Ø© Ø®Ù„Ø§Ù„ 6 Ø£Ø´Ù‡Ø± Ù…Ù† Ø§Ù„Ø²ÙˆØ§Ø¬ Ø£Ùˆ 3 Ù…Ù† Ø§Ù„ÙˆØ¶Ø¹</option>
          </optgroup>
          <optgroup label="â€” ÙØ³Ø® Ø§Ù„Ø¹Ù‚Ø¯ Ø¨Ø³Ø¨Ø¨ Ø§Ù„Ù…ÙˆØ¸Ù">
            <option value="article80">{t('eosCalcReasonArticle80')}</option>
          </optgroup>
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
            <span className="noorix-result-panel__row-label">Ù…Ø¯Ø© Ø§Ù„Ø®Ø¯Ù…Ø©</span>
            <span className="noorix-result-panel__row-value ltr">
              {serviceComp.years} Ø³Ù†Ø© {serviceComp.months} Ø´Ù‡Ø± {serviceComp.days} ÙŠÙˆÙ…
            </span>
          </div>
          <div className="noorix-result-panel__row">
            <span className="noorix-result-panel__row-label">{t('eosCalcYears')} (Ø¥Ø¬Ù…Ø§Ù„ÙŠ)</span>
            <span className="noorix-result-panel__row-value">{serviceYears.toDecimalPlaces(2).toString()} Ø³Ù†Ø©</span>
          </div>
          {/* ØªÙØµÙŠÙ„ Ø­Ø³Ø§Ø¨ÙŠ: Ù†ØµÙ Ø´Ù‡Ø± Ù„Ù„Ø®Ù…Ø³ Ø§Ù„Ø£ÙˆÙ„Ù‰ + Ø´Ù‡Ø± ÙƒØ§Ù…Ù„ Ù„Ù…Ø§ Ø¨Ø¹Ø¯Ù‡Ø§ â€” Ù…84 */}
          <div className="noorix-result-panel__row text-[12px] opacity-[0.82]">
            <span className="noorix-result-panel__row-label">
              Ù†ØµÙ Ø´Ù‡Ø± Ã— {firstFiveYears.toDecimalPlaces(2).toString()} Ø³Ù†Ø© (â‰¤5)
            </span>
            <span className="noorix-result-panel__row-value">
              {hrFmt(sal.times(firstFiveYears).times(0.5).toNumber())} <span className="nx-sar">SR</span>
            </span>
          </div>
          {remainingYears.gt(0) && (
            <div className="noorix-result-panel__row text-[12px] opacity-[0.82]">
              <span className="noorix-result-panel__row-label">
                Ø´Ù‡Ø± ÙƒØ§Ù…Ù„ Ã— {remainingYears.toDecimalPlaces(2).toString()} Ø³Ù†Ø© ({'>'}5)
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
          {terminationReason === 'article80' && 'Ù…80: Ù„Ø§ ÙŠØ³ØªØ­Ù‚ Ø§Ù„Ø¹Ø§Ù…Ù„ Ù…ÙƒØ§ÙØ£Ø© Ø¹Ù†Ø¯ Ø§Ù„ÙØµÙ„ Ø¨Ø³Ø¨Ø¨ Ù…Ø®Ø§Ù„ÙØ© Ø¬Ø³ÙŠÙ…Ø©.'}
          {terminationReason === 'employer'  && 'Ù…84: Ù…ÙƒØ§ÙØ£Ø© ÙƒØ§Ù…Ù„Ø© â€” Ø¥Ù†Ù‡Ø§Ø¡ Ù…Ù† ØµØ§Ø­Ø¨ Ø§Ù„Ø¹Ù…Ù„.'}
          {terminationReason === 'article81' && 'Ù…81: Ù…ÙƒØ§ÙØ£Ø© ÙƒØ§Ù…Ù„Ø© â€” ØªØ±Ùƒ Ù…Ø¨Ø±Ø± Ù‚Ø§Ù†ÙˆÙ†ÙŠØ§Ù‹ Ù…Ù† Ø§Ù„Ø¹Ø§Ù…Ù„.'}
          {terminationReason === 'force_majeure' && 'Ù…85: Ù…ÙƒØ§ÙØ£Ø© ÙƒØ§Ù…Ù„Ø© â€” Ù‚ÙˆØ© Ù‚Ø§Ù‡Ø±Ø© Ø®Ø§Ø±Ø¬Ø© Ø¹Ù† Ø§Ù„Ø¥Ø±Ø§Ø¯Ø©.'}
          {terminationReason === 'maternity' && 'Ù…85: Ù…ÙƒØ§ÙØ£Ø© ÙƒØ§Ù…Ù„Ø© â€” Ø§Ù„Ø¹Ø§Ù…Ù„Ø© Ø§Ù„ØªÙŠ Ø£Ù†Ù‡Øª Ø§Ù„Ø¹Ù‚Ø¯ Ø¨Ø¹Ø¯ Ø§Ù„Ø²ÙˆØ§Ø¬ Ø£Ùˆ Ø§Ù„ÙˆØ¶Ø¹.'}
          {terminationReason === 'resignation' && (
            serviceYears.lt(2)   ? 'Ù…85: Ø®Ø¯Ù…Ø© Ø£Ù‚Ù„ Ù…Ù† Ø³Ù†ØªÙŠÙ† â€” Ù„Ø§ Ø§Ø³ØªØ­Ù‚Ø§Ù‚.' :
            serviceYears.lte(5)  ? 'Ù…85: Ø®Ø¯Ù…Ø© 2â€“5 Ø³Ù†ÙˆØ§Øª â€” Ø«Ù„Ø« Ø§Ù„Ù…ÙƒØ§ÙØ£Ø© (Ù„Ø§ ØªØ²ÙŠØ¯ Ø¹Ù„Ù‰ 5 Ø³Ù†ÙˆØ§Øª).' :
            serviceYears.lt(10)  ? 'Ù…85: Ø®Ø¯Ù…Ø© 5â€“10 Ø³Ù†ÙˆØ§Øª â€” Ø«Ù„Ø«Ø§ Ø§Ù„Ù…ÙƒØ§ÙØ£Ø©.' :
                                   'Ù…85: Ø®Ø¯Ù…Ø© 10 Ø³Ù†ÙˆØ§Øª ÙØ£ÙƒØ«Ø± â€” Ù…ÙƒØ§ÙØ£Ø© ÙƒØ§Ù…Ù„Ø©.'
          )}
        </div>
      </div>
      <Button
        onClick={handlePrint}
        className="w-full mt-3 p-2.5"
      >
        {t('printCalc')}
      </Button>
      </div>
    </div>
  );
}
