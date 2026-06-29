import { TaxVatCoreService, type TaxVatAggregateRow } from './tax-vat-core.service';

describe('TaxVatCoreService', () => {
  const service = new TaxVatCoreService();

  it('keeps recorded taxable sales and purchases as the official VAT disclosure source', () => {
    const rows: TaxVatAggregateRow[] = [
      { kind: 'sale', has_tax: true, net_sum: '100', tax_sum: '15' },
      { kind: 'purchase', has_tax: true, net_sum: '40', tax_sum: '6' },
      { kind: 'expense', has_tax: false, net_sum: '25', tax_sum: '0' },
    ];

    const result = service.computeDisclosureFromInvoiceAggregates(rows, 15, false);

    expect(result.standard_sales).toEqual({ amount: 100, adjustment: 0, vat: 15 });
    expect(result.standard_purchases).toEqual({ amount: 40, adjustment: 0, vat: 6 });
    expect(result.exempt_purchases).toEqual({ amount: 25, adjustment: 0, vat: 0 });
  });

  it('imputes VAT for untaxed sales when disclosure policy treats sales as tax inclusive', () => {
    const rows: TaxVatAggregateRow[] = [
      { kind: 'sale', has_tax: false, net_sum: '115', tax_sum: '0' },
    ];

    const result = service.computeDisclosureFromInvoiceAggregates(rows, 15, true);

    expect(result.standard_sales.amount).toBeCloseTo(100, 6);
    expect(result.standard_sales.vat).toBeCloseTo(15, 6);
    expect(result.exempt_sales).toEqual({ amount: 0, adjustment: 0, vat: 0 });
  });

  it('imputes VAT for untaxed sales when disclosure policy treats sales as tax exclusive', () => {
    const rows: TaxVatAggregateRow[] = [
      { kind: 'sale', has_tax: false, net_sum: '100', tax_sum: '0' },
    ];

    const result = service.computeDisclosureFromInvoiceAggregates(rows, 15, false);

    expect(result.standard_sales).toEqual({ amount: 100, adjustment: 0, vat: 15 });
  });
});
