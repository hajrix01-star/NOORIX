import type { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { normalize } from './ocr-normalize.util';

export type SupplierMatchRow = {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  aliases: Array<{ alias: string }>;
};

export type ItemMatchRow = {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  aliases: Array<{ alias: string }>;
};

const ARABIC_SCRIPT_RE = /[\u0600-\u06FF]/;

function detectAliasLanguage(text: string): 'ar' | 'en' {
  return ARABIC_SCRIPT_RE.test(text) ? 'ar' : 'en';
}

function shouldLearnAlias(
  rawAlias: string | undefined | null,
  canonical: string,
  altCanonical: string | null | undefined,
  existingAliases: Array<{ alias: string }>,
): string | null {
  const trimmed = rawAlias?.trim();
  if (!trimmed || trimmed.length < 3) return null;
  const normAlias = normalize(trimmed);
  if (!normAlias || normAlias.length < 2) return null;
  if (normalize(canonical) === normAlias) return null;
  if (altCanonical && normalize(altCanonical) === normAlias) return null;
  if (existingAliases.some((a) => normalize(a.alias) === normAlias)) return null;
  return trimmed;
}

export async function learnSupplierAliasIfNeeded(
  prisma: PrismaService,
  logger: Logger,
  suppliers: SupplierMatchRow[],
  supplierMatch: { id: string; score: number; status?: string } | null,
  rawAlias: string | undefined,
  seenKeys: Set<string>,
): Promise<void> {
  if (!supplierMatch || supplierMatch.score < 0.95 || supplierMatch.status !== 'auto') return;
  const matched = suppliers.find((s) => s.id === supplierMatch.id);
  if (!matched) return;

  const candidate = shouldLearnAlias(rawAlias, matched.nameAr, matched.nameEn, matched.aliases);
  if (!candidate) return;
  const normCandidate = normalize(candidate);
  const key = `${matched.id}:${normCandidate}`;
  if (seenKeys.has(key)) return;
  seenKeys.add(key);

  await prisma.ocrSupplierAlias
    .create({
      data: {
        supplierId: matched.id,
        alias: candidate,
        language: detectAliasLanguage(candidate),
        addedBy: 'ocr-auto',
      },
    })
    .catch(() => {});
  matched.aliases.push({ alias: candidate });
  logger.log(`OCR learned supplier alias "${candidate}" -> ${matched.id}`);
}

export async function learnItemAliasIfNeeded(
  prisma: PrismaService,
  logger: Logger,
  items: ItemMatchRow[],
  itemMatch: { id: string; score: number; status?: string } | null,
  rawAlias: string | undefined,
  seenKeys: Set<string>,
): Promise<void> {
  if (!itemMatch || itemMatch.score < 0.95 || itemMatch.status !== 'auto') return;
  const matched = items.find((i) => i.id === itemMatch.id);
  if (!matched) return;

  const candidate = shouldLearnAlias(rawAlias, matched.nameAr, matched.nameEn, matched.aliases);
  if (!candidate) return;
  const normCandidate = normalize(candidate);
  const key = `${matched.id}:${normCandidate}`;
  if (seenKeys.has(key)) return;
  seenKeys.add(key);

  await prisma.ocrItemAlias
    .create({
      data: {
        itemId: matched.id,
        alias: candidate,
        language: detectAliasLanguage(candidate),
        addedBy: 'ocr-auto',
      },
    })
    .catch(() => {});
  matched.aliases.push({ alias: candidate });
  logger.log(`OCR learned item alias "${candidate}" -> ${matched.id}`);
}
