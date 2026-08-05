import { Inject, Injectable } from '@nestjs/common';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { isSuperAdmin } from '../auth/constants/permissions';
import { toYmd } from '../common/utils/to-ymd.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ReportsService } from '../reports/reports.service';
import type { GeneralProfitLossModel } from '../reports/reports-general-profit-loss-model.util';
import { SalesService } from '../sales/sales.service';
import {
  buildOwnerOverviewModel,
  normalizeOwnerDailySalesItems,
  type OwnerOverviewCompany,
  type OwnerOverviewDailySalesItem,
} from './owner-overview-model.util';
import type { OwnerOverviewQueryDto } from './dto/owner-overview-query.dto';

type OwnerPrismaReader = {
  company: {
    findMany(args: {
      where: { id: { in: string[] }; isArchived: false };
      select: { id: true; nameAr: true; nameEn: true; sortOrder: true };
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }];
    }): Promise<OwnerOverviewCompany[]>;
  };
};

type OwnerReportsReader = {
  getGeneralProfitLoss(companyId: string, year: number): Promise<GeneralProfitLossModel>;
};

type OwnerSalesReader = {
  findDashboardPack(
    companyId: string,
    range: { yearStart: string; yearEnd: string; dailyStart: string; dailyEnd: string },
    includeArchived: boolean,
  ): Promise<{ dailySummaries: unknown[] }>;
};

function monthBounds(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0);
  const end = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;
  return { start: toYmd(start), end: toYmd(end) };
}

@Injectable()
export class OwnerService {
  constructor(
    @Inject(TenantPrismaService) private readonly prisma: OwnerPrismaReader,
    @Inject(ReportsService) private readonly reportsService: OwnerReportsReader,
    @Inject(SalesService) private readonly salesService: OwnerSalesReader,
  ) {}

  /**
   * يُنفّذ P&L ومبيعات يومية لكل الشركات بالتوازي — بدلاً من N×2 طلبات منفصلة.
   * الأرقام تصل مرةً واحدةً فقط، تحلّ مشكلة "تغيّر الأرقام" في لوحة المالك.
   */
  async getOverview(query: OwnerOverviewQueryDto, user: JwtUser) {
    const { year, month } = query;

    const companyIds = this.resolveAccessibleIds(query.companyIds, user);
    if (companyIds.length === 0) {
      return buildOwnerOverviewModel({ year, month: month ?? null, companies: [] });
    }

    const yearStart = `${year}-01-01`;
    const yearEnd   = `${year}-12-31`;
    const bounds    = month ? monthBounds(year, month) : null;
    const companies = await this.prisma.company.findMany({
      where: { id: { in: companyIds }, isArchived: false },
      select: { id: true, nameAr: true, nameEn: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    });
    const activeCompanyIds = companies.map((company) => company.id);
    const companyById = new Map(companies.map((company) => [company.id, company]));

    const [plResults, dailyResults] = await Promise.all([
      // P&L لكل شركة بالتوازي
      Promise.all(
        activeCompanyIds.map((companyId) =>
          this.reportsService
            .getGeneralProfitLoss(companyId, year)
            .then((data) => ({ companyId, data })),
        ),
      ),
      // مبيعات يومية بالتوازي (بدون pagination — استعلام مباشر بدل N صفحات متسلسلة)
      bounds
        ? Promise.all(
            activeCompanyIds.map((companyId) =>
              this.salesService
                .findDashboardPack(
                  companyId,
                  {
                    yearStart,
                    yearEnd,
                    dailyStart: bounds.start,
                    dailyEnd:   bounds.end,
                  },
                  false,
                )
                .then((pack) => ({ companyId, items: normalizeOwnerDailySalesItems(pack.dailySummaries) })),
            ),
          )
        : Promise.resolve([] as { companyId: string; items: unknown[] }[]),
    ]);

    const dailyByCompany = new Map<string, OwnerOverviewDailySalesItem[]>(
      dailyResults.map((entry) => [entry.companyId, normalizeOwnerDailySalesItems(entry.items)]),
    );
    return buildOwnerOverviewModel({
      year,
      month: month ?? null,
      companies: plResults.flatMap((entry) => {
        const company = companyById.get(entry.companyId);
        if (!company) return [];
        return [{
          company,
          report: entry.data,
          dailySales: dailyByCompany.get(entry.companyId) ?? [],
        }];
      }),
    });
  }

  /**
   * يُصفّي قائمة الشركات المطلوبة على شركات يملك المستخدم صلاحية الوصول إليها.
   * — owner / super_admin: يملكون الوصول لكل شركات الـ tenant (فلا تصفية).
   * — بقية الأدوار: تصفية على user.companyIds.
   */
  private resolveAccessibleIds(requested: string[], user: JwtUser): string[] {
    const role = (user.role || '').toLowerCase();
    if (isSuperAdmin(role)) return requested;
    const allowed = new Set<string>(user.companyIds || []);
    return requested.filter((id) => allowed.has(id));
  }
}
