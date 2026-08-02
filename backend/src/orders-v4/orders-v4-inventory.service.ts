import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { calculateOrdersV4StocktakeAdjustment } from './orders-v4-calculation.kernel';
import type { OrdersV4StocktakeInput } from './orders-v4.contracts';
import type { OrdersV4InventoryBalance } from './orders-v4-kernel.types';

function stocktakeDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new BadRequestException('تاريخ الجرد غير صالح');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException('تاريخ الجرد غير صالح');
  return date;
}

function stocktakeRequestHash(input: OrdersV4StocktakeInput): string {
  return createHash('sha256').update(JSON.stringify({
    stocktakeDate: input.stocktakeDate,
    locationId: input.locationId,
    notes: input.notes?.trim() || null,
    lines: input.lines.map((line) => ({ itemId: line.itemId, physicalQuantity: String(line.physicalQuantity) })),
  })).digest('hex');
}

@Injectable()
export class OrdersV4InventoryService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async balances(companyId: string) {
    const [entries, items, locations] = await Promise.all([
      this.prisma.ordersV4InventoryLedgerEntry.findMany({
        where: { companyId },
        include: { item: { include: { inventoryUnit: true, category: true } }, location: true },
        orderBy: { sequence: 'desc' },
      }),
      this.prisma.ordersV4Item.findMany({
        where: { companyId, isActive: true, trackInventory: true },
        include: { inventoryUnit: true, category: true },
        orderBy: { nameAr: 'asc' },
      }),
      this.prisma.ordersV4Location.findMany({ where: { companyId, isActive: true }, orderBy: { nameAr: 'asc' } }),
    ]);
    const latest = new Map<string, (typeof entries)[number]>();
    for (const entry of entries) {
      const key = `${entry.itemId}:${entry.locationId}`;
      if (!latest.has(key)) latest.set(key, entry);
    }
    const rows = [...latest.values()].map((entry) => ({
      itemId: entry.itemId,
      itemName: entry.item.nameAr,
      categoryName: entry.item.category?.nameAr ?? '',
      unitCode: entry.item.inventoryUnit.code,
      unitName: entry.item.inventoryUnit.nameAr,
      locationId: entry.locationId,
      locationName: entry.location.nameAr,
      quantity: entry.quantityAfter,
      value: entry.valueAfter,
      averageUnitCost: entry.averageUnitCostAfter,
      lastSequence: entry.sequence.toString(),
      updatedAt: entry.createdAt,
    }));
    for (const location of locations) {
      for (const item of items) {
        if (rows.some((row) => row.itemId === item.id && row.locationId === location.id)) continue;
        rows.push({
          itemId: item.id,
          itemName: item.nameAr,
          categoryName: item.category?.nameAr ?? '',
          unitCode: item.inventoryUnit.code,
          unitName: item.inventoryUnit.nameAr,
          locationId: location.id,
          locationName: location.nameAr,
          quantity: new Prisma.Decimal(0),
          value: new Prisma.Decimal(0),
          averageUnitCost: new Prisma.Decimal(0),
          lastSequence: '0',
          updatedAt: item.updatedAt,
        });
      }
    }
    return rows.sort((a, b) => a.itemName.localeCompare(b.itemName, 'ar'));
  }

  async ledger(companyId: string, itemId?: string, locationId?: string) {
    const entries = await this.prisma.ordersV4InventoryLedgerEntry.findMany({
      where: { companyId, itemId: itemId || undefined, locationId: locationId || undefined },
      include: { item: { include: { inventoryUnit: true } }, location: true },
      orderBy: { sequence: 'desc' },
      take: 1000,
    });
    return entries.map((entry) => ({ ...entry, sequence: entry.sequence.toString() }));
  }

  async listStocktakes(companyId: string) {
    return this.prisma.ordersV4Stocktake.findMany({
      where: { companyId },
      include: { location: true, lines: { include: { item: true, unit: true } } },
      orderBy: [{ stocktakeDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createStocktake(companyId: string, input: OrdersV4StocktakeInput) {
    if (!input.idempotencyKey?.trim()) throw new BadRequestException('مفتاح منع التكرار مطلوب');
    if (!input.lines?.length) throw new BadRequestException('الجرد لا يحتوي على أصناف');
    const tenantId = TenantContext.getTenantId();
    const date = stocktakeDate(input.stocktakeDate);
    const inputRequestHash = stocktakeRequestHash(input);
    return this.prisma.withTenant(async (tx) => {
      const duplicate = await tx.ordersV4Stocktake.findFirst({
        where: { companyId, idempotencyKey: input.idempotencyKey.trim() },
        include: { location: true, lines: { include: { item: true, unit: true } } },
      });
      if (duplicate) {
        if (duplicate.requestHash !== inputRequestHash) throw new BadRequestException('مفتاح منع التكرار مستخدم لجرد مختلف');
        return duplicate;
      }
      const location = await tx.ordersV4Location.findFirst({ where: { id: input.locationId, companyId, isActive: true } });
      if (!location) throw new BadRequestException('موقع الجرد غير موجود');
      const itemIds = [...new Set(input.lines.map((line) => line.itemId))];
      if (itemIds.length !== input.lines.length) throw new BadRequestException('لا يمكن تكرار الصنف في الجرد');
      const items = await tx.ordersV4Item.findMany({ where: { companyId, id: { in: itemIds }, isActive: true, trackInventory: true } });
      if (items.length !== itemIds.length) throw new BadRequestException('أحد أصناف الجرد غير صالح');
      for (const itemId of [...itemIds].sort()) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:ledger:${companyId}:${itemId}:${location.id}`}))`;
      }
      const stocktake = await tx.ordersV4Stocktake.create({
        data: {
          tenantId, companyId,
          stocktakeNumber: `STK4-${date.toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`,
          stocktakeDate: date, locationId: location.id, status: 'posted',
          notes: input.notes?.trim() || null, idempotencyKey: input.idempotencyKey.trim(),
          requestHash: inputRequestHash,
          createdByUserId: TenantContext.getUserId(),
        },
      });
      for (const line of [...input.lines].sort((a, b) => a.itemId.localeCompare(b.itemId))) {
        const item = items.find((row) => row.id === line.itemId);
        if (!item) throw new BadRequestException('صنف الجرد غير موجود');
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:ledger:${companyId}:${item.id}:${location.id}`}))`;
        const latest = await tx.ordersV4InventoryLedgerEntry.findFirst({
          where: { companyId, itemId: item.id, locationId: location.id }, orderBy: { sequence: 'desc' },
        });
        const balance: OrdersV4InventoryBalance = {
          quantity: latest?.quantityAfter ?? new Prisma.Decimal(0),
          value: latest?.valueAfter ?? new Prisma.Decimal(0),
          averageUnitCost: latest?.averageUnitCostAfter ?? new Prisma.Decimal(0),
        };
        const calculation = calculateOrdersV4StocktakeAdjustment(balance, line.physicalQuantity);
        const createdLine = await tx.ordersV4StocktakeLine.create({
          data: {
            tenantId, companyId, stocktakeId: stocktake.id, itemId: item.id, unitId: item.inventoryUnitId,
            expectedQuantity: balance.quantity, physicalQuantity: calculation.quantityAfter,
            varianceQuantity: calculation.quantityDelta, unitCost: calculation.unitCost,
            varianceValue: calculation.valueDelta,
          },
        });
        if (!calculation.quantityDelta.isZero()) {
          await tx.ordersV4InventoryLedgerEntry.create({
            data: {
              tenantId, companyId, itemId: item.id, locationId: location.id,
              effectiveAt: date, entryType: 'stocktake_adjustment', ...calculation,
              sourceType: 'stocktake', sourceId: stocktake.id,
              sourceKey: `stocktake:${stocktake.id}:line:${createdLine.id}`,
              sourceSnapshot: { kernelVersion: 4, stocktakeNumber: stocktake.stocktakeNumber, stocktakeLineId: createdLine.id },
              createdByUserId: TenantContext.getUserId(),
            },
          });
        }
      }
      return tx.ordersV4Stocktake.findUniqueOrThrow({
        where: { id: stocktake.id }, include: { location: true, lines: { include: { item: true, unit: true } } },
      });
    });
  }

  async dataQuality(companyId: string) {
    const items = await this.prisma.ordersV4Item.findMany({
      where: { companyId, isActive: true },
      include: {
        inventoryUnit: true,
        conversionVersions: { where: { status: 'published' }, take: 1 },
        recipeVersions: { where: { status: 'published' }, take: 1 },
        sections: true,
      },
    });
    const issues = items.flatMap((item) => {
      const rows: Array<{ code: string; severity: 'warning' | 'error'; itemId: string; itemName: string; message: string }> = [];
      if (!item.inventoryUnit.isActive) {
        rows.push({ code: 'INACTIVE_BASE_UNIT', severity: 'error', itemId: item.id, itemName: item.nameAr, message: 'وحدة أساس الصنف معطلة' });
      }
      if (item.itemType === 'sale' && item.trackInventory && !item.recipeVersions.length) {
        rows.push({ code: 'MISSING_RECIPE', severity: 'warning', itemId: item.id, itemName: item.nameAr, message: 'صنف البيع لا يملك وصفة منشورة وسيُصرف من رصيده مباشرة' });
      }
      if (!item.sections.length) {
        rows.push({ code: 'MISSING_SECTION', severity: 'warning', itemId: item.id, itemName: item.nameAr, message: 'الصنف غير مرتبط بقسم' });
      }
      return rows;
    });
    return {
      kernelVersion: 4,
      itemCount: items.length,
      errorCount: issues.filter((issue) => issue.severity === 'error').length,
      warningCount: issues.filter((issue) => issue.severity === 'warning').length,
      ready: !issues.some((issue) => issue.severity === 'error'),
      issues,
    };
  }
}

