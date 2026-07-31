import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { toYmd } from '../common/utils/to-ymd.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  CreateShishaPurchaseBatchDto,
  CreateShishaPurchaseDto,
  CreateShishaStocktakeDto,
  InitializeShishaInventoryDto,
} from './dto/shisha-inventory.dto';
import { parseSaleDateYmd } from './orders-staff-date.util';
import {
  calculateShishaInventory,
  type ShishaMaterialType,
  type ShishaMovementInput,
} from './shisha-inventory-calculator.util';
import {
  charcoalPieces,
  normalizeShishaText,
  purchaseQuantityBase,
  serializeShishaInventorySettings,
  shishaDecimal,
  tobaccoGrams,
} from './shisha-inventory-input.util';
import { ShishaInventorySourceService } from './shisha-inventory-source.service';

const ZERO = new Prisma.Decimal(0);
const CHARCOAL_SHISHAS_PER_PACK = 6;

@Injectable()
export class ShishaInventoryService {
  constructor(private readonly prisma: TenantPrismaService, private readonly source: ShishaInventorySourceService) {}

  private async requireSettings(companyId: string) {
    const settings = await this.prisma.shishaInventorySettings.findUnique({ where: { companyId } });
    if (!settings) {
      throw new NotFoundException('يجب تسجيل مخزون بداية الشيشة أولاً.');
    }
    return settings;
  }

  private async calculation(companyId: string, startDate: string, endDate: string) {
    const settings = await this.requireSettings(companyId);
    const end = parseSaleDateYmd(endDate);
    const [movements, sales, catalogPurchases] = await Promise.all([
      this.prisma.shishaInventoryMovement.findMany({
        where: { companyId, transactionDate: { lte: end } },
        orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
        include: { createdBy: { select: { nameAr: true, nameEn: true } } },
      }),
      this.source.saleEvents(
        companyId,
        settings.trackingStartedAt,
        end,
        settings.changeProductId,
        settings.charcoalPiecesPerPack,
        settings.charcoalPacksPerCarton,
      ),
      this.source.catalogRecipeMaterialPurchases(
        companyId,
        settings.trackingStartedAt,
        end,
        settings.charcoalPiecesPerPack,
        settings.charcoalPacksPerCarton,
      ),
    ]);
    const manualMovements = movements;
    const movementInputs: ShishaMovementInput[] = manualMovements.map((movement) => ({
      date: toYmd(movement.transactionDate),
      movementType: movement.movementType as ShishaMovementInput['movementType'],
      materialType: movement.materialType as ShishaMaterialType,
      quantityBase: movement.quantityBase,
      costInclVat: movement.costInclVat,
    }));
    movementInputs.push(...catalogPurchases.map((movement) => ({
      date: toYmd(movement.transactionDate),
      movementType: movement.movementType,
      materialType: movement.materialType,
      quantityBase: movement.quantityBase,
      costInclVat: movement.costInclVat,
    })));
    const displayStart = parseSaleDateYmd(startDate);
    const displayMovements = [...manualMovements, ...catalogPurchases]
      .filter((movement) => movement.transactionDate >= displayStart && movement.transactionDate <= end)
      .sort((left, right) =>
        right.transactionDate.getTime() - left.transactionDate.getTime()
        || right.createdAt.getTime() - left.createdAt.getTime()
      )
      .slice(0, 100);
    return {
      settings,
      displayMovements,
      calculation: calculateShishaInventory({
        trackingStartDate: toYmd(settings.trackingStartedAt),
        charcoalActualTrackingStartDate: settings.charcoalActualTrackingStartedAt
          ? toYmd(settings.charcoalActualTrackingStartedAt)
          : null,
        startDate,
        endDate,
        headsPerKg: settings.headsPerKg,
        charcoalPacksPerCarton: settings.charcoalPacksPerCarton,
        charcoalPiecesPerPack: settings.charcoalPiecesPerPack,
        charcoalShishaPerPack: CHARCOAL_SHISHAS_PER_PACK,
        movements: movementInputs,
        sales,
      }),
    };
  }

  async getSummary(companyId: string, startDate: string, endDate: string) {
    const settings = await this.prisma.shishaInventorySettings.findUnique({ where: { companyId } });
    if (!settings) {
      return { initialized: false, startDate, endDate };
    }
    const [{ calculation, displayMovements }, latestStocktake] = await Promise.all([
      this.calculation(companyId, startDate, endDate),
      this.prisma.shishaStocktake.findFirst({
        where: { companyId },
        orderBy: [{ stocktakeDate: 'desc' }, { createdAt: 'desc' }],
        include: { createdBy: { select: { nameAr: true, nameEn: true } } },
      }),
    ]);
    return {
      initialized: true,
      startDate,
      endDate,
      settings: serializeShishaInventorySettings(settings, CHARCOAL_SHISHAS_PER_PACK),
      ...calculation,
      latestStocktake,
      movements: displayMovements,
    };
  }

