import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';
import { PERMISSIONS } from '../auth/constants/permissions';
import {
  resolveStaffItemVariant,
  StaffItemConversionError,
} from './orders-staff-pricing.util';
import {
  buildStaffSaleLogRef,
  staffSaleLogRefPrefix,
} from './orders-staff-log-ref.util';
import { buildSalesReportSince } from './orders-staff-sales-report.util';
import {
  buildSalesWhatsAppTextCombined,
  buildStaffPurchaseWhatsAppText,
} from './orders-staff-whatsapp.util';
import { dateToSaudiYmd, saudiDateYmd } from '../hr/utils/hr-saudi-dates.util';
import { parseSaleDateYmd } from './orders-staff-date.util';
import { suggestNextStaffRegistrationDate } from './orders-staff-registration-coverage.util';
import { resolveProductSection } from './orders-staff-sections.util';
import { CreateStaffOrderDto, StaffOrderItemInput, StaffOrderEntryType } from './orders-staff.types';
import { OrdersStaffReportService } from './orders-staff-report.service';
import { OrdersInventoryService } from './orders-inventory.service';
import {
  normalizeCancellationReasons,
  staffCancellationVariantKey,
} from './orders-staff-cancellation.util';
import { canEditStaffSaleRecordByLatest } from './orders-staff-edit-policy.util';
import {
  buildCancellationConsumptionSnapshot,
  buildInventoryConsumptionSnapshot,
  inventoryConsumptionSnapshotJson,
  inventoryRecipeMaterialIds,
  InventoryConsumptionSnapshotError,
  parseInventoryConsumptionSnapshot,
} from './orders-inventory-consumption-snapshot.util';

type StaffOrderClient = Pick<
  TenantPrismaService,
  'orderProduct' | 'staffOrder' | 'staffOrderItem' | 'inventoryMovement' | '$queryRaw'
>;

export const NEGATIVE_INVENTORY_CONFIRMATION_REQUIRED = 'NEGATIVE_INVENTORY_CONFIRMATION_REQUIRED';

