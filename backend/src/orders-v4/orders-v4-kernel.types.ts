import { Prisma } from '@prisma/client';

export type OrdersV4UnitDefinition = Readonly<{
  id: string;
  code: string;
  dimension: string;
  canonicalFactor: Prisma.Decimal | null;
}>;

export type OrdersV4ConversionEdgeDefinition = Readonly<{
  id: string;
  fromUnitId: string;
  toUnitId: string;
  factor: Prisma.Decimal;
  reversible: boolean;
  allowDimensionBridge: boolean;
}>;

export type OrdersV4ResolvedConversion = Readonly<{
  fromUnitId: string;
  toUnitId: string;
  factor: Prisma.Decimal;
  source: 'identity' | 'item-definition' | 'canonical';
  path: ReadonlyArray<Readonly<{
    edgeId: string;
    fromUnitId: string;
    toUnitId: string;
    factor: string;
    reversed: boolean;
  }>>;
}>;

export type OrdersV4LineCalculation = Readonly<{
  inputQuantity: Prisma.Decimal;
  baseQuantity: Prisma.Decimal;
  priceQuantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  inputConversion: OrdersV4ResolvedConversion;
  priceConversion: OrdersV4ResolvedConversion;
}>;

export type OrdersV4InventoryBalance = Readonly<{
  quantity: Prisma.Decimal;
  value: Prisma.Decimal;
  averageUnitCost: Prisma.Decimal;
}>;

export type OrdersV4InventoryCalculation = Readonly<{
  quantityDelta: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  valueDelta: Prisma.Decimal;
  quantityAfter: Prisma.Decimal;
  valueAfter: Prisma.Decimal;
  averageUnitCostAfter: Prisma.Decimal;
}>;

