import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TaxVatCoreService, type TaxVatAggregateRow } from '../tax-vat-core/tax-vat-core.service';

type ReportsTaxVatPrisma = {
  company: {
    findUnique(args: {
      where: { id: string };
      select: { vatRatePercent: true };
    }): Promise<{ vatRatePercent: number | null } | null>;
  };
  $queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<TaxVatAggregateRow[]>;
};
type ReportsTaxVatCore = Pick<TaxVatCoreService, 'computeDisclosureFromInvoiceAggregates'>;

@Injectable()
export class ReportsTaxVatService {
  constructor(
    @Inject(TenantPrismaService)
    private readonly prisma: ReportsTaxVatPrisma,
    @Inject(TaxVatCoreService)
    private readonly taxVatCore: ReportsTaxVatCore,
  ) {}

  /**
   * تقرير الضرائب — تجميع مخرجات ومدخلات ضريبة القيمة المضافة من الفواتير
   */
  async getTaxVatReport(
    companyId: string,
    year: number,
    period: string,
    salesAmountIncludesVat = false,
  ) {
    let startMonth: number;
    let endMonth: number;
    if (period.startsWith('Q')) {
      const q = parseInt(period.slice(1), 10);
      startMonth = (q - 1) * 3;
      endMonth = startMonth + 2;
    } else if (period.startsWith('M')) {
      startMonth = endMonth = parseInt(period.slice(1), 10) - 1;
    } else {
      throw new BadRequestException('Invalid period');
    }
    const startDate = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, endMonth + 1, 0, 23, 59, 59, 999));

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { vatRatePercent: true },
    });
    const vatRows = await this.prisma.$queryRaw`
      SELECT
        kind,
        (tax_amount > 0) AS has_tax,
        SUM(net_amount)::text  AS net_sum,
        SUM(tax_amount)::text  AS tax_sum
      FROM invoices
      WHERE company_id = ${companyId}
        AND status = 'active'
        AND kind = ANY(ARRAY['sale','purchase','expense','fixed_expense']::text[])
        AND transaction_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY kind, has_tax
    `;

    return {
      success: true,
      data: this.taxVatCore.computeDisclosureFromInvoiceAggregates(
        vatRows,
        company?.vatRatePercent ?? null,
        salesAmountIncludesVat,
      ),
    };
  }
}
