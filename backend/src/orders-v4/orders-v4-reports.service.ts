import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { calculateOrdersV4AverageUnitCost, calculateOrdersV4ConvertedQuantity } from './orders-v4-calculation.kernel';
import { calculateOrdersV4CashAvailable, calculateOrdersV4FundsBalance } from './orders-v4-funds.kernel';
import type { OrdersV4DocumentType } from './orders-v4.contracts';
import {
  ordersV4EdgeDefinitions,
  ordersV4UnitDefinitions,
  resolveOrdersV4ContextConversion,
} from './orders-v4-conversion.context';
import { ordersV4RangeBounds, ordersV4SaudiToday } from './orders-v4-date.util';
import { loadOrdersV4UserIdentities, ordersV4UserIdentity } from './orders-v4-user-identity.util';
import { buildOrdersV4RegistrationCoverage } from './orders-v4-registration-coverage.util';

@Injectable()
export class OrdersV4ReportsService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async summary(companyId: string, startDate?: string, endDate?: string) {
    const bounds = ordersV4RangeBounds(startDate, endDate);
    const cashStart = bounds.gte ?? new Date('1970-01-01T00:00:00.000Z');
    const cashEnd = bounds.lte ? new Date(bounds.lte.getTime() + 86_399_999) : new Date('2999-12-31T23:59:59.999Z');
    const effectiveBounds = { gte: cashStart, lte: cashEnd };
    const [documents, cashSales, custodyEntries] = await Promise.all([
      this.prisma.ordersV4Document.findMany({
        where: { companyId, status: 'received', documentDate: bounds },
        select: { documentType: true, registrationEntryType: true, paymentMethod: true, totalAmount: true, operationalCost: true },
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
        where: { companyId, effectiveAt: effectiveBounds },
        select: { entryType: true, amountDelta: true, reversalOf: { select: { entryType: true } } },
      }),
    ]);
    const zero = new Prisma.Decimal(0);
    const sumFinancial = (rows: typeof documents) => rows.reduce((total, row) => total.plus(row.totalAmount), zero).toDecimalPlaces(6);
    const sumOperationalCost = (rows: typeof documents) => rows.reduce((total, row) => total.plus(row.operationalCost), zero).toDecimalPlaces(6);
    const purchases = documents.filter((row) => row.documentType === 'purchase');
    const registrations = documents.filter((row) => row.documentType === 'registration' && row.registrationEntryType !== 'cancellation');
    const cancellations = documents.filter((row) => row.documentType === 'registration' && row.registrationEntryType === 'cancellation');
    const registrationMovements = documents.filter((row) => row.documentType === 'registration');
    const cashUsed = sumFinancial(purchases.filter((row) => row.paymentMethod === 'cash'));
    const cashSalesImported = new Prisma.Decimal(cashSales[0]?.total ?? 0).toDecimalPlaces(6);
    const custodyFundingDelta = custodyEntries
      .filter((row) => row.entryType === 'funding' || (row.entryType === 'reversal' && row.reversalOf?.entryType === 'funding'))
      .reduce((total, row) => total.plus(row.amountDelta), zero)
      .toDecimalPlaces(6);
    const custodyPurchaseDelta = custodyEntries
      .filter((row) => row.entryType === 'purchase' || (row.entryType === 'reversal' && row.reversalOf?.entryType === 'purchase'))
      .reduce((total, row) => total.plus(row.amountDelta), zero)
      .toDecimalPlaces(6);
    const custodyFunded = custodyFundingDelta.lt(0) ? zero : custodyFundingDelta;
    const custodySpent = custodyPurchaseDelta.gt(0) ? zero : custodyPurchaseDelta.negated().toDecimalPlaces(6);
    const custodyBalance = calculateOrdersV4FundsBalance(custodyEntries.map((row) => row.amountDelta));
    return {
      purchaseCount: purchases.length,
      registrationCount: registrations.length,
      cancellationCount: cancellations.length,
      purchaseTotal: sumFinancial(purchases),
      registrationTotal: sumOperationalCost(registrationMovements),
      cancellationTotal: sumOperationalCost(cancellations),
      custodyTotal: sumFinancial(purchases.filter((row) => row.paymentMethod === 'custody')),
      cashTotal: sumFinancial(purchases.filter((row) => row.paymentMethod === 'cash')),
      transferTotal: sumFinancial(purchases.filter((row) => row.paymentMethod === 'transfer')),
      cashSalesImported,
      cashUsed,
      cashAvailable: calculateOrdersV4CashAvailable(cashSalesImported, cashUsed),
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
      this.prisma.ordersV4Unit.findMany({ where: { companyId } }),
    ]);
    const unitDefinitions = ordersV4UnitDefinitions(units);
    const byItem = new Map<string, {
      itemId: string; nameAr: string; categoryName: string; inventoryUnit: string;
      documentCount: Set<string>; baseQuantity: Prisma.Decimal; totalAmount: Prisma.Decimal;
    }>();
    for (const line of lines) {
      const currentDefinition = line.item.conversionVersions[0];
      const kernelQuantity = calculateOrdersV4ConvertedQuantity(
        line.baseQuantity,
        resolveOrdersV4ContextConversion({
          fromUnitId: line.baseUnitId,
          toUnitId: line.item.kernelUnitId,
          units: unitDefinitions,
          edges: ordersV4EdgeDefinitions(currentDefinition?.edges),
        }),
      );
      const baseQuantity = calculateOrdersV4ConvertedQuantity(
        kernelQuantity,
        resolveOrdersV4ContextConversion({
          fromUnitId: line.item.kernelUnitId,
          toUnitId: line.item.inventoryUnitId,
          units: unitDefinitions,
          edges: ordersV4EdgeDefinitions(currentDefinition?.edges),
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
      current.totalAmount = current.totalAmount.plus(line.operationalCost);
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
    const [summary, byItem, documents, coverageDocuments, activeSections] = await Promise.all([
      this.summary(companyId, startDate, endDate),
      this.itemsReport(companyId, 'registration', startDate, endDate),
      this.prisma.ordersV4Document.findMany({
        where: { companyId, documentType: 'registration', documentDate: bounds },
        include: { section: true, location: true, lines: { include: { item: { include: { category: true } }, inputUnit: true, baseUnit: true, priceUnit: true }, orderBy: { lineNumber: 'asc' } } },
        orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.ordersV4Document.findMany({
        where: { companyId, documentType: 'registration', registrationEntryType: 'issue', status: 'received' },
        select: { sectionId: true, documentDate: true },
      }),
      this.prisma.ordersV4Section.findMany({
        where: { companyId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
        select: { id: true, nameAr: true },
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
      current.total = current.total.plus(document.operationalCost);
      bySection.set(key, current);
    }
    const identities = await loadOrdersV4UserIdentities(this.prisma, documents.map((document) => document.createdByUserId));
    const today = ordersV4SaudiToday();
    const registrationCoverage = buildOrdersV4RegistrationCoverage({
      documents: coverageDocuments,
      sections: activeSections,
      startDate: startDate || coverageDocuments.map((row) => row.documentDate.toISOString().slice(0, 10)).sort()[0] || today,
      endDate: endDate || today,
      today,
    });
    const receivedDocuments = documents.filter((document) => document.status === 'received');
    const receivedLines = receivedDocuments.flatMap((document) => document.lines);
    return {
      summary: { count: summary.registrationCount, totalAmount: summary.registrationTotal },
      byItem,
      bySection: [...bySection.values()].map((row) => ({ ...row, totalAmount: row.total })),
      documents: documents.map((document) => ({
        ...document,
        createdByUser: ordersV4UserIdentity(identities, document.createdByUserId),
      })),
      registrationCoverage,
      costCoverage: {
        documents: receivedDocuments.length,
        zeroCostDocuments: receivedDocuments.filter((document) => document.operationalCost.isZero()).length,
        lines: receivedLines.length,
        zeroCostLines: receivedLines.filter((line) => line.operationalCost.isZero()).length,
      },
      kernelVersion: 4,
    };
  }
}

