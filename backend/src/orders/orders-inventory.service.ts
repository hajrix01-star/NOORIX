import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { saudiDateYmd } from '../hr/utils/hr-saudi-dates.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CreateInventoryStocktakeDto } from './dto/create-inventory-stocktake.dto';
import { aggregateRecipeInventoryStock } from './orders-items-report-aggregate.util';
import { inventoryConsumptionSnapshotValidity } from './orders-inventory-snapshot.sql';
import {
  assertCurrentSaudiStocktakeDate,
  calculateStocktakeLines,
  InventoryStocktakeValidationError,
} from './orders-inventory-stocktake.util';
import {
  findNegativeInventoryShortages,
  NegativeInventoryShortage,
} from './orders-negative-inventory.util';

type InventoryClient = Pick<
  TenantPrismaService,
  'orderProduct' | 'inventoryMovement' | '$queryRaw'
>;

type InventoryLockClient = Pick<TenantPrismaService, '$executeRaw'>;

type AggregatedInventoryQuantity = {
  productId: string;
  quantityBase: Prisma.Decimal | null;
};

type AggregatedLegacyInventoryQuantity = {
  productId: string;
  quantity: Prisma.Decimal;
  unit: string | null;
  quantityMultiplier: Prisma.Decimal | null;
};

type AggregatedInventoryConsumption = {
  productId: string | null;
  quantityBase: Prisma.Decimal | null;
  invalidCount: number;
};

@Injectable()
export class OrdersInventoryService {
  private readonly logger = new Logger(OrdersInventoryService.name);

  constructor(private readonly prisma: TenantPrismaService) {}

  async lockInventoryBalance(
    client: InventoryLockClient,
    tenantId: string,
    companyId: string,
  ): Promise<void> {
    const lockKey = `inventory-balance:${tenantId}:${companyId}`;
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  }

  async findStaffSaleNegativeInventory(
    client: InventoryClient,
    companyId: string,
    consumptionSnapshots: readonly unknown[],
    excludeStaffOrderId?: string,
  ): Promise<NegativeInventoryShortage[]> {
    const stock = await this.projectStock(client, companyId, { excludeStaffOrderId });
    return findNegativeInventoryShortages(stock, consumptionSnapshots);
  }

  async getStock(companyId: string) {
    return this.prisma.withTenant((tx) => this.projectStock(tx, companyId));
  }

