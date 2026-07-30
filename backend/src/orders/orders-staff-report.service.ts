import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  buildSalesReportPeriodFromDays,
  buildSalesReportPeriodFromYmd,
  staffSaleMatchesReportPeriod,
  type StaffSalesReportPeriod,
} from './orders-staff-sales-report.util';
import { buildStaffSalesReportModel } from './orders-staff-sales-report-builder.util';
import { buildStaffRegistrationCoverage } from './orders-staff-registration-coverage.util';
import { toYmd } from '../common/utils/to-ymd.util';
import { saudiDateYmd } from '../hr/utils/hr-saudi-dates.util';

@Injectable()
export class OrdersStaffReportService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async getSalesReport(
    companyId: string,
    periodInput: number | { startDate: string; endDate: string } = 30,
  ) {
    const period: StaffSalesReportPeriod = typeof periodInput === 'number'
      ? buildSalesReportPeriodFromDays(periodInput)
      : buildSalesReportPeriodFromYmd(periodInput.startDate, periodInput.endDate);
    const tenantId = TenantContext.tryGetTenantId();
    const where: Prisma.StaffOrderWhereInput = { companyId, orderType: 'sale' };
    if (tenantId) where.tenantId = tenantId;

    const allSaleOrders = await this.prisma.staffOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        logRef: true,
        userId: true,
        sectionName: true,
        saleDate: true,
        createdAt: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            unit: true,
            size: true,
            packaging: true,
            unitPrice: true,
          },
        },
      },
    });
    const orders = allSaleOrders.filter((order) => staffSaleMatchesReportPeriod(order, period));
    const [users, products, sections] = await Promise.all([
      this.loadReportUsers(orders.map((order) => order.userId), tenantId),
      this.loadReportProducts(companyId, orders.flatMap((order) => order.items.map((item) => item.productId)), tenantId),
      this.prisma.orderSection.findMany({
        where: { companyId, ...(tenantId ? { tenantId } : {}) },
        orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
        select: { nameAr: true },
      }),
    ]);

    return {
      ...buildStaffSalesReportModel({ orders, users, products }),
      registrationCoverage: buildStaffRegistrationCoverage({
        orders: allSaleOrders,
        sectionNames: sections.map((section) => section.nameAr),
        startDate: toYmd(period.start),
        endDate: toYmd(period.end),
        today: saudiDateYmd(),
      }),
    };
  }

  private async loadReportUsers(userIdsInput: string[], tenantId: string | null) {
    const userIds = [...new Set(userIdsInput)];
    return userIds.length
      ? this.prisma.user.findMany({
          where: { ...(tenantId ? { tenantId } : {}), id: { in: userIds } },
          select: { id: true, nameAr: true, nameEn: true },
        })
      : [];
  }

  private async loadReportProducts(companyId: string, productIdsInput: string[], tenantId: string | null) {
    const productIds = [...new Set(productIdsInput.filter(Boolean))];
    return productIds.length
      ? this.prisma.orderProduct.findMany({
          where: { companyId, ...(tenantId ? { tenantId } : {}), id: { in: productIds } },
          select: { id: true, nameAr: true, nameEn: true, unit: true, lastPrice: true, variants: true },
        })
      : [];
  }
}
