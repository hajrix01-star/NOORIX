import { getText } from '../../../../../i18n/translations';
import { formatSaudiDate } from '../../../../../utils/saudiDate';
import { hrFmt } from '../../../utils/hrFmt';
import { parseEmployeeNotesMeta } from '../../../utils/employeeNotesMeta';
import type { DocSalaryRow, TerminationSummary } from '../types';
import { translateAllowanceToEnglish } from './employeeDocFormatters';
import {
  calculateEosServiceDays,
  getEosEligibilityFactor,
} from '../../../utils/hrCalculations/eos';

export function calculateServiceDays(joinDate: unknown, endDate: unknown) {
  return calculateEosServiceDays(
    joinDate as string | Date | null | undefined,
    endDate as string | Date | null | undefined,
  );
}

export function getEligibilityFactor(reason: string, serviceYears: number) {
  return getEosEligibilityFactor(reason, serviceYears);
}

export function mapReasonByMeta(reasonText: string | undefined | null = '', clause: string | undefined | null = '') {
  const reason = String(reasonText || '').toLowerCase();
  const legalClause = String(clause || '').toLowerCase();
  if (legalClause.includes('80') || reason.includes('80')) return 'article80';
  if (legalClause.includes('81') || reason.includes('81')) return 'article81';
  if (reason.includes('قوة') || reason.includes('force')) return 'force_majeure';
  if (reason.includes('زواج') || reason.includes('وضع') || reason.includes('maternity') || reason.includes('marriage')) {
    return 'maternity';
  }
  if (reason.includes('استقال') || reason.includes('resign')) return 'resignation';
  return 'employer';
}

export function buildSalaryRows(
  compensationSnapshot: Record<string, any>,
): { rows: DocSalaryRow[]; total: number } {
  const rows: DocSalaryRow[] = [];
  const breakdown = compensationSnapshot?.salaryPackage;
  if (!breakdown) {
    throw new Error('HR compensation snapshot is required for employee documents.');
  }
  if (breakdown.basicSalary > 0) rows.push({ ar: 'الراتب الأساسي', en: 'Basic Salary', amount: breakdown.basicSalary });
  if (breakdown.housingAllowance > 0) rows.push({ ar: 'بدل السكن', en: 'Housing Allowance', amount: breakdown.housingAllowance });
  if (breakdown.transportAllowance > 0) rows.push({ ar: 'بدل المواصلات', en: 'Transport Allowance', amount: breakdown.transportAllowance });
  if (breakdown.otherAllowance > 0) rows.push({ ar: 'بدل آخر', en: 'Other Allowance', amount: breakdown.otherAllowance });
  for (const row of compensationSnapshot?.customAllowances?.items ?? []) {
    const amount = Number(row.amount ?? 0);
    if (amount > 0) {
      rows.push({
        ar: String(row.nameAr || row.nameEn || 'بدل'),
        en: String(row.nameEn || translateAllowanceToEnglish(row.nameAr as string)),
        amount,
      });
    }
  }
  if (breakdown.overtimeHoursPerDay > 0) {
    rows.push({
      ar: `مقابل الأوفر تايم (${hrFmt(breakdown.overtimeHoursPerDay)} ساعة/يوم)`,
      en: `Overtime Pay (${hrFmt(breakdown.overtimeHoursPerDay)} hr/day)`,
      amount: breakdown.overtimePay,
    });
  }
  return { rows, total: breakdown.total };
}