@Injectable()
export class OrdersStaffService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly report: OrdersStaffReportService,
    private readonly inventory: OrdersInventoryService,
  ) {}

  private isPrivilegedStaffOrderUser(userRole?: string): boolean {
    const role = String(userRole || '').toLowerCase();
    return role === 'owner' || role === 'super_admin';
  }

  private hasStaffPermission(userPermissions: string[] | undefined, permission: string): boolean {
    return Array.isArray(userPermissions) && userPermissions.includes(permission);
  }

  private async assertStaffSaleInventoryAvailable(
    client: StaffOrderClient,
    companyId: string,
    mappedItems: Array<{ inventoryConsumptionSnapshot: unknown }>,
    allowNegativeInventory: boolean | undefined,
    excludeStaffOrderId?: string,
  ): Promise<void> {
    const shortages = await this.inventory.findStaffSaleNegativeInventory(
      client,
      companyId,
      mappedItems.map((item) => item.inventoryConsumptionSnapshot),
      excludeStaffOrderId,
    );
    if (shortages.length === 0) return;

    if (allowNegativeInventory) return;
    throw new ConflictException({
      errorCode: NEGATIVE_INVENTORY_CONFIRMATION_REQUIRED,
      message: 'سيؤدي الحفظ إلى مخزون سالب. يلزم تأكيد صريح للمتابعة.',
      details: { canOverride: true, shortages },
    });
  }

  private resolveAllowedStaffOrderTypes(
    userRole?: string,
    userPermissions?: string[],
  ): { order: boolean; sale: boolean } {
    if (this.isPrivilegedStaffOrderUser(userRole)) return { order: true, sale: true };
    return {
      order: this.hasStaffPermission(userPermissions, PERMISSIONS.ORDERS_STAFF_SUBMIT),
      sale: this.hasStaffPermission(userPermissions, PERMISSIONS.STAFF_ORDERS_SUBMIT),
    };
  }

  private assertStaffOrderTypeAccess(
    orderType: 'order' | 'sale',
    userRole?: string,
    userPermissions?: string[],
  ): void {
    const allowed = this.resolveAllowedStaffOrderTypes(userRole, userPermissions);
    if (allowed[orderType]) return;
    throw new ForbiddenException(
      orderType === 'sale'
        ? 'لا تملك صلاحية التسجيل الداخلي.'
        : 'لا تملك صلاحية إرسال طلبات الأقسام.',
    );
  }

  private async assertLatestEditableStaffSaleOrder(
    order: { id: string; companyId: string; userId: string; orderType?: string | null; logRef?: string | null },
    userRole?: string,
    client: StaffOrderClient = this.prisma,
  ): Promise<void> {
    if (order.orderType !== 'sale') return;

    const where: Prisma.StaffOrderWhereInput = {
      companyId: order.companyId,
      userId: order.userId,
      orderType: 'sale',
    };
    const tenantId = TenantContext.tryGetTenantId();
    if (tenantId) where.tenantId = tenantId;

    const latest = await client.staffOrder.findFirst({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, logRef: true },
    });

    if (!canEditStaffSaleRecordByLatest({ target: order, latest, role: userRole })) {
      throw new ForbiddenException('يمكن تعديل آخر تسجيل داخلي فقط.');
    }
  }

  private async countStaffSaleOperationsForDay(
    companyId: string,
    saleDate: Date,
    client: StaffOrderClient = this.prisma,
  ): Promise<number> {
    const prefix = staffSaleLogRefPrefix(saleDate);
    const rows = await client.staffOrder.findMany({
      where: { companyId, orderType: 'sale', logRef: { startsWith: prefix } },
      select: { logRef: true },
      distinct: ['logRef'],
    });
    return rows.length;
  }

  private async allocateStaffSaleLogRef(
    companyId: string,
    saleDate: Date,
    client: StaffOrderClient = this.prisma,
  ): Promise<string> {
    const nextSeq = (await this.countStaffSaleOperationsForDay(companyId, saleDate, client)) + 1;
    return buildStaffSaleLogRef(saleDate, nextSeq);
  }

  /** يعرض الرقم التالي في سلة التسجيل دون حجزه. */
  async peekNextStaffSaleLogRef(companyId: string, saleDateYmd: string): Promise<{ logRef: string }> {
    const saleDate = parseSaleDateYmd(saleDateYmd);
    const nextSeq = (await this.countStaffSaleOperationsForDay(companyId, saleDate)) + 1;
    return { logRef: buildStaffSaleLogRef(saleDate, nextSeq) };
  }

  async getStaffSaleDateStatus(companyId: string, userId: string, sectionNameInput?: string) {
    const today = saudiDateYmd();
    const sectionName = String(sectionNameInput || '').trim();
    if (!sectionName) {
      return {
        sectionName: '',
        today,
        suggestedDate: today,
        lastSectionDate: null,
        lastUserDate: null,
      };
    }

    const tenantId = TenantContext.tryGetTenantId();
    const baseWhere: Prisma.StaffOrderWhereInput = {
      companyId,
      orderType: 'sale',
      entryType: 'issue',
      sectionName,
      ...(tenantId ? { tenantId } : {}),
    };
    const sectionRows = await this.prisma.staffOrder.findMany({
      where: baseWhere,
      select: { userId: true, saleDate: true, createdAt: true },
    });
    const sectionDates = sectionRows.map((row) => dateToSaudiYmd(row.saleDate ?? row.createdAt)).sort();
    const userDates = sectionRows
      .filter((row) => row.userId === userId)
      .map((row) => dateToSaudiYmd(row.saleDate ?? row.createdAt))
      .sort();
    const lastSectionDate = sectionDates.at(-1) ?? null;
    const lastUserDate = userDates.at(-1) ?? null;

    return {
      sectionName,
      today,
      suggestedDate: suggestNextStaffRegistrationDate(lastSectionDate, today),
      lastSectionDate,
      lastUserDate,
    };
  }

  private async groupItemsBySection(
    companyId: string,
    items: StaffOrderItemInput[],
    explicitSection?: string,
    client: StaffOrderClient = this.prisma,
  ): Promise<Map<string, StaffOrderItemInput[]>> {
    const groups = new Map<string, StaffOrderItemInput[]>();
    if (explicitSection?.trim()) {
      groups.set(explicitSection.trim(), items);
      return groups;
    }

    const productIds = [...new Set(items.map((it) => it.productId).filter(Boolean))];
    const products = productIds.length
      ? await client.orderProduct.findMany({
          where: { companyId, id: { in: productIds } },
          select: { id: true, sections: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const it of items) {
      const fromItem = it.sectionName?.trim();
      const fromProduct = resolveProductSection(productMap.get(it.productId));
      const sec = fromItem || fromProduct;
      if (!groups.has(sec)) groups.set(sec, []);
      groups.get(sec)!.push(it);
    }
    return groups;
  }

  private validateItemQuantities(items: StaffOrderItemInput[]): Prisma.Decimal[] {
    return items.map((it) => {
      try {
        const quantity = new Prisma.Decimal(it.quantity);
        if (it.productId && quantity.isFinite() && quantity.gt(0)) return quantity;
      } catch {
        // Converted below into the existing request validation error.
      }
      throw new BadRequestException('بيانات الصنف غير صحيحة');
    });
  }

  private async mapStaffItemsForCreate(
    companyId: string,
    items: StaffOrderItemInput[],
    entryType: StaffOrderEntryType,
    orderType: 'order' | 'sale',
    client: StaffOrderClient = this.prisma,
  ) {
    const productIds = [...new Set(items.map((it) => it.productId).filter(Boolean))];
    const products = productIds.length
      ? await client.orderProduct.findMany({
          where: { companyId, id: { in: productIds } },
          include: { conversionTemplate: { select: { conversions: true } } },
        })
      : [];
    const pmap = new Map(products.map((p) => [p.id, p]));
    const missing = productIds.filter((id) => !pmap.has(id));
    if (missing.length) {
      throw new BadRequestException('الصنف غير موجود أو لا ينتمي إلى هذه الشركة');
    }
    const qty = this.validateItemQuantities(items);
    try {
      const materialIds = orderType === 'sale'
        ? [...new Set(products.flatMap((product) => inventoryRecipeMaterialIds(product.recipe)))]
        : [];
      const materials = materialIds.length > 0
        ? await client.orderProduct.findMany({
            where: {
              companyId,
              id: { in: materialIds },
              productType: 'order',
              isActive: true,
            },
            include: { conversionTemplate: { select: { conversions: true } } },
          })
        : [];
      const materialById = new Map(materials.map((material) => [material.id, material]));

      return items.map((it, i) => {
        const product = pmap.get(it.productId)!;
        const v = resolveStaffItemVariant(product, it);
        const cancellationReasons = normalizeCancellationReasons(it, entryType === 'cancellation');
        const inventoryConsumptionSnapshot = orderType === 'sale'
          ? inventoryConsumptionSnapshotJson(buildInventoryConsumptionSnapshot({
              saleProduct: product,
              soldQuantity: qty[i],
              soldQuantityMultiplier: v.quantityMultiplier,
              materialById,
            }))
          : Prisma.JsonNull;
        return {
          productId: it.productId,
          quantity: qty[i],
          quantityMultiplier: v.quantityMultiplier,
          inventoryConsumptionSnapshot,
          size: v.size,
          packaging: v.packaging,
          unit: v.unit,
          unitPrice: v.unitPrice,
          notes: it.notes?.trim() || null,
          cancellationReasons,
        };
      });
    } catch (error) {
      if (error instanceof StaffItemConversionError) {
        throw new BadRequestException(`لا توجد معادلة تحويل صالحة لوحدة ${error.unit}`);
      }
      if (error instanceof InventoryConsumptionSnapshotError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async assertCancellationAvailability(
    companyId: string,
    sectionName: string,
    saleDate: Date,
    items: Awaited<ReturnType<OrdersStaffService['mapStaffItemsForCreate']>>,
    client: StaffOrderClient = this.prisma,
  ): Promise<Prisma.InputJsonObject[]> {
    const recordedItems = await client.staffOrderItem.findMany({
      where: {
        staffOrder: {
          companyId,
          orderType: 'sale',
          sectionName,
          saleDate,
        },
      },
      select: {
        productId: true,
        quantity: true,
        size: true,
        packaging: true,
        unit: true,
        quantityMultiplier: true,
        inventoryConsumptionSnapshot: true,
      },
    });
    const recordedByVariant = new Map<string, typeof recordedItems>();
    const availableByVariant = new Map<string, Prisma.Decimal>();
    for (const item of recordedItems) {
      const key = staffCancellationVariantKey(item);
      recordedByVariant.set(key, [...(recordedByVariant.get(key) ?? []), item]);
      availableByVariant.set(
        key,
        (availableByVariant.get(key) ?? new Prisma.Decimal(0)).plus(item.quantity),
      );
    }

    const requestedByVariant = new Map<string, Prisma.Decimal>();
    for (const item of items) {
      const key = staffCancellationVariantKey(item);
      requestedByVariant.set(
        key,
        (requestedByVariant.get(key) ?? new Prisma.Decimal(0)).plus(item.quantity),
      );
    }

    for (const [key, requested] of requestedByVariant) {
      const available = availableByVariant.get(key) ?? new Prisma.Decimal(0);
      if (requested.gt(available)) {
        throw new BadRequestException(
          `كمية الإلغاء (${requested.toString()}) أكبر من الكمية المسجلة المتاحة (${available.toString()}) لهذا الصنف.`,
        );
      }
    }

    try {
      return items.map((item) => {
        const key = staffCancellationVariantKey(item);
        const estimatedCurrentSnapshot = parseInventoryConsumptionSnapshot(
          item.inventoryConsumptionSnapshot,
        );
        if (!estimatedCurrentSnapshot) {
          throw new InventoryConsumptionSnapshotError('Cancellation snapshot could not be estimated.');
        }
        return inventoryConsumptionSnapshotJson(buildCancellationConsumptionSnapshot({
          requestedSoldBaseQuantity: item.quantity.times(item.quantityMultiplier),
          recordedSnapshots: (recordedByVariant.get(key) ?? []).map(
            (recorded) => recorded.inventoryConsumptionSnapshot,
          ),
          estimatedCurrentSnapshot,
        }));
      });
    } catch (error) {
      if (error instanceof InventoryConsumptionSnapshotError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async createStaffOrderRecord(
    tenantId: string,
    userId: string,
    dto: CreateStaffOrderDto,
    sectionName: string,
    items: StaffOrderItemInput[],
    orderType: 'order' | 'sale',
    saleDate: Date | null,
    sentAt: Date | null,
    logRef: string | null = null,
    entryType: StaffOrderEntryType = 'issue',
    userRole?: string,
    client: StaffOrderClient = this.prisma,
  ) {
    const mapped = await this.mapStaffItemsForCreate(dto.companyId, items, entryType, orderType, client);
    let cancellationSnapshots: Prisma.InputJsonObject[] | null = null;
    if (entryType === 'cancellation') {
      if (!saleDate) throw new BadRequestException('تاريخ الإلغاء مطلوب.');
      cancellationSnapshots = await this.assertCancellationAvailability(
        dto.companyId,
        sectionName,
        saleDate,
        mapped,
        client,
      );
    }
    if (orderType === 'sale' && entryType === 'issue') {
      await this.assertStaffSaleInventoryAvailable(
        client,
        dto.companyId,
        mapped,
        dto.allowNegativeInventory,
      );
    }
    return client.staffOrder.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        userId,
        sectionName,
        orderType,
        entryType,
        logRef,
        saleDate,
        notes: dto.notes?.trim() || null,
        status: 'sent',
        sentAt,
        items: {
          create: mapped.map((item, index) => ({
            ...item,
            quantity: entryType === 'cancellation'
              ? new Prisma.Decimal(item.quantity).negated()
              : item.quantity,
            inventoryConsumptionSnapshot: cancellationSnapshots?.[index]
              ?? item.inventoryConsumptionSnapshot,
            cancellationReasons: item.cancellationReasons ?? Prisma.JsonNull,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
        user: { select: { nameAr: true, nameEn: true } },
      },
    });
  }

  async createStaffOrder(
    userId: string,
    dto: CreateStaffOrderDto,
    userRole?: string,
    userPermissions?: string[],
  ) {
    const tenantId = TenantContext.getTenantId();
    const companyId = String(dto.companyId ?? '').trim();
    if (!companyId) throw new BadRequestException('companyId مطلوب');
    if (!dto.items?.length) throw new BadRequestException('يجب إضافة صنف واحد على الأقل');

    const orderType = dto.orderType === 'sale' ? 'sale' : 'order';
    this.assertStaffOrderTypeAccess(orderType, userRole, userPermissions);
    const entryType: StaffOrderEntryType = dto.entryType === 'cancellation' ? 'cancellation' : 'issue';
    const lang: 'ar' | 'en' = dto.lang === 'en' ? 'en' : 'ar';
    const isSale = orderType === 'sale';
    if (!isSale && entryType === 'cancellation') {
      throw new BadRequestException('الإلغاء متاح في التسجيل الداخلي فقط.');
    }
    const saleDate = isSale ? parseSaleDateYmd(dto.saleDate || saudiDateYmd()) : null;
    const sentAt = new Date();

    const grouped = await this.groupItemsBySection(companyId, dto.items, dto.sectionName);
    const sectionEntries = [...grouped.entries()];
    if (isSale && sectionEntries.length !== 1) {
      throw new BadRequestException('يجب تسجيل كل قسم بشكل مستقل في التسجيل الداخلي.');
    }
    const persistOrders = async (client: StaffOrderClient, saleLogRef: string | null) => {
      const saved: Awaited<ReturnType<typeof this.createStaffOrderRecord>>[] = [];
      for (const [sectionName, sectionItems] of sectionEntries) {
        saved.push(await this.createStaffOrderRecord(
          tenantId,
          userId,
          { ...dto, companyId },
          sectionName,
          sectionItems,
          orderType,
          saleDate,
          sentAt,
          saleLogRef,
          entryType,
          userRole,
          client,
        ));
      }
      return saved;
    };

    let saleLogRef: string | null = null;
    let orders: Awaited<ReturnType<typeof this.createStaffOrderRecord>>[];
    if (isSale && entryType === 'issue' && saleDate) {
      const persisted = await this.prisma.withTenant(async (tx) => {
        await this.inventory.lockInventoryBalance(tx, tenantId, companyId);
        const lockedLogRef = await this.allocateStaffSaleLogRef(companyId, saleDate, tx);
        return {
          saleLogRef: lockedLogRef,
          orders: await persistOrders(tx, lockedLogRef),
        };
      });
      saleLogRef = persisted.saleLogRef;
      orders = persisted.orders;
    } else {
      saleLogRef = isSale && saleDate ? await this.allocateStaffSaleLogRef(companyId, saleDate) : null;
      orders = await persistOrders(this.prisma, saleLogRef);
    }

    if (!isSale) {
      const sections = orders.map((order) => ({
        sectionName: order.sectionName,
        orders: [order],
      }));
      const whatsAppText = buildStaffPurchaseWhatsAppText(
        sections,
        saudiDateYmd().replace(/-/g, '/'),
        lang,
      );
      const primary = orders[0];
      return { ...primary, orders, count: orders.length, whatsAppText };
    }

    const whatsAppText = buildSalesWhatsAppTextCombined(orders, saleDate!, lang, saleLogRef);
    const primary = orders[0];
    return { ...primary, orders, count: orders.length, logRef: saleLogRef, whatsAppText };
  }

  async getMyStaffOrders(
    companyId: string,
    userId: string,
    days = 30,
    userRole?: string,
    userPermissions?: string[],
  ) {
    // نفس نافذة تقرير المبيعات: createdAt أو saleDate داخل الفترة.
    const since = buildSalesReportSince(days);
    const tenantId = TenantContext.tryGetTenantId();
    const where: Prisma.StaffOrderWhereInput = {
      companyId,
      userId,
      OR: [{ createdAt: { gte: since } }, { saleDate: { gte: since } }],
    };
    const allowed = this.resolveAllowedStaffOrderTypes(userRole, userPermissions);
    if (!allowed.order && !allowed.sale) return [];
    if (allowed.order !== allowed.sale) {
      where.orderType = allowed.sale ? 'sale' : 'order';
    }
    if (tenantId) where.tenantId = tenantId;
    return this.prisma.staffOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: true } } },
    });
  }

  private async updateStaffOrderItemsAtomic(
    id: string,
    companyId: string,
    userId: string,
    userRole: string | undefined,
    userPermissions: string[] | undefined,
    dto: {
      sectionName?: string;
      notes?: string;
      saleDate?: string;
      items: StaffOrderItemInput[];
      lang?: 'ar' | 'en';
      allowNegativeInventory?: boolean;
    },
  ) {
    const tenantId = TenantContext.getTenantId();
    return this.prisma.withTenant(async (tx) => {
      await this.inventory.lockInventoryBalance(tx, tenantId, companyId);
      const order = await tx.staffOrder.findFirst({ where: { id, companyId } });
      if (!order) throw new NotFoundException('Staff order not found.');
      if (order.userId !== userId) throw new ForbiddenException('Another employee staff order cannot be edited.');
      this.assertStaffOrderTypeAccess(order.orderType === 'sale' ? 'sale' : 'order', userRole, userPermissions);
      if (order.orderType !== 'sale') throw new BadRequestException('A sent operational order cannot be edited.');
      if (order.entryType === 'cancellation') {
        throw new BadRequestException('Cancellation records are immutable.');
      }
      await this.assertLatestEditableStaffSaleOrder(order, userRole, tx);

      const grouped = await this.groupItemsBySection(companyId, dto.items, dto.sectionName, tx);
      if (grouped.size !== 1) {
        throw new BadRequestException('An internal sale record must contain exactly one section.');
      }
      const [[sectionName, sectionItems]] = grouped.entries();
      const mapped = await this.mapStaffItemsForCreate(companyId, sectionItems, 'issue', 'sale', tx);
      await this.assertStaffSaleInventoryAvailable(
        tx,
        companyId,
        mapped,
        dto.allowNegativeInventory,
        id,
      );

      await tx.staffOrderItem.deleteMany({ where: { staffOrderId: id } });
      const updated = await tx.staffOrder.update({
        where: { id },
        data: {
          sectionName,
          ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
          ...(dto.saleDate && { saleDate: parseSaleDateYmd(dto.saleDate) }),
          items: {
            create: mapped.map((item) => ({
              ...item,
              cancellationReasons: item.cancellationReasons ?? Prisma.JsonNull,
            })),
          },
        },
        include: {
          items: { include: { product: true } },
          user: { select: { nameAr: true, nameEn: true } },
        },
      });
      const saleDay = updated.saleDate ?? updated.createdAt;
      const lang: 'ar' | 'en' = dto.lang === 'en' ? 'en' : 'ar';
      return {
        ...updated,
        whatsAppText: buildSalesWhatsAppTextCombined([updated], saleDay, lang, updated.logRef),
      };
    });
  }

  async updateStaffOrder(
    id: string,
    companyId: string,
    userId: string,
    userRole: string | undefined,
    userPermissions: string[] | undefined,
    dto: {
      sectionName?: string;
      notes?: string;
      saleDate?: string;
      items?: StaffOrderItemInput[];
      lang?: 'ar' | 'en';
      allowNegativeInventory?: boolean;
    },
  ) {
    if (dto.items?.length) {
      return this.updateStaffOrderItemsAtomic(
        id,
        companyId,
        userId,
        userRole,
        userPermissions,
        { ...dto, items: dto.items },
      );
    }
    const order = await this.prisma.staffOrder.findFirst({ where: { id, companyId } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.userId !== userId) throw new ForbiddenException('لا يمكن تعديل طلب موظف آخر');
    this.assertStaffOrderTypeAccess(order.orderType === 'sale' ? 'sale' : 'order', userRole, userPermissions);

    const isSale = order.orderType === 'sale';
    if (!isSale) {
      throw new BadRequestException('لا يمكن تعديل طلب تم إرساله');
    }
    if (order.entryType === 'cancellation') {
      throw new BadRequestException('عملية الإلغاء محفوظة كسجل رقابي ولا يمكن تعديلها.');
    }
    await this.assertLatestEditableStaffSaleOrder(order, userRole);

    const lang: 'ar' | 'en' = dto.lang === 'en' ? 'en' : 'ar';
    const data: Prisma.StaffOrderUpdateInput = {};
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    if (isSale && dto.saleDate) {
      data.saleDate = parseSaleDateYmd(dto.saleDate);
    }

    if (dto.items?.length) {
      const grouped = await this.groupItemsBySection(companyId, dto.items, dto.sectionName);
      if (grouped.size > 1) {
        throw new BadRequestException(
          'لا يمكن دمج أقسام متعددة في سجل مبيعات واحد؛ عدّل كل قسم من قائمة المبيعات',
        );
      }
      const [[sectionName, sectionItems]] = grouped.entries();
      data.sectionName = sectionName;
      const mapped = await this.mapStaffItemsForCreate(companyId, sectionItems, 'issue', 'sale');
      await this.prisma.staffOrderItem.deleteMany({ where: { staffOrderId: id } });
      data.items = {
        create: mapped.map((item) => ({
          ...item,
          cancellationReasons: item.cancellationReasons ?? Prisma.JsonNull,
        })),
      };
    } else if (dto.sectionName?.trim()) {
      data.sectionName = dto.sectionName.trim();
    }

    const updated = await this.prisma.staffOrder.update({
      where: { id },
      data,
      include: {
        items: { include: { product: true } },
        user: { select: { nameAr: true, nameEn: true } },
      },
    });

    if (!isSale) return updated;

    const saleDay = updated.saleDate ?? updated.createdAt;
    const whatsAppText = buildSalesWhatsAppTextCombined([updated], saleDay, lang, updated.logRef);
    return { ...updated, whatsAppText };
  }

  /** Reopen WhatsApp for an operational section order or an internal log. */
  async resendStaffOrder(
    id: string,
    companyId: string,
    userId: string,
    lang: 'ar' | 'en' = 'ar',
    userRole?: string,
    userPermissions?: string[],
  ) {
    const order = await this.prisma.staffOrder.findFirst({
      where: { id, companyId },
      include: {
        items: { include: { product: true } },
        user: { select: { nameAr: true, nameEn: true } },
      },
    });
    if (!order) throw new NotFoundException('المبيعات غير موجودة');
    if (order.userId !== userId) throw new ForbiddenException('لا يمكن إعادة إرسال مبيعات موظف آخر');
    this.assertStaffOrderTypeAccess(order.orderType === 'sale' ? 'sale' : 'order', userRole, userPermissions);

    if (order.orderType !== 'sale') {
      if (order.status !== 'sent') {
        await this.prisma.staffOrder.update({
          where: { id: order.id },
          data: { status: 'sent', sentAt: new Date() },
        });
      }
      const whatsAppText = buildStaffPurchaseWhatsAppText(
        [{ sectionName: order.sectionName, orders: [order] }],
        dateToSaudiYmd(order.createdAt).replace(/-/g, '/'),
        lang,
      );
      return { whatsAppText, logRef: null };
    }

    const saleDay = order.saleDate ?? order.createdAt;
    const orders = order.logRef
      ? await this.prisma.staffOrder.findMany({
          where: { companyId, orderType: 'sale', logRef: order.logRef },
          orderBy: { sectionName: 'asc' },
          include: {
            items: { include: { product: true } },
            user: { select: { nameAr: true, nameEn: true } },
          },
        })
      : [order];
    const whatsAppText = buildSalesWhatsAppTextCombined(orders, saleDay, lang, order.logRef);
    return { whatsAppText, logRef: order.logRef };
  }

  async deleteStaffOrder(
    id: string,
    companyId: string,
    userId: string,
    userRole?: string,
    userPermissions?: string[],
  ) {
    const order = await this.prisma.staffOrder.findFirst({ where: { id, companyId } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.userId !== userId) throw new ForbiddenException('لا يمكن حذف طلب موظف آخر');
    this.assertStaffOrderTypeAccess(order.orderType === 'sale' ? 'sale' : 'order', userRole, userPermissions);
    if (order.orderType !== 'sale') {
      throw new BadRequestException('لا يمكن حذف طلب تم إرساله');
    }
    if (order.entryType === 'cancellation') {
      throw new BadRequestException('عملية الإلغاء محفوظة كسجل رقابي ولا يمكن حذفها.');
    }
    await this.assertLatestEditableStaffSaleOrder(order, userRole);
    await this.prisma.staffOrder.delete({ where: { id } });
    return { deleted: true };
  }

  async getSalesReport(
    companyId: string,
    periodInput: number | { startDate: string; endDate: string } = 30,
  ) {
    return this.report.getSalesReport(companyId, periodInput);
  }
}
