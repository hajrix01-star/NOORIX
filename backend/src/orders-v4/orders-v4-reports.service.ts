import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { calculateOrdersV4AverageUnitCost, calculateOrdersV4ConvertedSignedQuantity } from './orders-v4-calculation.kernel';
import { calculateOrdersV4CashAvailable, calculateOrdersV4FundsBalance } from './orders-v4-funds.kernel';
import type { OrdersV4DocumentType, OrdersV4ReportFilters } from './orders-v4.contracts';
import {
  ordersV4EdgeDefinitions,
  ordersV4UnitDefinitions,
  resolveOrdersV4ContextConversion,
} from './orders-v4-conversion.context';
import { ordersV4DateYmd, ordersV4RangeBounds, ordersV4SaudiToday } from './orders-v4-date.util';
import { loadOrdersV4UserIdentities, ordersV4UserIdentity } from './orders-v4-user-identity.util';
import { buildOrdersV4RegistrationCoverage } from './orders-v4-registration-coverage.util';
import { ordersV4NormalizedSearch } from './orders-v4-report-filters.util';

@Injectable()
export class OrdersV4ReportsService {
  constructor(private readonly prisma: TenantPrismaService) {}

  private async reportFacets(companyId: string) {
    const [sections, categories, items, units] = await Promise.all([
      this.prisma.ordersV4Section.findMany({
        where: { companyId },
        orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
        select: { id: true, code: true, nameAr: true, nameEn: true },
      }),
      this.prisma.ordersV4Category.findMany({
        where: { companyId },
        orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
        select: { id: true, nameAr: true, nameEn: true },
      }),
      this.prisma.ordersV4Item.findMany({
        where: { companyId },
        orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
        select: {
          id: true, sku: true, nameAr: true, nameEn: true, itemType: true, categoryId: true,
          sections: { select: { sectionId: true } },
        },
      }),
      this.prisma.ordersV4Unit.findMany({
        where: { companyId },
        orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
        select: { id: true, code: true, nameAr: true, nameEn: true },
      }),
    ]);
    return {
      sections,
      categories,
      items: items.map((item) => ({ ...item, sectionIds: item.sections.map((entry) => entry.sectionId), sections: undefined })),
      units,
    };
  }

