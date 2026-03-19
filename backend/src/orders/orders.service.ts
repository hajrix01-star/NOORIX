import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';

type OrderItemInput = { productId: string; size?: string | null; packaging?: string | null; unit?: string | null; unitPrice: Prisma.Decimal };

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: TenantPrismaService) {}

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
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
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
    orderType: 'external' | 'internal';
    pettyCashAmount?: string;
    notes?: string;
    items: { productId: string; size?: string; packaging?: string; unit?: string; quantity: string; unitPrice: string }[];
  }) {
    const tenantId = TenantContext.getTenantId();
    if (!dto.items?.length) throw new BadRequestException('يجب إدخال صنف واحد على الأقل');

    const items = dto.items.map((i) => ({
      productId: i.productId,
      size: i.size?.trim() || null,
      packaging: i.packaging?.trim() || null,
      unit: i.unit?.trim() || null,
      quantity: new Prisma.Decimal(i.quantity || 0),
      unitPrice: new Prisma.Decimal(i.unitPrice || 0),
      amount: new Prisma.Decimal(i.quantity || 0).times(new Prisma.Decimal(i.unitPrice || 0)),
    }));
    const totalAmount = items.reduce((sum, i) => sum.plus(i.amount), new Prisma.Decimal(0));

    const dateStr = dto.orderDate.replace(/-/g, '').slice(0, 8);
    const existing = await this.prisma.order.count({
      where: { companyId, orderNumber: { startsWith: `ORD-${dateStr}` } },
    });
    const orderNumber = `ORD-${dateStr}-${String(existing + 1).padStart(3, '0')}`;

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

    await this.updateProductLastPrices(items);
    return order;
  }

  async update(companyId: string, id: string, dto: {
    orderDate?: string;
    orderType?: 'external' | 'internal';
    pettyCashAmount?: string;
    notes?: string;
    items?: { productId: string; size?: string; packaging?: string; unit?: string; quantity: string; unitPrice: string }[];
  }) {
    const existing = await this.prisma.order.findFirst({ where: { id, companyId, status: 'active' } });
    if (!existing) throw new NotFoundException('الطلب غير موجود');

    if (dto.items?.length) {
      await this.prisma.orderItem.deleteMany({ where: { orderId: id } });
      const items = dto.items.map((i) => ({
        productId: i.productId,
        size: i.size?.trim() || null,
        packaging: i.packaging?.trim() || null,
        unit: i.unit?.trim() || null,
        quantity: new Prisma.Decimal(i.quantity || 0),
        unitPrice: new Prisma.Decimal(i.unitPrice || 0),
        amount: new Prisma.Decimal(i.quantity || 0).times(new Prisma.Decimal(i.unitPrice || 0)),
      }));
      const totalAmount = items.reduce((sum, i) => sum.plus(i.amount), new Prisma.Decimal(0));
      await this.prisma.orderItem.createMany({
        data: items.map((i) => ({
          orderId: id,
          productId: i.productId,
          size: i.size,
          packaging: i.packaging,
          unit: i.unit,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          amount: i.amount,
        })),
      });
      await this.prisma.order.update({
        where: { id },
        data: {
          totalAmount,
          ...(dto.orderDate && { orderDate: new Date(dto.orderDate) }),
          ...(dto.orderType && { orderType: dto.orderType }),
          ...(dto.pettyCashAmount !== undefined && { pettyCashAmount: dto.pettyCashAmount ? new Prisma.Decimal(dto.pettyCashAmount) : null }),
          ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
        },
      });
      await this.updateProductLastPrices(items);
    } else {
      await this.prisma.order.update({
        where: { id },
        data: {
          ...(dto.orderDate && { orderDate: new Date(dto.orderDate) }),
          ...(dto.orderType && { orderType: dto.orderType }),
          ...(dto.pettyCashAmount !== undefined && { pettyCashAmount: dto.pettyCashAmount ? new Prisma.Decimal(dto.pettyCashAmount) : null }),
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
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const orders = await this.prisma.order.findMany({
      where: { companyId, status: 'active', orderDate: { gte: start, lte: end } },
    });
    let pettyCashTotal = new Prisma.Decimal(0);
    let delegatePurchasesTotal = new Prisma.Decimal(0);
    let localPurchasesTotal = new Prisma.Decimal(0);
    for (const o of orders) {
      if (o.orderType === 'external') {
        pettyCashTotal = pettyCashTotal.plus(o.pettyCashAmount ?? 0);
        delegatePurchasesTotal = delegatePurchasesTotal.plus(o.totalAmount);
      } else {
        localPurchasesTotal = localPurchasesTotal.plus(o.totalAmount);
      }
    }
    return {
      pettyCashTotal: pettyCashTotal.toString(),
      delegatePurchasesTotal: delegatePurchasesTotal.toString(),
      localPurchasesTotal: localPurchasesTotal.toString(),
      delegateBalance: pettyCashTotal.minus(delegatePurchasesTotal).toString(),
    };
  }

  async getItemsReport(companyId: string, year: number, month: number) {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: { companyId, status: 'active', orderDate: { gte: start, lte: end } },
      },
      include: {
        product: { include: { category: true } },
        order: true,
      },
    });

    const byProduct = new Map<string, { product: typeof items[0]['product']; quantity: Prisma.Decimal; amount: Prisma.Decimal; orderCount: number }>();
    for (const it of items) {
      const key = it.productId;
      const existing = byProduct.get(key);
      const qty = new Prisma.Decimal(it.quantity);
      const amt = new Prisma.Decimal(it.amount);
      if (existing) {
        existing.quantity = existing.quantity.plus(qty);
        existing.amount = existing.amount.plus(amt);
        existing.orderCount += 1;
      } else {
        byProduct.set(key, {
          product: it.product,
          quantity: qty,
          amount: amt,
          orderCount: 1,
        });
      }
    }

    return Array.from(byProduct.values()).map((v) => ({
      productId: v.product.id,
      productNameAr: v.product.nameAr,
      productNameEn: v.product.nameEn,
      categoryId: v.product.categoryId,
      categoryNameAr: v.product.category?.nameAr,
      categoryNameEn: v.product.category?.nameEn,
      unit: v.product.unit,
      quantity: v.quantity.toString(),
      amount: v.amount.toString(),
      orderCount: v.orderCount,
    }));
  }

  async getProductPurchaseHistory(companyId: string, productId: string, year?: number, month?: number) {
    const orderWhere: Record<string, unknown> = { companyId, status: 'active' };
    if (year && month) {
      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
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

  async getCategoryPurchaseHistory(companyId: string, categoryId: string, year?: number, month?: number) {
    const orderWhere: Record<string, unknown> = { companyId, status: 'active' };
    if (year && month) {
      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
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

  // ── Order Products ─────────────────────────────────────────────
  async getProducts(companyId: string) {
    return this.prisma.orderProduct.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
      include: { category: true },
    });
  }

  async createProductsBatch(companyId: string, products: { nameAr: string; nameEn?: string; unit?: string; sizes?: string; packaging?: string; categoryId?: string; lastPrice?: string; variants?: Array<{ size?: string; packaging?: string; unit?: string; lastPrice?: string }> }[]) {
    const tenantId = TenantContext.getTenantId();
    const created = [];
    for (const dto of products) {
      if (!dto.nameAr?.trim()) continue;
      const variantsData = dto.variants?.length
        ? dto.variants.map((v) => ({ size: v.size || '', packaging: v.packaging || '', unit: v.unit || 'piece', lastPrice: v.lastPrice || '0' }))
        : null;
      const p = await this.prisma.orderProduct.create({
        data: {
          tenantId,
          companyId,
          nameAr: dto.nameAr.trim(),
          nameEn: dto.nameEn?.trim() || null,
          unit: dto.unit || 'piece',
          sizes: dto.sizes?.trim() || null,
          packaging: dto.packaging?.trim() || null,
          categoryId: dto.categoryId || null,
          lastPrice: dto.lastPrice ? new Prisma.Decimal(dto.lastPrice) : new Prisma.Decimal(0),
          variants: variantsData as object,
        } as any,
        include: { category: true },
      });
      created.push(p);
    }
    return created;
  }

  async createCategoriesBatch(companyId: string, categories: { nameAr: string; nameEn?: string; sortOrder?: number }[]) {
    const tenantId = TenantContext.getTenantId();
    const created = [];
    for (const dto of categories) {
      if (!dto.nameAr?.trim()) continue;
      const c = await this.prisma.orderCategory.create({
        data: {
          tenantId,
          companyId,
          nameAr: dto.nameAr.trim(),
          nameEn: dto.nameEn?.trim() || null,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      created.push(c);
    }
    return created;
  }

  async createProduct(companyId: string, dto: {
    nameAr: string;
    nameEn?: string;
    unit?: string;
    sizes?: string;
    packaging?: string;
    categoryId?: string;
    lastPrice?: string;
    variants?: Array<{ size?: string; packaging?: string; unit?: string; lastPrice?: string }>;
  }) {
    const tenantId = TenantContext.getTenantId();
    if (!dto.nameAr?.trim()) throw new BadRequestException('اسم الصنف بالعربية مطلوب');
    const variantsData = dto.variants?.length
      ? dto.variants.map((v) => ({ size: v.size || '', packaging: v.packaging || '', unit: v.unit || 'piece', lastPrice: v.lastPrice || '0' }))
      : null;
    return this.prisma.orderProduct.create({
      data: {
        tenantId,
        companyId,
        nameAr: dto.nameAr.trim(),
        nameEn: dto.nameEn?.trim() || null,
        unit: dto.unit || 'piece',
        sizes: dto.sizes?.trim() || null,
        packaging: dto.packaging?.trim() || null,
        categoryId: dto.categoryId || null,
        lastPrice: dto.lastPrice ? new Prisma.Decimal(dto.lastPrice) : new Prisma.Decimal(0),
        variants: variantsData as object,
      } as any,
      include: { category: true },
    });
  }

  async updateProduct(id: string, companyId: string, dto: {
    nameAr?: string;
    nameEn?: string | null;
    unit?: string;
    sizes?: string | null;
    packaging?: string | null;
    categoryId?: string | null;
    lastPrice?: string;
    variants?: Array<{ size?: string; packaging?: string; unit?: string; lastPrice?: string }>;
    isActive?: boolean;
  }) {
    const p = await this.prisma.orderProduct.findFirst({ where: { id, companyId } });
    if (!p) throw new NotFoundException('الصنف غير موجود');
    const variantsData = dto.variants !== undefined
      ? (dto.variants?.length
        ? dto.variants.map((v) => ({ size: v.size || '', packaging: v.packaging || '', unit: v.unit || 'piece', lastPrice: v.lastPrice || '0' }))
        : null)
      : undefined;
    return this.prisma.orderProduct.update({
      where: { id },
      data: {
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr.trim() } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn?.trim() || null } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.sizes !== undefined ? { sizes: dto.sizes?.trim() || null } : {}),
        ...(dto.packaging !== undefined ? { packaging: dto.packaging?.trim() || null } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId || null } : {}),
        ...(dto.lastPrice !== undefined ? { lastPrice: new Prisma.Decimal(dto.lastPrice) } : {}),
        ...(variantsData !== undefined ? { variants: variantsData as object } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { category: true },
    });
  }

  // ── Order Categories ────────────────────────────────────────────
  async getCategories(companyId: string) {
    return this.prisma.orderCategory.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    });
  }

  async createCategory(companyId: string, dto: { nameAr: string; nameEn?: string; sortOrder?: number }) {
    const tenantId = TenantContext.getTenantId();
    if (!dto.nameAr?.trim()) throw new BadRequestException('اسم الفئة بالعربية مطلوب');
    return this.prisma.orderCategory.create({
      data: {
        tenantId,
        companyId,
        nameAr: dto.nameAr.trim(),
        nameEn: dto.nameEn?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(id: string, companyId: string, dto: {
    nameAr?: string;
    nameEn?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const c = await this.prisma.orderCategory.findFirst({ where: { id, companyId } });
    if (!c) throw new NotFoundException('الفئة غير موجودة');
    return this.prisma.orderCategory.update({
      where: { id },
      data: {
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr.trim() } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn?.trim() || null } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}
