import { roundMoney2 } from '../../../../../utils/moneyInput';
import { employeeDisplayName } from '../../../../../utils/employeeDisplayName';
import { formatMoneyForReport } from './hrQuickEntryFormatters';
import type { EmployeeOption } from '../types';

type VaultLike = { id?: string; nameAr?: string; nameEn?: string };

export function buildAdvancePending(
  args: {
    advEmp: string;
    advAmount: string;
    advVault: string;
    advDate: string;
    advNotes: string;
    companyId: string;
    activeEmployees: EmployeeOption[];
    vaults: VaultLike[];
  },
) {
  const { advEmp, advAmount, advVault, advDate, advNotes, companyId, activeEmployees, vaults } = args;
  const amt = parseFloat(String(advAmount).replace(',', '.'));
  const emp = activeEmployees.find((x) => x.id === advEmp);
  const vault = vaults.find((v) => v.id === advVault);
  const payload = {
    employeeId: advEmp,
    companyId,
    vaultId: advVault || undefined,
    amount: amt,
    transactionDate: advDate,
    notes: advNotes.trim() || `سلفة — ${employeeDisplayName(emp, 'ar', '')}`,
    employeeName: employeeDisplayName(emp, 'ar'),
  };
  const report = {
    textAr: `النوع: سلفة\nالاسم: ${employeeDisplayName(emp, 'ar')}\nالمبلغ: ${formatMoneyForReport(amt)} SR\nالخزنة: ${vault?.nameAr || vault?.nameEn || '—'}\nالتاريخ: ${advDate}`,
    textEn: `Type: Advance\nName: ${employeeDisplayName(emp, 'en')}\nAmount: ${formatMoneyForReport(amt)} SAR\nVault: ${vault?.nameEn || vault?.nameAr || '—'}\nDate: ${advDate}`,
  };
  return { payload, report };
}

export function buildLeavePending(args: {
  lvEmp: string;
  lvType: string;
  lvStart: string;
  lvEnd: string;
  lvDays: string;
  lvNotes: string;
  companyId: string;
  activeEmployees: EmployeeOption[];
}) {
  const { lvEmp, lvType, lvStart, lvEnd, lvDays, lvNotes, companyId, activeEmployees } = args;
  const s = new Date(lvStart);
  const end = new Date(lvEnd);
  const emp = activeEmployees.find((x) => x.id === lvEmp);
  const days = lvDays ? parseInt(lvDays, 10) : Math.ceil((end.getTime() - s.getTime()) / 86400000) + 1;
  const payload = {
    companyId,
    employeeId: lvEmp,
    leaveType: lvType,
    startDate: `${lvStart}T00:00:00.000Z`,
    endDate: `${lvEnd}T00:00:00.000Z`,
    daysCount: days,
    status: 'pending',
    notes: lvNotes || undefined,
  };
  const report = {
    textAr: `النوع: إجازة\nالاسم: ${employeeDisplayName(emp, 'ar')}\nالمدة: ${days} يوم\nمن: ${lvStart}\nإلى: ${lvEnd}`,
    textEn: `Type: Leave\nName: ${employeeDisplayName(emp, 'en')}\nDays: ${days}\nFrom: ${lvStart}\nTo: ${lvEnd}`,
  };
  return { payload, report };
}

export function buildDeductionPending(args: {
  ddEmp: string;
  ddType: string;
  ddAmount: string;
  ddDate: string;
  ddNotes: string;
  companyId: string;
  activeEmployees: EmployeeOption[];
}) {
  const { ddEmp, ddType, ddAmount, ddDate, ddNotes, companyId, activeEmployees } = args;
  const amt = parseFloat(String(ddAmount).replace(',', '.'));
  const emp = activeEmployees.find((x) => x.id === ddEmp);
  const payload = {
    companyId,
    employeeId: ddEmp,
    deductionType: ddType,
    amount: amt,
    transactionDate: `${ddDate}T12:00:00.000Z`,
    notes: ddNotes || undefined,
  };
  const report = {
    textAr: `النوع: خصم\nالاسم: ${employeeDisplayName(emp, 'ar')}\nالمبلغ: ${formatMoneyForReport(amt)} SR\nالتاريخ: ${ddDate}`,
    textEn: `Type: Deduction\nName: ${employeeDisplayName(emp, 'en')}\nAmount: ${formatMoneyForReport(amt)} SAR\nDate: ${ddDate}`,
  };
  return { payload, report };
}

export function buildMovementPending(args: {
  mvEmp: string;
  mvType: string;
  mvAmount: string;
  mvPrev: string;
  mvNew: string;
  mvEff: string;
  mvNotes: string;
  companyId: string;
  activeEmployees: EmployeeOption[];
}) {
  const { mvEmp, mvType, mvAmount, mvPrev, mvNew, mvEff, mvNotes, companyId, activeEmployees } = args;
  const emp = activeEmployees.find((x) => x.id === mvEmp);
  const amt = mvAmount.trim() ? parseFloat(String(mvAmount).replace(',', '.')) : undefined;
  const payload = {
    companyId,
    employeeId: mvEmp,
    movementType: mvType,
    amount: Number.isFinite(amt) ? amt : undefined,
    previousValue: mvPrev || undefined,
    newValue: mvNew || undefined,
    effectiveDate: `${mvEff}T12:00:00.000Z`,
    notes: mvNotes || undefined,
  };
  const report = {
    textAr: `النوع: ${mvType === 'raise' ? 'زيادة' : mvType === 'promotion' ? 'ترقية' : 'حركة'}\nالاسم: ${employeeDisplayName(emp, 'ar')}\n${Number.isFinite(amt) ? `المبلغ: ${formatMoneyForReport(amt as number)} SR\n` : ''}التاريخ: ${mvEff}`,
    textEn: `Type: ${mvType === 'raise' ? 'Raise' : mvType === 'promotion' ? 'Promotion' : 'Movement'}\nName: ${employeeDisplayName(emp, 'en')}\n${Number.isFinite(amt) ? `Amount: ${formatMoneyForReport(amt as number)} SAR\n` : ''}Date: ${mvEff}`,
  };
  return { payload, report };
}

export function buildAllowancePending(args: {
  alEmp: string;
  alName: string;
  alAmount: string;
  companyId: string;
  activeEmployees: EmployeeOption[];
}) {
  const { alEmp, alName, alAmount, companyId, activeEmployees } = args;
  const amt = parseFloat(String(alAmount).replace(',', '.'));
  const amtRounded = roundMoney2(amt);
  const emp = activeEmployees.find((x) => x.id === alEmp);
  const payload = {
    companyId,
    employeeId: alEmp,
    nameAr: alName.trim(),
    amount: amtRounded,
  };
  const report = {
    textAr: `النوع: بدلة\nالاسم: ${employeeDisplayName(emp, 'ar')}\nالبند: ${alName.trim()}\nالمبلغ: ${formatMoneyForReport(amtRounded)} SR`,
    textEn: `Type: Allowance\nName: ${employeeDisplayName(emp, 'en')}\nItem: ${alName.trim()}\nAmount: ${formatMoneyForReport(amtRounded)} SAR`,
  };
  return { payload, report };
}