  async listStocktakes(companyId: string) {
    return this.prisma.inventoryStocktake.findMany({
      where: { companyId },
      include: {
        createdBy: { select: { id: true, nameAr: true, nameEn: true, email: true } },
        lines: {
          include: { product: { select: { id: true, nameAr: true, nameEn: true } } },
          orderBy: { product: { nameAr: 'asc' } },
        },
      },
      orderBy: [{ stocktakeDate: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async createStocktake(companyId: string, userId: string, dto: CreateInventoryStocktakeDto) {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) throw new BadRequestException('تعذر تحديد المنشأة الحالية.');
    let stocktakeDateYmd: string;
    try {
      stocktakeDateYmd = assertCurrentSaudiStocktakeDate(dto.stocktakeDate, saudiDateYmd());
    } catch (error) {
      this.rethrowStocktakeError(error);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
        TenantContext.setSkipSetConfigForTransaction(true);
        try {
          await this.lockInventoryBalance(tx, tenantId, companyId);

          const company = await tx.company.findFirst({
            where: { id: companyId, tenantId },
            select: { id: true },
          });
          if (!company) throw new NotFoundException('الشركة غير موجودة.');

          const stocktakeDate = new Date(`${stocktakeDateYmd}T00:00:00.000Z`);
          const existingLines = await tx.inventoryStocktakeLine.findMany({
            where: {
              companyId,
              stocktakeDate,
              productId: { in: dto.lines.map((line) => line.productId.trim()) },
            },
            select: { productId: true },
          });
          if (existingLines.length > 0) {
            throw new ConflictException('تم اعتماد جرد سابق اليوم لصنف واحد أو أكثر من الأصناف المحددة.');
          }

          const requestedProductIds = dto.lines.map((line) => String(line.productId ?? '').trim());
          if (new Set(requestedProductIds).size !== requestedProductIds.length) {
            throw new BadRequestException('لا يمكن تكرار الصنف في الجرد نفسه.');
          }
          const products = await tx.orderProduct.findMany({
            where: { companyId, productType: 'order', id: { in: requestedProductIds } },
            select: { id: true, unit: true },
          });
          if (products.length !== requestedProductIds.length) {
            throw new BadRequestException('يتضمن الجرد صنفاً غير موجود أو غير مخزني.');
          }

          const currentStock = await this.projectStock(tx, companyId);
          const stockByProductId = new Map(currentStock.map((row) => [row.productId, row]));
          const unitByProductId = new Map(products.map((product) => [product.id, product.unit || 'piece']));
          const calculatedLines = calculateStocktakeLines(dto.lines.map((line) => {
            const productId = line.productId.trim();
            const stock = stockByProductId.get(productId);
            return {
              productId,
              unit: unitByProductId.get(productId) ?? 'piece',
              expectedQuantity: stock?.balanceBaseQuantity ?? '0',
              physicalQuantity: line.physicalQuantity,
            };
          }));

          const stocktake = await tx.inventoryStocktake.create({
            data: {
              tenantId,
              companyId,
              stocktakeDate,
              status: 'approved',
              notes: dto.notes?.trim() || null,
              createdByUserId: userId,
              lines: {
                create: calculatedLines.map((line) => ({
                  tenantId,
                  companyId,
                  stocktakeDate,
                  productId: line.productId,
                  unit: line.unit,
                  expectedQuantity: line.expectedQuantity,
                  physicalQuantity: line.physicalQuantity,
                  varianceQuantity: line.varianceQuantity,
                })),
              },
            },
            include: {
              createdBy: { select: { id: true, nameAr: true, nameEn: true, email: true } },
              lines: {
                include: { product: { select: { id: true, nameAr: true, nameEn: true } } },
              },
            },
          });

          const movements = calculatedLines
            .filter((line) => !line.varianceQuantity.isZero())
            .map((line) => ({
              tenantId,
              companyId,
              productId: line.productId,
              transactionDate: stocktakeDate,
              movementType: 'stocktake_adjustment',
              quantityBase: line.varianceQuantity,
              stocktakeId: stocktake.id,
              sourceKey: `inventory-stocktake:${stocktake.id}:${line.productId}`,
              notes: dto.notes?.trim() || null,
              createdByUserId: userId,
            }));

          if (movements.length > 0) {
            await tx.inventoryMovement.createMany({ data: movements });
          }
          return stocktake;
        } finally {
          TenantContext.setSkipSetConfigForTransaction(false);
        }
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: TenantPrismaService.TX_TIMEOUT_MS,
        maxWait: 10_000,
      });
    } catch (error) {
      this.rethrowStocktakeError(error);
    }
  }

  private rethrowStocktakeError(error: unknown): never {
    if (error instanceof HttpException) throw error;
    if (error instanceof InventoryStocktakeValidationError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('تم اعتماد جرد سابق اليوم لصنف واحد أو أكثر من الأصناف المحددة.');
      }
      if (error.code === 'P2034') {
        throw new ConflictException('تغيرت بيانات المخزون أثناء الجرد؛ أعد المحاولة.');
      }
      if (error.code === 'P2003' || error.code === 'P2004') {
        throw new BadRequestException('بيانات الجرد تخالف قيود المخزون أو الشركة.');
      }
    }
    throw error;
  }

  private async projectStock(
    client: InventoryClient,
    companyId: string,
    options: { throughDate?: Date; excludeStaffOrderId?: string } = {},
  ) {
    const productSelect = {
      id: true,
      nameAr: true,
      nameEn: true,
      productType: true,
      sections: true,
      sectionIds: true,
      unit: true,
      inventoryConversions: true,
      conversionTemplate: { select: { conversions: true } },
      recipe: true,
    } satisfies Prisma.OrderProductSelect;

    const purchaseDateFilter = options.throughDate
      ? Prisma.sql`AND o."order_date" <= ${options.throughDate}`
      : Prisma.empty;
    const saleDateFilter = options.throughDate
      ? Prisma.sql`AND (
          so."sale_date" <= ${options.throughDate}
          OR (so."sale_date" IS NULL AND so."created_at" <= ${options.throughDate})
        )`
      : Prisma.empty;
    const excludedStaffOrderFilter = options.excludeStaffOrderId
      ? Prisma.sql`AND so."id" <> ${options.excludeStaffOrderId}`
      : Prisma.empty;

    const [
      materialProducts,
      aggregatedPurchases,
      legacyPurchases,
      aggregatedConsumption,
      legacySales,
      adjustments,
    ] = await Promise.all([
      client.orderProduct.findMany({
        where: { companyId, productType: 'order' },
        select: productSelect,
      }),
      client.$queryRaw<AggregatedInventoryQuantity[]>(Prisma.sql`
        SELECT
          oi."product_id" AS "productId",
          SUM(oi."inventory_base_quantity_snapshot") AS "quantityBase"
        FROM "order_items" oi
        INNER JOIN "orders" o ON o."id" = oi."order_id"
        WHERE o."company_id" = ${companyId}
          AND o."status" = 'active'
          AND oi."inventory_base_quantity_snapshot" IS NOT NULL
          ${purchaseDateFilter}
        GROUP BY oi."product_id"
      `),
      client.$queryRaw<AggregatedLegacyInventoryQuantity[]>(Prisma.sql`
        SELECT
          oi."product_id" AS "productId",
          SUM(oi."quantity") AS "quantity",
          oi."unit" AS "unit",
          oi."quantity_multiplier" AS "quantityMultiplier"
        FROM "order_items" oi
        INNER JOIN "orders" o ON o."id" = oi."order_id"
        WHERE o."company_id" = ${companyId}
          AND o."status" = 'active'
          AND oi."inventory_base_quantity_snapshot" IS NULL
          ${purchaseDateFilter}
        GROUP BY oi."product_id", oi."unit", oi."quantity_multiplier"
      `),
      client.$queryRaw<AggregatedInventoryConsumption[]>(Prisma.sql`
        WITH scoped_snapshots AS MATERIALIZED (
          SELECT soi."inventory_consumption_snapshot" AS snapshot
          FROM "staff_order_items" soi
          INNER JOIN "staff_orders" so ON so."id" = soi."staff_order_id"
          WHERE so."company_id" = ${companyId}
            AND so."order_type" = 'sale'
            AND so."status" = 'sent'
            AND soi."inventory_consumption_snapshot" IS NOT NULL
            ${excludedStaffOrderFilter}
            ${saleDateFilter}
        ), classified_snapshots AS MATERIALIZED (
          SELECT
            snapshot,
            ${inventoryConsumptionSnapshotValidity(Prisma.sql`snapshot`)} AS "isValid"
          FROM scoped_snapshots
        ), valid_consumption AS (
          SELECT
            component->>'materialProductId' AS "productId",
            SUM((component->>'quantityBase')::numeric) AS "quantityBase"
          FROM classified_snapshots
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN "isValid" THEN snapshot->'components' ELSE '[]'::jsonb END
          ) AS component
          WHERE "isValid"
          GROUP BY component->>'materialProductId'
        )
        SELECT
          "productId",
          "quantityBase",
          0::int AS "invalidCount"
        FROM valid_consumption
        UNION ALL
        SELECT
          NULL AS "productId",
          NULL AS "quantityBase",
          COUNT(*)::int AS "invalidCount"
        FROM classified_snapshots
        WHERE NOT "isValid"
      `),
      client.$queryRaw<AggregatedLegacyInventoryQuantity[]>(Prisma.sql`
        WITH classified_sales AS MATERIALIZED (
          SELECT
            soi."product_id" AS "productId",
            soi."quantity" AS "quantity",
            soi."unit" AS "unit",
            soi."quantity_multiplier" AS "quantityMultiplier",
            soi."inventory_consumption_snapshot" AS snapshot,
            ${inventoryConsumptionSnapshotValidity(
              Prisma.sql`soi."inventory_consumption_snapshot"`,
            )} AS "isValidSnapshot"
          FROM "staff_order_items" soi
          INNER JOIN "staff_orders" so ON so."id" = soi."staff_order_id"
          WHERE so."company_id" = ${companyId}
            AND so."order_type" = 'sale'
            AND so."status" = 'sent'
            ${excludedStaffOrderFilter}
            ${saleDateFilter}
        )
        SELECT
          "productId",
          SUM("quantity") AS "quantity",
          "unit",
          "quantityMultiplier"
        FROM classified_sales
        WHERE NOT "isValidSnapshot"
        GROUP BY "productId", "unit", "quantityMultiplier"
      `),
      client.inventoryMovement.groupBy({
        by: ['productId'],
        where: {
          companyId,
          ...(options.throughDate ? { transactionDate: { lte: options.throughDate } } : {}),
        },
        _sum: { quantityBase: true },
      }),
    ]);

    const estimatedSnapshotCount = aggregatedConsumption.reduce(
      (total, row) => total + Math.max(0, Number(row.invalidCount) || 0),
      0,
    );
    if (estimatedSnapshotCount > 0) {
      this.logger.warn(
        `Inventory projection estimated ${estimatedSnapshotCount} historical sale item(s) from the current recipe for company ${companyId}.`,
      );
    }

    const materialById = new Map(materialProducts.map((product) => [product.id, product]));
    const purchases = legacyPurchases.flatMap((purchase) => {
      const product = materialById.get(purchase.productId);
      return product ? [{ ...purchase, product }] : [];
    });
    const soldProductIds = Array.from(new Set(legacySales.map((sale) => sale.productId)));
    const soldProducts = soldProductIds.length > 0
      ? await client.orderProduct.findMany({
          where: { companyId, productType: 'sale', id: { in: soldProductIds } },
          select: productSelect,
        })
      : [];
    const soldProductById = new Map(soldProducts.map((product) => [product.id, product]));
    const sales = legacySales.flatMap((sale) => {
      const product = soldProductById.get(sale.productId);
      return product ? [{ ...sale, product }] : [];
    });

    return aggregateRecipeInventoryStock({
      materialProducts,
      purchases,
      sales,
      aggregatedPurchases: aggregatedPurchases.map((purchase) => ({
        productId: purchase.productId,
        quantityBase: purchase.quantityBase ?? 0,
      })),
      aggregatedConsumption: aggregatedConsumption.flatMap((consumption) => (
        consumption.productId
          ? [{
              productId: consumption.productId,
              quantityBase: consumption.quantityBase ?? 0,
            }]
          : []
      )),
      adjustments: adjustments.map((adjustment) => ({
        productId: adjustment.productId,
        quantityBase: adjustment._sum.quantityBase ?? 0,
      })),
    });
  }
}
