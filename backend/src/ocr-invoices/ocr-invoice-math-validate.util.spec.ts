import { validateInvoiceTotals } from './ocr-invoice-math-validate.util';

describe('validateInvoiceTotals', () => {
  it('classifies item totals close to subtotal as VAT-exclusive lines', () => {
    const result = validateInvoiceTotals(9130.43, 10500, 1369.57, 9130.43);
    expect(result.valid).toBe(true);
    expect(result.vatAdjusted).toBe(true);
    expect(result.lineTaxMode).toBe('exclusive');
  });

  it('classifies item totals close to total as VAT-inclusive lines even when subtotal exists', () => {
    const result = validateInvoiceTotals(10500, 10500, 1369.57, 9130.43);
    expect(result.valid).toBe(true);
    expect(result.vatAdjusted).toBe(false);
    expect(result.lineTaxMode).toBe('inclusive');
  });

  it('classifies item totals close to grand total as inclusive when subtotal missing', () => {
    const result = validateInvoiceTotals(230, 230, 30, undefined);
    expect(result.valid).toBe(true);
    expect(result.lineTaxMode).toBe('inclusive');
  });

  it('returns invalid when line totals do not align with subtotal or total', () => {
    const result = validateInvoiceTotals(180, 230, 30, 200);
    expect(result.valid).toBe(false);
    expect(result.lineTaxMode).toBe('unknown');
    expect(result.warning).toContain('لا يطابق');
  });
});