  async initialize(companyId: string, userId: string, dto: InitializeShishaInventoryDto) {
    const exists = await this.prisma.shishaInventorySettings.findUnique({ where: { companyId } });
    if (exists) throw new ConflictException('تم تسجيل مخزون البداية مسبقاً ولا يمكن تعديله.');

    const [section, changeProduct] = await Promise.all([
      this.prisma.orderSection.findFirst({ where: { companyId, nameAr: 'شيشة' }, select: { id: true } }),
      this.prisma.orderProduct.findFirst({
        where: { companyId, nameAr: 'تغيير', productType: 'sale' },
        select: { id: true },
      }),
    ]);
    if (!section) throw new BadRequestException('قسم شيشة غير موجود في إعدادات الطلبات.');
    if (!changeProduct) throw new BadRequestException('صنف تغيير غير موجود ضمن أصناف مبيعات الشيشة.');

    const tenantId = TenantContext.getTenantId();
    const date = parseSaleDateYmd(dto.startDate);
    const opening = [
      {
        materialType: 'tobacco',
        quantityBase: tobaccoGrams(dto.tobaccoQuantity, dto.tobaccoUnit),
        costInclVat: dto.tobaccoCostInclVat ? shishaDecimal(dto.tobaccoCostInclVat) : null,
      },
      {
        materialType: 'hose',
        quantityBase: shishaDecimal(dto.hoses),
        costInclVat: dto.hoseCostInclVat ? shishaDecimal(dto.hoseCostInclVat) : null,
      },
      {
        materialType: 'charcoal',
        quantityBase: charcoalPieces(dto.charcoalCartons, dto.charcoalPacks, dto.charcoalPieces, 10, 64),
        costInclVat: dto.charcoalCostInclVat ? shishaDecimal(dto.charcoalCostInclVat) : null,
      },
    ] as const;

    await this.prisma.withTenant(async (tx) => {
      await tx.shishaInventorySettings.create({
        data: {
          tenantId,
          companyId,
          trackingStartedAt: date,
          headsPerKg: shishaDecimal(dto.headsPerKg),
          charcoalPacksPerCarton: 10,
          charcoalPiecesPerPack: 64,
          shishaSectionId: section.id,
          changeProductId: changeProduct.id,
          charcoalConsumptionProductId: null,
          charcoalActualTrackingStartedAt: null,
          charcoalPurchaseProductId: null,
          charcoalPurchaseTrackingStartedAt: null,
        },
      });
      await tx.shishaInventoryMovement.createMany({
        data: opening.map((row) => ({
          tenantId,
          companyId,
          transactionDate: date,
          movementType: 'opening',
          materialType: row.materialType,
          quantityBase: row.quantityBase,
          costInclVat: row.costInclVat,
          sourceKey: `shisha-opening:${companyId}:${row.materialType}`,
          notes: normalizeShishaText(dto.notes),
          createdByUserId: userId,
        })),
      });
    });
    return this.getSummary(companyId, dto.startDate, dto.startDate);
  }

  async recordPurchase(companyId: string, userId: string, dto: CreateShishaPurchaseDto) {
    const settings = await this.requireSettings(companyId);
    const date = parseSaleDateYmd(dto.transactionDate);
    if (date < settings.trackingStartedAt) {
      throw new BadRequestException('تاريخ الشراء لا يمكن أن يسبق تاريخ بداية التتبع.');
    }

    const quantityBase = purchaseQuantityBase(settings, dto);

    const invoiceNumber = normalizeShishaText(dto.invoiceNumber);
    const sourceKey = invoiceNumber
      ? `shisha-purchase:${companyId}:${dto.materialType}:${invoiceNumber!.toLocaleLowerCase('en')}`
      : null;
    if (sourceKey) {
      const duplicate = await this.prisma.shishaInventoryMovement.findUnique({ where: { sourceKey } });
      if (duplicate) throw new ConflictException('هذه الفاتورة مسجلة مسبقاً لنفس المادة.');
    }
    const movement = await this.prisma.shishaInventoryMovement.create({
      data: {
        tenantId: TenantContext.getTenantId(),
        companyId,
        transactionDate: date,
        movementType: 'purchase',
        materialType: dto.materialType,
        quantityBase,
        costInclVat: dto.costInclVat ? shishaDecimal(dto.costInclVat) : null,
        invoiceNumber,
        supplierName: normalizeShishaText(dto.supplierName),
        sourceKey,
        notes: normalizeShishaText(dto.notes),
        createdByUserId: userId,
      },
    });
    return { id: movement.id, createdAt: movement.createdAt };
  }

