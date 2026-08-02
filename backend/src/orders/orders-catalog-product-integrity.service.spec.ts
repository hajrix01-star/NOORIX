import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { OrdersCatalogProductIntegrityService } from './orders-catalog-product-integrity.service';
import type { PersistedProductVariantInput } from './orders-catalog-product.types';

describe('OrdersCatalogProductIntegrityService', () => {
  const prisma = Object.create(TenantPrismaService.prototype) as TenantPrismaService;
  const service = new OrdersCatalogProductIntegrityService(prisma);

  it('accepts price rows in any order when their units resolve to inventory', () => {
    expect(() => service.assertProductUnitConversionChain({
      directConversions: [
        { fromUnit: 'carton', toUnit: 'pack', multiplier: '10' },
        { fromUnit: 'pack', toUnit: 'piece', multiplier: '64' },
      ],
      baseUnit: 'piece',
      variants: [
        { unit: 'pack', lastPrice: '20' },
        { unit: 'carton', lastPrice: '145' },
      ],
    })).not.toThrow();
  });

  it('accepts connected conversion rows regardless of storage order', () => {
    expect(() => service.assertProductUnitConversionChain({
      directConversions: [
        { fromUnit: 'pack', toUnit: 'piece', multiplier: '64' },
        { fromUnit: 'carton', toUnit: 'pack', multiplier: '10' },
      ],
      baseUnit: 'piece',
      variants: [{ unit: 'carton', lastPrice: '145' }],
    })).not.toThrow();
  });

  it('rejects a disconnected conversion component even without price rows', () => {
    expect(() => service.assertProductUnitConversionChain({
      directConversions: [{ fromUnit: 'carton', toUnit: 'pack', multiplier: '10' }],
      baseUnit: 'piece',
    })).toThrow(BadRequestException);
  });

  it('accepts a standard unit conversion without a custom chain', () => {
    expect(() => service.assertProductUnitConversionChain({
      baseUnit: 'g',
      variants: [{ unit: 'kg', lastPrice: '25' }],
    })).not.toThrow();
  });

  it('rejects a price unit that is not connected to inventory', () => {
    expect(() => service.assertProductUnitConversionChain({
      baseUnit: 'piece',
      variants: [{ unit: 'carton', lastPrice: '145' }],
    })).toThrow(BadRequestException);
  });

  it('writes new price rows without a quantity multiplier', () => {
    expect(service.variantJson([
      { size: '', packaging: 'carton', unit: 'carton', lastPrice: '145' },
    ])).toEqual([
      { size: '', packaging: 'carton', unit: 'carton', lastPrice: '145' },
    ]);
  });

  it('preserves a matching historical quantity multiplier during an update', () => {
    const existing: PersistedProductVariantInput[] = [{
      size: '',
      packaging: 'carton',
      unit: 'carton',
      lastPrice: '120',
      quantityMultiplier: '640',
    }];

    expect(service.variantJson([
      { size: '', packaging: 'carton', unit: 'carton', lastPrice: '145' },
    ], existing)).toEqual([
      {
        size: '',
        packaging: 'carton',
        unit: 'carton',
        lastPrice: '145',
        quantityMultiplier: '640',
      },
    ]);
  });

  it('returns the database null sentinel for an empty price list', () => {
    expect(service.variantJson([])).toBe(Prisma.DbNull);
  });
});
