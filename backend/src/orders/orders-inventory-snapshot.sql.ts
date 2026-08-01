import { Prisma } from '@prisma/client';

const INVENTORY_NUMERIC_PATTERN =
  '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$';

export function inventoryConsumptionSnapshotValidity(snapshot: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    CASE
      WHEN jsonb_typeof(${snapshot}) IS DISTINCT FROM 'object' THEN false
      WHEN ${snapshot}->>'version' IS DISTINCT FROM '1' THEN false
      WHEN jsonb_typeof(${snapshot}->'components') IS DISTINCT FROM 'array' THEN false
      WHEN EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(${snapshot}->'components') = 'array'
              THEN ${snapshot}->'components'
            ELSE '[]'::jsonb
          END
        ) AS component
        WHERE jsonb_typeof(component) IS DISTINCT FROM 'object'
          OR BTRIM(COALESCE(component->>'materialProductId', '')) = ''
          OR BTRIM(COALESCE(component->>'materialBaseUnit', '')) = ''
          OR COALESCE(component->>'quantityBase', '') !~ ${INVENTORY_NUMERIC_PATTERN}
      ) THEN false
      ELSE true
    END
  `;
}
