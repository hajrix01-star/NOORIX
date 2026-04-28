import { ReportingFacade } from './reporting.facade';
import type { ReportsService } from '../reports/reports.service';
import type { SalesService } from '../sales/sales.service';

describe('ReportingFacade (parity)', () => {
  let reportsService: {
    getGeneralProfitLoss: jest.Mock;
    getTaxVatReport: jest.Mock;
    getPeriodAnalytics: jest.Mock;
  };
  let salesService: { findDashboardPack: jest.Mock };
  let facade: ReportingFacade;

  beforeEach(() => {
    reportsService = {
      getGeneralProfitLoss: jest.fn(),
      getTaxVatReport: jest.fn(),
      getPeriodAnalytics: jest.fn(),
    };
    salesService = {
      findDashboardPack: jest.fn(),
    };
    facade = new ReportingFacade(
      reportsService as unknown as ReportsService,
      salesService as unknown as SalesService,
    );
  });

  describe('getProfitLossReport', () => {
    it('delegates to ReportsService.getGeneralProfitLoss with same args and returns the same resolved value', async () => {
      const companyId = 'company-parity-1';
      const year = 2026;
      const resolved = {
        cards: { sales: '100.00', unusual$: true },
        nested: { deep: [{ keep: Symbol.for('parity') }] },
      };
      reportsService.getGeneralProfitLoss.mockResolvedValue(resolved);

      const out = await facade.getProfitLossReport(companyId, year);

      expect(reportsService.getGeneralProfitLoss).toHaveBeenCalledTimes(1);
      expect(reportsService.getGeneralProfitLoss).toHaveBeenCalledWith(companyId, year);
      expect(out).toBe(resolved);
    });
  });

  describe('getVatReport', () => {
    it('delegates to ReportsService.getTaxVatReport with same args and returns the same resolved value', async () => {
      const companyId = 'company-parity-vat';
      const year = 2025;
      const period = 'Q2';
      const salesAmountIncludesVat = true;
      const resolved = {
        success: true,
        data: { standard_sales: { amount: 1, vat: 2, __raw: { nested: [null] } } },
      };
      reportsService.getTaxVatReport.mockResolvedValue(resolved);

      const out = await facade.getVatReport(companyId, year, period, salesAmountIncludesVat);

      expect(reportsService.getTaxVatReport).toHaveBeenCalledTimes(1);
      expect(reportsService.getTaxVatReport).toHaveBeenCalledWith(
        companyId,
        year,
        period,
        salesAmountIncludesVat,
      );
      expect(out).toBe(resolved);
    });

    it('passes default salesAmountIncludesVat false when omitted', async () => {
      reportsService.getTaxVatReport.mockResolvedValue({ ok: true });

      await facade.getVatReport('c', 2024, 'M3');

      expect(reportsService.getTaxVatReport).toHaveBeenCalledWith('c', 2024, 'M3', false);
    });
  });

  describe('getDashboardSummary', () => {
    it('calls underlying services with expected args and returns composed object without transforming nested fields', async () => {
      const sym = Symbol('parity-dashboard');
      const mockedProfitLoss = {
        cards: {},
        [sym]: 'preserved',
        nested: { stripMeNot: { $ref: '#/weird' } },
      };
      const mockedSalesPack = {
        yearSummaries: [{ id: 's1', totalAmount: '500', channels: [{ __keep: 0 }] }],
        meta: Object.freeze({ frozen: true }),
      };
      const mockedPeriodAnalytics = {
        totalsByKind: { sale: { totalAmount: '1', invoiceCount: 2 } },
        topSuppliers: [{ supplierId: 'x', nameAr: 'مورد', totalAmount: '9' }],
      };

      reportsService.getGeneralProfitLoss.mockResolvedValue(mockedProfitLoss);
      salesService.findDashboardPack.mockResolvedValue(mockedSalesPack);
      reportsService.getPeriodAnalytics.mockResolvedValue(mockedPeriodAnalytics);

      const companyId = 'co-dash';
      const dateRange = {
        year: 2024,
        yearStart: '2024-01-01',
        yearEnd: '2024-12-31',
        dailyStart: '2024-03-01' as string | null,
        dailyEnd: '2024-03-31' as string | null,
        monthStart: null,
        monthEnd: null,
        periodStart: '2024-03-01',
        periodEnd: '2024-03-31',
        includeCancelledSales: true,
      };

      const result = await facade.getDashboardSummary(companyId, dateRange);

      expect(reportsService.getGeneralProfitLoss).toHaveBeenCalledWith(companyId, 2024);
      expect(salesService.findDashboardPack).toHaveBeenCalledWith(
        companyId,
        {
          yearStart: '2024-01-01',
          yearEnd: '2024-12-31',
          dailyStart: '2024-03-01',
          dailyEnd: '2024-03-31',
          monthStart: null,
          monthEnd: null,
        },
        true,
      );
      expect(reportsService.getPeriodAnalytics).toHaveBeenCalledWith(
        companyId,
        '2024-03-01',
        '2024-03-31',
      );

      expect(result).toEqual({
        profitLoss: mockedProfitLoss,
        salesPack: mockedSalesPack,
        periodAnalytics: mockedPeriodAnalytics,
      });
      expect(result.profitLoss).toBe(mockedProfitLoss);
      expect(result.salesPack).toBe(mockedSalesPack);
      expect(result.periodAnalytics).toBe(mockedPeriodAnalytics);
      expect(Object.getOwnPropertySymbols(result.profitLoss)).toContain(sym);
    });

    it('defaults includeCancelledSales to false when omitted', async () => {
      reportsService.getGeneralProfitLoss.mockResolvedValue({});
      salesService.findDashboardPack.mockResolvedValue({});
      reportsService.getPeriodAnalytics.mockResolvedValue({});

      await facade.getDashboardSummary('c', {
        year: 2023,
        yearStart: '2023-01-01',
        yearEnd: '2023-12-31',
        periodStart: '2023-01-01',
        periodEnd: '2023-12-31',
      });

      expect(salesService.findDashboardPack).toHaveBeenCalledWith(
        'c',
        {
          yearStart: '2023-01-01',
          yearEnd: '2023-12-31',
          dailyStart: undefined,
          dailyEnd: undefined,
          monthStart: undefined,
          monthEnd: undefined,
        },
        false,
      );
    });
  });
});
