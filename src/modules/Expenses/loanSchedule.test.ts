import { describe, expect, it } from 'vitest';
import type { LoanRecord } from '../../types/api';
import {
  getLoanExpectedEndDate,
  getLoanHistoricalPaidThroughDate,
  getLoanNextPaymentDate,
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

  it('uses the documented last-paid date from notes when the structured field is missing', () => {
    const legacyLoan: LoanRecord = {
      ...loan,
      historicalPaidThroughDate: null,
      notes: 'تمويل POS Finance — الرصيد الموحد شامل الربح. 48 قسطًا، آخر قسط مسدد 2026-07-25.',
    };
    expect(getLoanHistoricalPaidThroughDate(legacyLoan)).toBe('2026-07-25');
    expect(getLoanScheduleStartDate(legacyLoan)).toBe('2024-11-25');
    expect(getLoanPaymentInstallmentNumber(legacyLoan, '2026-07-22')).toBe(21);
  });

  it('normalizes invisible RTL marks and Arabic digits in the documented schedule anchor', () => {
    const rtlLoan: LoanRecord = {
      ...loan,
      historicalPaidThroughDate: null,
      notes: 'تمويل POS Finance — ٤٨ قسطًا، آخر قسط مسدد \u200f٢٠٢٦-٠٧-٢٥\u200e.',
    };
    expect(getLoanHistoricalPaidThroughDate(rtlLoan)).toBe('2026-07-25');
    expect(getLoanPaymentInstallmentNumber(rtlLoan, '2026-07-22')).toBe(21);
  });

  it('uses the latest migrated repayment as a safe fallback anchor', () => {
    const migratedLoan: LoanRecord = {
      ...loan,
      historicalPaidThroughDate: null,
      notes: 'تمويل POS Finance — الرصيد الموحد شامل الربح. 48 قسطًا.',
      payments: [
        { id: 'payment-20', amount: 15423.54, transactionDate: '2026-06-22', status: 'posted', sourceInvoice: { invoiceNumber: 'EXP-20' } },
        { id: 'payment-21', amount: 15423.54, transactionDate: '2026-07-22', status: 'posted', sourceInvoice: { invoiceNumber: 'EXP-21' } },
      ],
    };
    expect(getLoanHistoricalPaidThroughDate(migratedLoan)).toBe('2026-07-22');
    expect(getLoanPaymentInstallmentNumber(migratedLoan, '2026-07-22')).toBe(21);
  });

  it('prefills the next contractual repayment date after the documented installment', () => {
    expect(getLoanNextPaymentDate(loan)).toBe('2026-08-25');
  });

  it('advances the suggested date after a new Noorix repayment is posted', () => {
    const loanAfterAugustPayment: LoanRecord = {
      ...loan,
      payments: [
        { id: 'payment-22', amount: 15423.54, transactionDate: '2026-08-26', status: 'posted' },
      ],
    };
    expect(getLoanNextPaymentDate(loanAfterAugustPayment)).toBe('2026-09-25');
  });
});
