/**
 * مزامنة أقسام الأصناف: sectionIds (معرّفات) + sections (أسماء للعرض والتوافق).
 */

export type OrderSectionRow = { id: string; nameAr: string; nameEn?: string | null };

export function parseStringArrayJson(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((x) => String(x).trim()).filter(Boolean);
  return [];
}

export function idsToNames(sectionList: OrderSectionRow[], ids: string[]): string[] {
  const byId = new Map(sectionList.map((s) => [s.id, s.nameAr]));
  return ids.map((id) => byId.get(id)).filter((n): n is string => !!n);
}

export function namesToIds(sectionList: OrderSectionRow[], names: string[]): string[] {
  const byName = new Map(sectionList.map((s) => [s.nameAr.trim(), s.id]));
  const ids: string[] = [];
  for (const n of names) {
    const key = String(n).trim();
    const id = byName.get(key);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** يكمّل sectionIds من الأسماء إن وُجدت أسماء فقط (بيانات قديمة). */
export function enrichSectionIds(
  sectionList: OrderSectionRow[],
  sections: string[] | null | undefined,
  sectionIds: string[] | null | undefined,
): string[] {
  const ids = parseStringArrayJson(sectionIds);
  if (ids.length > 0) return ids;
  const names = parseStringArrayJson(sections);
  return namesToIds(sectionList, names);
}

export function normalizeProductSections(
  sectionList: OrderSectionRow[],
  input: { sections?: string[] | null; sectionIds?: string[] | null },
): { sections: string[] | null; sectionIds: string[] | null } {
  const idsFromInput = parseStringArrayJson(input.sectionIds);
  const namesFromInput = parseStringArrayJson(input.sections);

  if (idsFromInput.length > 0) {
    const names = idsToNames(sectionList, idsFromInput);
    return {
      sectionIds: idsFromInput,
      sections: names.length > 0 ? names : null,
    };
  }
  if (namesFromInput.length > 0) {
    const ids = namesToIds(sectionList, namesFromInput);
    return {
      sectionIds: ids.length > 0 ? ids : null,
      sections: namesFromInput,
    };
  }
  return { sections: null, sectionIds: null };
}

export function enrichProductWithSectionIds<T extends { sections?: unknown; sectionIds?: unknown }>(
  product: T,
  sectionList: OrderSectionRow[],
): T & { sectionIds: string[]; sections: string[] | null } {
  const names = parseStringArrayJson(product.sections);
  const ids = enrichSectionIds(sectionList, names, parseStringArrayJson(product.sectionIds));
  const resolvedNames = ids.length > 0 ? idsToNames(sectionList, ids) : names;
  return {
    ...product,
    sectionIds: ids,
    sections: resolvedNames.length > 0 ? resolvedNames : null,
  };
}
