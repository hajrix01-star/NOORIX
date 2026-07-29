import {
  filterOrderCategoriesTemplateRows,
  filterOrderProductsTemplateRows,
  groupOrderProductImportRows,
  orderProductImportGroupsToPayload,
  type ImportRow,
  type OrderProductImportGroup,
} from '../../../utils/exportUtils';
import type {
  ApiParsedResult,
  OrderCatalogBatchCreateResult,
  OrderCategory,
  OrderCategoryPayload,
  OrderProduct,
  OrderProductPayload,
  OrderProductType,
  OrderProductVariant,
  OrderSection,
} from '../../../types/api';

export type RowStatus = 'new' | 'duplicate' | 'invalid';
export type Phase = 'upload' | 'parsing' | 'preview' | 'importing' | 'done';
export type FilterType = 'all' | RowStatus;

export interface ParsedRow {
  status: RowStatus;
  reason: string;
  nameAr: string;
  nameEn: string;
  category: string;
  sectionsSummary: string;
  variantsSummary: string;
  payload: OrderProductPayload | OrderCategoryPayload | null;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  invalid: number;
  error?: string;
}

export type BatchMutation<TPayload> = {
  mutate: (
    payload: TPayload[],
    options: {
      onSuccess: (data: ApiParsedResult<OrderCatalogBatchCreateResult>) => void;
      onError: (error: Error) => void;
    },
  ) => void;
  isPending?: boolean;
};

type TranslateFn = (key: string, vars?: unknown) => string;

type ParseOrdersImportRowsInput = {
  rawRows: ImportRow[];
  isProducts: boolean;
  productType: OrderProductType;
  needsImportSections: boolean;
  importSections: string[];
  knownSectionNames: string[];
  scopedProducts: OrderProduct[];
  categories: OrderCategory[];
  t: TranslateFn;
};

export type ParseOrdersImportRowsResult = {
  rows: ParsedRow[];
  categoryByName: Map<string, string>;
  newCategoriesToCreate: string[];
};

export function mutationCreatedCount(value: ApiParsedResult<OrderCatalogBatchCreateResult>, fallback: number): number {
  if (Array.isArray(value.data)) return value.data.length;
  const created = Number(value.data?.created ?? value.data?.count);
  return Number.isFinite(created) ? created : fallback;
}

