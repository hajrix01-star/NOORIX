import { describe, expect, it } from 'vitest';
import type { LoanRecord } from '../../types/api';
import {
  getLoanExpectedEndDate,
  getLoanPaymentInstallmentNumber,
  getLoanReferenceInstallmentAmount,
  getLoanRemainingInstallments,
  getLoanScheduleStartDate,
  getLoanTotalInstallments,
} from './loanSchedule';

const loan: LoanRecord = {
  id: 'loan-1',
  nameAr: 'تمويل الراجحي',
  creditorName: 'مصرف الراجحي',
  openingAmount: 462571.12,
  outstandingAmount: 416435.58,
  openingDate: '2026-08-08',
  historicalPaymentsCount: 21,
  historicalPaidAmount: 323894.34,
  historicalPaidThroughDate: '2026-07-25',
  notes: 'تمويل POS Finance — الرصيد الموحد شامل الربح. 48 قسطًا.',
};

describe('loanSchedule', () => {
  it('derives the reference installment from documented historical payments', () => {
    expect(getLoanReferenceInstallmentAmount(loan)).toBeCloseTo(15423.54, 2);
  });

  it('derives remaining installments from the current outstanding balance', () => {
    expect(getLoanRemainingInstallments(loan)).toBe(27);
  });

  it('reads total installments from the loan notes', () => {
    expect(getLoanTotalInstallments(loan)).toBe(48);
  });

  it('derives first installment and expected final installment dates for a monthly schedule', () => {
    expect(getLoanScheduleStartDate(loan)).toBe('2024-11-25');
    expect(getLoanExpectedEndDate(loan)).toBe('2028-10-25');
  });

  it('maps repayment dates to the matching installment number even when the day differs', () => {
    expect(getLoanPaymentInstallmentNumber(loan, '2026-04-25')).toBe(18);
    expect(getLoanPaymentInstallmentNumber(loan, '2026-05-25')).toBe(19);
    expect(getLoanPaymentInstallmentNumber(loan, '2026-06-22')).toBe(20);
    expect(getLoanPaymentInstallmentNumber(loan, '2026-07-22')).toBe(21);
  });
});
