import {
  normalizeUnit,
  resolveProductUnitMultiplierOrNull,
} from './orders-unit-conversions.util';

export type RecipeLinkedMaterial = {
  id: string;
  nameAr?: string | null;
  productType?: string | null;
  isActive?: boolean;
  unit?: string | null;
  inventoryConversions?: unknown;
  conversionTemplate?: { conversions?: unknown } | null;
};

export type RecipeLinkedSaleProduct = {
  id: string;
  nameAr?: string | null;
  recipe?: unknown;
};

export type RecipeLinkIntegrityIssue = {
  saleProductId: string;
  saleProductName: string;
  recipeUnit: string;
  materialBaseUnit: string;
  reason: 'inactive' | 'not_inventory' | 'missing_conversion';
};

type RecipeMaterialReference = {
  materialProductId: string;
  unit: string;
};

function recipeMaterialReferences(value: unknown): RecipeMaterialReference[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const materialProductId = String(row.materialProductId ?? '').trim();
    if (!materialProductId) return [];
    const materialType = String(row.materialType ?? '').trim();
    const fallbackUnit = materialType === 'tobacco' ? 'g' : 'piece';
    return [{
      materialProductId,
      unit: normalizeUnit(row.unit, fallbackUnit),
    }];
  });
}

export function findRecipeLinkIntegrityIssues(input: {
  material: RecipeLinkedMaterial;
  saleProducts: readonly RecipeLinkedSaleProduct[];
}): RecipeLinkIntegrityIssue[] {
  const materialBaseUnit = normalizeUnit(input.material.unit, 'piece');
  const issues: RecipeLinkIntegrityIssue[] = [];

  for (const saleProduct of input.saleProducts) {
    const linkedRows = recipeMaterialReferences(saleProduct.recipe)
      .filter((row) => row.materialProductId === input.material.id);
    for (const linkedRow of linkedRows) {
      const common = {
        saleProductId: saleProduct.id,
        saleProductName: String(saleProduct.nameAr ?? saleProduct.id).trim() || saleProduct.id,
        recipeUnit: linkedRow.unit,
        materialBaseUnit,
      };
      if (input.material.isActive === false) {
        issues.push({ ...common, reason: 'inactive' });
        continue;
      }
      if (input.material.productType !== 'order') {
        issues.push({ ...common, reason: 'not_inventory' });
        continue;
      }
      if (!resolveProductUnitMultiplierOrNull(
        input.material,
        linkedRow.unit,
        materialBaseUnit,
      )) {
        issues.push({ ...common, reason: 'missing_conversion' });
      }
    }
  }

  return issues;
}
