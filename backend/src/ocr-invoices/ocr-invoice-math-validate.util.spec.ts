import {
  reconcileLineAmountsForTaxMode,
  validateInvoiceTotals,
  validateItemMath,
} from './ocr-invoice-math-validate.util';

describe('validateItemMath', () => {
  it('suggests gross unit price when net unit price is mixed with gross total', () => {
    const result = validateItemMath(1, 1478.26, 1699.999);
    expect(result.valid).toBe(false);
    expect(result.suggestedUnitPrice).toBe(1700);
  });
});

describe('reconcileLineAmountsForTaxMode', () => {
  it('fixes inclusive lines when unit price is net and total is gross', () => {
    const result = reconcileLineAmountsForTaxMode(1, 1478.26, 1699.999, 'inclusive');
    expect(result.reconciled).toBe(true);
    expect(result.unitPrice).toBe(1700);
    expect(result.totalPrice).toBe(1699.999);
    expect(validateItemMath(1, result.unitPrice, result.totalPrice).valid).toBe(true);
  });

  it('fixes exclusive lines when total is gross but unit price is net', () => {
    const result = reconcileLineAmountsForTaxMode(2, 100, 230, 'exclusive');
    expect(result.reconciled).toBe(true);
    expect(result.unitPrice).toBe(100);
    expect(result.totalPrice).toBe(200);
    expect(validateItemMath(2, result.unitPrice, result.totalPrice).valid).toBe(true);
  });

  it('does not reconcile when quantity mismatch is the likely issue', () => {
    const result = reconcileLineAmountsForTaxMode(1, 100, 200, 'inclusive');
    expect(result.reconciled).toBe(false);
  });
});

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
