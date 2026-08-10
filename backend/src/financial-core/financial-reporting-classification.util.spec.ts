import {
  reportingClassForHistoricalLedgerEntry,
  reportingClassForHrServiceCategory,
  reportingClassForOutflowKind,
  reportingClassForReferenceType,
} from './financial-reporting-classification.util';

describe('financial reporting classification', () => {
  it.each([
    ['purchase', 'operating_purchase'],
    ['fixed_expense', 'operating_recurring_expense'],
    ['salary', 'operating_payroll'],
    ['advance', 'non_operating_advance'],
    ['expense', 'operating_other_expense'],
    ['hr_expense', 'operating_other_expense'],
    ['unsupported', 'unclassified'],
  ] as const)('classifies outflow kind %s as %s', (kind, expected) => {
    expect(reportingClassForOutflowKind(kind)).toBe(expected);
  });

  it.each([
    ['sale', 'operating_revenue'],
    ['advance_settlement', 'operating_payroll'],
    ['loan_payment', 'non_operating_loan'],
    ['transfer', 'internal_transfer'],
    ['unknown', 'unclassified'],
  ] as const)('classifies reference type %s as %s', (referenceType, expected) => {
    expect(reportingClassForReferenceType(referenceType)).toBe(expected);
  });

  it('classifies the VAT share of a sale separately from operating revenue', () => {
    expect(reportingClassForReferenceType('sale', { isVat: true })).toBe('tax_collected');
  });

  it('restores legacy invoice and VAT classes without relying on a live invoice query', () => {
    expect(reportingClassForHistoricalLedgerEntry('invoice', { invoiceKind: 'fixed_expense' }))
      .toBe('operating_recurring_expense');
    expect(reportingClassForHistoricalLedgerEntry('invoice', {
      invoiceKind: 'hr_expense', hrServiceCategory: 'medical_insurance',
    })).toBe('operating_recurring_expense');
    expect(reportingClassForHistoricalLedgerEntry('sale', { creditAccountCode: 'TAX-001' }))
      .toBe('tax_collected');
  });

  it('keeps recurring HR services in recurring expenses and one-off services in other expenses', () => {
    expect(reportingClassForHrServiceCategory('medical_insurance')).toBe('operating_recurring_expense');
    expect(reportingClassForHrServiceCategory('flight_ticket')).toBe('operating_other_expense');
  });
});
