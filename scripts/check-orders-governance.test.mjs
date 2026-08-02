import { describe, expect, it } from 'vitest';
import {
  operationalQuantityMultiplierFailures,
  ordersV2SnapshotConventionFailures,
} from './orders-governance-rules.mjs';

describe('Orders V2 governance rules', () => {
  it('rejects quantityMultiplier in DTO and operational variant contracts', () => {
    expect(operationalQuantityMultiplierFailures(
      'backend/src/orders/dto/create-product.dto.ts',
      'export class ProductVariantDto { quantityMultiplier?: string; }',
    )).not.toHaveLength(0);

    expect(operationalQuantityMultiplierFailures(
      'backend/src/orders/orders-catalog-product.types.ts',
      'export type ProductVariantInput = { quantityMultiplier?: string; };',
    )).toContain('ProductVariantInput must not accept the historical quantityMultiplier field');
  });

  it('allows quantityMultiplier only in the isolated persisted compatibility contract', () => {
    const source = `
      export type ProductVariantInput = { unit?: string; };
      export type PersistedProductVariantInput = ProductVariantInput & {
        quantityMultiplier?: string;
      };
    `;

    expect(operationalQuantityMultiplierFailures(
      'backend/src/orders/orders-catalog-product.types.ts',
      source,
    )).toEqual([]);
  });

  it('rejects quantityMultiplier when it is added directly to a frontend write payload', () => {
    const source = `
      export type OrderProductPayload = {
        nameAr: string;
        quantityMultiplier?: string;
      };
    `;

    expect(operationalQuantityMultiplierFailures(
      'src/types/api/domains/orders.ts',
      source,
    )).toContain('OrderProductPayload must not expose quantityMultiplier on a write payload');
  });

  it('requires mapped, versioned snapshot conventions when snapshot schema fields exist', () => {
    const failures = ordersV2SnapshotConventionFailures({
      schema: `
        inventoryBaseQuantitySnapshot Decimal?
        inventoryConsumptionSnapshot Json?
      `,
      ordersService: '',
      consumptionSnapshot: '',
      snapshotSql: '',
    });

    expect(failures).toContain('inventoryBaseQuantitySnapshot must keep its nullable Decimal(18, 6) mapped schema convention');
    expect(failures).toContain('inventoryConsumptionSnapshot must keep its nullable mapped Json schema convention');
    expect(failures).toContain('inventory snapshot SQL validation must enforce the same stored snapshot version as the parser');
  });

  it('does not require snapshot artifacts before their schema fields are present', () => {
    expect(ordersV2SnapshotConventionFailures({ schema: '' })).toEqual([]);
  });
});