  async activityReport(
    companyId: string,
    documentType?: OrdersV4DocumentType,
    startDate?: string,
    endDate?: string,
    filters: OrdersV4ReportFilters = {},
  ) {
    const lineWhere: Prisma.OrdersV4DocumentLineWhereInput = {
      itemId: filters.itemIds?.length ? { in: filters.itemIds } : undefined,
      baseUnitId: filters.baseUnitIds?.length ? { in: filters.baseUnitIds } : undefined,
      inputUnitId: filters.inputUnitIds?.length ? { in: filters.inputUnitIds } : undefined,
      item: filters.categoryIds?.length ? { categoryId: { in: filters.categoryIds } } : undefined,
    };
    const hasLineFilter = Boolean(
      filters.itemIds?.length || filters.categoryIds?.length || filters.baseUnitIds?.length || filters.inputUnitIds?.length,
    );
    const where: Prisma.OrdersV4DocumentWhereInput = {
      companyId,
      documentType: documentType || undefined,
      reversalOfId: null,
      documentDate: ordersV4RangeBounds(startDate, endDate),
      sectionId: filters.sectionIds?.length ? { in: filters.sectionIds } : undefined,
      paymentMethod: filters.paymentMethods?.length ? { in: filters.paymentMethods } : undefined,
      status: filters.statuses?.length ? { in: filters.statuses } : undefined,
      registrationEntryType: filters.registrationEntryTypes?.length ? { in: filters.registrationEntryTypes } : undefined,
      createdByUserId: filters.createdByUserIds?.length ? { in: filters.createdByUserIds } : undefined,
      lines: hasLineFilter ? { some: lineWhere } : undefined,
    };
    const [rawDocuments, facets] = await Promise.all([
      this.prisma.ordersV4Document.findMany({
        where,
        include: {
          section: true,
          location: true,
          lines: {
            where: hasLineFilter ? lineWhere : undefined,
            include: { item: { include: { category: true } }, inputUnit: true, baseUnit: true, priceUnit: true },
            orderBy: { lineNumber: 'asc' },
          },
        },
        orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
      }),
      this.reportFacets(companyId),
    ]);
    const identities = await loadOrdersV4UserIdentities(this.prisma, rawDocuments.map((document) => document.createdByUserId));
    const term = ordersV4NormalizedSearch(filters.search);
    const cancellationReasons = new Set<string>(filters.cancellationReasons ?? []);
    const documents = rawDocuments.flatMap((document) => {
      const identity = ordersV4UserIdentity(identities, document.createdByUserId);
      const documentText = ordersV4NormalizedSearch([
        document.documentNumber,
        document.notes,
        document.section?.nameAr,
        document.section?.nameEn,
        identity?.nameAr,
        identity?.nameEn,
        identity?.username,
      ].filter(Boolean).join(' '));
      const documentMatchesSearch = !term || documentText.includes(term);
      const lines = document.lines.filter((line) => {
        const reasons = Array.isArray(line.cancellationReasons)
          ? line.cancellationReasons.map((reason) => String(reason))
          : [];
        if (cancellationReasons.size && !reasons.some((reason) => cancellationReasons.has(reason))) return false;
        if (!term || documentMatchesSearch) return true;
        return ordersV4NormalizedSearch([
          line.itemNameSnapshot,
          line.item.nameAr,
          line.item.nameEn,
          line.item.sku,
          line.item.category?.nameAr,
          line.item.category?.nameEn,
          line.inputUnit.nameAr,
          line.baseUnit.nameAr,
          line.priceUnit.nameAr,
          reasons.join(' '),
          line.cancellationNote,
        ].filter(Boolean).join(' ')).includes(term);
      });
      if (!lines.length) return [];
      const amount = lines.reduce(
        (total, line) => total.plus(document.documentType === 'registration' ? line.operationalCost : line.lineTotal),
        new Prisma.Decimal(0),
      ).toDecimalPlaces(6);
      return [{
        ...document,
        subtotal: document.documentType === 'purchase' ? amount : document.subtotal,
        totalAmount: document.documentType === 'purchase' ? amount : document.totalAmount,
        operationalCost: amount,
        lines,
        createdByUser: identity,
      }];
    });
    return { documents, facets, kernelVersion: 4 as const };
  }

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
      const kernelQuantity = calculateOrdersV4ConvertedSignedQuantity(
        line.baseQuantity,
        resolveOrdersV4ContextConversion({
          fromUnitId: line.baseUnitId,
          toUnitId: line.item.kernelUnitId,
          units: unitDefinitions,
          edges: ordersV4EdgeDefinitions(currentDefinition?.edges),
        }),
      );
      const baseQuantity = calculateOrdersV4ConvertedSignedQuantity(
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

  async salesReport(
    companyId: string,
    startDate?: string,
    endDate?: string,
    filters: OrdersV4ReportFilters = {},
  ) {
    const [activity, coverageDocuments] = await Promise.all([
      this.activityReport(companyId, 'registration', startDate, endDate, filters),
      this.prisma.ordersV4Document.findMany({
        where: { companyId, documentType: 'registration', registrationEntryType: 'issue', status: 'received' },
        select: { sectionId: true, documentDate: true },
      }),
    ]);
    const documents = activity.documents;
    const activeSections = activity.facets.sections;
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
    const today = ordersV4SaudiToday();
    const coverageStartDate = startDate
      ? ordersV4DateYmd(startDate, 'تاريخ البداية')
      : coverageDocuments.map((row) => row.documentDate.toISOString().slice(0, 10)).sort()[0] || today;
    const coverageEndDate = endDate ? ordersV4DateYmd(endDate, 'تاريخ النهاية') : today;
    const registrationCoverage = buildOrdersV4RegistrationCoverage({
      documents: coverageDocuments,
      sections: activeSections,
      startDate: coverageStartDate,
      endDate: coverageEndDate,
      today,
    });
    const receivedDocuments = documents.filter((document) => document.status === 'received');
    const receivedLines = receivedDocuments.flatMap((document) => document.lines);
    const byItemMap = new Map<string, {
      itemId: string; nameAr: string; categoryName: string; inventoryUnit: string;
      documentIds: Set<string>; baseQuantity: Prisma.Decimal; totalAmount: Prisma.Decimal;
    }>();
    for (const document of receivedDocuments) {
      for (const line of document.lines) {
        const row = byItemMap.get(line.itemId) ?? {
          itemId: line.itemId,
          nameAr: line.itemNameSnapshot,
          categoryName: line.item.category?.nameAr ?? '',
          inventoryUnit: line.baseUnit.nameAr,
          documentIds: new Set<string>(),
          baseQuantity: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal(0),
        };
        row.documentIds.add(document.id);
        row.baseQuantity = row.baseQuantity.plus(line.baseQuantity);
        row.totalAmount = row.totalAmount.plus(line.operationalCost);
        byItemMap.set(line.itemId, row);
      }
    }
    const byItem = [...byItemMap.values()].map((row) => ({
      itemId: row.itemId,
      nameAr: row.nameAr,
      categoryName: row.categoryName,
      inventoryUnit: row.inventoryUnit,
      documentCount: row.documentIds.size,
      baseQuantity: row.baseQuantity.toDecimalPlaces(8),
      totalAmount: row.totalAmount.toDecimalPlaces(6),
      averageUnitCost: calculateOrdersV4AverageUnitCost(row.totalAmount, row.baseQuantity),
    })).sort((a, b) => b.totalAmount.comparedTo(a.totalAmount));
    const registrationDocuments = receivedDocuments.filter((document) => document.registrationEntryType !== 'cancellation');
    const registrationTotal = receivedDocuments.reduce(
      (total, document) => total.plus(document.operationalCost),
      new Prisma.Decimal(0),
    ).toDecimalPlaces(6);
    return {
      summary: { count: registrationDocuments.length, totalAmount: registrationTotal },
      byItem,
      bySection: [...bySection.values()].map((row) => ({ ...row, totalAmount: row.total })),
      documents: documents.map((document) => ({
        ...document,
      })),
      facets: activity.facets,
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

