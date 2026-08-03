import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { OrdersV4StocktakeInput } from './orders-v4.contracts';
import { ordersV4DateOnly } from './orders-v4-date.util';
import { OrdersV4LedgerPostingService } from './orders-v4-ledger-posting.service';
import { loadOrdersV4UserIdentities, ordersV4UserIdentity } from './orders-v4-user-identity.util';
import { calculateOrdersV4ConvertedQuantity, calculateOrdersV4ConvertedUnitPrice } from './orders-v4-calculation.kernel';
import { ordersV4EdgeDefinitions, ordersV4UnitDefinitions, resolveOrdersV4ContextConversion } from './orders-v4-conversion.context';

function stocktakeRequestHash(input: OrdersV4StocktakeInput): string {
  return createHash('sha256').update(JSON.stringify({
    stocktakeDate: input.stocktakeDate,
    locationId: input.locationId,
    notes: input.notes?.trim() || null,
    lines: [...input.lines]
      .sort((left, right) => left.itemId.localeCompare(right.itemId))
      .map((line) => ({
        itemId: line.itemId,
        physicalQuantity: line.physicalQuantity == null ? null : String(line.physicalQuantity),
        physicalUnits: [...(line.physicalUnits ?? [])]
          .sort((left, right) => left.unitId.localeCompare(right.unitId))
          .map((row) => ({ unitId: row.unitId, quantity: String(row.quantity) })),
      })),
  })).digest('hex');
}

