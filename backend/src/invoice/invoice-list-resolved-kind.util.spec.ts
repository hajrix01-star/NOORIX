import {
  INVOICE_HR_KINDS_CSV,
  INVOICE_KIND_SALE,
  INVOICE_OUTFLOW_KINDS_CSV,
  resolveInvoiceListKindFilter,
} from './invoice-list-resolved-kind.util';

describe('resolveInvoiceListKindFilter', () => {
  it('returns explicit kind when provided', () => {
    expect(
      resolveInvoiceListKindFilter({
        requestedKind: 'hr_expense',
        canSales: true,
        canPurchases: false,
        canHr: false,
      }),
    ).toBe('hr_expense');
  });

  it('returns undefined when user has both sales and purchases read', () => {
    expect(
      resolveInvoiceListKindFilter({
        canSales: true,
        canPurchases: true,
        canHr: false,
      }),
    ).toBeUndefined();
  });

  it('returns all outflow kinds for purchases-only (includes hr_expense)', () => {
    expect(
      resolveInvoiceListKindFilter({
        canSales: false,
        canPurchases: true,
        canHr: false,
      }),
    ).toBe(INVOICE_OUTFLOW_KINDS_CSV);
  });

  it('returns sale only for sales-only without HR', () => {
    expect(
      resolveInvoiceListKindFilter({
        canSales: true,
        canPurchases: false,
        canHr: false,
      }),
    ).toBe(INVOICE_KIND_SALE);
  });

  it('includes HR kinds for sales-only with HR access', () => {
    expect(
      resolveInvoiceListKindFilter({
        canSales: true,
        canPurchases: false,
        canHr: true,
      }),
    ).toBe(`${INVOICE_KIND_SALE},${INVOICE_HR_KINDS_CSV}`);
  });
});
