import { combinedSimilarity, deepSimilarity } from './ocr-match.util';
import { normalize } from './ocr-normalize.util';
import { evaluateSizeGate, type OcrSizeGateResult } from './utils/ocr-size-gate.util';

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
const PACKAGING_SUFFIX_REGEX =
  /(?:^|\s)(?:شد(?:ة)?|ربطة|رزمة|كرتون|carton|ctn|pack|bundle|باك(?:يت)?)\s*\d+(?:[.,]\d+)?(?=\s|$)/gi;
const PACKAGING_COUNT_REGEX =
  /(?:^|\s)\d+(?:[.,]\d+)?\s*(?:حبة|حبات|pcs?|pc|cartons?|packs?)(?=\s|$)/gi;

const ARABIC_RANGE = /[\u0600-\u06FF]/;
const LATIN_RANGE  = /[A-Za-z]/;
const NON_CRITICAL_SEMANTIC_TOKENS = new Set([
  'فاخر',
  'مزايا',
  'اصلي',
  'اصليه',
  'صغير',
  'كبير',
  'وسط',
  'جديد',
  'قديم',
  'عرض',
  'خاص',
  'مفري',
  'عبوه',
  'حبه',
  'حبات',
  'قطعه',
  'قطع',
  'pack',
  'bundle',
  'ctn',
  'carton',
]);
const PACKAGING_TOKEN_RE =
  /^(?:شد(?:ه)?|ربطه|رزمة|كرتون|pack|bundle|ctn|carton|box|pcs?|pc)$/i;

function stripPackagingDescriptors(name: string): string {
  if (!name) return name;
  return name
    .replace(PACKAGING_SUFFIX_REGEX, ' ')
    .replace(PACKAGING_COUNT_REGEX, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function canonicalizeSemanticToken(token: string): string {
  let t = token.trim();
  if (!t) return '';
  if (t.length >= 4 && t.endsWith('ه')) t = t.slice(0, -1);
  if (t.length >= 5 && t.endsWith('ات')) t = t.slice(0, -2);
  return t;
}

function extractSemanticTokensForMatch(raw: string): string[] {
  const { cleanName } = extractSizeFromName(raw);
  const tokens = normalize(cleanName)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !/^\d+(?:[.,]\d+)?$/.test(t))
    .filter((t) => !PACKAGING_TOKEN_RE.test(t))
    .map(canonicalizeSemanticToken)
    .filter((t) => t.length > 1)
    .filter((t) => !NON_CRITICAL_SEMANTIC_TOKENS.has(t));

  return Array.from(new Set(tokens));
}

export type ItemMatchSemanticSignals = {
  queryCoverage: number;
  candidateCoverage: number;
  overlapCount: number;
  missingCriticalTokens: string[];
  autoEligible: boolean;
};

export type FindBestItemMatchOptions = {
  querySize?: string | number | null;
  queryUnit?: string | null;
};

function computeSemanticSignals(query: string, candidate: string): ItemMatchSemanticSignals {
  const qSet = new Set(extractSemanticTokensForMatch(query));
  const cSet = new Set(extractSemanticTokensForMatch(candidate));
  const overlapTokens = [...qSet].filter((t) => cSet.has(t));

  const overlapCount = overlapTokens.length;
  const queryCoverage = qSet.size ? overlapCount / qSet.size : 1;
  const candidateCoverage = cSet.size ? overlapCount / cSet.size : 1;
  const missingCriticalTokens = [...qSet].filter((t) => !cSet.has(t));

  const autoEligible =
    (qSet.size === 0 || cSet.size === 0 || overlapCount > 0) &&
    queryCoverage >= 0.75 &&
    candidateCoverage >= 0.6;

  return {
    queryCoverage,
    candidateCoverage,
    overlapCount,
    missingCriticalTokens,
    autoEligible,
  };
}

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
    cleanName = stripPackagingDescriptors(name.replace(packMatch[0], ' ').replace(/\s{2,}/g, ' ').trim());
    return { cleanName, size, sizeUnit };
  }

  SIMPLE_SIZE_REGEX.lastIndex = 0;
  const simpleMatch = SIMPLE_SIZE_REGEX.exec(name);
  if (simpleMatch) {
    size = simpleMatch[1].replace(',', '.');
    sizeUnit = simpleMatch[2].toLowerCase();
    cleanName = stripPackagingDescriptors(name.replace(simpleMatch[0], ' ').replace(/\s{2,}/g, ' ').trim());
    return { cleanName, size, sizeUnit };
  }

  return { cleanName: stripPackagingDescriptors(name.trim()), size: null, sizeUnit: null };
}