@Injectable()
export class OrdersV4InventoryService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly posting: OrdersV4LedgerPostingService,
  ) {}

  async balances(companyId: string) {
    const latestIds = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT DISTINCT ON (item_id, location_id) id
      FROM orders_v4_inventory_ledger
      WHERE company_id = ${companyId}
      ORDER BY item_id, location_id, sequence DESC
    `);
    const [entries, items, locations, units] = await Promise.all([
      this.prisma.ordersV4InventoryLedgerEntry.findMany({
        where: { companyId, id: { in: latestIds.map((row) => row.id) } },
        include: {
          inventoryUnit: true,
          item: {
            include: {
              inventoryUnit: true,
              category: true,
              conversionVersions: {
                where: { status: 'published' }, orderBy: { version: 'desc' }, take: 1,
                include: { edges: true },
              },
            },
          },
          location: true,
        },
        orderBy: { sequence: 'desc' },
      }),
      this.prisma.ordersV4Item.findMany({
        where: { companyId, isActive: true, trackInventory: true },
        include: { inventoryUnit: true, kernelUnit: true, category: true },
        orderBy: { nameAr: 'asc' },
      }),
      this.prisma.ordersV4Location.findMany({ where: { companyId, isActive: true }, orderBy: { nameAr: 'asc' } }),
      this.prisma.ordersV4Unit.findMany({ where: { companyId } }),
    ]);
    const unitDefinitions = ordersV4UnitDefinitions(units);
    const latest = new Map<string, (typeof entries)[number]>();
    for (const entry of entries) {
      const key = `${entry.itemId}:${entry.locationId}`;
      if (!latest.has(key)) latest.set(key, entry);
    }
    const rows = [...latest.values()].map((entry) => {
      const conversion = resolveOrdersV4ContextConversion({
        fromUnitId: entry.inventoryUnitId,
        toUnitId: entry.item.inventoryUnitId,
        units: unitDefinitions,
        edges: ordersV4EdgeDefinitions(entry.item.conversionVersions[0]?.edges),
      });
      const displayQuantity = calculateOrdersV4ConvertedQuantity(entry.quantityAfter.abs(), conversion)
        .times(entry.quantityAfter.isNegative() ? -1 : 1)
        .toDecimalPlaces(8);
      return {
      itemId: entry.itemId,
      itemName: entry.item.nameAr,
      categoryName: entry.item.category?.nameAr ?? '',
      unitCode: entry.item.inventoryUnit.code,
      unitName: entry.item.inventoryUnit.nameAr,
      locationId: entry.locationId,
      locationName: entry.location.nameAr,
      quantity: displayQuantity,
      value: entry.valueAfter,
      averageUnitCost: calculateOrdersV4ConvertedUnitPrice(entry.averageUnitCostAfter, conversion),
      lastSequence: entry.sequence.toString(),
      updatedAt: entry.createdAt,
      createdByUserId: entry.createdByUserId,
      kernelQuantity: entry.quantityAfter,
      kernelUnitCode: entry.inventoryUnit.code,
      };
    });
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
          kernelQuantity: new Prisma.Decimal(0),
          kernelUnitCode: item.kernelUnit.code,
          lastSequence: '0',
          updatedAt: item.updatedAt,
          createdByUserId: null,
        });
      }
    }
    const identities = await loadOrdersV4UserIdentities(this.prisma, rows.map((row) => row.createdByUserId));
    return rows.map(({ createdByUserId, ...row }) => ({
      ...row,
      createdByUser: ordersV4UserIdentity(identities, createdByUserId),
    })).sort((a, b) => a.itemName.localeCompare(b.itemName, 'ar'));
  }

  async ledger(companyId: string, itemId?: string, locationId?: string, limit = 250) {
    const entries = await this.prisma.ordersV4InventoryLedgerEntry.findMany({
      where: { companyId, itemId: itemId || undefined, locationId: locationId || undefined },
      include: { inventoryUnit: true, item: { include: { inventoryUnit: true } }, location: true },
      orderBy: { sequence: 'desc' },
      take: Math.max(1, Math.min(500, limit)),
    });
    const identities = await loadOrdersV4UserIdentities(this.prisma, entries.map((entry) => entry.createdByUserId));
    return entries.map((entry) => ({
      ...entry,
      sequence: entry.sequence.toString(),
      createdByUser: ordersV4UserIdentity(identities, entry.createdByUserId),
    }));
  }

  async listStocktakes(companyId: string, limit = 100) {
    const stocktakes = await this.prisma.ordersV4Stocktake.findMany({
      where: { companyId },
      include: { location: true, lines: { include: { item: true, unit: true } } },
      orderBy: [{ stocktakeDate: 'desc' }, { createdAt: 'desc' }],
      take: Math.max(1, Math.min(500, limit)),
    });
    const identities = await loadOrdersV4UserIdentities(this.prisma, stocktakes.map((stocktake) => stocktake.createdByUserId));
    return stocktakes.map((stocktake) => ({
      ...stocktake,
      createdByUser: ordersV4UserIdentity(identities, stocktake.createdByUserId),
    }));
  }

  async createStocktake(companyId: string, input: OrdersV4StocktakeInput) {
    if (!input.idempotencyKey?.trim()) throw new BadRequestException('مفتاح منع التكرار مطلوب');
    if (!input.lines?.length) throw new BadRequestException('الجرد لا يحتوي على أصناف');
    const tenantId = TenantContext.getTenantId();
    const date = ordersV4DateOnly(input.stocktakeDate, 'تاريخ الجرد');
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
      const [items, companyUnits] = await Promise.all([
        tx.ordersV4Item.findMany({
          where: { companyId, id: { in: itemIds }, isActive: true, trackInventory: true },
          include: {
            units: { where: { isActive: true } },
            conversionVersions: {
              where: { status: 'published' }, orderBy: { version: 'desc' }, take: 1,
              include: { edges: true },
            },
          },
        }),
        tx.ordersV4Unit.findMany({ where: { companyId } }),
      ]);
      if (items.length !== itemIds.length) throw new BadRequestException('أحد أصناف الجرد غير صالح');
      const unitDefinitions = ordersV4UnitDefinitions(companyUnits);
      await this.posting.lockKeys(tx, companyId, itemIds.map((itemId) => ({ itemId, locationId: location.id })));
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
        const physicalInputs = line.physicalUnits?.length
          ? line.physicalUnits
          : line.physicalQuantity == null
            ? []
            : [{ unitId: item.inventoryUnitId, quantity: line.physicalQuantity }];
        if (!physicalInputs.length) throw new BadRequestException('يجب إدخال كمية الجرد لكل صنف');
        if (new Set(physicalInputs.map((row) => row.unitId)).size !== physicalInputs.length) {
          throw new BadRequestException('لا يمكن تكرار الوحدة في جرد الصنف');
        }
        const allowedUnitIds = new Set([
          item.inventoryUnitId,
          item.kernelUnitId,
          ...item.units.map((row) => row.unitId),
        ]);
        const physicalKernelQuantity = physicalInputs.reduce((total, physical) => {
          if (!allowedUnitIds.has(physical.unitId)) {
            throw new BadRequestException('إحدى وحدات الجرد غير مرتبطة بالصنف');
          }
          const converted = calculateOrdersV4ConvertedQuantity(
            physical.quantity,
            resolveOrdersV4ContextConversion({
              fromUnitId: physical.unitId,
              toUnitId: item.kernelUnitId,
              units: unitDefinitions,
              edges: ordersV4EdgeDefinitions(item.conversionVersions[0]?.edges),
            }),
          );
          return total.plus(converted);
        }, new Prisma.Decimal(0)).toDecimalPlaces(8);
        await this.posting.postStocktakeAdjustment(tx, {
          tenantId, companyId, itemId: item.id, inventoryUnitId: item.kernelUnitId, locationId: location.id,
          stocktakeId: stocktake.id, effectiveAt: date, physicalQuantity: physicalKernelQuantity,
          stocktakeNumber: stocktake.stocktakeNumber,
        });
      }
      return tx.ordersV4Stocktake.findUniqueOrThrow({
        where: { id: stocktake.id }, include: { location: true, lines: { include: { item: true, unit: true } } },
      });
    });
  }

  async dataQuality(companyId: string) {
    const [items, units, ledgerAudit, custodyAudit, documentAudit] = await Promise.all([
      this.prisma.ordersV4Item.findMany({
        where: { companyId, isActive: true },
        include: {
          inventoryUnit: true,
          kernelUnit: true,
          units: true,
          conversionVersions: {
            where: { status: 'published' }, orderBy: { version: 'desc' }, take: 1,
            include: { edges: true },
          },
          recipeVersions: {
            where: { status: 'published' }, orderBy: { version: 'desc' }, take: 1,
            include: { lines: { include: { componentItem: true } } },
          },
          sections: true,
        },
      }),
      this.prisma.ordersV4Unit.findMany({ where: { companyId } }),
      this.prisma.$queryRaw<Array<{ invalid_count: bigint }>>(Prisma.sql`
        WITH ordered AS (
          SELECT item_id, inventory_unit_id, quantity_delta, value_delta, quantity_after, value_after, average_unit_cost_after,
                 LAG(quantity_after) OVER (PARTITION BY item_id, location_id ORDER BY sequence) AS previous_quantity,
                 LAG(value_after) OVER (PARTITION BY item_id, location_id ORDER BY sequence) AS previous_value
          FROM orders_v4_inventory_ledger WHERE company_id = ${companyId}
        )
        SELECT COUNT(*)::bigint AS invalid_count FROM ordered
        WHERE ABS(quantity_after - (COALESCE(previous_quantity, 0) + quantity_delta)) > 0.00000001
           OR ABS(value_after - (COALESCE(previous_value, 0) + value_delta)) > 0.000001
           OR average_unit_cost_after < 0
           OR EXISTS (
             SELECT 1 FROM orders_v4_items AS item
             WHERE item.id = ordered.item_id AND item.kernel_unit_id <> ordered.inventory_unit_id
           )
      `),
      this.prisma.$queryRaw<Array<{ invalid_count: bigint }>>(Prisma.sql`
        WITH ordered AS (
          SELECT amount_delta, balance_after,
                 LAG(balance_after) OVER (ORDER BY sequence) AS previous_balance
          FROM orders_v4_custody_ledger WHERE company_id = ${companyId}
        )
        SELECT COUNT(*)::bigint AS invalid_count FROM ordered
        WHERE ABS(balance_after - (COALESCE(previous_balance, 0) + amount_delta)) > 0.000001
      `),
      this.prisma.$queryRaw<Array<{ invalid_count: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS invalid_count
        FROM orders_v4_documents AS document
        WHERE document.company_id = ${companyId} AND document.status = 'received'
          AND ABS(document.operational_cost - COALESCE((
            SELECT SUM(line.operational_cost) FROM orders_v4_document_lines AS line
            WHERE line.document_id = document.id
          ), 0)) > 0.000001
      `),
    ]);
    const componentIds = [...new Set(items.flatMap((item) => item.recipeVersions.flatMap((recipe) => recipe.lines.map((line) => line.componentItemId))))];
    const pricedComponents = componentIds.length
      ? new Set((await this.prisma.ordersV4PriceHistory.findMany({
          where: { companyId, itemId: { in: componentIds }, document: { status: 'received' } },
          distinct: ['itemId'], select: { itemId: true },
        })).map((row) => row.itemId))
      : new Set<string>();
    const unitDefinitions = ordersV4UnitDefinitions(units);
    const issues = items.flatMap((item) => {
      const rows: Array<{ code: string; severity: 'warning' | 'error'; itemId: string; itemName: string; message: string }> = [];
      if (!item.inventoryUnit.isActive) {
        rows.push({ code: 'INACTIVE_BASE_UNIT', severity: 'error', itemId: item.id, itemName: item.nameAr, message: 'وحدة أساس الصنف معطلة' });
      }
      if (!item.kernelUnit.isActive) {
        rows.push({ code: 'INACTIVE_KERNEL_UNIT', severity: 'error', itemId: item.id, itemName: item.nameAr, message: 'وحدة نواة الصنف معطلة' });
      }
      const definition = item.conversionVersions[0];
      for (const configuredUnit of item.units.filter((row) => row.isActive)) {
        try {
          resolveOrdersV4ContextConversion({
            fromUnitId: configuredUnit.unitId,
            toUnitId: item.kernelUnitId,
            units: unitDefinitions,
            edges: ordersV4EdgeDefinitions(definition?.edges),
          });
        } catch {
          rows.push({ code: 'DISCONNECTED_UNIT', severity: 'error', itemId: item.id, itemName: item.nameAr, message: 'إحدى وحدات الصنف غير متصلة بوحدة النواة' });
          break;
        }
      }
      if (item.itemType === 'sale' && item.trackInventory && !item.recipeVersions.length) {
        rows.push({ code: 'MISSING_RECIPE', severity: 'warning', itemId: item.id, itemName: item.nameAr, message: 'صنف البيع لا يملك وصفة منشورة وسيُصرف من رصيده مباشرة' });
      }
      for (const recipe of item.recipeVersions) {
        for (const line of recipe.lines) {
          if (line.componentItem.itemType !== 'purchased') {
            rows.push({ code: 'INVALID_RECIPE_COMPONENT', severity: 'error', itemId: item.id, itemName: item.nameAr, message: 'الرسبي يحتوي على مكوّن ليس صنف شراء' });
          } else if (!pricedComponents.has(line.componentItemId)) {
            rows.push({ code: 'MISSING_COMPONENT_PRICE', severity: 'error', itemId: item.id, itemName: item.nameAr, message: `لا توجد طلبات مستلمة لتسعير المكوّن ${line.componentItem.nameAr}` });
          }
        }
      }
      if (!item.sections.length) {
        rows.push({ code: 'MISSING_SECTION', severity: 'warning', itemId: item.id, itemName: item.nameAr, message: 'الصنف غير مرتبط بقسم' });
      }
      return rows;
    });
    const systemIssue = (code: string, message: string) => ({
      code, severity: 'error' as const, itemId: 'system', itemName: 'نواة طلبات V4', message,
    });
    if (Number(ledgerAudit[0]?.invalid_count ?? 0) > 0) issues.push(systemIssue('LEDGER_INVARIANT_FAILURE', 'يوجد عدم تطابق في تسلسل كميات أو قيم دفتر المخزون'));
    if (Number(custodyAudit[0]?.invalid_count ?? 0) > 0) issues.push(systemIssue('CUSTODY_INVARIANT_FAILURE', 'يوجد عدم تطابق في تسلسل رصيد دفتر العهدة'));
    if (Number(documentAudit[0]?.invalid_count ?? 0) > 0) issues.push(systemIssue('DOCUMENT_COST_MISMATCH', 'إجمالي تكلفة مستند لا يطابق مجموع تكلفة أسطره'));
    return {
      kernelVersion: 4,
      kernelMode: 'immutable-unit-central-ledgers',
      itemCount: items.length,
      errorCount: issues.filter((issue) => issue.severity === 'error').length,
      warningCount: issues.filter((issue) => issue.severity === 'warning').length,
      ready: !issues.some((issue) => issue.severity === 'error'),
      issues,
    };
  }
}

