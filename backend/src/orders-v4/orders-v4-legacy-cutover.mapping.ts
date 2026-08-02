import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { normalizeUnit, productUnitConversionRowsFromUnknown } from '../orders/orders-unit-conversions.util';

export type LegacyRecipeRow = { materialProductId: string; quantity: Prisma.Decimal; unitKey: string };
export type LegacyConversionRow = { fromUnitKey: string; toUnitKey: string; factor: Prisma.Decimal };

export function legacyStableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function legacyTargetId(entity: string, source: string): string {
  return `v4m_${legacyStableHash([entity, source]).slice(0, 20)}`;
}

export function legacyUnitKey(value: unknown, fallback = 'piece'): string {
  return normalizeUnit(value, fallback);
}

export function legacyUnitCode(key: string): string {
  const normalized = key.trim().toLowerCase();
  return /^[a-z0-9_-]+$/.test(normalized) ? normalized : `legacy-${legacyStableHash(key).slice(0, 10)}`;
}

export function legacyUnitDefinition(key: string, nameAr?: string | null, nameEn?: string | null) {
  const standard: Record<string, { nameAr: string; nameEn: string; dimension: string; canonicalFactor: string | null; scale: number }> = {
    piece: { nameAr: 'حبة', nameEn: 'Piece', dimension: 'count', canonicalFactor: '1', scale: 3 },
    kg: { nameAr: 'كيلوجرام', nameEn: 'Kilogram', dimension: 'mass', canonicalFactor: '1000', scale: 6 },
    g: { nameAr: 'جرام', nameEn: 'Gram', dimension: 'mass', canonicalFactor: '1', scale: 6 },
    l: { nameAr: 'لتر', nameEn: 'Liter', dimension: 'volume', canonicalFactor: '1000', scale: 6 },
    ml: { nameAr: 'ملليلتر', nameEn: 'Milliliter', dimension: 'volume', canonicalFactor: '1', scale: 6 },
    pack: { nameAr: 'علبة', nameEn: 'Pack', dimension: 'package', canonicalFactor: null, scale: 4 },
    box: { nameAr: 'صندوق', nameEn: 'Box', dimension: 'package', canonicalFactor: null, scale: 4 },
    carton: { nameAr: 'كرتون', nameEn: 'Carton', dimension: 'package', canonicalFactor: null, scale: 4 },
    dozen: { nameAr: 'درزن', nameEn: 'Dozen', dimension: 'package', canonicalFactor: null, scale: 4 },
    bottle: { nameAr: 'قارورة', nameEn: 'Bottle', dimension: 'package', canonicalFactor: null, scale: 4 },
    cup: { nameAr: 'كوب', nameEn: 'Cup', dimension: 'package', canonicalFactor: null, scale: 4 },
    half_pack: { nameAr: 'نصف علبة', nameEn: 'Half pack', dimension: 'package', canonicalFactor: null, scale: 4 },
  };
  const preset = standard[key];
  return {
    code: legacyUnitCode(key),
    nameAr: nameAr?.trim() || preset?.nameAr || key,
    nameEn: nameEn?.trim() || preset?.nameEn || null,
    dimension: preset?.dimension || 'package',
    canonicalFactor: preset?.canonicalFactor == null ? null : new Prisma.Decimal(preset.canonicalFactor),
    decimalScale: preset?.scale ?? 6,
  };
}

export function legacyJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry ?? '').trim()).filter(Boolean))];
}

export function legacyVariantRows(value: unknown): Array<{ unitKey: string; label: string | null; lastPrice: Prisma.Decimal | null }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const rawUnit = row.unit || row.packaging;
    const unitKey = legacyUnitKey(rawUnit, 'piece');
    let lastPrice: Prisma.Decimal | null = null;
    try {
      if (row.lastPrice != null && String(row.lastPrice).trim() !== '') lastPrice = new Prisma.Decimal(String(row.lastPrice));
    } catch {
      lastPrice = null;
    }
    const label = [row.size, row.packaging].map((part) => String(part ?? '').trim()).filter(Boolean).join(' - ') || null;
    return [{ unitKey, label, lastPrice }];
  });
}

export function legacyConversionRows(...values: unknown[]): LegacyConversionRow[] {
  const seen = new Set<string>();
  const nextUnit = new Map<string, string>();
  const rows: LegacyConversionRow[] = [];
  for (const value of values) {
    for (const row of productUnitConversionRowsFromUnknown(value)) {
      const fromUnitKey = legacyUnitKey(row.fromUnit, '');
      const toUnitKey = legacyUnitKey(row.toUnit, '');
      let factor: Prisma.Decimal;
      try {
        factor = new Prisma.Decimal(String(row.multiplier ?? ''));
      } catch {
        continue;
      }
      const pair = `${fromUnitKey}->${toUnitKey}`;
      const reversePair = `${toUnitKey}->${fromUnitKey}`;
      if (!fromUnitKey || !toUnitKey || fromUnitKey === toUnitKey || !factor.gt(0) || seen.has(pair) || seen.has(reversePair) || nextUnit.has(fromUnitKey)) continue;
      let cursor: string | undefined = toUnitKey;
      let createsCycle = false;
      while (cursor) {
        if (cursor === fromUnitKey) { createsCycle = true; break; }
        cursor = nextUnit.get(cursor);
      }
      if (createsCycle) continue;
      seen.add(pair);
      nextUnit.set(fromUnitKey, toUnitKey);
      rows.push({ fromUnitKey, toUnitKey, factor });
    }
  }
  return rows;
}

export function legacyRecipeRows(value: unknown): LegacyRecipeRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const materialProductId = String(row.materialProductId ?? '').trim();
    const unitKey = legacyUnitKey(row.unit, 'piece');
    let quantity: Prisma.Decimal;
    try {
      quantity = new Prisma.Decimal(String(row.quantity ?? ''));
    } catch {
      return [];
    }
    return materialProductId && quantity.gt(0) ? [{ materialProductId, quantity, unitKey }] : [];
  });
}

export function legacyConsolidatedRecipeRows(value: unknown): LegacyRecipeRow[] {
  const merged = new Map<string, LegacyRecipeRow>();
  for (const row of legacyRecipeRows(value)) {
    const key = `${row.materialProductId}:${row.unitKey}`;
    const existing = merged.get(key);
    merged.set(key, existing ? { ...existing, quantity: existing.quantity.plus(row.quantity) } : row);
  }
  return [...merged.values()];
}

export function legacyPaymentMethod(orderType: string): 'custody' | 'cash' | 'transfer' {
  if (orderType === 'internal') return 'cash';
  if (orderType === 'transfer') return 'transfer';
  return 'custody';
}
