import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { InventoryDataQualityReport } from './orders-inventory-quality.types';
import { inventoryConsumptionSnapshotValidity } from './orders-inventory-snapshot.sql';

type InventoryDataQualitySqlCount = bigint | number | null;

type InventoryDataQualitySqlRow = {
  purchaseTotal: InventoryDataQualitySqlCount;
  purchaseMissing: InventoryDataQualitySqlCount;
  saleTotal: InventoryDataQualitySqlCount;
  saleVerified: InventoryDataQualitySqlCount;
  saleMissing: InventoryDataQualitySqlCount;
  saleInvalid: InventoryDataQualitySqlCount;
  shishaSettings: InventoryDataQualitySqlCount;
  shishaMovements: InventoryDataQualitySqlCount;
  shishaStocktakes: InventoryDataQualitySqlCount;
};

function countValue(value: InventoryDataQualitySqlCount | undefined): number {
  const count = Number(value ?? 0);
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

@Injectable()
export class OrdersInventoryQualityService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async getDataQuality(companyId: string): Promise<InventoryDataQualityReport> {
    return this.prisma.withTenant(async (tx) => {
      const [rawQuality] = await tx.$queryRaw<InventoryDataQualitySqlRow[]>(Prisma.sql`
        WITH purchase_quality AS (
          SELECT
            COUNT(*) AS "purchaseTotal",
            COUNT(*) FILTER (
              WHERE oi."inventory_base_quantity_snapshot" IS NULL
            ) AS "purchaseMissing"
          FROM "order_items" oi
          INNER JOIN "orders" o ON o."id" = oi."order_id"
          WHERE o."company_id" = ${companyId}
            AND o."status" = 'active'
        ), classified_sales AS MATERIALIZED (
          SELECT
            soi."inventory_consumption_snapshot" AS snapshot,
            ${inventoryConsumptionSnapshotValidity(
              Prisma.sql`soi."inventory_consumption_snapshot"`,
            )} AS "isValid"
          FROM "staff_order_items" soi
          INNER JOIN "staff_orders" so ON so."id" = soi."staff_order_id"
          WHERE so."company_id" = ${companyId}
            AND so."order_type" = 'sale'
            AND so."status" = 'sent'
        ), sale_quality AS (
          SELECT
            COUNT(*) AS "saleTotal",
            COUNT(*) FILTER (WHERE "isValid") AS "saleVerified",
            COUNT(*) FILTER (WHERE snapshot IS NULL) AS "saleMissing",
            COUNT(*) FILTER (
              WHERE snapshot IS NOT NULL AND NOT "isValid"
            ) AS "saleInvalid"
          FROM classified_sales
        ), legacy_quality AS (
          SELECT
            (
              SELECT COUNT(*)
              FROM "shisha_inventory_settings"
              WHERE "company_id" = ${companyId}
            ) AS "shishaSettings",
            (
              SELECT COUNT(*)
              FROM "shisha_inventory_movements"
              WHERE "company_id" = ${companyId}
            ) AS "shishaMovements",
            (
              SELECT COUNT(*)
              FROM "shisha_stocktakes"
              WHERE "company_id" = ${companyId}
            ) AS "shishaStocktakes"
        )
        SELECT *
        FROM purchase_quality
        CROSS JOIN sale_quality
        CROSS JOIN legacy_quality
      `);

      const purchaseTotal = countValue(rawQuality?.purchaseTotal);
      const purchaseMissing = countValue(rawQuality?.purchaseMissing);
      const saleTotal = countValue(rawQuality?.saleTotal);
      const saleVerified = countValue(rawQuality?.saleVerified);
      const saleMissing = countValue(rawQuality?.saleMissing);
      const saleInvalid = countValue(rawQuality?.saleInvalid);
      const shishaSettings = countValue(rawQuality?.shishaSettings);
      const shishaMovements = countValue(rawQuality?.shishaMovements);
      const shishaStocktakes = countValue(rawQuality?.shishaStocktakes);
      const shishaTotalRows = shishaSettings + shishaMovements + shishaStocktakes;
      const estimatedSaleItems = saleMissing + saleInvalid;
      const needsReview = shishaTotalRows > 0 || purchaseMissing > 0 || estimatedSaleItems > 0;

      return {
        status: needsReview ? 'needs_review' : 'verified',
        checkedAt: new Date().toISOString(),
        legacy: {
          shishaSettingsRows: shishaSettings,
          shishaMovementRows: shishaMovements,
          shishaStocktakeRows: shishaStocktakes,
          shishaTotalRows,
          purchaseItemsWithoutSnapshot: purchaseMissing,
        },
        estimated: {
          saleItemsFromCurrentRecipe: estimatedSaleItems,
        },
        snapshots: {
          purchases: {
            totalItems: purchaseTotal,
            verifiedItems: Math.max(0, purchaseTotal - purchaseMissing),
            missingItems: purchaseMissing,
          },
          consumption: {
            totalItems: saleTotal,
            verifiedItems: saleVerified,
            missingItems: saleMissing,
            invalidItems: saleInvalid,
          },
        },
      };
    });
  }
}
