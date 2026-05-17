import { Injectable } from '@nestjs/common';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { isSuperAdmin } from '../auth/constants/permissions';
import { toYmd } from '../common/utils/to-ymd.util';
import { ReportsService } from '../reports/reports.service';
import { SalesService } from '../sales/sales.service';
import type { OwnerOverviewQueryDto } from './dto/owner-overview-query.dto';

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
    private readonly reportsService: ReportsService,
    private readonly salesService: SalesService,
  ) {}

  /**
   * يُنفّذ P&L ومبيعات يومية لكل الشركات بالتوازي — بدلاً من N×2 طلبات منفصلة.
   * الأرقام تصل مرةً واحدةً فقط، تحلّ مشكلة "تغيّر الأرقام" في لوحة المالك.
   */
  async getOverview(query: OwnerOverviewQueryDto, user: JwtUser) {
    const { year, month } = query;

    const companyIds = this.resolveAccessibleIds(query.companyIds, user);
    if (companyIds.length === 0) {
      return { reportsByCompany: {}, dailySalesByCompany: {} };
    }

    const yearStart = `${year}-01-01`;
    const yearEnd   = `${year}-12-31`;
    const bounds    = month ? monthBounds(year, month) : null;

    const [plResults, dailyResults] = await Promise.all([
      // P&L لكل شركة بالتوازي
      Promise.all(
        companyIds.map((companyId) =>
          this.reportsService
            .getGeneralProfitLoss(companyId, year)
            .then((data) => ({ companyId, data })),
        ),
      ),
      // مبيعات يومية بالتوازي (بدون pagination — استعلام مباشر بدل N صفحات متسلسلة)
      bounds
        ? Promise.all(
            companyIds.map((companyId) =>
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
                .then((pack) => ({ companyId, items: pack.dailySummaries })),
            ),
          )
        : Promise.resolve([] as { companyId: string; items: unknown[] }[]),
    ]);

    const reportsByCompany: Record<string, unknown> = {};
    for (const r of plResults) reportsByCompany[r.companyId] = r.data;

    const dailySalesByCompany: Record<string, unknown[]> = {};
    for (const d of dailyResults) dailySalesByCompany[d.companyId] = d.items;

    return { reportsByCompany, dailySalesByCompany };
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
