import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';
import { utcBoundsForGregorianMonth } from './orders-month-range.util';
import { mapDtoItemsToOrderLines, orderLinesToLastPriceInputs } from './orders-lines.util';
import { orderGregorianDateToNumberPrefix, buildOrderNumberFromPrefix } from './orders-order-number.util';
import { aggregateOrdersMonthSummary, aggregateOrdersRangeSummaryGroups } from './orders-month-summary.util';
import {
  aggregateOrderItemsByProductForReport,
  aggregateOrderItemsForRangeReport,
} from './orders-items-report-aggregate.util';
import { OrdersCatalogService } from './orders-catalog.service';
import { resolveQuantityMultiplier } from './orders-quantity-multiplier.util';

type OrderItemInput = { productId: string; size?: string | null; packaging?: string | null; unit?: string | null; unitPrice: Prisma.Decimal };
type OrderPaymentMethod = 'external' | 'internal' | 'transfer';
type OrderPaymentPatch = { orderType?: OrderPaymentMethod; pettyCashAmount?: string };

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly catalog: OrdersCatalogService,
  ) {}

  private async withQuantityMultipliers<T extends {
    productId: string;
    quantity: Prisma.Decimal;
    size?: string | null;
    packaging?: string | null;
    unit?: string | null;
  }>(companyId: string, items: T[]) {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await this.prisma.orderProduct.findMany({
      where: { companyId, id: { in: productIds } },
      select: {
        id: true,
        unit: true,
        variants: true,
        inventoryConversions: true,
        conversionTemplate: { select: { conversions: true } },
      },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));
    const missing = productIds.filter((productId) => !productMap.has(productId));
    if (missing.length > 0) throw new BadRequestException('صنف غير موجود أو لا ينتمي لهذه الشركة');
    return items.map((item) => {
      const quantityMultiplier = resolveQuantityMultiplier(productMap.get(item.productId), item);
      return {
        ...item,
        quantityMultiplier,
        inventoryBaseQuantitySnapshot: item.quantity.times(quantityMultiplier).toDecimalPlaces(6),
      };
    });
  }

  private paymentPatch(
    dto: OrderPaymentPatch,
    currentOrderType?: string | null,
  ): { orderType?: OrderPaymentMethod; pettyCashAmount?: Prisma.Decimal | null } {
    const patch: { orderType?: OrderPaymentMethod; pettyCashAmount?: Prisma.Decimal | null } = {};
    const effectiveOrderType = dto.orderType ?? currentOrderType;
    if (dto.orderType) {
      patch.orderType = dto.orderType;
      if (dto.orderType !== 'external') patch.pettyCashAmount = null;
    }
    if (effectiveOrderType === 'external' && dto.pettyCashAmount !== undefined) {
      patch.pettyCashAmount = dto.pettyCashAmount ? new Prisma.Decimal(dto.pettyCashAmount) : null;
    } else if (dto.pettyCashAmount !== undefined) {
      patch.pettyCashAmount = null;
    }
    return patch;
  }

  async updateProductLastPrices(items: OrderItemInput[]) {
    for (const it of items) {
      const product = await this.prisma.orderProduct.findUnique({ where: { id: it.productId }, select: { variants: true } });
      if (!product) continue;
      const variants = product.variants as Array<{ size?: string; packaging?: string; unit?: string; lastPrice?: string }> | null;
      if (variants && Array.isArray(variants) && variants.length > 0) {
        const size = it.size || '';
        const packaging = it.packaging || '';
        const unit = it.unit || '';
        const idx = variants.findIndex((v) => (v.size || '') === size && (v.packaging || '') === packaging && (v.unit || '') === unit);
        if (idx >= 0) {
          variants[idx] = { ...variants[idx], lastPrice: String(it.unitPrice) };
          await this.prisma.orderProduct.update({
            where: { id: it.productId },
            data: { variants: variants as object },
          });
        }
      } else {
        await this.prisma.orderProduct.update({
          where: { id: it.productId },
          data: { lastPrice: it.unitPrice },
        });
      }
    }
  }

  async findAll(companyId: string, year: number, month: number) {
    const { start, end } = utcBoundsForGregorianMonth(year, month);
    const orders = await this.prisma.order.findMany({
      where: { companyId, status: 'active', orderDate: { gte: start, lte: end } },
      orderBy: [{ orderDate: 'desc' }, { orderNumber: 'desc' }],
      include: {
        items: {
          include: { product: { include: { category: true } } },
        },
      },
    });
    return orders;
  }

  async findOne(id: string, companyId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: { product: { include: { category: true } } },
        },
      },
    });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    return order;
  }

  async create(companyId: string, dto: {
    orderDate: string;
    orderType: OrderPaymentMethod;
    pettyCashAmount?: string;
    notes?: string;
    items: { productId: string; size?: string; packaging?: string; unit?: string; quantity: string; unitPrice: string }[];
  }) {
    const tenantId = TenantContext.getTenantId();
    if (!dto.items?.length) throw new BadRequestException('يجب إدخال صنف واحد على الأقل');

    const items = await this.withQuantityMultipliers(companyId, mapDtoItemsToOrderLines(dto.items));
    const totalAmount = items.reduce((sum, i) => sum.plus(i.amount), new Prisma.Decimal(0));

    const dateStr = orderGregorianDateToNumberPrefix(dto.orderDate);
    const existing = await this.prisma.order.count({
      where: { companyId, orderNumber: { startsWith: `ORD-${dateStr}` } },
    });
    const orderNumber = buildOrderNumberFromPrefix(dateStr, existing + 1);

    const order = await this.prisma.order.create({
      data: {
        tenantId,
        companyId,
        orderNumber,
        orderDate: new Date(dto.orderDate),
        orderType: dto.orderType,
        pettyCashAmount: dto.orderType === 'external' && dto.pettyCashAmount ? new Prisma.Decimal(dto.pettyCashAmount) : null,
        totalAmount,
        notes: dto.notes?.trim() || null,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            size: i.size,
            packaging: i.packaging,
            unit: i.unit,
            quantity: i.quantity,
            quantityMultiplier: i.quantityMultiplier,
            inventoryBaseQuantitySnapshot: i.inventoryBaseQuantitySnapshot,
            unitPrice: i.unitPrice,
            amount: i.amount,
          })),
        },
      },
      include: {
        items: {
          include: { product: { include: { category: true } } },
        },
      },
    });

    await this.updateProductLastPrices(orderLinesToLastPriceInputs(items));
    return order;
  }

  async update(companyId: string, id: string, dto: {
    orderDate?: string;
    orderType?: OrderPaymentMethod;
    pettyCashAmount?: string;
    notes?: string;
    items?: { productId: string; size?: string; packaging?: string; unit?: string; quantity: string; unitPrice: string }[];
  }) {
    const existing = await this.prisma.order.findFirst({ where: { id, companyId, status: 'active' } });
    if (!existing) throw new NotFoundException('الطلب غير موجود');

    if (dto.items?.length) {
      const items = await this.withQuantityMultipliers(companyId, mapDtoItemsToOrderLines(dto.items));
      await this.prisma.orderItem.deleteMany({ where: { orderId: id } });
      const totalAmount = items.reduce((sum, i) => sum.plus(i.amount), new Prisma.Decimal(0));
      await this.prisma.orderItem.createMany({
        data: items.map((i) => ({
          orderId: id,
          productId: i.productId,
          size: i.size,
          packaging: i.packaging,
          unit: i.unit,
          quantity: i.quantity,
          quantityMultiplier: i.quantityMultiplier,
          inventoryBaseQuantitySnapshot: i.inventoryBaseQuantitySnapshot,
          unitPrice: i.unitPrice,
          amount: i.amount,
        })),
      });
      await this.prisma.order.update({
        where: { id },
        data: {
          totalAmount,
          ...(dto.orderDate && { orderDate: new Date(dto.orderDate) }),
          ...this.paymentPatch(dto, existing.orderType),
          ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
        },
      });
      await this.updateProductLastPrices(orderLinesToLastPriceInputs(items));
    } else {
      await this.prisma.order.update({
        where: { id },
        data: {
          ...(dto.orderDate && { orderDate: new Date(dto.orderDate) }),
          ...this.paymentPatch(dto, existing.orderType),
          ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
        },
      });
    }

    return this.findOne(id, companyId);
  }

  async cancel(id: string, companyId: string) {
    const o = await this.prisma.order.findFirst({ where: { id, companyId } });
    if (!o) throw new NotFoundException('الطلب غير موجود');
    await this.prisma.order.update({ where: { id }, data: { status: 'cancelled' } });
    return { success: true };
  }

  async getSummary(companyId: string, year: number, month: number) {
    const { start, end } = utcBoundsForGregorianMonth(year, month);
    const orders = await this.prisma.order.findMany({
      where: { companyId, status: 'active', orderDate: { gte: start, lte: end } },
    });
    return aggregateOrdersMonthSummary(orders);
  }

  async getRangeSummary(companyId: string, startDate: string, endDate: string) {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);
    const [orderGroups, cashSales] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['orderType'],
        where: { companyId, status: 'active', orderDate: { gte: start, lte: end } },
        _sum: { pettyCashAmount: true, totalAmount: true },
      }),
      this.prisma.$queryRaw<Array<{ total: Prisma.Decimal | null }>>(Prisma.sql`
        SELECT COALESCE(SUM(channel.amount), 0) AS total
        FROM daily_sales_summaries AS summary
        INNER JOIN daily_sales_channels AS channel
          ON channel.summary_id = summary.id
        INNER JOIN vaults AS vault
          ON vault.id = channel.vault_id
        WHERE summary.company_id = ${companyId}
          AND summary.status = 'active'
          AND summary.transaction_date >= ${start}
          AND summary.transaction_date <= ${end}
          AND vault.type = 'cash'
      `),
    ]);
    return aggregateOrdersRangeSummaryGroups(orderGroups, cashSales[0]?.total ?? 0);
  }

  async getItemsReport(companyId: string, year: number, month: number) {
    const { start, end } = utcBoundsForGregorianMonth(year, month);
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: { companyId, status: 'active', orderDate: { gte: start, lte: end } },
      },
      include: {
        product: { include: { category: true } },
        order: true,
      },
    });

    return aggregateOrderItemsByProductForReport(items);
  }

  async getItemsReportRange(companyId: string, startDate: string, endDate: string) {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          companyId,
          status: 'active',
          orderDate: { gte: start, lte: end },
        },
      },
      include: {
        product: { include: { category: true } },
        order: {
          select: {
            id: true,
            orderDate: true,
            orderType: true,
          },
        },
      },
      orderBy: [
        { order: { orderDate: 'asc' } },
        { product: { nameAr: 'asc' } },
      ],
    });

    return aggregateOrderItemsForRangeReport(items);
  }

  async getProductPurchaseHistory(
    companyId: string,
    productId: string,
    year?: number,
    month?: number,
    startDate?: string,
    endDate?: string,
  ) {
    const orderWhere: Record<string, unknown> = { companyId, status: 'active' };
    if (startDate && endDate) {
      orderWhere.orderDate = {
        gte: new Date(`${startDate}T00:00:00.000Z`),
        lte: new Date(`${endDate}T23:59:59.999Z`),
      };
    } else if (year && month) {
      const { start, end } = utcBoundsForGregorianMonth(year, month);
      orderWhere.orderDate = { gte: start, lte: end };
    }
    const items = await this.prisma.orderItem.findMany({
      where: { productId, order: orderWhere },
      include: { order: true, product: { include: { category: true } } },
      orderBy: { order: { orderDate: 'desc' } },
    });
    return items.map((it) => ({
      orderId: it.orderId,
      orderNumber: it.order.orderNumber,
      orderDate: it.order.orderDate,
      quantity: it.quantity.toString(),
      unitPrice: it.unitPrice.toString(),
      amount: it.amount.toString(),
      productNameAr: it.product.nameAr,
      productNameEn: it.product.nameEn,
    }));
  }

  async getCategoryPurchaseHistory(
    companyId: string,
    categoryId: string,
    year?: number,
    month?: number,
    startDate?: string,
    endDate?: string,
  ) {
    const orderWhere: Record<string, unknown> = { companyId, status: 'active' };
    if (startDate && endDate) {
      orderWhere.orderDate = {
        gte: new Date(`${startDate}T00:00:00.000Z`),
        lte: new Date(`${endDate}T23:59:59.999Z`),
      };
    } else if (year && month) {
      const { start, end } = utcBoundsForGregorianMonth(year, month);
      orderWhere.orderDate = { gte: start, lte: end };
    }
    const items = await this.prisma.orderItem.findMany({
      where: { product: { categoryId }, order: orderWhere },
      include: { order: true, product: { include: { category: true } } },
      orderBy: { order: { orderDate: 'desc' } },
    });
    return items.map((it) => ({
      orderId: it.orderId,
      orderNumber: it.order.orderNumber,
      orderDate: it.order.orderDate,
      quantity: it.quantity.toString(),
      unitPrice: it.unitPrice.toString(),
      amount: it.amount.toString(),
      productNameAr: it.product.nameAr,
      productNameEn: it.product.nameEn,
      categoryNameAr: it.product.category?.nameAr,
      categoryNameEn: it.product.category?.nameEn,
    }));
  }

  async getProducts(companyId: string, section?: string, productType?: string) {
    return this.catalog.getProducts(companyId, section, productType);
  }

  async createProductsBatch(companyId: string, products: Array<{ nameAr: string; nameEn?: string; unit?: string; sizes?: string; packaging?: string; categoryId?: string; productType?: string; sections?: string[]; sectionIds?: string[]; lastPrice?: string; variants?: Array<{ size?: string; packaging?: string; unit?: string; lastPrice?: string; quantityMultiplier?: string }>; inventoryConversions?: Array<{ fromUnit?: string; toUnit?: string; multiplier?: string; label?: string }>; conversionTemplateId?: string | null; recipe?: Array<{ materialType?: string; materialProductId?: string; quantity?: string; unit?: string }> }>) {
    return this.catalog.createProductsBatch(companyId, products);
  }

  async createCategoriesBatch(companyId: string, categories: Array<{ nameAr: string; nameEn?: string; sortOrder?: number }>) {
    return this.catalog.createCategoriesBatch(companyId, categories);
  }

  async createProduct(companyId: string, dto: {
    nameAr: string;
    nameEn?: string;
    unit?: string;
    sizes?: string;
    packaging?: string;
    categoryId?: string;
    lastPrice?: string;
    sections?: string[];
    sectionIds?: string[];
    productType?: string;
    variants?: Array<{ size?: string; packaging?: string; unit?: string; lastPrice?: string; quantityMultiplier?: string }>;
    inventoryConversions?: Array<{ fromUnit?: string; toUnit?: string; multiplier?: string; label?: string }>;
    conversionTemplateId?: string | null;
    recipe?: Array<{ materialType?: string; materialProductId?: string; quantity?: string; unit?: string }>;
  }) {
    return this.catalog.createProduct(companyId, dto);
  }

  async updateProduct(id: string, companyId: string, dto: {
    nameAr?: string;
    nameEn?: string | null;
    unit?: string;
    sizes?: string | null;
    packaging?: string | null;
    categoryId?: string | null;
    lastPrice?: string;
    sections?: string[] | null;
    sectionIds?: string[] | null;
    productType?: string;
    variants?: Array<{ size?: string; packaging?: string; unit?: string; lastPrice?: string; quantityMultiplier?: string }>;
    inventoryConversions?: Array<{ fromUnit?: string; toUnit?: string; multiplier?: string; label?: string }>;
    conversionTemplateId?: string | null;
    recipe?: Array<{ materialType?: string; materialProductId?: string; quantity?: string; unit?: string }>;
    isActive?: boolean;
  }) {
    return this.catalog.updateProduct(id, companyId, dto);
  }

  async getCategories(companyId: string) {
    return this.catalog.getCategories(companyId);
  }

  async getCatalogUnits(companyId: string) {
    return this.catalog.getCatalogUnits(companyId);
  }

  async createCatalogUnit(companyId: string, dto: { code?: string; nameAr?: string; nameEn?: string | null; kind?: string | null; isActive?: boolean; sortOrder?: number }) {
    return this.catalog.createCatalogUnit(companyId, dto);
  }

  async updateCatalogUnit(id: string, companyId: string, dto: { code?: string; nameAr?: string; nameEn?: string | null; kind?: string | null; isActive?: boolean; sortOrder?: number }) {
    return this.catalog.updateCatalogUnit(id, companyId, dto);
  }

  async deleteCatalogUnit(id: string, companyId: string) {
    return this.catalog.deleteCatalogUnit(id, companyId);
  }

  async getConversionTemplates(companyId: string) {
    return this.catalog.getConversionTemplates(companyId);
  }

  async createConversionTemplate(companyId: string, dto: { code?: string; nameAr?: string; nameEn?: string | null; description?: string | null; conversions?: Array<{ fromUnit?: string; toUnit?: string; multiplier?: string; label?: string }>; isActive?: boolean; sortOrder?: number }) {
    return this.catalog.createConversionTemplate(companyId, dto);
  }

  async updateConversionTemplate(id: string, companyId: string, dto: { code?: string; nameAr?: string; nameEn?: string | null; description?: string | null; conversions?: Array<{ fromUnit?: string; toUnit?: string; multiplier?: string; label?: string }>; isActive?: boolean; sortOrder?: number }) {
    return this.catalog.updateConversionTemplate(id, companyId, dto);
  }

  async deleteConversionTemplate(id: string, companyId: string) {
    return this.catalog.deleteConversionTemplate(id, companyId);
  }

  async createCategory(companyId: string, dto: { nameAr: string; nameEn?: string; sortOrder?: number }) {
    return this.catalog.createCategory(companyId, dto);
  }

  async getSections(companyId: string) {
    return this.catalog.getSections(companyId);
  }

  async createSection(companyId: string, dto: { nameAr: string; nameEn?: string; sortOrder?: number }) {
    return this.catalog.createSection(companyId, dto);
  }

  async updateSection(id: string, companyId: string, dto: { nameAr?: string; nameEn?: string | null; sortOrder?: number }) {
    return this.catalog.updateSection(id, companyId, dto);
  }

  async deleteSection(id: string, companyId: string) {
    return this.catalog.deleteSection(id, companyId);
  }

  async bulkSetProductSections(
    companyId: string,
    productIds: string[],
    opts: { sectionNames?: string[]; sectionIds?: string[]; mode?: 'replace' | 'add' },
  ) {
    return this.catalog.bulkSetProductSections(companyId, productIds, opts);
  }

  async updateCategory(id: string, companyId: string, dto: {
    nameAr?: string;
    nameEn?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    return this.catalog.updateCategory(id, companyId, dto);
  }
}
