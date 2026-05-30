import { hrFmt } from '../../utils/hrFmt';
import { toYmd } from '../../../../utils/saudiDate';

export const TYPE_MAP = { annual: 'leaveAnnual', sick: 'leaveSick', unpaid: 'leaveUnpaid', other: 'leaveOther' };

export function getInitials(name: any) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] || '') + (parts[1][0] || '');
  return (parts[0] || '').slice(0, 2) || '?';
}

export function buildCareerTableRows(movements: any, t: any) {
  const labelFor = (mt: any) => {
    if (mt === 'promotion') return t('movementTypePromotion');
    if (mt === 'raise') return t('movementTypeRaise');
    return t('movementTypeOther');
  };
  return movements.map((m: any) => {
    let changeSummary = '—';
    if (m.movementType === 'promotion') {
      const a = m.previousValue || '—';
      const b = m.newValue || '—';
      changeSummary = `${a} → ${b}`;
    } else if (m.movementType === 'raise') {
      const a =
        m.previousValue != null && String(m.previousValue).trim() !== ''
          ? hrFmt(Number(m.previousValue))
          : '—';
      const b =
        m.newValue != null && String(m.newValue).trim() !== ''
          ? hrFmt(Number(m.newValue))
          : '—';
      const inc = m.amount != null && Number(m.amount) > 0 ? ` (+${hrFmt(Number(m.amount))})` : '';
      changeSummary = `${a} → ${b}${inc}`;
    } else {
      const parts = [m.previousValue, m.newValue].filter(Boolean);
      changeSummary =
        parts.length > 0
          ? parts.join(' → ')
          : m.amount != null
            ? hrFmt(Number(m.amount))
            : '—';
    }
    return {
      id: m.id,
      effectiveDate: m.effectiveDate,
      typeLabel: labelFor(m.movementType),
      changeSummary,
      notes: m.notes || '—',
    };
  });
}

export function buildFinancialRecords(hrInvoicesData: any, deductions: any, t: any, residencies: any[] = []) {
  const recs = [];
  const residencyByInvoiceId = new Map(
    (residencies || [])
      .filter((r: any) => r.invoiceId)
      .map((r: any) => [r.invoiceId, r.id]),
  );
  const hrInvs = (hrInvoicesData?.items ?? []).filter((i: any) => i.status !== 'cancelled');
  for (const inv of hrInvs) {
    const dt = toYmd(inv.transactionDate);
    let typeKey = 'opAdvance';
    let typeLabel = t('opAdvance');
    if (inv.kind === 'salary') {
      typeKey = 'opSalary';
      typeLabel = t('opSalary');
    } else if (inv.kind === 'hr_expense') {
      typeKey = 'invoiceKindHrExpense';
      typeLabel = t('invoiceKindHrExpense');
    }
    let notes = inv.notes || '';
    if (inv.kind === 'advance' && inv.settledAt) {
      notes = (notes ? notes + ' — ' : '') + (t('advanceSettled') || 'تم السداد');
    }
    recs.push({
      id: inv.id,
      date: dt,
      type: typeKey,
      typeLabel,
      amount: Number(inv.totalAmount ?? inv.netAmount ?? 0),
      notes,
      source: 'invoice',
      kind: inv.kind,
      status: inv.status,
      settledAt: inv.settledAt,
      residencyId: inv.kind === 'hr_expense' ? residencyByInvoiceId.get(inv.id) : undefined,
    });
  }
  for (const d of deductions) {
    const dt = toYmd(d.transactionDate);
    recs.push({
      id: d.id,
      date: dt,
      type: 'payrollDeductions',
      typeLabel: t('payrollDeductions'),
      amount: -Number(d.amount ?? 0),
      notes: d.notes || '',
      source: 'deduction',
      deductionType: d.deductionType,
    });
  }
  recs.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
  return recs;
}

export function buildSalaryRows(employee: any, customAllowances: any, overtimeTotal: any, total: any, overtimeHoursPerDay: any, t: any) {
  type SalaryRow = { label: any; amount: number; strong?: boolean; total?: boolean };
  const rows: SalaryRow[] = [{ label: t('basicSalary'), amount: Number(employee.basicSalary ?? 0), strong: true }];
  if (Number(employee.housingAllowance ?? 0) > 0) {
    rows.push({ label: t('housingAllowance'), amount: Number(employee.housingAllowance ?? 0) });
  }
  if (Number(employee.transportAllowance ?? 0) > 0) {
    rows.push({ label: t('transportAllowance'), amount: Number(employee.transportAllowance ?? 0) });
  }
  if (Number(employee.otherAllowance ?? 0) > 0) {
    rows.push({ label: t('otherAllowance'), amount: Number(employee.otherAllowance ?? 0) });
  }
  for (const allowance of customAllowances) {
    rows.push({ label: allowance.nameAr || t('customAllowanceName'), amount: Number(allowance.amount ?? 0) });
  }
  if (overtimeTotal > 0) {
    rows.push({
      label:
        overtimeHoursPerDay > 0
          ? `${t('salaryCalcOvertimePay')} (${hrFmt(overtimeHoursPerDay)} ساعة/يوم)`
          : t('salaryCalcOvertimePay'),
      amount: overtimeTotal,
    });
  }
  rows.push({ label: t('totalSalary'), amount: total, total: true });
  return rows;
}