export function mutationCreatedItems(value: ApiParsedResult<OrderCatalogBatchCreateResult>): Array<OrderProduct | OrderCategory> {
  if (Array.isArray(value.data)) return value.data;
  return Array.isArray(value.data?.items) ? value.data.items : [];
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function productPayloadVariants(payload: OrderProductPayload | OrderCategoryPayload | null): OrderProductVariant[] {
  if (!payload || !('variants' in payload) || !Array.isArray(payload.variants)) return [];
  return payload.variants;
}

export function productPayloadSections(payload: OrderProductPayload | OrderCategoryPayload | null): string[] {
  if (!payload || !('sections' in payload) || !Array.isArray(payload.sections)) return [];
  return payload.sections;
}

export function requirePayload(payload: OrderProductPayload | OrderCategoryPayload | null): OrderProductPayload | OrderCategoryPayload {
  if (!payload) throw new Error('Invalid empty import payload');
  return payload;
}

export function knownOrderSectionNames(sections: OrderSection[]): string[] {
  return sections.map((section) => String(section.nameAr ?? '').trim()).filter(Boolean);
}

function emptyCell(): string {
  return '-';
}

function groupNameAr(group: OrderProductImportGroup): string {
  return group.type === 'flat' ? group.nameAr : String(group.row.nameAr ?? group.row.name_ar ?? '');
}

function groupNameEn(group: OrderProductImportGroup): string {
  return group.type === 'flat' ? group.nameEn : String(group.row.nameEn ?? group.row.name_en ?? '');
}

function groupCategory(group: OrderProductImportGroup): string {
  return group.type === 'flat' ? group.category : String(group.row.category ?? group.row.categoryName ?? '');
}

function parseCategoryRows(rawRows: ImportRow[], categories: OrderCategory[], t: TranslateFn): ParsedRow[] {
  const existingNames = new Set(
    categories.map((category) => String(category.nameAr ?? '').trim().toLowerCase()),
  );

  return filterOrderCategoriesTemplateRows(rawRows).map((row): ParsedRow => {
    const nameAr = String(row.nameAr ?? row.name_ar ?? '').trim();
    const nameEn = String(row.nameEn ?? row.name_en ?? '').trim();
    const payload = { nameAr, nameEn: nameEn || undefined };

    if (!nameAr) {
      return {
        status: 'invalid',
        reason: t('importReasonMissingNameAr'),
        nameAr: emptyCell(),
        nameEn,
        category: '',
        sectionsSummary: '',
        variantsSummary: '',
        payload: null,
      };
    }

    if (existingNames.has(nameAr.toLowerCase())) {
      return {
        status: 'duplicate',
        reason: t('importReasonDuplicate'),
        nameAr,
        nameEn,
        category: '',
        sectionsSummary: '',
        variantsSummary: '',
        payload,
      };
    }

    return {
      status: 'new',
      reason: '',
      nameAr,
      nameEn,
      category: '',
      sectionsSummary: '',
      variantsSummary: '',
      payload,
    };
  });
}

function parseProductRows(input: ParseOrdersImportRowsInput): ParseOrdersImportRowsResult {
  const {
    rawRows,
    productType,
    categories,
    scopedProducts,
    knownSectionNames,
    importSections,
    needsImportSections,
    t,
  } = input;
  const categoryByName = new Map(
    categories.map((category) => [String(category.nameAr ?? '').trim().toLowerCase(), category.id]),
  );
  const existingNames = new Set(
    scopedProducts.map((product) => String(product.nameAr ?? '').trim().toLowerCase()),
  );
  const groups = groupOrderProductImportRows(filterOrderProductsTemplateRows(rawRows, productType));
  const payloads = orderProductImportGroupsToPayload(groups, categoryByName, productType, {
    knownSectionNames,
    defaultSections: importSections,
  });
  const payloadMap = new Map(payloads.map((payload) => [String(payload.nameAr).trim().toLowerCase(), payload]));
  const missingCategoryNames = new Map<string, string>();

  const rows = groups.map((group): ParsedRow => {
    const nameAr = groupNameAr(group).trim();
    const nameEn = groupNameEn(group).trim();
    const category = groupCategory(group).trim();

    if (!nameAr) {
      return {
        status: 'invalid',
        reason: t('importReasonMissingNameAr'),
        nameAr: emptyCell(),
        nameEn,
        category,
        sectionsSummary: '',
        variantsSummary: '',
        payload: null,
      };
    }

    const payload = payloadMap.get(nameAr.toLowerCase()) ?? null;
    const variantsSummary = productPayloadVariants(payload).length > 0
      ? t('importVariants', String(productPayloadVariants(payload).length))
      : emptyCell();
    const rowSections = productPayloadSections(payload);
    const sectionsSummary = rowSections.length > 0 ? rowSections.join(' / ') : emptyCell();

    const categoryKey = category.toLowerCase();
    let categoryNote = '';
    if (categoryKey && !categoryByName.has(categoryKey)) {
      missingCategoryNames.set(categoryKey, category);
      categoryNote = t('importReasonCategoryWillBeCreated');
    }

    if (needsImportSections && rowSections.length === 0) {
      return {
        status: 'invalid',
        reason: t('importReasonMissingSection'),
        nameAr,
        nameEn,
        category,
        sectionsSummary,
        variantsSummary,
        payload: null,
      };
    }

    if (existingNames.has(nameAr.toLowerCase())) {
      return {
        status: 'duplicate',
        reason: t('importReasonDuplicate') + (categoryNote ? ` - ${categoryNote}` : ''),
        nameAr,
        nameEn,
        category,
        sectionsSummary,
        variantsSummary,
        payload,
      };
    }

    return {
      status: 'new',
      reason: categoryNote,
      nameAr,
      nameEn,
      category,
      sectionsSummary,
      variantsSummary,
      payload,
    };
  });

  return {
    rows,
    categoryByName,
    newCategoriesToCreate: Array.from(missingCategoryNames.values()),
  };
}

export function parseOrdersImportRows(input: ParseOrdersImportRowsInput): ParseOrdersImportRowsResult {
  const result = input.isProducts
    ? parseProductRows(input)
    : {
        rows: parseCategoryRows(input.rawRows, input.categories, input.t),
        categoryByName: new Map<string, string>(),
        newCategoriesToCreate: [],
      };

  return {
    ...result,
    rows: result.rows.filter((row) => row.nameAr !== '' || row.nameEn !== '' || row.category !== ''),
  };
}