export function buildDocFileBaseName(prefix: string, employee: Record<string, unknown>) {
  const employeeName = String(employee?.name || employee?.nameAr || 'employee');
  const datePart = formatSaudiDate(new Date()).replace(/\//g, '-');
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${prefix}-${employeeName}-${datePart}-${hh}-${mm}-${ss}`;
}

export function getTerminationSummary(employee: Record<string, unknown>): TerminationSummary {
  const status = String(employee?.status || '').toLowerCase();
  const parsed = parseEmployeeNotesMeta(employee?.notes as string | undefined);
  const meta = (parsed.meta || {}) as Record<string, string>;
  const reasonAr =
    meta.terminationReason ||
    (employee?.terminationReasonAr as string) ||
    (employee?.terminationReason as string) ||
    (employee?.statusReason as string) ||
    '';
  const reasonEn = String(employee?.terminationReasonEn || '');
  const clause =
    meta.terminationClause || (employee?.terminationClause as string) || (employee?.laborArticle as string) || '';
  const terminationDate = meta.terminationDate || '';
  if (status !== 'terminated') {
    return {
      ar: 'الموظف على رأس العمل (لا يوجد إنهاء خدمة مسجل).',
      en: 'Employee is active (no termination record).',
      clauseAr: 'غير منطبق',
      clauseEn: 'Not applicable',
      terminationDate,
      reasonCode: 'employer',
    };
  }
  return {
    ar: `إنهاء خدمة الموظف${reasonAr ? ` - السبب: ${reasonAr}` : ''}.`,
    en: `Employment terminated${reasonEn ? ` - reason: ${reasonEn}` : ''}.`,
    clauseAr: clause ? `البند النظامي: ${clause}` : 'البند النظامي: غير محدد',
    clauseEn: clause ? `Legal clause: ${clause}` : 'Legal clause: Not specified',
    terminationDate,
    reasonCode: mapReasonByMeta(reasonAr, clause),
  };
}

/** إزالة صياغة التعويض / م77 من نصوص الإقرار عند المخالصة بدون نهاية خدمة */
export function stripArt77CompensationPhrases(text: unknown) {
  if (text == null || typeof text !== 'string') return text;
  let s = text;
  s = s.replace(/\s*مع\s+تعويض\s*\(\s*مادة\s*77\s*\)/gi, '');
  s = s.replace(/\s*مع\s+تعويض\s*\(\s*ماده\s*77\s*\)/gi, '');
  s = s.replace(/\s*with\s+compensation\s*\(\s*Art\.?\s*77\s*\)/gi, '');
  s = s.replace(/\s*with\s+compensation\s*\(\s*Article\s*77\s*\)/gi, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

export function buildSettlementDeclaration(
  includeEos: boolean,
  termination: TerminationSummary,
): { ar: string; en: string; clauseAr: string; clauseEn: string } {
  if (includeEos) {
    return {
      ar: termination.ar,
      en: termination.en,
      clauseAr: termination.clauseAr,
      clauseEn: termination.clauseEn,
    };
  }
  const ar = stripArt77CompensationPhrases(termination.ar) as string;
  const en = stripArt77CompensationPhrases(termination.en) as string;
  const clauseArRaw = String(termination.clauseAr || '').trim();
  const clauseEnRaw = String(termination.clauseEn || '').trim();
  const clauseArOnly77 =
    /^البند\s*النظامي:\s*مادة\s*77\s*$/i.test(clauseArRaw) || /^البند\s*النظامي:\s*ماده\s*77\s*$/i.test(clauseArRaw);
  const clauseEnOnly77 =
    /^Legal\s+clause:\s*Article\s*77\s*$/i.test(clauseEnRaw) ||
    /^Legal\s+clause:\s*Art\.\s*77\s*$/i.test(clauseEnRaw) ||
    /^Legal\s+clause:\s*mادة\s*77\s*$/i.test(clauseEnRaw);
  return {
    ar,
    en,
    clauseAr: clauseArOnly77
      ? getText('finalSettlementClauseNeutralNoEos', 'ar')
      : (stripArt77CompensationPhrases(termination.clauseAr) as string),
    clauseEn: clauseEnOnly77
      ? getText('finalSettlementClauseNeutralNoEos', 'en')
      : (stripArt77CompensationPhrases(termination.clauseEn) as string),
  };
}