function inferCandidatePrimarySize(candidate: {
  nameAr: string;
  nameEn?: string | null;
  aliases: { alias: string }[];
}): { size: string; sizeUnit: string } | null {
  const probes = [
    candidate.nameAr,
    candidate.nameEn || '',
    ...candidate.aliases.map((a) => a.alias),
  ];
  for (const probe of probes) {
    const { size, sizeUnit } = extractSizeFromName(probe || '');
    if (size && sizeUnit) return { size, sizeUnit };
  }
  return null;
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
  options: FindBestItemMatchOptions = {},
): {
  item: typeof candidates[0];
  score: number;
  autoEligible: boolean;
  semantic: ItemMatchSemanticSignals;
  sizeGate: OcrSizeGateResult;
} | null {
  if (!query || candidates.length === 0) return null;

  const { cleanName: queryCleanName, size: extractedQuerySize, sizeUnit: extractedQueryUnit } = extractSizeFromName(query);
  const gateQuerySize = options.querySize ?? extractedQuerySize;
  const gateQueryUnit = options.queryUnit ?? extractedQueryUnit;
  const { ar: qAr, en: qEn, combined: qCombined } = normalizeItemForSearch(queryCleanName);
  const searchTerms = Array.from(new Set([queryCleanName, qAr, qEn, qCombined].filter(Boolean)));
  const querySemanticSource = qCombined || qAr || queryCleanName;
  const queryHasArabic = ARABIC_RANGE.test(querySemanticSource);
  const queryHasLatin = LATIN_RANGE.test(querySemanticSource);

  let best: {
    item: typeof candidates[0];
    score: number;
    autoEligible: boolean;
    semantic: ItemMatchSemanticSignals;
    sizeGate: OcrSizeGateResult;
  } | null = null;
  let secondBestScore = 0;

  for (const candidate of candidates) {
    const candidatePrimarySize = inferCandidatePrimarySize(candidate);
    const sizeGate = evaluateSizeGate(
      gateQuerySize,
      gateQueryUnit,
      candidatePrimarySize?.size ?? null,
      candidatePrimarySize?.sizeUnit ?? null,
      { candidateHasSizes: candidate.hasSizes },
    );

    const canonicalCandidateName = [candidate.nameAr, candidate.nameEn || ''].filter(Boolean).join(' ');
    const { ar: cAr, en: cEn, combined: cCombined } = normalizeItemForSearch(canonicalCandidateName);
    const canonicalSemanticTarget = queryHasArabic
      ? candidate.nameAr || canonicalCandidateName
      : queryHasLatin
        ? candidate.nameEn || candidate.nameAr || canonicalCandidateName
        : cCombined || canonicalCandidateName;
    const canonicalSemantic = computeSemanticSignals(querySemanticSource, canonicalSemanticTarget);
    const candidateNames = [
      canonicalCandidateName,
      cAr, cEn, cCombined,
      candidate.nameEn,
      ...candidate.aliases.map((a) => a.alias),
    ].filter((n): n is string => !!n);

    let maxScore = 0;
    let maxScoreSemantic: ItemMatchSemanticSignals = {
      queryCoverage: 0,
      candidateCoverage: 0,
      overlapCount: 0,
      missingCriticalTokens: [],
      autoEligible: false,
    };
    for (const sq of searchTerms) {
      if (!sq) continue;
      for (const cn of candidateNames) {
        if (!cn) continue;
        if (sq.length < 2 || cn.length < 2) continue;
        let s = Math.max(
          combinedSimilarity(sq, cn),
          deepSimilarity(sq, cn),
        );

        const semantic = computeSemanticSignals(sq, cn);
        if (!semantic.autoEligible) {
          s -= 0.12;
          if (s > 0.93) s = 0.93;
        } else if (semantic.queryCoverage < 0.9 || semantic.candidateCoverage < 0.85) {
          s -= 0.03;
        }

        if (s > 1) s = 1;
        if (s < 0) s = 0;
        if (s > maxScore) {
          maxScore = s;
          maxScoreSemantic = semantic;
        }
      }
    }

    const candidateAutoEligible = maxScoreSemantic.autoEligible && canonicalSemantic.autoEligible;
    if (!canonicalSemantic.autoEligible) {
      maxScore = Math.min(maxScore, 0.93);
      maxScoreSemantic = {
        ...maxScoreSemantic,
        queryCoverage: canonicalSemantic.queryCoverage,
        candidateCoverage: canonicalSemantic.candidateCoverage,
        overlapCount: canonicalSemantic.overlapCount,
        missingCriticalTokens: canonicalSemantic.missingCriticalTokens,
        autoEligible: false,
      };
    }

    const sizeAllowsAuto = sizeGate.decision === 'allow';
    const autoEligible = candidateAutoEligible && sizeAllowsAuto;

    if (maxScore >= 0.999 && autoEligible) {
      return {
        item: candidate,
        score: 1,
        autoEligible: true,
        semantic: maxScoreSemantic,
        sizeGate,
      };
    }
    if (!best || maxScore > best.score) {
      secondBestScore = best?.score ?? secondBestScore;
      best = {
        item: candidate,
        score: maxScore,
        autoEligible,
        semantic: maxScoreSemantic,
        sizeGate,
      };
    } else if (maxScore > secondBestScore) {
      secondBestScore = maxScore;
    }
  }

  if (best && best.score >= 0.9 && secondBestScore > 0 && best.score - secondBestScore <= 0.02) {
    best = { ...best, score: Math.max(0, best.score - 0.03) };
  }

  return best;
}
