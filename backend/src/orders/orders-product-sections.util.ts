export type OrderSectionRow = { id: string; nameAr: string; nameEn?: string | null };

export function cleanOrderSectionName(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function orderSectionIdentity(value: unknown): string {
  return cleanOrderSectionName(value).toLocaleLowerCase('ar');
}

export function parseStringArrayJson(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(cleanOrderSectionName).filter(Boolean);
  return [];
}

export function canonicalOrderSections(sectionList: OrderSectionRow[]): OrderSectionRow[] {
  const byIdentity = new Map<string, OrderSectionRow>();
  for (const section of sectionList) {
    const identity = orderSectionIdentity(section.nameAr);
    if (identity && !byIdentity.has(identity)) {
      byIdentity.set(identity, { ...section, nameAr: cleanOrderSectionName(section.nameAr) });
    }
  }
  return Array.from(byIdentity.values());
}

export function canonicalizeOrderSectionIds(sectionList: OrderSectionRow[], ids: string[]): string[] {
  const canonicalSections = canonicalOrderSections(sectionList);
  const canonicalByIdentity = new Map(canonicalSections.map((section) => [orderSectionIdentity(section.nameAr), section]));
  const sectionById = new Map(sectionList.map((section) => [section.id, section]));
  const result: string[] = [];

  for (const rawId of ids) {
    const section = sectionById.get(rawId);
    if (!section) continue;
    const canonical = canonicalByIdentity.get(orderSectionIdentity(section.nameAr));
    if (canonical && !result.includes(canonical.id)) result.push(canonical.id);
  }
  return result;
}

export function idsToNames(sectionList: OrderSectionRow[], ids: string[]): string[] {
  const canonicalIds = canonicalizeOrderSectionIds(sectionList, ids);
  const byId = new Map(canonicalOrderSections(sectionList).map((section) => [section.id, section.nameAr]));
  return canonicalIds.map((id) => byId.get(id)).filter((name): name is string => Boolean(name));
}

export function namesToIds(sectionList: OrderSectionRow[], names: string[]): string[] {
  const byName = new Map(
    canonicalOrderSections(sectionList).map((section) => [orderSectionIdentity(section.nameAr), section.id]),
  );
  const ids: string[] = [];
  for (const name of names) {
    const id = byName.get(orderSectionIdentity(name));
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function enrichSectionIds(
  sectionList: OrderSectionRow[],
  sections: string[] | null | undefined,
  sectionIds: string[] | null | undefined,
): string[] {
  const ids = canonicalizeOrderSectionIds(sectionList, parseStringArrayJson(sectionIds));
  if (ids.length > 0) return ids;
  return namesToIds(sectionList, parseStringArrayJson(sections));
}

export function normalizeProductSections(
  sectionList: OrderSectionRow[],
  input: { sections?: string[] | null; sectionIds?: string[] | null },
): { sections: string[] | null; sectionIds: string[] | null } {
  const idsFromInput = canonicalizeOrderSectionIds(sectionList, parseStringArrayJson(input.sectionIds));
  const namesFromInput = parseStringArrayJson(input.sections);

  if (idsFromInput.length > 0) {
    const names = idsToNames(sectionList, idsFromInput);
    return { sectionIds: idsFromInput, sections: names.length > 0 ? names : null };
  }

  if (namesFromInput.length > 0) {
    const ids = namesToIds(sectionList, namesFromInput);
    const knownNames = idsToNames(sectionList, ids);
    return {
      sectionIds: ids.length > 0 ? ids : null,
      sections: knownNames.length > 0 ? knownNames : Array.from(new Map(
        namesFromInput.map((name) => [orderSectionIdentity(name), cleanOrderSectionName(name)]),
      ).values()),
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
  const resolvedNames = ids.length > 0
    ? idsToNames(sectionList, ids)
    : Array.from(new Map(names.map((name) => [orderSectionIdentity(name), cleanOrderSectionName(name)])).values());
  return {
    ...product,
    sectionIds: ids,
    sections: resolvedNames.length > 0 ? resolvedNames : null,
  };
}
