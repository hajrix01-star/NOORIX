import Decimal from 'decimal.js';
import { ChatFinancialMetricsService } from './chat-financial-metrics.service';

type ChatFinancialMetricsDeps = ConstructorParameters<typeof ChatFinancialMetricsService>;

function mockDependency<T extends object>(value: object): T {
  return value as T;
}

describe('ChatFinancialMetricsService', () => {
  it('reads period revenue from active ledger revenue credits', async () => {
    const aggregate = jest.fn().mockResolvedValue({ _sum: { amount: new Decimal(1200) } });
    const service = new ChatFinancialMetricsService(
      mockDependency<ChatFinancialMetricsDeps[0]>({ ledgerEntry: { aggregate } }),
      mockDependency<ChatFinancialMetricsDeps[1]>({ getGeneralProfitLoss: jest.fn() }),
    );
    const start = new Date('2026-07-01T00:00:00.000Z');
    const end = new Date('2026-07-07T23:59:59.999Z');

    await expect(service.sumRevenue('company-1', start, end)).resolves.toEqual(new Decimal(1200));
    expect(aggregate).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        status: 'active',
        transactionDate: { gte: start, lte: end },
        creditAccount: { type: 'revenue' },
      },
      _sum: { amount: true },
    });
  });

  it('uses the central P&L service for annual cards', async () => {
    const getGeneralProfitLoss = jest.fn().mockResolvedValue({
      cards: { sales: '1000', purchases: '300', expenses: '200' },
    });
    const service = new ChatFinancialMetricsService(
      mockDependency<ChatFinancialMetricsDeps[0]>({ ledgerEntry: { aggregate: jest.fn() } }),
      mockDependency<ChatFinancialMetricsDeps[1]>({ getGeneralProfitLoss }),
    );

    await expect(service.annualSales('company-1', 2026)).resolves.toEqual(new Decimal(1000));
    await expect(service.annualPurchases('company-1', 2026)).resolves.toEqual(new Decimal(300));
    await expect(service.annualExpenses('company-1', 2026)).resolves.toEqual(new Decimal(200));
    expect(getGeneralProfitLoss).toHaveBeenCalledTimes(3);
  });
});
