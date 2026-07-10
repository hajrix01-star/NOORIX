import { describe, expect, it } from 'vitest';
import {
  buildTaxPeriodOptions,
  buildTaxReportExportRows,
  computeTaxReportTotals,
  updateTaxDisclosureRow,
} from './taxReportTabModel';
import { defaultDisclosureData } from '../../constants/taxDisclosure';

const t = (key: string) => ({ reportItem: 'Item' })[key] ?? key;

describe('taxReportTabModel', () => {
  it('builds period options centrally', () => {
    const options = buildTaxPeriodOptions('en');

    expect(options[0]).toEqual({ value: 'Q1', label: 'Q1' });
    expect(options.at(-1)).toEqual({ value: 'M12', label: 'Dec' });
  });

  it('updates disclosure rows and computes totals without screen logic', () => {
    let data = defaultDisclosureData();
    data = updateTaxDisclosureRow(data, 'standard_sales', 'vat', 150);
    data = updateTaxDisclosureRow(data, 'standard_purchases', 'vat', 40);
    data = updateTaxDisclosureRow(data, 'prior_adjustments', null, 10);

    const totals = computeTaxReportTotals(data);

    expect(totals.outputTotal).toBe(150);
    expect(totals.inputTotal).toBe(40);
    expect(totals.netPayable).toBe(120);
  });

  it('builds export rows from the central disclosure model', () => {
    const data = updateTaxDisclosureRow(defaultDisclosureData(), 'standard_sales', 'vat', 15);
    const rows = buildTaxReportExportRows({
      data,
      totals: computeTaxReportTotals(data),
      lang: 'en',
      t,
    });

    expect(rows[0]).toMatchObject({ Item: 'Standard-rated sales 15%', VAT: 15 });
    expect(rows.at(-1)).toMatchObject({ Item: 'Net VAT payable or refundable', Amount: 15 });
  });
});
