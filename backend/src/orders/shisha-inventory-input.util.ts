import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toYmd } from '../common/utils/to-ymd.util';

export function shishaDecimal(value: string | number | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function tobaccoGrams(quantity: string, unit: 'kg' | 'g'): Prisma.Decimal {
  const value = shishaDecimal(quantity);
  return unit === 'kg' ? value.times(1000) : value;
}

export function charcoalPieces(
  cartons: string,
  packs: string,
  pieces: string,
  packsPerCarton: number,
  piecesPerPack: number,
): Prisma.Decimal {
  return shishaDecimal(cartons)
    .times(packsPerCarton)
    .times(piecesPerPack)
    .plus(shishaDecimal(packs).times(piecesPerPack))
    .plus(shishaDecimal(pieces));
}

export function purchaseQuantityBase(
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
    return shishaDecimal(item.quantity);
  }
  if (!['piece', 'pack', 'carton'].includes(item.unit)) {
    throw new BadRequestException('وحدة الفحم يجب أن تكون حبة أو علبة أو كرتون.');
  }
  const multiplier = item.unit === 'carton'
    ? settings.charcoalPacksPerCarton * settings.charcoalPiecesPerPack
    : item.unit === 'pack'
      ? settings.charcoalPiecesPerPack
      : 1;
  return shishaDecimal(item.quantity).times(multiplier);
}

export function normalizeShishaText(value?: string): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function assertManualCharcoalPurchaseAllowed(
  settings: {
    charcoalPurchaseProductId: string | null;
    charcoalPurchaseTrackingStartedAt: Date | null;
  },
  date: Date,
  materialTypes: Array<'tobacco' | 'hose' | 'charcoal'>,
) {
  if (
    settings.charcoalPurchaseProductId
    && settings.charcoalPurchaseTrackingStartedAt
    && toYmd(date) >= toYmd(settings.charcoalPurchaseTrackingStartedAt)
    && materialTypes.includes('charcoal')
  ) {
    throw new BadRequestException(
      'شراء الفحم مرتبط بصنف «فحم» في الطلبات ويضاف للمخزون تلقائياً؛ لا تسجله مرة ثانية هنا.',
    );
  }
}

export function serializeShishaInventorySettings(
  settings: {
    trackingStartedAt: Date;
    headsPerKg: Prisma.Decimal;
    charcoalPacksPerCarton: number;
    charcoalPiecesPerPack: number;
    charcoalActualTrackingStartedAt: Date | null;
    charcoalConsumptionProductId: string | null;
    charcoalPurchaseTrackingStartedAt: Date | null;
    charcoalPurchaseProductId: string | null;
  },
  charcoalShishaPerPack: number,
) {
  return {
    trackingStartDate: toYmd(settings.trackingStartedAt),
    headsPerKg: Number(settings.headsPerKg),
    gramsPerHead: Number(new Prisma.Decimal(1000).div(settings.headsPerKg).toDecimalPlaces(3)),
    charcoalPacksPerCarton: settings.charcoalPacksPerCarton,
    charcoalPiecesPerPack: settings.charcoalPiecesPerPack,
    charcoalShishaPerPack,
    charcoalActualTrackingStartDate: settings.charcoalActualTrackingStartedAt
      ? toYmd(settings.charcoalActualTrackingStartedAt)
      : null,
    charcoalConsumptionProductId: settings.charcoalConsumptionProductId,
    charcoalPurchaseTrackingStartDate: settings.charcoalPurchaseTrackingStartedAt
      ? toYmd(settings.charcoalPurchaseTrackingStartedAt)
      : null,
    charcoalPurchaseProductId: settings.charcoalPurchaseProductId,
  };
}
