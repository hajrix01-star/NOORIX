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

  it('treats taxable expense and fixed expense as input VAT purchases', () => {
    const rows: TaxVatAggregateRow[] = [
      { kind: 'expense', has_tax: true, net_sum: '20', tax_sum: '3' },
      { kind: 'fixed_expense', has_tax: true, net_sum: '30', tax_sum: '4.5' },
    ];

    const result = service.computeDisclosureFromInvoiceAggregates(rows, 15, false);

    expect(result.standard_purchases).toEqual({ amount: 50, adjustment: 0, vat: 7.5 });
    expect(result.exempt_purchases).toEqual({ amount: 0, adjustment: 0, vat: 0 });
  });

  it('classifies untaxed purchases as exempt purchases', () => {
    const rows: TaxVatAggregateRow[] = [
      { kind: 'purchase', has_tax: false, net_sum: '42.25', tax_sum: '0' },
    ];

    const result = service.computeDisclosureFromInvoiceAggregates(rows, 15, false);

    expect(result.standard_purchases).toEqual({ amount: 0, adjustment: 0, vat: 0 });
    expect(result.exempt_purchases).toEqual({ amount: 42.25, adjustment: 0, vat: 0 });
  });

  it('combines taxable and untaxed sales under the selected disclosure policy', () => {
    const rows: TaxVatAggregateRow[] = [
      { kind: 'sale', has_tax: true, net_sum: '100', tax_sum: '15' },
      { kind: 'sale', has_tax: false, net_sum: '200', tax_sum: '0' },
    ];

    const result = service.computeDisclosureFromInvoiceAggregates(rows, 15, false);

    expect(result.standard_sales).toEqual({ amount: 300, adjustment: 0, vat: 45 });
  });

  it('uses the default VAT rate when company VAT percent is missing', () => {
    const rows: TaxVatAggregateRow[] = [
      { kind: 'sale', has_tax: false, net_sum: '100', tax_sum: '0' },
    ];

    const result = service.computeDisclosureFromInvoiceAggregates(rows, null, false);

    expect(result.standard_sales).toEqual({ amount: 100, adjustment: 0, vat: 15 });
  });

  it('allows a zero VAT rate policy for untaxed sales', () => {
    const rows: TaxVatAggregateRow[] = [
      { kind: 'sale', has_tax: false, net_sum: '100', tax_sum: '0' },
    ];

    const result = service.computeDisclosureFromInvoiceAggregates(rows, 0, false);

    expect(result.standard_sales).toEqual({ amount: 100, adjustment: 0, vat: 0 });
  });

  it('ignores zero and negative untaxed sales rows', () => {
    const rows: TaxVatAggregateRow[] = [
      { kind: 'sale', has_tax: false, net_sum: '0', tax_sum: '0' },
      { kind: 'sale', has_tax: false, net_sum: '-10', tax_sum: '0' },
    ];

    const result = service.computeDisclosureFromInvoiceAggregates(rows, 15, false);

    expect(result.standard_sales).toEqual({ amount: 0, adjustment: 0, vat: 0 });
  });

  it('keeps fractional VAT precision for inclusive disclosure edge cases', () => {
    const rows: TaxVatAggregateRow[] = [
      { kind: 'sale', has_tax: false, net_sum: '99.99', tax_sum: '0' },
    ];

    const result = service.computeDisclosureFromInvoiceAggregates(rows, 15, true);

    expect(result.standard_sales.amount).toBeCloseTo(86.947826, 6);
    expect(result.standard_sales.vat).toBeCloseTo(13.042174, 6);
  });
});
