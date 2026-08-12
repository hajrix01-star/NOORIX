import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function resolveOrdersV4DocumentUnitPrice(params: {
  documentType: 'purchase' | 'registration';
  isRegistrationCancellation: boolean;
  itemName: string;
  requestedPrice?: string | null;
  salePrice?: Prisma.Decimal | null;
}) {
  const requestedPrice = params.requestedPrice == null || params.requestedPrice === ''
    ? null
    : new Prisma.Decimal(params.requestedPrice);
  const unitPrice = new Prisma.Decimal(params.documentType === 'registration'
    ? (requestedPrice?.gt(0) ? requestedPrice : params.salePrice ?? new Prisma.Decimal(0))
    : params.requestedPrice ?? 0);

  if (params.documentType === 'registration' && !params.isRegistrationCancellation && unitPrice.lte(0)) {
    throw new BadRequestException(`${params.itemName}: يجب تحديد سعر بيع موجب قبل اعتماد التسجيل الداخلي`);
  }
  return unitPrice;
}