  async recordPurchases(companyId: string, userId: string, dto: CreateShishaPurchaseBatchDto) {
    const settings = await this.requireSettings(companyId);
    const date = parseSaleDateYmd(dto.transactionDate);
    if (date < settings.trackingStartedAt) {
      throw new BadRequestException('تاريخ الشراء لا يمكن أن يسبق تاريخ بداية التتبع.');
    }

    const invoiceNumber = normalizeShishaText(dto.invoiceNumber);
    if (invoiceNumber) {
      const duplicate = await this.prisma.shishaInventoryMovement.findFirst({
        where: {
          companyId,
          movementType: 'purchase',
          invoiceNumber: { equals: invoiceNumber, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('هذه الفاتورة مسجلة مسبقًا.');
    }

    const tenantId = TenantContext.getTenantId();
    const supplierName = normalizeShishaText(dto.supplierName);
    const notes = normalizeShishaText(dto.notes);
    const invoiceKey = invoiceNumber?.toLocaleLowerCase('en') ?? null;
    const rows = dto.items.map((item, index) => ({
      tenantId,
      companyId,
      transactionDate: date,
      movementType: 'purchase',
      materialType: item.materialType,
      quantityBase: purchaseQuantityBase(settings, item),
      costInclVat: item.costInclVat ? shishaDecimal(item.costInclVat) : null,
      invoiceNumber,
      supplierName,
      sourceKey: invoiceKey
        ? `shisha-purchase-batch:${companyId}:${invoiceKey}:${index}`
        : null,
      notes,
      createdByUserId: userId,
    }));

    const result = await this.prisma.shishaInventoryMovement.createMany({ data: rows });
    return { count: result.count };
  }

  async createStocktake(companyId: string, userId: string, dto: CreateShishaStocktakeDto) {
    const settings = await this.requireSettings(companyId);
    const date = parseSaleDateYmd(dto.stocktakeDate);
    if (date < settings.trackingStartedAt) {
      throw new BadRequestException('تاريخ الجرد لا يمكن أن يسبق تاريخ بداية التتبع.');
    }
    const duplicate = await this.prisma.shishaStocktake.findUnique({
      where: { companyId_stocktakeDate: { companyId, stocktakeDate: date } },
    });
    if (duplicate) throw new ConflictException('يوجد جرد مسجل لهذا التاريخ.');

    const { calculation } = await this.calculation(companyId, dto.stocktakeDate, dto.stocktakeDate);
    const expectedTobacco = shishaDecimal(calculation.current.tobaccoGrams);
    const expectedHoses = shishaDecimal(calculation.current.hoses);
    const expectedCharcoal = shishaDecimal(calculation.current.charcoalPiecesTotal);
    const physicalTobacco = tobaccoGrams(dto.tobaccoQuantity, dto.tobaccoUnit);
    const physicalHoses = shishaDecimal(dto.hoses);
    const physicalCharcoal = charcoalPieces(
      dto.charcoalCartons,
      dto.charcoalPacks,
      dto.charcoalPieces,
      settings.charcoalPacksPerCarton,
      settings.charcoalPiecesPerPack,
    );
    const tenantId = TenantContext.getTenantId();
    const variances = [
      { materialType: 'tobacco', quantityBase: physicalTobacco.minus(expectedTobacco) },
      { materialType: 'hose', quantityBase: physicalHoses.minus(expectedHoses) },
      { materialType: 'charcoal', quantityBase: physicalCharcoal.minus(expectedCharcoal) },
    ] as const;

    const stocktake = await this.prisma.withTenant(async (tx) => {
      const created = await tx.shishaStocktake.create({
        data: {
          tenantId,
          companyId,
          stocktakeDate: date,
          expectedTobaccoGrams: expectedTobacco,
          physicalTobaccoGrams: physicalTobacco,
          tobaccoVarianceGrams: physicalTobacco.minus(expectedTobacco),
          expectedHoses,
          physicalHoses,
          hoseVariance: physicalHoses.minus(expectedHoses),
          expectedCharcoalPieces: expectedCharcoal,
          physicalCharcoalPieces: physicalCharcoal,
          charcoalVariancePieces: physicalCharcoal.minus(expectedCharcoal),
          notes: normalizeShishaText(dto.notes),
          createdByUserId: userId,
        },
      });
      await tx.shishaInventoryMovement.createMany({
        data: variances.map((variance) => ({
          tenantId,
          companyId,
          transactionDate: date,
          movementType: 'stocktake_adjustment',
          materialType: variance.materialType,
          quantityBase: variance.quantityBase,
          sourceKey: `shisha-stocktake:${created.id}:${variance.materialType}`,
          stocktakeId: created.id,
          notes: normalizeShishaText(dto.notes),
          createdByUserId: userId,
        })),
      });
      return created;
    });
    return { id: stocktake.id, stocktakeDate: toYmd(stocktake.stocktakeDate), status: stocktake.status };
  }
}
