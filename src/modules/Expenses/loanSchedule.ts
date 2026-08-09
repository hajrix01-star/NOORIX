import type { LoanRecord } from '../../types/api';

function asPositiveNumber(value: number | string | null | undefined) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeScheduleText(value: string | null | undefined) {
  return String(value || '')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

function parseIsoDate(value: string | null | undefined) {
  const normalized = normalizeScheduleText(value).trim();
  const match = normalized.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

function findDateInText(value: string) {
  const normalized = normalizeScheduleText(value);
  const match = normalized.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  return match ? parseIsoDate(`${match[1]}-${match[2]}-${match[3]}`) : null;
}

function addMonths(value: string, months: number) {
  const iso = parseIsoDate(value);
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  const monthIndex = month - 1 + months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonthIndex = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  return `${targetYear.toString().padStart(4, '0')}-${(targetMonthIndex + 1).toString().padStart(2, '0')}-${targetDay.toString().padStart(2, '0')}`;
}

export function getLoanReferenceInstallmentAmount(loan: LoanRecord) {
  const historicalCount = Number(loan.historicalPaymentsCount || 0);
  const historicalPaid = asPositiveNumber(loan.historicalPaidAmount);
  if (historicalCount > 0 && historicalPaid) return historicalPaid / historicalCount;

  const posted = (loan.payments || [])
    .filter((payment) => !payment.reversalOfId && payment.status === 'posted')
    .map((payment) => asPositiveNumber(payment.amount))
    .filter((amount): amount is number => amount !== null);
  return posted[0] || null;
}

export function getLoanRemainingInstallments(loan: LoanRecord) {
  const installment = getLoanReferenceInstallmentAmount(loan);
  const outstanding = asPositiveNumber(loan.outstandingAmount);
  if (!installment || !outstanding) return outstanding === null && Number(loan.outstandingAmount) === 0 ? 0 : null;
  const raw = outstanding / installment;
  const nearest = Math.round(raw);
  return Math.max(0, Math.abs(raw - nearest) < 0.001 ? nearest : Math.ceil(raw));
}

export function getLoanTotalInstallments(loan: LoanRecord) {
  const notes = normalizeScheduleText(loan.notes);
  const match = notes.match(/(\d{1,4})\s*(?:قسط(?:ًا|ا)?|أقساط|installments?)/i);
  return match ? Number(match[1]) : null;
}

export function getLoanHistoricalPaidThroughDate(loan: LoanRecord) {
  const stored = parseIsoDate(loan.historicalPaidThroughDate);
  if (stored) return stored;

  const notes = normalizeScheduleText(loan.notes);
  const contextual = notes.match(/(?:آخر\s+قسط\s+مسدد|مسدد\s+حتى|paid\s+through)[^0-9]*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i);
  if (contextual) return parseIsoDate(contextual[1]);

  const noteDate = findDateInText(notes);
  if (noteDate) return noteDate;

  const migratedDates = (loan.payments || [])
    .filter((payment) => !payment.reversalOfId && payment.sourceInvoice)
    .map((payment) => parseIsoDate(payment.transactionDate))
    .filter((date): date is string => date !== null)
    .sort();
  return migratedDates.at(-1) || null;
}

export function getLoanScheduleStartDate(loan: LoanRecord) {
  const throughDate = getLoanHistoricalPaidThroughDate(loan);
  const historicalCount = Number(loan.historicalPaymentsCount || 0);
  if (throughDate && historicalCount > 0) return addMonths(throughDate, -(historicalCount - 1));
  return null;
}

export function getLoanPaymentInstallmentNumber(loan: LoanRecord, paymentDate: string | null | undefined) {
  const start = getLoanScheduleStartDate(loan);
  const payment = parseIsoDate(paymentDate);
  if (!start || !payment) return null;
  const [startYear, startMonth] = start.split('-').map(Number);
  const [paymentYear, paymentMonth] = payment.split('-').map(Number);
  const monthOffset = (paymentYear - startYear) * 12 + (paymentMonth - startMonth);
  if (monthOffset < 0) return null;
  const installmentNumber = monthOffset + 1;
  const total = getLoanTotalInstallments(loan);
  if (total && installmentNumber > total) return null;
  return installmentNumber;
}

export function getLoanExpectedEndDate(loan: LoanRecord) {
  const dueDate = parseIsoDate(loan.dueDate);
  if (dueDate) return dueDate;

  const startDate = getLoanScheduleStartDate(loan);
  const totalInstallments = getLoanTotalInstallments(loan);
  if (startDate && totalInstallments && totalInstallments > 0) return addMonths(startDate, totalInstallments - 1);
  return null;
}

export function getLoanNextPaymentDate(loan: LoanRecord) {
  const startDate = getLoanScheduleStartDate(loan);
  if (!startDate) return null;

  const historicalCount = Math.max(0, Number(loan.historicalPaymentsCount || 0));
  const postedInstallments = (loan.payments || [])
    .filter((payment) => !payment.reversalOfId && payment.status === 'posted')
    .map((payment) => getLoanPaymentInstallmentNumber(loan, payment.transactionDate))
    .filter((number): number is number => number !== null);
  const lastSettledInstallment = Math.max(historicalCount, 0, ...postedInstallments);
  const nextInstallment = lastSettledInstallment + 1;
  const totalInstallments = getLoanTotalInstallments(loan);
  if (totalInstallments && nextInstallment > totalInstallments) return null;
  return addMonths(startDate, nextInstallment - 1);
}
