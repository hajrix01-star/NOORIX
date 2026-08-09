import type { LoanRecord } from '../../types/api';

function asPositiveNumber(value: number | string | null | undefined) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseIsoDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  return value.slice(0, 10);
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
  const notes = loan.notes || '';
  const match = notes.match(/(\d{1,4})\s*(?:قسط(?:ًا|ا)?|أقساط|installments?)/i);
  return match ? Number(match[1]) : null;
}

export function getLoanHistoricalPaidThroughDate(loan: LoanRecord) {
  const stored = parseIsoDate(loan.historicalPaidThroughDate);
  if (stored) return stored;

  const notes = loan.notes || '';
  const contextual = notes.match(/(?:آخر\s+قسط\s+مسدد|مسدد\s+حتى|paid\s+through)[^0-9]*(\d{4}-\d{2}-\d{2})/i);
  if (contextual) return contextual[1];

  const anyIsoDate = notes.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return anyIsoDate ? anyIsoDate[1] : null;
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
