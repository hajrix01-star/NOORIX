import { BadRequestException, Injectable } from '@nestjs/common';
import { resolveVatRateDecimal } from '../common/utils/math-engine';

@Injectable()
export class ReportsTaxVatService {
  constructor(private readonly prisma: TenantPrismaService) {}

  private dec(value: Decimal.Value) {
    return new Decimal(value || 0);
  }

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
    const VAT_STANDARD_RATE = resolveVatRateDecimal(company?.vatRatePercent ?? null);
    const VAT_INCLUSIVE_DIVISOR = new Decimal('1').plus(VAT_STANDARD_RATE);

    type VatAggRow = { kind: string; has_tax: boolean; net_sum: string; tax_sum: string };
    const vatRows = await this.prisma.$queryRaw<VatAggRow[]>`
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

    const standard_sales = { amount: new Decimal(0), vat: new Decimal(0) };
    const exempt_sales = { amount: new Decimal(0), vat: new Decimal(0) };
    const standard_purchases = { amount: new Decimal(0), vat: new Decimal(0) };
    const exempt_purchases = { amount: new Decimal(0), vat: new Decimal(0) };

    for (const row of vatRows) {
      const net = this.dec(row.net_sum);
      const tax = this.dec(row.tax_sum);
      if (row.kind === 'sale') {
        if (row.has_tax) {
          standard_sales.amount = standard_sales.amount.plus(net);
          standard_sales.vat = standard_sales.vat.plus(tax);
        } else if (net.gt(0)) {
          if (salesAmountIncludesVat) {
            const grossInclusive = net;
            const baseExcl = grossInclusive.div(VAT_INCLUSIVE_DIVISOR);
            const vatImputed = grossInclusive.minus(baseExcl);
            standard_sales.amount = standard_sales.amount.plus(baseExcl);
            standard_sales.vat = standard_sales.vat.plus(vatImputed);
          } else {
            const baseExcl = net;
            const vatImputed = baseExcl.mul(VAT_STANDARD_RATE);
            standard_sales.amount = standard_sales.amount.plus(baseExcl);
            standard_sales.vat = standard_sales.vat.plus(vatImputed);
          }
        }
      } else {
        if (row.has_tax) {
          standard_purchases.amount = standard_purchases.amount.plus(net);
          standard_purchases.vat = standard_purchases.vat.plus(tax);
        } else if (net.gt(0)) {
          exempt_purchases.amount = exempt_purchases.amount.plus(net);
        }
      }
    }

    return {
      success: true,
      data: {
        standard_sales: { amount: standard_sales.amount.toNumber(), adjustment: 0, vat: standard_sales.vat.toNumber() },
        special_sales: { amount: 0, adjustment: 0, vat: 0 },
        zero_rated_domestic: { amount: 0, adjustment: 0, vat: 0 },
        exports: { amount: 0, adjustment: 0, vat: 0 },
        exempt_sales: { amount: exempt_sales.amount.toNumber(), adjustment: 0, vat: 0 },
        standard_purchases: { amount: standard_purchases.amount.toNumber(), adjustment: 0, vat: standard_purchases.vat.toNumber() },
        imports_customs: { amount: 0, adjustment: 0, vat: 0 },
        reverse_charge: { amount: 0, adjustment: 0, vat: 0 },
        exempt_purchases: { amount: exempt_purchases.amount.toNumber(), adjustment: 0, vat: 0 },
      },
    };
  }
}
