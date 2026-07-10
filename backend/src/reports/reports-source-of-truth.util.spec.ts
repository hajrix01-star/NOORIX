import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const reportsDir = __dirname;

describe('reports source-of-truth guardrails', () => {
  it('keeps general profit/loss totals on annual ledger aggregates', () => {
    const service = readFileSync(join(reportsDir, 'reports.service.ts'), 'utf8');

    expect(service).toContain('loadAnnualLedgerAggregates(this.prisma, companyId, year)');
    expect(service).toContain('GENERAL_PNL_AMOUNT_BASIS');
  });

  it('keeps general profit/loss amount basis explicit and VAT-inclusive', () => {
    const contract = readFileSync(join(reportsDir, 'reports-pl-contract.util.ts'), 'utf8');
    const model = readFileSync(join(reportsDir, 'reports-general-profit-loss-model.util.ts'), 'utf8');

    expect(contract).toContain("GENERAL_PNL_AMOUNT_BASIS = 'gross_including_vat'");
    expect(model).toContain('amountBasis: GeneralPnlAmountBasis');
  });

  it('keeps sales breakdown out of category hierarchy noise', () => {
    const service = readFileSync(join(reportsDir, 'reports.service.ts'), 'utf8');

    expect(service).toContain("groupKey !== 'sales'");
    expect(service).toContain('buildPlCategoryHierarchy(groupKey, flatItems, categories, expenseLines, salesMonths, totalSales)');
  });

  it('keeps VAT disclosure calculation centralized in TaxVatCore', () => {
    const taxVatService = readFileSync(join(reportsDir, 'reports-tax-vat.service.ts'), 'utf8');

    expect(taxVatService).toContain('TaxVatCoreService');
    expect(taxVatService).toContain('computeDisclosureFromInvoiceAggregates');
    expect(taxVatService).not.toContain('standard_sales =');
    expect(taxVatService).not.toContain('standard_purchases =');
  });
});
