import { Global, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditLogService } from '../audit/audit-log.service';
import { PermissionCacheService } from '../auth/permission-cache.service';
import { FinancialCoreService } from '../financial-core/financial-core.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CompanyInsightThresholdSettingsService } from './insights/company-insight-threshold-settings.service';
import { DashboardInsightsService } from './insights/dashboard-insights.service';
import { ExpenseInsightsService } from './insights/expenses/expense-insights.service';
import { PurchaseSupplierInsightsService } from './insights/purchases/purchase-supplier-insights.service';
import { ReportingInsightsAggregatorService } from './insights/reporting-insights-aggregator.service';
import { ReportingFacade } from './reporting.facade';
import { ReportingModule } from './reporting.module';

const mkAudit = (): Partial<AuditLogService> => ({
  log: jest.fn().mockResolvedValue(undefined),
  logUpdate: jest.fn().mockResolvedValue(undefined),
});

const mkPermCache = (): Partial<PermissionCacheService> => ({
  getPermissions: jest.fn().mockResolvedValue([]),
  invalidate: jest.fn(),
});

const mkFacade = (): Partial<ReportingFacade> => ({
  getDashboardSummary: jest.fn(),
  getProfitLossReport: jest.fn(),
  getVatReport: jest.fn(),
});

const mkThresholdSettings = (): Partial<CompanyInsightThresholdSettingsService> => ({
  getResolvedThresholds: jest.fn().mockResolvedValue({}),
  updateStoredThresholds: jest.fn(),
  resetStoredThresholds: jest.fn(),
});

const emptyDashboard = {
  schemaVersion: 1,
  generatedAt: '',
  context: { companyId: 'c1', year: 2026, selectedMonth: null, labels: {} },
  metrics: { accounting: {}, operational: {} },
  ratios: { purchaseToSales: null, expenseToSales: null, netProfitMargin: null, notes: [] },
  health: { score: null, band: 'unknown' as const, summaryAr: '', summaryEn: '' },
  insights: [],
  opportunities: [],
  warnings: [],
};

const emptyPurchase = {
  schemaVersion: 1,
  generatedAt: '',
  context: {
    companyId: 'c1',
    year: 2026,
    selectedMonth: null,
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    labels: {
      purchaseCategoriesScope: 'invoice_period_purchase_only',
      supplierClassificationScope: 'invoice_period_supplier_counts',
      purchaseCategorySpikeScope: 'accounting_ledger_pl_purchase_categories',
    },
  },
  supplierInsights: [],
  purchaseInsights: [],
  warnings: [],
};

const emptyExpense = {
  schemaVersion: 1,
  generatedAt: '',
  context: {
    companyId: 'c1',
    year: 2026,
    selectedMonth: null,
    labels: {
      expenseBreakdownScope: 'accounting_ledger_pl_month',
      expenseSpikeScope: 'accounting_ledger_pl_expense_totals',
      fixedExpenseScope: 'accounting_ledger_pl_kind_fixed_expense',
    },
  },
  expenseInsights: [],
  warnings: [],
};

@Global()
@Module({
  providers: [{ provide: AuditLogService, useValue: mkAudit() }],
  exports: [AuditLogService],
})
class GlobalTestAuditModule {}

@Global()
@Module({
  providers: [{ provide: PermissionCacheService, useValue: mkPermCache() }],
  exports: [PermissionCacheService],
})
class GlobalTestPermissionModule {}

/** Proves {@link ReportingModule} exports {@link ReportingInsightsAggregatorService} to importers. */
@Injectable()
class AggregatorExportProbe {
  constructor(public readonly aggregator: ReportingInsightsAggregatorService) {}
}

@Module({
  imports: [ReportingModule],
  providers: [AggregatorExportProbe],
})
class AggregatorExportProbeModule {}

function wireReportingTestModule() {
  return Test.createTestingModule({
    imports: [GlobalTestAuditModule, GlobalTestPermissionModule, ReportingModule],
  })
    .overrideProvider(PrismaService)
    .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
    .overrideProvider(TenantPrismaService)
    .useValue({})
    .overrideProvider(FinancialCoreService)
    .useValue({})
    .overrideProvider(ReportingFacade)
    .useValue(mkFacade())
    .overrideProvider(CompanyInsightThresholdSettingsService)
    .useValue(mkThresholdSettings())
    .overrideProvider(DashboardInsightsService)
    .useValue({
      buildDashboardInsights: jest.fn().mockResolvedValue(emptyDashboard),
    })
    .overrideProvider(PurchaseSupplierInsightsService)
    .useValue({
      buildPurchaseSupplierInsights: jest.fn().mockResolvedValue(emptyPurchase),
    })
    .overrideProvider(ExpenseInsightsService)
    .useValue({
      buildExpenseInsights: jest.fn().mockResolvedValue(emptyExpense),
    });
}

describe('ReportingModule', () => {
  it('resolves ReportingInsightsAggregatorService from ReportingModule', async () => {
    const moduleRef = await wireReportingTestModule().compile();
    const agg = moduleRef.get(ReportingInsightsAggregatorService);
    expect(agg).toBeInstanceOf(ReportingInsightsAggregatorService);
  });

  it('exports ReportingInsightsAggregatorService to a module that imports ReportingModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GlobalTestAuditModule, GlobalTestPermissionModule, AggregatorExportProbeModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .overrideProvider(TenantPrismaService)
      .useValue({})
      .overrideProvider(FinancialCoreService)
      .useValue({})
      .overrideProvider(ReportingFacade)
      .useValue(mkFacade())
      .overrideProvider(CompanyInsightThresholdSettingsService)
      .useValue(mkThresholdSettings())
      .overrideProvider(DashboardInsightsService)
      .useValue({
        buildDashboardInsights: jest.fn().mockResolvedValue(emptyDashboard),
      })
      .overrideProvider(PurchaseSupplierInsightsService)
      .useValue({
        buildPurchaseSupplierInsights: jest.fn().mockResolvedValue(emptyPurchase),
      })
      .overrideProvider(ExpenseInsightsService)
      .useValue({
        buildExpenseInsights: jest.fn().mockResolvedValue(emptyExpense),
      })
      .compile();

    const probe = moduleRef.get(AggregatorExportProbe);
    expect(probe.aggregator).toBeInstanceOf(ReportingInsightsAggregatorService);
  });
});
