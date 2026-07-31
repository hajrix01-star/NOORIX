import type { OrderRecipeInventoryStockRow, OrderSection } from '../../types/api';

export type InventorySectionOption = {
  id: string;
  label: string;
  count: number;
};

export const ALL_INVENTORY_SECTIONS = 'all';
export const UNCATEGORIZED_INVENTORY_SECTION = '__uncategorized';
const SECTION_KEY_PREFIX = 'section:';
const ALL_SECTIONS_LABEL = 'كل الأقسام';
const UNCATEGORIZED_LABEL = 'بدون قسم';

export function inventorySectionIdentity(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ar');
}

function cleanLabel(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function sectionFilterId(identity: string): string {
  return `${SECTION_KEY_PREFIX}${encodeURIComponent(identity)}`;
}

function sectionLabelsForRow(
  row: OrderRecipeInventoryStockRow,
  sectionsById: Map<string, OrderSection>,
): string[] {
  const labels = new Map<string, string>();
  row.sectionIds.forEach((sectionId, index) => {
    const section = sectionsById.get(String(sectionId));
    const label = cleanLabel(section?.nameAr || section?.nameEn || row.sections[index]);
    const identity = inventorySectionIdentity(label);
    if (identity && !labels.has(identity)) labels.set(identity, label);
  });
  row.sections.forEach((rawLabel) => {
    const label = cleanLabel(rawLabel);
    const identity = inventorySectionIdentity(label);
    if (identity && !labels.has(identity)) labels.set(identity, label);
  });
  return Array.from(labels.values());
}

export function inventoryRowSectionLabels(
  row: OrderRecipeInventoryStockRow,
  sections: OrderSection[],
): string[] {
  const labels = sectionLabelsForRow(row, new Map(sections.map((section) => [section.id, section])));
  return labels.length > 0 ? labels : [UNCATEGORIZED_LABEL];
}

export function buildInventorySectionOptions(
  rows: OrderRecipeInventoryStockRow[],
  sections: OrderSection[],
): InventorySectionOption[] {
  const sectionsById = new Map(sections.map((section) => [section.id, section]));
  const optionsByIdentity = new Map<string, InventorySectionOption>();

  for (const row of rows) {
    const labels = sectionLabelsForRow(row, sectionsById);
    if (labels.length === 0) {
      const current = optionsByIdentity.get(UNCATEGORIZED_INVENTORY_SECTION);
      optionsByIdentity.set(UNCATEGORIZED_INVENTORY_SECTION, {
        id: UNCATEGORIZED_INVENTORY_SECTION,
        label: UNCATEGORIZED_LABEL,
        count: (current?.count ?? 0) + 1,
      });
      continue;
    }

    labels.forEach((label) => {
      const identity = inventorySectionIdentity(label);
      const id = sectionFilterId(identity);
      const current = optionsByIdentity.get(identity);
      optionsByIdentity.set(identity, { id, label: current?.label ?? label, count: (current?.count ?? 0) + 1 });
    });
  }

  return [
    { id: ALL_INVENTORY_SECTIONS, label: ALL_SECTIONS_LABEL, count: rows.length },
    ...Array.from(optionsByIdentity.values()).sort((a, b) => a.label.localeCompare(b.label, 'ar')),
  ];
}

export function inventoryRowMatchesSection(
  row: OrderRecipeInventoryStockRow,
  selectedSectionId: string,
  sections: OrderSection[],
): boolean {
  if (selectedSectionId === ALL_INVENTORY_SECTIONS) return true;
  const labels = sectionLabelsForRow(row, new Map(sections.map((section) => [section.id, section])));
  if (selectedSectionId === UNCATEGORIZED_INVENTORY_SECTION) return labels.length === 0;
  if (!selectedSectionId.startsWith(SECTION_KEY_PREFIX)) return false;
  const selectedIdentity = decodeURIComponent(selectedSectionId.slice(SECTION_KEY_PREFIX.length));
  return labels.some((label) => inventorySectionIdentity(label) === selectedIdentity);
}
