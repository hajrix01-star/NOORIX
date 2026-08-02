import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { calculateOrdersV4AverageUnitCost, calculateOrdersV4ConvertedQuantity } from './orders-v4-calculation.kernel';
import type { OrdersV4DocumentType } from './orders-v4.contracts';
import { resolveOrdersV4Conversion } from './orders-v4-conversion.kernel';
import { ordersV4RangeBounds } from './orders-v4-date.util';

@Injectable()
export class OrdersV4ReportsService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async summary(companyId: string, startDate?: string, endDate?: string) {
    const bounds = ordersV4RangeBounds(startDate, endDate);
    const cashStart = bounds.gte ?? new Date('1970-01-01T00:00:00.000Z');
    const cashEnd = bounds.lte ? new Date(bounds.lte.getTime() + 86_399_999) : new Date('2999-12-31T23:59:59.999Z');
    const [documents, cashSales, custodyEntries] = await Promise.all([
      this.prisma.ordersV4Document.findMany({
        where: { companyId, status: 'received', documentDate: bounds },
        select: { documentType: true, paymentMethod: true, totalAmount: true },
      }),
      this.prisma.$queryRaw<Array<{ total: Prisma.Decimal | null }>>(Prisma.sql`
        SELECT COALESCE(SUM(channel.amount), 0) AS total
        FROM daily_sales_summaries AS summary
        INNER JOIN daily_sales_channels AS channel ON channel.summary_id = summary.id
        INNER JOIN vaults AS vault ON vault.id = channel.vault_id
        WHERE summary.company_id = ${companyId}
          AND summary.status = 'active'
          AND summary.transaction_date >= ${cashStart}
          AND summary.transaction_date <= ${cashEnd}
          AND vault.type = 'cash'
      `),
      this.prisma.ordersV4CustodyLedgerEntry.findMany({
        where: { companyId, effectiveAt: bounds },
        select: { entryType: true, amountDelta: true },
      }),
    ]);
    const zero = new Prisma.Decimal(0);
    const sum = (rows: typeof documents) => rows.reduce((total, row) => total.plus(row.totalAmount), zero).toDecimalPlaces(6);
    const purchases = documents.filter((row) => row.documentType === 'purchase');
    const registrations = documents.filter((row) => row.documentType === 'registration');
    const cashUsed = sum(purchases.filter((row) => row.paymentMethod === 'cash'));
    const cashSalesImported = new Prisma.Decimal(cashSales[0]?.total ?? 0).toDecimalPlaces(6);
    const custodyFunded = custodyEntries.filter((row) => row.entryType === 'funding').reduce((total, row) => total.plus(row.amountDelta), zero).toDecimalPlaces(6);
    const custodySpent = custodyEntries.filter((row) => row.entryType === 'purchase').reduce((total, row) => total.plus(row.amountDelta.abs()), zero).toDecimalPlaces(6);
    const custodyBalance = custodyEntries.reduce((total, row) => total.plus(row.amountDelta), zero).toDecimalPlaces(6);
    return {
      purchaseCount: purchases.length,
      registrationCount: registrations.length,
      purchaseTotal: sum(purchases),
      registrationTotal: sum(registrations),
      custodyTotal: sum(purchases.filter((row) => row.paymentMethod === 'custody')),
      cashTotal: sum(purchases.filter((row) => row.paymentMethod === 'cash')),
      transferTotal: sum(purchases.filter((row) => row.paymentMethod === 'transfer')),
      cashSalesImported,
      cashUsed,
      cashAvailable: cashSalesImported.minus(cashUsed).toDecimalPlaces(6),
      custodyFunded,
      custodySpent,
      custodyBalance,
      kernelVersion: 4,
    };
  }

  async itemsReport(companyId: string, documentType?: OrdersV4DocumentType, startDate?: string, endDate?: string) {
    const [lines, units] = await Promise.all([
      this.prisma.ordersV4DocumentLine.findMany({
        where: {
          companyId,
          document: { status: 'received', documentType: documentType || undefined, documentDate: ordersV4RangeBounds(startDate, endDate) },
        },
        include: {
          item: {
            include: {
              category: true,
              inventoryUnit: true,
              conversionVersions: {
                where: { status: 'published' },
                orderBy: { version: 'desc' },
                take: 1,
                include: { edges: true },
              },
            },
          },
        },
      }),
      this.prisma.ordersV4Unit.findMany({ where: { companyId, isActive: true } }),
    ]);
    const unitDefinitions = units.map((unit) => ({
      id: unit.id,
      code: unit.code,
      dimension: unit.dimension,
      canonicalFactor: unit.canonicalFactor,
    }));
    const byItem = new Map<string, {
      itemId: string; nameAr: string; categoryName: string; inventoryUnit: string;
      documentCount: Set<string>; baseQuantity: Prisma.Decimal; totalAmount: Prisma.Decimal;
    }>();
    for (const line of lines) {
      const currentDefinition = line.item.conversionVersions[0];
      const baseQuantity = calculateOrdersV4ConvertedQuantity(
        line.baseQuantity,
        resolveOrdersV4Conversion({
          fromUnitId: line.baseUnitId,
          toUnitId: line.item.inventoryUnitId,
          units: unitDefinitions,
          edges: currentDefinition?.edges.map((edge) => ({
            ...edge,
            allowDimensionBridge: edge.allowDimensionBridge,
          })) ?? [],
        }),
      );
      const current = byItem.get(line.itemId) ?? {
        itemId: line.itemId,
        nameAr: line.item.nameAr,
        categoryName: line.item.category?.nameAr ?? '',
        inventoryUnit: line.item.inventoryUnit.nameAr,
        documentCount: new Set<string>(),
        baseQuantity: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(0),
      };
      current.documentCount.add(line.documentId);
      current.baseQuantity = current.baseQuantity.plus(baseQuantity);
      current.totalAmount = current.totalAmount.plus(line.lineTotal);
      byItem.set(line.itemId, current);
    }
    return [...byItem.values()].map((row) => ({
      itemId: row.itemId,
      nameAr: row.nameAr,
      categoryName: row.categoryName,
      inventoryUnit: row.inventoryUnit,
      documentCount: row.documentCount.size,
      baseQuantity: row.baseQuantity.toDecimalPlaces(8),
      totalAmount: row.totalAmount.toDecimalPlaces(6),
      averageUnitCost: calculateOrdersV4AverageUnitCost(row.totalAmount, row.baseQuantity),
    })).sort((a, b) => b.totalAmount.comparedTo(a.totalAmount));
  }

  async salesReport(companyId: string, startDate?: string, endDate?: string) {
    const bounds = ordersV4RangeBounds(startDate, endDate);
    const [summary, byItem, documents] = await Promise.all([
      this.summary(companyId, startDate, endDate),
      this.itemsReport(companyId, 'registration', startDate, endDate),
      this.prisma.ordersV4Document.findMany({
        where: { companyId, documentType: 'registration', documentDate: bounds },
        include: { section: true, location: true, lines: { include: { item: true, inputUnit: true, baseUnit: true, priceUnit: true }, orderBy: { lineNumber: 'asc' } } },
        orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);
    const bySection = new Map<string, { sectionId: string; sectionName: string; count: number; total: Prisma.Decimal }>();
    for (const document of documents.filter((row) => row.status === 'received')) {
      const key = document.sectionId || 'unassigned';
      const current = bySection.get(key) ?? {
        sectionId: key,
        sectionName: document.section?.nameAr ?? 'غير محدد',
        count: 0,
        total: new Prisma.Decimal(0),
      };
      current.count += 1;
      current.total = current.total.plus(document.totalAmount);
      bySection.set(key, current);
    }
    return {
      summary: { count: summary.registrationCount, totalAmount: summary.registrationTotal },
      byItem,
      bySection: [...bySection.values()].map((row) => ({ ...row, totalAmount: row.total })),
      documents,
      kernelVersion: 4,
    };
  }
}

