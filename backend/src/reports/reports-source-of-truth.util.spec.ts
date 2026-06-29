import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const reportsDir = __dirname;

describe('reports source-of-truth guardrails', () => {
  it('keeps general profit/loss totals on annual ledger aggregates', () => {
    const service = readFileSync(join(reportsDir, 'reports.service.ts'), 'utf8');

    expect(service).toContain('loadAnnualLedgerAggregates(this.prisma, companyId, year)');
  });

  it('keeps VAT disclosure calculation centralized in TaxVatCore', () => {
    const taxVatService = readFileSync(join(reportsDir, 'reports-tax-vat.service.ts'), 'utf8');

    expect(taxVatService).toContain('TaxVatCoreService');
    expect(taxVatService).toContain('computeDisclosureFromInvoiceAggregates');
    expect(taxVatService).not.toContain('standard_sales =');
    expect(taxVatService).not.toContain('standard_purchases =');
  });
});
