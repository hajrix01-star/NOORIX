import { combinedSimilarity, deepSimilarity } from './ocr-match.util';

const SIZE_UNITS = ['kg', 'g', 'gr', 'gm', 'ml', 'l', 'ltr', 'liter', 'pcs', 'pc', 'كجم', 'كيلو', 'جرام', 'مل', 'لتر', 'حبة', 'علبة', 'كيس'];
const UNITS_PATTERN = SIZE_UNITS.join('|');

const PACK_SIZE_REGEX = new RegExp(
  `\\(?(\\d+)\\s*[xX×]\\s*(\\d+(?:[.,]\\d+)?)\\s*-?\\s*(${UNITS_PATTERN})\\s*-?[A-Z]?\\)?`,
  'gi',
);
const SIMPLE_SIZE_REGEX = new RegExp(
  `\\(?(\\d+(?:[.,]\\d+)?)\\s*-?\\s*(${UNITS_PATTERN})\\.?\\)?(?=\\s|$|[,)x×])`,
  'gi',
);

const ARABIC_RANGE = /[\u0600-\u06FF]/;
const LATIN_RANGE  = /[A-Za-z]/;

/** يقسّم الاسم المختلط إلى جزء عربي وجزء إنجليزي (يحذف الأرقام والرموز) */
export function splitBilingualName(name: string): { nameAr: string | null; nameEn: string | null } {
  if (!name) return { nameAr: null, nameEn: null };
  const hasAr = ARABIC_RANGE.test(name);
  const hasEn = LATIN_RANGE.test(name);
  if (!hasAr && !hasEn) return { nameAr: name, nameEn: null };
  if (hasAr && !hasEn)  return { nameAr: name, nameEn: null };
  if (!hasAr && hasEn)  return { nameAr: null, nameEn: name };

  const arTokens: string[] = [];
  const enTokens: string[] = [];
  name.split(/\s+/).forEach((token) => {
    const cleanToken = token.replace(/[()[\]{}_\-.,]/g, '');
    if (!cleanToken) return;
    if (ARABIC_RANGE.test(cleanToken)) arTokens.push(cleanToken);
    else if (LATIN_RANGE.test(cleanToken)) enTokens.push(cleanToken);
  });
  return {
    nameAr: arTokens.length ? arTokens.join(' ') : null,
    nameEn: enTokens.length ? enTokens.join(' ') : null,
  };
}

/**
 * يستخرج الحجم ووحدته من اسم الصنف ويُرجع الاسم مُنظَّفاً.
 */
export function extractSizeFromName(name: string): { cleanName: string; size: string | null; sizeUnit: string | null } {
  if (!name) return { cleanName: name, size: null, sizeUnit: null };

  let cleanName = name;
  let size: string | null = null;
  let sizeUnit: string | null = null;

  PACK_SIZE_REGEX.lastIndex = 0;
  const packMatch = PACK_SIZE_REGEX.exec(name);
  if (packMatch) {
    size = packMatch[2].replace(',', '.');
    sizeUnit = packMatch[3].toLowerCase();
    cleanName = name.replace(packMatch[0], ' ').replace(/\s{2,}/g, ' ').trim();
    return { cleanName, size, sizeUnit };
  }

  SIMPLE_SIZE_REGEX.lastIndex = 0;
  const simpleMatch = SIMPLE_SIZE_REGEX.exec(name);
  if (simpleMatch) {
    size = simpleMatch[1].replace(',', '.');
    sizeUnit = simpleMatch[2].toLowerCase();
    cleanName = name.replace(simpleMatch[0], ' ').replace(/\s{2,}/g, ' ').trim();
    return { cleanName, size, sizeUnit };
  }

  return { cleanName: name.trim(), size: null, sizeUnit: null };
}

/** يُطبّع اسم صنف للمقارنة الذكية */
export function normalizeItemForSearch(rawName: string): { ar: string; en: string; combined: string } {
  const { cleanName } = extractSizeFromName(rawName);
  const { nameAr, nameEn } = splitBilingualName(cleanName);
  const ar = nameAr?.trim() ?? '';
  const en = nameEn?.trim() ?? '';
  const combined = [ar, en].filter(Boolean).join(' ');
  return { ar, en, combined };
}

/**
 * بحث ذكي في قائمة أصناف — أعلى نسبة تشابه.
 */
export function findBestItemMatch(
  query: string,
  candidates: Array<{ id: string; nameAr: string; nameEn?: string | null; hasSizes: boolean; aliases: { alias: string }[] }>,
): { item: typeof candidates[0]; score: number } | null {
  if (!query || candidates.length === 0) return null;

  const { ar: qAr, en: qEn, combined: qCombined } = normalizeItemForSearch(query);
  const searchTerms = [query, qAr, qEn, qCombined].filter(Boolean);

  let best: { item: typeof candidates[0]; score: number } | null = null;

  for (const candidate of candidates) {
    const { ar: cAr, en: cEn, combined: cCombined } = normalizeItemForSearch(candidate.nameAr);
    const candidateNames = [
      candidate.nameAr,
      cAr, cEn, cCombined,
      candidate.nameEn,
      ...candidate.aliases.map((a) => a.alias),
    ].filter((n): n is string => !!n);

    let maxScore = 0;
    for (const sq of searchTerms) {
      if (!sq) continue;
      for (const cn of candidateNames) {
        if (!cn) continue;
        if (sq.length < 2 || cn.length < 2) continue;
        const s = Math.max(
          combinedSimilarity(sq, cn),
          deepSimilarity(sq, cn),
        );
        if (s > maxScore) maxScore = s;
      }
    }

    if (maxScore === 1) return { item: candidate, score: 1 };
    if (!best || maxScore > best.score) best = { item: candidate, score: maxScore };
  }

  return best;
}
