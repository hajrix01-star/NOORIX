import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ReportsService } from '../reports/reports.service';

@Injectable()
export class ChatFinancialMetricsService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly reportsService: ReportsService,
  ) {}

  async sumRevenue(companyId: string, start: Date, end: Date): Promise<Decimal> {
    const agg = await this.prisma.ledgerEntry.aggregate({
      where: {
        companyId,
        status: 'active',
        transactionDate: { gte: start, lte: end },
        creditAccount: { type: 'revenue' },
      },
      _sum: { amount: true },
    });
    return new Decimal(agg._sum.amount ?? 0);
  }

  async sumPurchases(companyId: string, start: Date, end: Date): Promise<Decimal> {
    const agg = await this.prisma.ledgerEntry.aggregate({
      where: {
        companyId,
        status: 'active',
        transactionDate: { gte: start, lte: end },
        debitAccount: { code: { startsWith: 'PUR' } },
      },
      _sum: { amount: true },
    });
    return new Decimal(agg._sum.amount ?? 0);
  }

  async sumOperatingExpenses(companyId: string, start: Date, end: Date): Promise<Decimal> {
    const agg = await this.prisma.ledgerEntry.aggregate({
      where: {
        companyId,
        status: 'active',
        transactionDate: { gte: start, lte: end },
        debitAccount: { type: 'expense', code: { not: { startsWith: 'PUR' } } },
      },
      _sum: { amount: true },
    });
    return new Decimal(agg._sum.amount ?? 0);
  }

  async annualSales(companyId: string, year: number): Promise<Decimal> {
    const report = await this.reportsService.getGeneralProfitLoss(companyId, year);
    return new Decimal(report?.cards?.sales ?? 0);
  }

  async annualPurchases(companyId: string, year: number): Promise<Decimal> {
    const report = await this.reportsService.getGeneralProfitLoss(companyId, year);
    return new Decimal(report?.cards?.purchases ?? 0);
  }

  async annualExpenses(companyId: string, year: number): Promise<Decimal> {
    const report = await this.reportsService.getGeneralProfitLoss(companyId, year);
    return new Decimal(report?.cards?.expenses ?? 0);
  }
}
