import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { OrdersInventoryService } from '../orders/orders-inventory.service';
import {
  normalizeUnit,
  productUnitConversionRowsFromUnknown,
  validateProductUnitConversions,
} from '../orders/orders-unit-conversions.util';

type CutoverIssue = {
  severity: 'error' | 'warning';
  code: string;
  entity: string;
  entityId?: string;
  message: string;
};

function decimalSum(values: Array<Prisma.Decimal | string | number | null | undefined>): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((sum, value) => sum.plus(value ?? 0), new Prisma.Decimal(0));
}

function checksum(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function recipeRows(value: unknown): Array<{ materialProductId: string; quantity: string; unit: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const materialProductId = String(row.materialProductId ?? '').trim();
    const quantity = String(row.quantity ?? '').trim();
    const unit = normalizeUnit(row.unit, '');
    return materialProductId && quantity && unit ? [{ materialProductId, quantity, unit }] : [];
  });
}

@Injectable()
export class OrdersV4LegacyCutoverService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly legacyInventory: OrdersInventoryService,
  ) {}

  async audit(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, tenantId: true, nameAr: true, nameEn: true },
    });
    if (!company) throw new NotFoundException('الشركة غير موجودة');

    const [
      categories,
      sections,
      catalogUnits,
      products,
      orderLines,
      staffLines,
      activeOrders,
      cancelledOrders,
      staffIssues,
      staffCancellations,
      projectedStock,
      activePriceLines,
      v4Counts,
      v4Purchase,
      v4Registration,
      v4Custody,
    ] = await Promise.all([
      this.prisma.orderCategory.findMany({ where: { companyId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
      this.prisma.orderSection.findMany({ where: { companyId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
      this.prisma.orderCatalogUnit.findMany({ where: { companyId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
      this.prisma.orderProduct.findMany({
        where: { companyId },
        include: { conversionTemplate: { select: { conversions: true } } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.orderItem.findMany({
        where: { order: { companyId } },
        select: { id: true, productId: true, unit: true, packaging: true, quantityMultiplier: true, inventoryBaseQuantitySnapshot: true },
      }),
      this.prisma.staffOrderItem.findMany({
        where: { staffOrder: { companyId, orderType: 'sale' } },
        select: { id: true, productId: true, unit: true, packaging: true, quantityMultiplier: true },
      }),
      this.prisma.order.findMany({
        where: { companyId, status: 'active' },
        select: { id: true, orderType: true, totalAmount: true, pettyCashAmount: true },
        orderBy: { id: 'asc' },
      }),
      this.prisma.order.count({ where: { companyId, status: 'cancelled' } }),
      this.prisma.staffOrder.findMany({
        where: { companyId, orderType: 'sale', entryType: 'issue' },
        select: { id: true, items: { select: { quantity: true, unitPrice: true } } },
        orderBy: { id: 'asc' },
      }),
      this.prisma.staffOrder.count({ where: { companyId, orderType: 'sale', entryType: 'cancellation' } }),
      this.legacyInventory.getStock(companyId),
      this.prisma.orderItem.findMany({
        where: { order: { companyId, status: 'active' } },
        select: {
          productId: true,
          amount: true,
          quantity: true,
          quantityMultiplier: true,
          inventoryBaseQuantitySnapshot: true,
          order: { select: { id: true, orderDate: true, createdAt: true } },
        },
        orderBy: [{ order: { orderDate: 'desc' } }, { order: { createdAt: 'desc' } }],
      }),
      Promise.all([
        this.prisma.ordersV4Unit.count({ where: { companyId } }),
        this.prisma.ordersV4Category.count({ where: { companyId } }),
        this.prisma.ordersV4Section.count({ where: { companyId } }),
        this.prisma.ordersV4Item.count({ where: { companyId } }),
        this.prisma.ordersV4Document.count({ where: { companyId } }),
        this.prisma.ordersV4InventoryLedgerEntry.count({ where: { companyId } }),
        this.prisma.ordersV4CustodyLedgerEntry.count({ where: { companyId } }),
        this.prisma.ordersV4Stocktake.count({ where: { companyId } }),
      ]),
      this.prisma.ordersV4Document.aggregate({
        where: { companyId, documentType: 'purchase', status: 'received' },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.ordersV4Document.aggregate({
        where: { companyId, documentType: 'registration', status: 'received' },
        _count: { _all: true },
        _sum: { totalAmount: true, operationalCost: true },
      }),
      this.prisma.ordersV4CustodyLedgerEntry.findFirst({
        where: { companyId },
        orderBy: { sequence: 'desc' },
        select: { balanceAfter: true },
      }),
    ]);

    const issues: CutoverIssue[] = [];
    const productIds = new Set(products.map((product) => product.id));
    const orderProductIds = new Set(products.filter((product) => product.productType === 'order').map((product) => product.id));
    const categoryNames = new Map<string, string>();
    for (const category of categories) {
      const key = category.nameAr.trim().toLocaleLowerCase('ar');
      const existingId = categoryNames.get(key);
      if (existingId) issues.push({ severity: 'warning', code: 'merged_duplicate_category', entity: 'OrderCategory', entityId: category.id, message: `سيتم دمج الفئة المكررة مع ${existingId}: ${category.nameAr}` });
      categoryNames.set(key, category.id);
    }

    for (const product of products) {
      if (!product.nameAr.trim()) issues.push({ severity: 'error', code: 'missing_item_name', entity: 'OrderProduct', entityId: product.id, message: 'الصنف بلا اسم عربي' });
      if (!['order', 'sale'].includes(product.productType)) issues.push({ severity: 'error', code: 'unsupported_item_type', entity: 'OrderProduct', entityId: product.id, message: `نوع الصنف غير مدعوم: ${product.productType}` });
      const conversions = [
        ...productUnitConversionRowsFromUnknown(product.inventoryConversions),
        ...productUnitConversionRowsFromUnknown(product.conversionTemplate?.conversions),
      ];
      for (const problem of validateProductUnitConversions(conversions)) {
        issues.push({ severity: 'warning', code: `legacy_conversion_${problem.code}`, entity: 'OrderProduct', entityId: product.id, message: `${product.nameAr}: ${problem.message}` });
      }
      if (product.productType === 'sale') {
        const rows = recipeRows(product.recipe);
        if (!rows.length) {
          issues.push({ severity: 'warning', code: 'sale_item_without_recipe', entity: 'OrderProduct', entityId: product.id, message: `${product.nameAr}: لا توجد رسبي قابلة للترحيل` });
        }
        for (const row of rows) {
          if (!productIds.has(row.materialProductId) || !orderProductIds.has(row.materialProductId)) {
            issues.push({ severity: 'error', code: 'invalid_recipe_component', entity: 'OrderProduct', entityId: product.id, message: `${product.nameAr}: مكوّن الرسبي ${row.materialProductId} غير موجود أو ليس مادة مشتراة` });
          }
          try {
            if (!new Prisma.Decimal(row.quantity).gt(0)) throw new Error();
          } catch {
            issues.push({ severity: 'error', code: 'invalid_recipe_quantity', entity: 'OrderProduct', entityId: product.id, message: `${product.nameAr}: كمية رسبي غير صالحة` });
          }
        }
      }
    }

    for (const line of orderLines) {
      if (!productIds.has(line.productId)) issues.push({ severity: 'error', code: 'orphan_purchase_line', entity: 'OrderItem', entityId: line.id, message: `سطر شراء مرتبط بصنف غير موجود: ${line.productId}` });
      if (!line.inventoryBaseQuantitySnapshot && !line.quantityMultiplier.gt(0)) issues.push({ severity: 'error', code: 'missing_purchase_multiplier', entity: 'OrderItem', entityId: line.id, message: 'سطر شراء بلا كمية أساس أو معامل صالح' });
    }
    for (const line of staffLines) {
      if (!productIds.has(line.productId)) issues.push({ severity: 'error', code: 'orphan_registration_line', entity: 'StaffOrderItem', entityId: line.id, message: `سطر تسجيل مرتبط بصنف غير موجود: ${line.productId}` });
      if (!line.quantityMultiplier.gt(0)) issues.push({ severity: 'error', code: 'missing_registration_multiplier', entity: 'StaffOrderItem', entityId: line.id, message: 'سطر تسجيل بلا معامل كمية صالح' });
    }

    const purchaseTotal = decimalSum(activeOrders.map((row) => row.totalAmount));
    const custodyFunding = decimalSum(activeOrders.filter((row) => row.orderType === 'external').map((row) => row.pettyCashAmount));
    const custodyPurchases = decimalSum(activeOrders.filter((row) => row.orderType === 'external').map((row) => row.totalAmount));
    const registrationTotal = decimalSum(staffIssues.flatMap((row) => row.items.map((item) => item.quantity.mul(item.unitPrice))));
    const priceSamples = new Map<string, Array<{ documentId: string; unitCost: Prisma.Decimal }>>();
    for (const line of activePriceLines) {
      const baseQuantity = line.inventoryBaseQuantitySnapshot ?? line.quantity.times(line.quantityMultiplier);
      if (!baseQuantity.gt(0)) continue;
      const samples = priceSamples.get(line.productId) ?? [];
      if (!samples.some((sample) => sample.documentId === line.order.id) && samples.length < 5) {
        samples.push({ documentId: line.order.id, unitCost: line.amount.div(baseQuantity) });
        priceSamples.set(line.productId, samples);
      }
    }
    const projectedBalances = projectedStock.map((row) => {
      const quantity = new Prisma.Decimal(row.balanceBaseQuantity);
      const samples = priceSamples.get(row.productId) ?? [];
      const unitCost = samples.length
        ? decimalSum(samples.map((sample) => sample.unitCost)).div(samples.length)
        : new Prisma.Decimal(0);
      return { productId: row.productId, quantity, value: quantity.times(unitCost), unitCost };
    });
    const inventoryQuantity = decimalSum(projectedBalances.map((row) => row.quantity));
    const inventoryValue = decimalSum(projectedBalances.map((row) => row.value));
    const blockingIssues = issues.filter((issue) => issue.severity === 'error');
    const sourceFingerprint = checksum({
      categories: categories.map((row) => [row.id, row.updatedAt]),
      sections: sections.map((row) => [row.id, row.updatedAt]),
      products: products.map((row) => [row.id, row.updatedAt]),
      activeOrders: activeOrders.map((row) => [row.id, row.totalAmount.toString()]),
      staffIssues: staffIssues.map((row) => row.id),
    });

    return {
      audit: 'orders-v4-legacy-cutover',
      readOnly: true,
      generatedAt: new Date().toISOString(),
      company: { id: company.id, nameAr: company.nameAr, nameEn: company.nameEn },
      ready: blockingIssues.length === 0,
      sourceFingerprint,
      source: {
        categories: categories.length,
        sections: sections.length,
        catalogUnits: catalogUnits.length,
        purchasedItems: products.filter((row) => row.productType === 'order').length,
        saleItems: products.filter((row) => row.productType === 'sale').length,
        activePurchaseDocuments: activeOrders.length,
        cancelledPurchaseDocuments: cancelledOrders,
        purchaseLines: orderLines.length,
        purchaseTotal: purchaseTotal.toString(),
        registrationDocuments: staffIssues.length,
        registrationCancellations: staffCancellations,
        registrationLines: staffLines.length,
        registrationTotal: registrationTotal.toString(),
        custodyFunding: custodyFunding.toString(),
        custodyPurchases: custodyPurchases.toString(),
        custodyBalance: custodyFunding.minus(custodyPurchases).toString(),
        inventoryBalances: projectedBalances.filter((row) => !row.quantity.isZero() || !row.value.isZero()).length,
        inventoryQuantity: inventoryQuantity.toString(),
        inventoryValue: inventoryValue.toString(),
      },
      target: {
        units: v4Counts[0], categories: v4Counts[1], sections: v4Counts[2], items: v4Counts[3],
        documents: v4Counts[4], inventoryEntries: v4Counts[5], custodyEntries: v4Counts[6], stocktakes: v4Counts[7],
        receivedPurchaseDocuments: v4Purchase._count._all,
        purchaseTotal: (v4Purchase._sum.totalAmount ?? new Prisma.Decimal(0)).toString(),
        registrationDocuments: v4Registration._count._all,
        registrationTotal: (v4Registration._sum.totalAmount ?? new Prisma.Decimal(0)).toString(),
        registrationOperationalCost: (v4Registration._sum.operationalCost ?? new Prisma.Decimal(0)).toString(),
        custodyBalance: (v4Custody?.balanceAfter ?? new Prisma.Decimal(0)).toString(),
      },
      issueCounts: {
        errors: blockingIssues.length,
        warnings: issues.length - blockingIssues.length,
      },
      issues: issues.slice(0, 500),
    };
  }
}
