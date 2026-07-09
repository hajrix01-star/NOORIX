import { BadRequestException } from '@nestjs/common';
import { ReportsTaxVatService } from './reports-tax-vat.service';
import type { TaxVatAggregateRow, TaxVatCoreService, TaxVatReportData } from '../tax-vat-core/tax-vat-core.service';

type ReportsTaxVatPrismaMock = {
  company: {
    findUnique: jest.Mock<Promise<{ vatRatePercent: number | null } | null>, [{ where: { id: string }; select: { vatRatePercent: true } }]>;
  };
  $queryRaw: jest.Mock<Promise<TaxVatAggregateRow[]>, [TemplateStringsArray, ...unknown[]]>;
};
type ReportsTaxVatCoreMock = Pick<TaxVatCoreService, 'computeDisclosureFromInvoiceAggregates'>;

describe('ReportsTaxVatService', () => {
  const vatRows: TaxVatAggregateRow[] = [
    { kind: 'sale', has_tax: true, net_sum: '100', tax_sum: '15' },
  ];

  const coreResult: TaxVatReportData = {
    standard_sales: { amount: 100, adjustment: 0, vat: 15 },
    special_sales: { amount: 0, adjustment: 0, vat: 0 },
    zero_rated_domestic: { amount: 0, adjustment: 0, vat: 0 },
    exports: { amount: 0, adjustment: 0, vat: 0 },
    exempt_sales: { amount: 0, adjustment: 0, vat: 0 },
    standard_purchases: { amount: 0, adjustment: 0, vat: 0 },
    imports_customs: { amount: 0, adjustment: 0, vat: 0 },
    reverse_charge: { amount: 0, adjustment: 0, vat: 0 },
    exempt_purchases: { amount: 0, adjustment: 0, vat: 0 },
  };

  it('delegates VAT disclosure calculation to TaxVatCoreService', async () => {
    const prisma: ReportsTaxVatPrismaMock = {
      company: {
        findUnique: jest.fn().mockResolvedValue({ vatRatePercent: 5 }),
      },
      $queryRaw: jest.fn().mockResolvedValue(vatRows),
    };
    const taxVatCore: ReportsTaxVatCoreMock = {
      computeDisclosureFromInvoiceAggregates: jest.fn().mockReturnValue(coreResult),
    };
    const service = new ReportsTaxVatService(prisma, taxVatCore);

    const result = await service.getTaxVatReport('company-1', 2026, 'M6', true);

    expect(result).toEqual({ success: true, data: coreResult });
    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: 'company-1' },
      select: { vatRatePercent: true },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(taxVatCore.computeDisclosureFromInvoiceAggregates).toHaveBeenCalledWith(vatRows, 5, true);
  });

  it('uses null VAT rate when company settings are missing', async () => {
    const prisma: ReportsTaxVatPrismaMock = {
      company: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $queryRaw: jest.fn().mockResolvedValue(vatRows),
    };
    const taxVatCore: ReportsTaxVatCoreMock = {
      computeDisclosureFromInvoiceAggregates: jest.fn().mockReturnValue(coreResult),
    };
    const service = new ReportsTaxVatService(prisma, taxVatCore);

    await service.getTaxVatReport('company-1', 2026, 'Q2', false);

    expect(taxVatCore.computeDisclosureFromInvoiceAggregates).toHaveBeenCalledWith(vatRows, null, false);
  });

  it('rejects unsupported VAT report periods before querying', async () => {
    const prisma: ReportsTaxVatPrismaMock = {
      company: {
        findUnique: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };
    const taxVatCore: ReportsTaxVatCoreMock = {
      computeDisclosureFromInvoiceAggregates: jest.fn(),
    };
    const service = new ReportsTaxVatService(prisma, taxVatCore);

    await expect(service.getTaxVatReport('company-1', 2026, 'Y2026', false)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.company.findUnique).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(taxVatCore.computeDisclosureFromInvoiceAggregates).not.toHaveBeenCalled();
  });
});
