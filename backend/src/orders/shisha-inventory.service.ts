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
  type ShishaSaleEventInput,
} from './shisha-inventory-calculator.util';

const ZERO = new Prisma.Decimal(0);
const CHARCOAL_SHISHAS_PER_PACK = 6;

function decimal(value: string | number | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function tobaccoGrams(quantity: string, unit: 'kg' | 'g'): Prisma.Decimal {
  const value = decimal(quantity);
  return unit === 'kg' ? value.times(1000) : value;
}

function charcoalPieces(
  cartons: string,
  packs: string,
  pieces: string,
  packsPerCarton: number,
  piecesPerPack: number,
): Prisma.Decimal {
  return decimal(cartons)
    .times(packsPerCarton)
    .times(piecesPerPack)
    .plus(decimal(packs).times(piecesPerPack))
    .plus(decimal(pieces));
}

function purchaseQuantityBase(
  settings: { charcoalPacksPerCarton: number; charcoalPiecesPerPack: number },
  item: { materialType: 'tobacco' | 'hose' | 'charcoal'; quantity: string; unit: string },
): Prisma.Decimal {
  if (item.materialType === 'tobacco') {
    if (item.unit !== 'kg' && item.unit !== 'g') {
      throw new BadRequestException('وحدة المعسل يجب أن تكون كيلو أو جرام.');
    }
    return tobaccoGrams(item.quantity, item.unit);
  }
  if (item.materialType === 'hose') {
    if (item.unit !== 'piece') {
      throw new BadRequestException('وحدة اللي يجب أن تكون حبة.');
    }
    return decimal(item.quantity);
  }
  if (!['piece', 'pack', 'carton'].includes(item.unit)) {
    throw new BadRequestException('وحدة الفحم يجب أن تكون حبة أو علبة أو كرتون.');
  }
  const multiplier = item.unit === 'carton'
    ? settings.charcoalPacksPerCarton * settings.charcoalPiecesPerPack
    : item.unit === 'pack'
      ? settings.charcoalPiecesPerPack
      : 1;
  return decimal(item.quantity).times(multiplier);
}

function normalizeText(value?: string): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isShishaSection(value: string | null | undefined): boolean {
  return String(value ?? '').trim() === 'شيشة';
}

@Injectable()
export class ShishaInventoryService {
  constructor(private readonly prisma: TenantPrismaService) {}

  private async requireSettings(companyId: string) {
    const settings = await this.prisma.shishaInventorySettings.findUnique({ where: { companyId } });
    if (!settings) {
      throw new NotFoundException('يجب تسجيل مخزون بداية الشيشة أولاً.');
    }
    return settings;
  }

  private async saleEvents(
    companyId: string,
    trackingStart: Date,
    endDate: Date,
    changeProductId: string | null,
  ): Promise<ShishaSaleEventInput[]> {
    const orders = await this.prisma.staffOrder.findMany({
      where: {
        companyId,
        orderType: 'sale',
        saleDate: { gte: trackingStart, lte: endDate },
      },
      select: {
        id: true,
        logRef: true,
        saleDate: true,
        sectionName: true,
        items: {
          select: {
            quantity: true,
            productId: true,
            product: {
              select: { nameAr: true, productType: true, sections: true },
            },
          },
        },
      },
      orderBy: [{ saleDate: 'asc' }, { createdAt: 'asc' }],
    });

    const events: ShishaSaleEventInput[] = [];
    for (const order of orders) {
      if (!order.saleDate) continue;
      for (const item of order.items) {
        const sections = Array.isArray(item.product.sections) ? item.product.sections : [];
        const belongsToShisha =
          isShishaSection(order.sectionName) ||
          sections.some((section) => isShishaSection(String(section)));
        if (!belongsToShisha || item.product.productType !== 'sale') continue;
        const isChange =
          item.productId === changeProductId ||
          item.product.nameAr.trim() === 'تغيير';
        events.push({
          date: toYmd(order.saleDate),
          operationKey: order.logRef ?? order.id,
          heads: item.quantity,
          changes: isChange ? item.quantity : ZERO,
        });
      }
    }
    return events;
  }

  private async calculation(companyId: string, startDate: string, endDate: string) {
    const settings = await this.requireSettings(companyId);
    const end = parseSaleDateYmd(endDate);
    const [movements, sales] = await Promise.all([
      this.prisma.shishaInventoryMovement.findMany({
        where: { companyId, transactionDate: { lte: end } },
        orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
      }),
      this.saleEvents(companyId, settings.trackingStartedAt, end, settings.changeProductId),
    ]);
    const movementInputs: ShishaMovementInput[] = movements.map((movement) => ({
      date: toYmd(movement.transactionDate),
      movementType: movement.movementType as ShishaMovementInput['movementType'],
      materialType: movement.materialType as ShishaMaterialType,
      quantityBase: movement.quantityBase,
      costInclVat: movement.costInclVat,
    }));
    return {
      settings,
      calculation: calculateShishaInventory({
        trackingStartDate: toYmd(settings.trackingStartedAt),
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
    const [{ calculation }, latestStocktake, movements] = await Promise.all([
      this.calculation(companyId, startDate, endDate),
      this.prisma.shishaStocktake.findFirst({
        where: { companyId },
        orderBy: [{ stocktakeDate: 'desc' }, { createdAt: 'desc' }],
        include: { createdBy: { select: { nameAr: true, nameEn: true } } },
      }),
      this.prisma.shishaInventoryMovement.findMany({
        where: {
          companyId,
          transactionDate: {
            gte: parseSaleDateYmd(startDate),
            lte: parseSaleDateYmd(endDate),
          },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        take: 100,
        include: { createdBy: { select: { nameAr: true, nameEn: true } } },
      }),
    ]);
    return {
      initialized: true,
      startDate,
      endDate,
      settings: {
        trackingStartDate: toYmd(settings.trackingStartedAt),
        headsPerKg: Number(settings.headsPerKg),
        gramsPerHead: Number(new Prisma.Decimal(1000).div(settings.headsPerKg).toDecimalPlaces(3)),
        charcoalPacksPerCarton: settings.charcoalPacksPerCarton,
        charcoalPiecesPerPack: settings.charcoalPiecesPerPack,
        charcoalShishaPerPack: CHARCOAL_SHISHAS_PER_PACK,
      },
      ...calculation,
      latestStocktake,
      movements,
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
        costInclVat: dto.tobaccoCostInclVat ? decimal(dto.tobaccoCostInclVat) : null,
      },
      {
        materialType: 'hose',
        quantityBase: decimal(dto.hoses),
        costInclVat: dto.hoseCostInclVat ? decimal(dto.hoseCostInclVat) : null,
      },
      {
        materialType: 'charcoal',
        quantityBase: charcoalPieces(dto.charcoalCartons, dto.charcoalPacks, dto.charcoalPieces, 10, 64),
        costInclVat: dto.charcoalCostInclVat ? decimal(dto.charcoalCostInclVat) : null,
      },
    ] as const;

    await this.prisma.withTenant(async (tx) => {
      await tx.shishaInventorySettings.create({
        data: {
          tenantId,
          companyId,
          trackingStartedAt: date,
          headsPerKg: decimal(dto.headsPerKg),
          charcoalPacksPerCarton: 10,
          charcoalPiecesPerPack: 64,
          shishaSectionId: section.id,
          changeProductId: changeProduct.id,
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
          notes: normalizeText(dto.notes),
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

    let quantityBase: Prisma.Decimal;
    if (dto.materialType === 'tobacco') {
      if (dto.unit !== 'kg' && dto.unit !== 'g') throw new BadRequestException('وحدة المعسل يجب أن تكون كيلو أو جرام.');
      quantityBase = tobaccoGrams(dto.quantity, dto.unit);
    } else if (dto.materialType === 'hose') {
      if (dto.unit !== 'piece') throw new BadRequestException('وحدة اللي يجب أن تكون حبة.');
      quantityBase = decimal(dto.quantity);
    } else {
      if (!['piece', 'pack', 'carton'].includes(dto.unit)) {
        throw new BadRequestException('وحدة الفحم يجب أن تكون حبة أو باكت أو كرتون.');
      }
      const multiplier = dto.unit === 'carton'
        ? settings.charcoalPacksPerCarton * settings.charcoalPiecesPerPack
        : dto.unit === 'pack'
          ? settings.charcoalPiecesPerPack
          : 1;
      quantityBase = decimal(dto.quantity).times(multiplier);
    }

    const invoiceNumber = normalizeText(dto.invoiceNumber);
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
        costInclVat: dto.costInclVat ? decimal(dto.costInclVat) : null,
        invoiceNumber,
        supplierName: normalizeText(dto.supplierName),
        sourceKey,
        notes: normalizeText(dto.notes),
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

    const invoiceNumber = normalizeText(dto.invoiceNumber);
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
    const supplierName = normalizeText(dto.supplierName);
    const notes = normalizeText(dto.notes);
    const invoiceKey = invoiceNumber?.toLocaleLowerCase('en') ?? null;
    const rows = dto.items.map((item, index) => ({
      tenantId,
      companyId,
      transactionDate: date,
      movementType: 'purchase',
      materialType: item.materialType,
      quantityBase: purchaseQuantityBase(settings, item),
      costInclVat: item.costInclVat ? decimal(item.costInclVat) : null,
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
    const expectedTobacco = decimal(calculation.current.tobaccoGrams);
    const expectedHoses = decimal(calculation.current.hoses);
    const expectedCharcoal = decimal(calculation.current.charcoalPiecesTotal);
    const physicalTobacco = tobaccoGrams(dto.tobaccoQuantity, dto.tobaccoUnit);
    const physicalHoses = decimal(dto.hoses);
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
          notes: normalizeText(dto.notes),
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
          notes: normalizeText(dto.notes),
          createdByUserId: userId,
        })),
      });
      return created;
    });
    return { id: stocktake.id, stocktakeDate: toYmd(stocktake.stocktakeDate), status: stocktake.status };
  }
}
