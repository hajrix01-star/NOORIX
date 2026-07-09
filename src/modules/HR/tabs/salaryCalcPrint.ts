import { getSaudiToday } from '../../../utils/saudiDate';
import { buildPrintHtmlTable } from '../../../utils/printTableHtml';
import { buildPrintDocumentHtml } from '../../../utils/printUtils';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { hrFmt } from '../utils/hrFmt';

type DecimalLike = {
  toNumber(): number;
  gt(value: number): boolean;
};

export type SalaryCalcPrintEmployee = {
  id?: string;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

export type SalaryCalcPrintAllowanceRow = {
  label: string;
  amount: number;
};

export type SalaryCalcPrintModel = {
  companyName: string;
  companyLogoUrl?: string;
  employee: SalaryCalcPrintEmployee | null | undefined;
  allowanceRows: SalaryCalcPrintAllowanceRow[];
  hours: number;
  workDays: number;
  regularWorkDays: number;
  restDays: number;
  overtimeHoursPerDay: number;
  totalDailyOT: number;
  totalRestOT: number;
  totalOT: number;
  vacDays: number;
  hasOT: boolean;
  totalTarget: DecimalLike;
  basic: DecimalLike;
  totalAllowances: DecimalLike;
  deduction: DecimalLike;
  actualHourlyRate: DecimalLike;
  basicHourlyRate: DecimalLike;
  overtimeHourlyRate: DecimalLike;
  dailyOTValue: DecimalLike;
  restOTValue: DecimalLike;
  totalOTValue: DecimalLike;
  calculatedTotal: DecimalLike;
  netSalary: DecimalLike;
};

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(value: DecimalLike | number): string {
  return hrFmt(typeof value === 'number' ? value : value.toNumber());
}

function row(label: string, value: string, extraClass = ''): string {
  return `<div class="row ${extraClass}"><span class="muted">${esc(label)}</span><span class="num">${value}</span></div>`;
}

function buildAllowanceTable(rows: SalaryCalcPrintAllowanceRow[], labelHeader: string, amountHeader: string): string {
  return buildPrintHtmlTable({
    wrapperClassName: null,
    emptyMessage: 'No allowances',
    emptyColSpan: 2,
    headerRows: [{
      cells: [
        { value: labelHeader },
        { value: amountHeader, className: 'num', align: 'end' },
      ],
    }],
    bodyRows: rows.length
      ? rows.map((allowance) => ({
          cells: [
            { value: allowance.label },
            { value: money(allowance.amount), className: 'num', align: 'end' as const },
          ],
        }))
      : [{ cells: [{ value: 'No allowances' }, { value: '0', className: 'num', align: 'end' }] }],
  });
}
export function buildSalaryCalcPrintHtml(model: SalaryCalcPrintModel): string {
  const employeeAr = model.employee ? employeeDisplayName(model.employee, 'ar') : '-';
  const employeeEn = model.employee ? employeeDisplayName(model.employee, 'en') : '-';
  const allowanceTableAr = buildAllowanceTable(
    model.allowanceRows,
    '\u0627\u0644\u0628\u062f\u0644',
    '\u0627\u0644\u0642\u064a\u0645\u0629 (SR)',
  );
  const allowanceTableEn = buildAllowanceTable(model.allowanceRows, 'Allowance', 'Amount (SR)');
  const hasDeduction = model.deduction.gt(0);

  const extraCss = `
    .doc{border:1px solid #dbe1e8;border-radius:12px;overflow:hidden}
    .head{padding:14px 18px;border-bottom:1px solid #dbe1e8;background:#f8fafc;text-align:center}
    .section{padding:14px 18px;border-bottom:1px solid #e5e7eb}
    .bi{display:grid;grid-template-columns:1fr 1px 1fr;gap:12px;align-items:stretch}
    .sep{background:#cbd5e1;border-radius:999px}
    .box{border:1px solid #dbe1e8;border-radius:10px;padding:12px}
    .box-title{font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e5e7eb}
    .row{display:flex;justify-content:space-between;gap:12px;margin-bottom:5px;font-size:12px}
    .row-hl{background:#f0fdf4;border-radius:6px;padding:5px 8px;margin-top:4px}
    .row-hl span:last-child{color:#15803d;font-weight:700}
    .en{direction:ltr;text-align:left}
    .num{font-family:'Cairo',Arial,sans-serif;font-weight:600}
    .muted{color:#6b7280}
    .amber{color:#b45309}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #dbe1e8;padding:8px;font-size:12px}
    th{background:#f8fafc}
    .warn{background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:8px 12px;font-size:11px;color:#92400e;margin-top:8px}
    @media print{.doc{box-shadow:none}}
  `;

  const overtimeSection = model.hasOT
    ? `
      <div class="section">
        <div class="bi">
          <div class="box">
            <div class="box-title">ØªÙØµÙŠÙ„ Ø§Ù„Ø³Ø§Ø¹Ø§Øª ÙˆØ§Ù„Ø£ÙˆÙØ± ØªØ§ÙŠÙ…</div>
            ${row('Ø³Ø§Ø¹Ø§Øª Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„ÙŠÙˆÙ…ÙŠØ©', money(model.hours))}
            ${row('Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø£ÙŠØ§Ù… Ø§Ù„Ø¹Ù…Ù„', money(model.workDays))}
            ${row('Ø£ÙŠØ§Ù… Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ø¹Ø§Ø¯ÙŠØ©', money(model.regularWorkDays))}
            ${model.restDays > 0 ? row('Ø£ÙŠØ§Ù… Ø§Ù„Ø±Ø§Ø­Ø© Ø§Ù„Ù…Ø´ØºÙ„Ø©', money(model.restDays), 'amber') : ''}
            ${row('Ø³Ø§Ø¹Ø§Øª Ø§Ù„Ø£ÙˆÙØ± ØªØ§ÙŠÙ… Ø§Ù„ÙŠÙˆÙ…ÙŠØ©', money(model.overtimeHoursPerDay), 'amber')}
            ${row('Ø³Ø§Ø¹Ø§Øª OT Ø§Ù„ÙŠÙˆÙ…ÙŠØ©', `${money(model.totalDailyOT)} Ø³Ø§Ø¹Ø©`, 'amber')}
            ${model.restDays > 0 ? row('Ø³Ø§Ø¹Ø§Øª OT Ø£ÙŠØ§Ù… Ø§Ù„Ø±Ø§Ø­Ø©', `${money(model.totalRestOT)} Ø³Ø§Ø¹Ø©`, 'amber') : ''}
            <div class="row row-hl"><span>Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø³Ø§Ø¹Ø§Øª OT</span><span class="num amber">${money(model.totalOT)} Ø³Ø§Ø¹Ø©</span></div>
            ${row('Ø£Ø¬Ø± Ø§Ù„Ø³Ø§Ø¹Ø© Ø§Ù„ÙØ¹Ù„ÙŠ', `${money(model.actualHourlyRate)} SR`)}
            ${row('Ø£Ø¬Ø± Ø§Ù„Ø³Ø§Ø¹Ø© Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ', `${money(model.basicHourlyRate)} SR`)}
            ${row('Ø£Ø¬Ø± Ø³Ø§Ø¹Ø© OT', `${money(model.overtimeHourlyRate)} SR`)}
            ${model.totalDailyOT > 0 ? row('Ù‚ÙŠÙ…Ø© OT Ø§Ù„ÙŠÙˆÙ…ÙŠØ©', `${money(model.dailyOTValue)} SR`) : ''}
            ${model.restDays > 0 ? row('Ù‚ÙŠÙ…Ø© OT Ø£ÙŠØ§Ù… Ø§Ù„Ø±Ø§Ø­Ø©', `${money(model.restOTValue)} SR`) : ''}
            <div class="row row-hl"><span>Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø£ÙˆÙØ± ØªØ§ÙŠÙ…</span><span class="num">${money(model.totalOTValue)} SR</span></div>
          </div>
          <div class="sep"></div>
          <div class="box en">
            <div class="box-title">Hourly Rate & Overtime Detail</div>
            ${row('Daily work hours', money(model.hours))}
            ${row('Total work days', money(model.workDays))}
            ${row('Regular days', money(model.regularWorkDays))}
            ${model.restDays > 0 ? row('Rest days worked', money(model.restDays), 'amber') : ''}
            ${row('Daily OT hours', money(model.overtimeHoursPerDay), 'amber')}
            ${row('Daily OT value', `${money(model.dailyOTValue)} SR`)}
            ${model.restDays > 0 ? row('Rest day OT value', `${money(model.restOTValue)} SR`) : ''}
            <div class="row row-hl"><span>Total Overtime Pay</span><span class="num">${money(model.totalOTValue)} SR</span></div>
          </div>
        </div>
      </div>
    `
    : '';

  const body = `
    <div class="doc">
      <div class="head">
        <div style="font-weight:700;margin-top:6px">ØªÙ‚Ø±ÙŠØ± Ø­Ø§Ø³Ø¨Ø© Ø§Ù„Ø±ÙˆØ§ØªØ¨ / Salary Calculator Report</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Date: ${esc(getSaudiToday())}</div>
      </div>

      <div class="section">
        <div class="bi">
          <div class="box">
            <div class="box-title">ØªÙØµÙŠÙ„ Ø§Ù„Ø±Ø§ØªØ¨</div>
            ${row('Ø§Ù„Ù…ÙˆØ¸Ù', esc(employeeAr))}
            ${row('Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù…Ø³ØªÙ‡Ø¯Ù', `${money(model.totalTarget)} SR`)}
            ${row('Ø§Ù„Ø±Ø§ØªØ¨ Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ', `${money(model.basic)} SR`)}
            ${row('Ø§Ù„Ø¨Ø¯Ù„Ø§Øª', `${money(model.totalAllowances)} SR`)}
            ${row('Ø§Ù„Ø£ÙˆÙØ± ØªØ§ÙŠÙ…', `${money(model.totalOTValue)} SR`, 'amber')}
            <div class="row row-hl"><span>Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ</span><span class="num">${money(model.calculatedTotal)} SR</span></div>
            ${hasDeduction ? row(`Ø®ØµÙ… Ø§Ù„Ø¥Ø¬Ø§Ø²Ø© (${model.vacDays} ÙŠÙˆÙ…)`, `-${money(model.deduction)} SR`) : ''}
            ${hasDeduction ? `<div class="row row-hl"><span>ØµØ§ÙÙŠ Ø§Ù„Ø±Ø§ØªØ¨</span><span class="num">${money(model.netSalary)} SR</span></div>` : ''}
          </div>
          <div class="sep"></div>
          <div class="box en">
            <div class="box-title">Salary Breakdown</div>
            ${row('Employee', esc(employeeEn))}
            ${row('Target Total', `${money(model.totalTarget)} SR`)}
            ${row('Basic Salary', `${money(model.basic)} SR`)}
            ${row('Allowances', `${money(model.totalAllowances)} SR`)}
            ${row('Overtime Pay', `${money(model.totalOTValue)} SR`, 'amber')}
            <div class="row row-hl"><span>Total</span><span class="num">${money(model.calculatedTotal)} SR</span></div>
            ${hasDeduction ? row(`Leave deduction (${model.vacDays} d)`, `-${money(model.deduction)} SR`) : ''}
            ${hasDeduction ? `<div class="row row-hl"><span>Net Salary</span><span class="num">${money(model.netSalary)} SR</span></div>` : ''}
          </div>
        </div>
      </div>

      ${overtimeSection}

      <div class="section">
        <div class="bi">
          <div class="box">
            <div class="box-title">ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø¨Ø¯Ù„Ø§Øª</div>
            ${allowanceTableAr}
          </div>
          <div class="sep"></div>
          <div class="box en">
            <div class="box-title">Allowances Breakdown</div>
            ${allowanceTableEn}
          </div>
        </div>
      </div>

      ${model.hasOT ? '<div class="section"><div class="warn">Ø§Ù„Ù…Ø§Ø¯Ø© 107: Ø£Ø¬Ø± Ø³Ø§Ø¹Ø© Ø§Ù„Ø£ÙˆÙØ± ØªØ§ÙŠÙ… = Ø§Ù„Ø£Ø¬Ø± Ø§Ù„ÙØ¹Ù„ÙŠ + 50% Ù…Ù† Ø§Ù„Ø£Ø¬Ø± Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ Ù…Ù‚Ø³ÙˆÙ…Ù‹Ø§ Ø¹Ù„Ù‰ Ø³Ø§Ø¹Ø§Øª Ø§Ù„Ø´Ù‡Ø± Ø§Ù„Ù‚ÙŠØ§Ø³ÙŠØ©. Art.107: OT hourly rate = actual wage plus 50% of basic wage.</div></div>' : ''}
    </div>
  `;

  return buildPrintDocumentHtml({
    title: 'Salary Calculator',
    companyName: model.companyName,
    logoUrl: model.companyLogoUrl || '',
    subtitle: 'Salary Calculator',
    extraCss,
    body,
  });
}
