import { Prisma } from '@prisma/client';
import {
  directoryIdentitySimilarity,
  matchesDirectorySearch,
  normalizeDirectoryText,
} from './supplier-directory-search.util';

export type DirectoryEntryRow = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string | null;
  aliases: Prisma.JsonValue;
  searchText: string;
  entityType: string;
  defaultCategoryCode: string;
  isTaxRegistered: boolean;
  taxNumber: string | null;
  supplierInvoiceNumberRequired: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type SupplierMatchRow = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  directoryEntryId: string | null;
  supplierCategoryId: string | null;
};

export const CANONICAL_CATEGORY_FALLBACKS: Record<string, {
  parentCode: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
}> = {
  'E2-8': {
    parentCode: 'EXP-002',
    nameAr: 'GOSI',
    nameEn: 'GOSI',
    sortOrder: 7,
  },
  'E2-10': {
    parentCode: 'EXP-002',
    nameAr: 'Ø±Ø³ÙˆÙ… Ù…Ù†ØµØ§Øª Ø­ÙƒÙˆÙ…ÙŠØ©',
    nameEn: 'Government Platform Fees',
    sortOrder: 9,
  },
  'E2-11': {
    parentCode: 'EXP-002',
    nameAr: 'Ø´Ù‡Ø§Ø¯Ø§Øª ØµØ­ÙŠØ© ÙˆØªØµØ§Ø±ÙŠØ­ Ù…ÙˆØ¸ÙÙŠÙ†',
    nameEn: 'Health Certificates & Employee Permits',
    sortOrder: 10,
  },
  'E4-1': {
    parentCode: 'EXP-004',
    nameAr: 'ØªØ°Ø§ÙƒØ± Ø³ÙØ± Ø§Ù„Ù…ÙˆØ¸ÙÙŠÙ†',
    nameEn: 'Employee Travel Tickets',
    sortOrder: 0,
  },
  'E4-2': {
    parentCode: 'EXP-004',
    nameAr: 'Ø§Ù„ØªØ£Ù…ÙŠÙ† Ø§Ù„Ø·Ø¨ÙŠ Ù„Ù„Ù…ÙˆØ¸ÙÙŠÙ†',
    nameEn: 'Employee Medical Insurance',
    sortOrder: 1,
  },
};

export function aliasesFromJson(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function entrySearchValues(entry: DirectoryEntryRow): string[] {
  return [entry.nameAr, entry.nameEn ?? '', ...aliasesFromJson(entry.aliases)];
}

function supplierSearchValues(supplier: SupplierMatchRow): string[] {
  return [supplier.nameAr, supplier.nameEn ?? ''];
}

export function supplierMatchesQuery(query: string | undefined, entry: DirectoryEntryRow): boolean {
  return matchesDirectorySearch(query, entrySearchValues(entry));
}

function supplierMatchScore(entry: DirectoryEntryRow, supplier: SupplierMatchRow): number {
  if (supplier.directoryEntryId && supplier.directoryEntryId !== entry.id) return 0;
  const entryValues = entrySearchValues(entry).map(normalizeDirectoryText).filter(Boolean);
  const supplierValues = supplierSearchValues(supplier).map(normalizeDirectoryText).filter(Boolean);
  if (supplier.directoryEntryId === entry.id) return 1;
  if (supplierValues.some((value) => entryValues.includes(value))) return 0.99;

  let best = 0;
  for (const supplierValue of supplierValues) {
    for (const entryValue of entryValues) {
      best = Math.max(best, directoryIdentitySimilarity(supplierValue, entryValue));
    }
  }
  return best;
}

export function rankSupplierDirectoryMatches(
  entry: DirectoryEntryRow,
  suppliers: SupplierMatchRow[],
): Array<{ supplier: SupplierMatchRow; score: number }> {
  return suppliers
    .map((supplier) => ({ supplier, score: supplierMatchScore(entry, supplier) }))
    .filter((match) => match.score >= 0.68)
    .sort((left, right) => right.score - left.score);
}
