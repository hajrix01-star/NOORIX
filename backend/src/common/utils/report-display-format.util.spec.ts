import Decimal from 'decimal.js';
import {
  formatReportMoneyInteger,
  formatReportPercentNumber,
  formatReportTaxAmount,
} from './report-display-format.util';

describe('report-display-format', () => {
  it('formats money as plain integers (no grouping — safe for parseFloat downstream)', () => {
    expect(formatReportMoneyInteger(1234.7)).toBe('1235');
    expect(formatReportMoneyInteger(new Decimal('999.4'))).toBe('999');
    expect(formatReportMoneyInteger('12345.00')).toBe('12345');
  });

  it('formats tax amounts with at most one decimal and grouping', () => {
    expect(formatReportTaxAmount(100)).toBe('100');
    expect(formatReportTaxAmount(15.25)).toBe('15.3');
    expect(formatReportTaxAmount(new Decimal('1234.56'))).toBe('1,234.6');
  });

  it('formats percentages with at most one decimal', () => {
    expect(formatReportPercentNumber(35)).toBe('35');
    expect(formatReportPercentNumber(35.56)).toBe('35.6');
    expect(formatReportPercentNumber(new Decimal('12.34'))).toBe('12.3');
  });
});
