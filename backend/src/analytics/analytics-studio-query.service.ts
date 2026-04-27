import { ForbiddenException, Injectable, BadRequestException } from '@nestjs/common';
import { CompanyService } from '../company/company.service';
import { ReportsService } from '../reports/reports.service';
import { isSuperAdmin } from '../auth/constants/permissions';
import { AnalyticsStudioQueryDto } from './dto/analytics-studio-query.dto';
import {
  buildAlerts,
  buildInvoiceFlowKpis,
  mergePeriodAnalyticsBlocks,
  outflowAmount,
  pickSaleAmount,
  purchaseAmount,
  totalInvoiceCount,
  type PeriodAnalyticsBlock,
} from './analytics-studio.mapper';
import type { AnalyticsStudioCompanyRowDto, AnalyticsStudioPayload } from './analytics-studio.types';
import { toYmd } from '../common/utils/to-ymd.util';

type UserLike = { role?: string; companyIds?: string[] };

@Injectable()
export class AnalyticsStudioQueryService {
  constructor(
    private readonly companyService: CompanyService,
    private readonly reportsService: ReportsService,
  ) {}

  async buildStudioPayload(user: UserLike, query: AnalyticsStudioQueryDto): Promise<AnalyticsStudioPayload> {
    const start = this.parseYmd(query.startDate);
    const end = this.parseYmd(query.endDate);
    if (start > end) {
      throw new BadRequestException('startDate يجب أن يسبق endDate');
    }
    const startY = toYmd(start);
    const endY = toYmd(end);

    if (user && !isSuperAdmin(user.role ?? '') && !user.companyIds?.length) {
      return this.emptyPayload(
        startY,
        endY,
        query.companyId && query.companyId.trim() !== '' ? 'single' : 'all',
      );
    }

    const companies = await this.companyService.findAll(
      false,
      user && !isSuperAdmin(user.role ?? '') ? user.companyIds || [] : undefined,
    );
    if (!companies.length) {
      return this.emptyPayload(startY, endY, query.companyId ? 'single' : 'all');
    }

    let targetIds: string[];
    if (query.companyId && query.companyId.trim() !== '') {
      const id = query.companyId.trim();
      if (!companies.some((c) => c.id === id)) {
        throw new ForbiddenException('غير مصرح لك بالوصول لهذه الشركة.');
      }
      targetIds = [id];
    } else {
      targetIds = companies.map((c) => c.id);
    }

    if (targetIds.length === 0) {
      return this.emptyPayload(startY, endY, 'all');
    }

    const blocks: PeriodAnalyticsBlock[] = [];
    const byCompany: AnalyticsStudioCompanyRowDto[] = [];

    for (const cid of targetIds) {
      const raw = (await this.reportsService.getPeriodAnalytics(
        cid,
        startY,
        endY,
      )) as PeriodAnalyticsBlock;
      blocks.push(raw);
      const co = companies.find((c) => c.id === cid);
      const sales = pickSaleAmount(raw);
      const pur = purchaseAmount(raw);
      const out = outflowAmount(raw);
      const net = sales.minus(out);
      byCompany.push({
        companyId: cid,
        nameAr: co?.nameAr ?? '—',
        nameEn: co?.nameEn ?? null,
        totalSales: sales.toFixed(4),
        totalPurchases: pur.toFixed(4),
        totalOutflow: out.toFixed(4),
        totalInvoices: totalInvoiceCount(raw),
        netInvoiceFlow: net.toFixed(4),
      });
    }

    const merged = mergePeriodAnalyticsBlocks(blocks);
    const kpis = buildInvoiceFlowKpis(merged);
    const alerts = buildAlerts(merged, targetIds.length);

    return {
      startDate: startY,
      endDate: endY,
      companyScope: query.companyId && query.companyId.trim() !== '' ? 'single' : 'all',
      companyIdsIncluded: targetIds,
      dataSource: 'reports.getPeriodAnalytics',
      kpis,
      mergedPeriodBlock: merged,
      byCompany,
      alerts,
    };
  }

  private emptyPayload(
    startDate: string,
    endDate: string,
    scope: 'all' | 'single',
  ): AnalyticsStudioPayload {
    const empty: PeriodAnalyticsBlock = {
      startDate,
      endDate,
      totalsByKind: {},
      topSuppliers: [],
      supplierCategoryBreakdown: [],
      suppliersInPeriodCount: 0,
      purchaseCategoryBreakdown: [],
      purchaseCategoryTotal: '0',
    };
    return {
      startDate,
      endDate,
      companyScope: scope,
      companyIdsIncluded: [],
      dataSource: 'reports.getPeriodAnalytics',
      kpis: {
        totalSales: '0',
        totalPurchases: '0',
        totalOutflow: '0',
        totalInvoices: 0,
        netInvoiceFlow: '0',
        sourceKey: 'reports.period_analytics.invoices',
      },
      mergedPeriodBlock: empty,
      byCompany: [],
      alerts: [],
    };
  }

  private parseYmd(s: string): Date {
    const d = new Date(`${s}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) throw new BadRequestException('تاريخ غير صالح');
    return d;
  }
}
