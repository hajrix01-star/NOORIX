import { BadRequestException } from '@nestjs/common';

export const CLASSIFICATION_PACK_VERSION = 1;
export const IMPORT_MAX_TREE = 400;
export const IMPORT_MAX_RULES = 8000;

export type BankClassificationPackRow = {
  name: string;
  sortOrder: number;
  isActive: boolean;
  transactionSide: string;
  transactionType: string | null;
  parentKeywords: string[];
  classifications: { name: string; keywords: string[] }[];
};

export type BankClassificationRulePackRow = {
  keyword: string;
  matchType: string;
  categoryName: string;
  transactionSide: string;
  transactionType: string | null;
  isActive: boolean;
  priority: number;
};

export type BankClassificationExportPack = {
  version: number;
  exportedAt: string;
  treeCategories: BankClassificationPackRow[];
  classificationRules: BankClassificationRulePackRow[];
};

export function normalizeParentKeywordsJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
}

export function normalizeClassificationsJson(raw: unknown): { name: string; keywords: string[] }[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c: { name?: unknown; keywords?: unknown }) => ({
    name: String(c?.name ?? '').trim(),
    keywords: Array.isArray(c?.keywords)
      ? c.keywords.map((k: unknown) => String(k ?? '').toLowerCase().trim()).filter(Boolean)
      : [],
  }));
}

export function parseBankClassificationExportPack(pack: unknown): BankClassificationExportPack {
  if (!pack || typeof pack !== 'object') {
    throw new BadRequestException('ملف الحزمة غير صالح.');
  }
  const p = pack as Record<string, unknown>;
  if (p.version !== CLASSIFICATION_PACK_VERSION) {
    throw new BadRequestException('إصدار حزمة التصنيف غير مدعوم (يتوقع الإصدار 1).');
  }
  const rawTree = Array.isArray(p.treeCategories) ? p.treeCategories : [];
  const rawRules = Array.isArray(p.classificationRules) ? p.classificationRules : [];
  if (rawTree.length > IMPORT_MAX_TREE) {
    throw new BadRequestException(`عدد فئات الشجرة يتجاوز الحد (${IMPORT_MAX_TREE}).`);
  }
  if (rawRules.length > IMPORT_MAX_RULES) {
    throw new BadRequestException(`عدد القواعد يتجاوز الحد (${IMPORT_MAX_RULES}).`);
  }

  const treeCategories: BankClassificationPackRow[] = [];
  for (const row of rawTree) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const name = String(o.name ?? '').trim();
    if (!name) continue;
    const classifications = normalizeClassificationsJson(o.classifications);
    if (!classifications.length || classifications.every((c) => !c.keywords.length)) {
      throw new BadRequestException(`فئة الشجرة «${name}» بلا كلمات مفتاحية في التصنيفات.`);
    }
    treeCategories.push({
      name,
      sortOrder: Number.isFinite(Number(o.sortOrder)) ? Number(o.sortOrder) : 100,
      isActive: o.isActive !== false,
      transactionSide: String(o.transactionSide ?? 'any') || 'any',
      transactionType: o.transactionType == null || o.transactionType === '' ? null : String(o.transactionType),
      parentKeywords: Array.isArray(o.parentKeywords)
        ? o.parentKeywords.map((x: unknown) => String(x ?? '').toLowerCase().trim()).filter(Boolean)
        : [],
      classifications,
    });
  }

  const classificationRules: BankClassificationRulePackRow[] = [];
  for (const row of rawRules) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const keyword = String(o.keyword ?? '').trim();
    const categoryName = String(o.categoryName ?? '').trim();
    if (!keyword || !categoryName) continue;
    classificationRules.push({
      keyword,
      matchType: String(o.matchType ?? 'contains') || 'contains',
      categoryName,
      transactionSide: String(o.transactionSide ?? 'any') || 'any',
      transactionType: o.transactionType == null || o.transactionType === '' ? null : String(o.transactionType),
      isActive: o.isActive !== false,
      priority: Number.isFinite(Number(o.priority)) ? Number(o.priority) : 0,
    });
  }

  return {
    version: CLASSIFICATION_PACK_VERSION,
    exportedAt: typeof p.exportedAt === 'string' ? p.exportedAt : new Date().toISOString(),
    treeCategories,
    classificationRules,
  };
}
