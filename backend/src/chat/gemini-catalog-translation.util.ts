export type CatalogTranslationClassification =
  | 'ingredient'
  | 'beverage'
  | 'cleaning'
  | 'packaging'
  | 'equipment'
  | 'brand'
  | 'other';

export type CatalogTranslationInput = {
  id: string;
  nameAr: string;
  categoryAr?: string | null;
  categoryEn?: string | null;
  unit?: string | null;
  productType?: string | null;
};

export type CatalogTranslationSuggestion = {
  id: string;
  suggestedNameEn: string;
  classification: CatalogTranslationClassification;
  confidence: number;
  needsReview: boolean;
};

export type RawCatalogTranslation = {
  id?: unknown;
  suggestedNameEn?: unknown;
  classification?: unknown;
  confidence?: unknown;
  needsReview?: unknown;
};

const CLASSIFICATIONS = new Set<CatalogTranslationClassification>([
  'ingredient', 'beverage', 'cleaning', 'packaging', 'equipment', 'brand', 'other',
]);

export function buildCatalogTranslationPrompt(items: CatalogTranslationInput[]): string {
  return [
    'You translate Arabic restaurant catalog item names into concise professional English.',
    'Use the category, unit, and product type as context. Distinguish food ingredients, beverages, cleaning supplies, packaging, and equipment.',
    'Preserve recognized brand names, model codes, acronyms, and product codes. Transliterate only brands or genuinely ambiguous proper names.',
    'Do not add quantities, units, brands, or qualities that are not present in the Arabic name.',
    'Use title case for catalog names. Keep each result under 80 characters.',
    'Set needsReview=true when the Arabic name is ambiguous, abbreviated, mixed-language, or could have multiple restaurant meanings.',
    'Return exactly one translation for every supplied id and never invent ids.',
    `Items: ${JSON.stringify(items)}`,
  ].join('\n');
}

export function normalizeCatalogTranslations(
  raw: RawCatalogTranslation[] | undefined,
  inputs: CatalogTranslationInput[],
): CatalogTranslationSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const allowedIds = new Set(inputs.map((item) => item.id));
  const seen = new Set<string>();

  return raw.flatMap((item) => {
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const suggestedNameEn = typeof item.suggestedNameEn === 'string'
      ? item.suggestedNameEn.replace(/\s+/g, ' ').trim().slice(0, 80)
      : '';
    if (!id || !allowedIds.has(id) || seen.has(id) || !suggestedNameEn) return [];
    seen.add(id);
    const rawClassification = typeof item.classification === 'string'
      ? item.classification.trim().toLowerCase()
      : 'other';
    const classification = CLASSIFICATIONS.has(rawClassification as CatalogTranslationClassification)
      ? rawClassification as CatalogTranslationClassification
      : 'other';
    const parsedConfidence = typeof item.confidence === 'number' ? item.confidence : Number(item.confidence);
    const confidence = Number.isFinite(parsedConfidence)
      ? Math.max(0, Math.min(1, parsedConfidence))
      : 0;

    return [{
      id,
      suggestedNameEn,
      classification,
      confidence,
      needsReview: typeof item.needsReview === 'boolean' ? item.needsReview : confidence < 0.85,
    }];
  });
}
