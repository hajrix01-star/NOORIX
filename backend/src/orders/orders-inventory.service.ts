import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { saudiDateYmd } from '../hr/utils/hr-saudi-dates.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CreateInventoryStocktakeDto } from './dto/create-inventory-stocktake.dto';
import { aggregateRecipeInventoryStock } from './orders-items-report-aggregate.util';
import {
  assertCurrentSaudiStocktakeDate,
  calculateStocktakeLines,
  InventoryStocktakeValidationError,
} from './orders-inventory-stocktake.util';

type InventoryClient = Pick<
  TenantPrismaService,
  'orderProduct' | 'orderItem' | 'staffOrderItem' | 'inventoryMovement'
>;

@Injectable()
export class OrdersInventoryService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async getStock(companyId: string) {
    return this.projectStock(this.prisma, companyId);
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
          const lockKey = `inventory-stocktake:${tenantId}:${companyId}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

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

  private async projectStock(client: InventoryClient, companyId: string, throughDate?: Date) {
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

    const [materialProducts, purchases, sales, adjustments] = await Promise.all([
      client.orderProduct.findMany({
        where: { companyId, productType: 'order' },
        select: productSelect,
      }),
      client.orderItem.findMany({
        where: {
          order: {
            companyId,
            status: 'active',
            ...(throughDate ? { orderDate: { lte: throughDate } } : {}),
          },
        },
        select: {
          productId: true,
          quantity: true,
          unit: true,
          quantityMultiplier: true,
          inventoryBaseQuantitySnapshot: true,
          product: { select: productSelect },
        },
      }),
      client.staffOrderItem.findMany({
        where: {
          staffOrder: {
            companyId,
            orderType: 'sale',
            status: 'sent',
            ...(throughDate ? {
              OR: [
                { saleDate: { lte: throughDate } },
                { saleDate: null, createdAt: { lte: throughDate } },
              ],
            } : {}),
          },
        },
        select: {
          productId: true,
          quantity: true,
          unit: true,
          quantityMultiplier: true,
          inventoryConsumptionSnapshot: true,
          product: { select: productSelect },
        },
      }),
      client.inventoryMovement.groupBy({
        by: ['productId'],
        where: {
          companyId,
          ...(throughDate ? { transactionDate: { lte: throughDate } } : {}),
        },
        _sum: { quantityBase: true },
      }),
    ]);

    return aggregateRecipeInventoryStock({
      materialProducts,
      purchases,
      sales,
      adjustments: adjustments.map((adjustment) => ({
        productId: adjustment.productId,
        quantityBase: adjustment._sum.quantityBase ?? 0,
      })),
    });
  }
}
