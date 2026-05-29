/**
 * OCR Matching Utility — مطابقة الأسماء بالتطبيع والخوارزميات
 * يستخدم Token Overlap أولاً ثم Levenshtein Distance
 */
import { tokenize, tokenizeDeep, normalize } from './ocr-normalize.util';

const LEGAL_ENTITY_TOKENS_RE = /\b(company|co|ltd|limited|trading|store|market|corp|corporation|inc|llc|est|establishment|مؤسسة|شركه|شركة|محدودة|التجارية|تجاريه|تجاره|متجر|ماركت)\b/gi;

function normalizeForMatching(text: string): string {
  return normalize(text)
    .replace(/[|]/g, 'l')
    .replace(/&/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLegalEntityTokens(text: string): string {
  return normalizeForMatching(text).replace(LEGAL_ENTITY_TOKENS_RE, ' ').replace(/\s+/g, ' ').trim();
}

function compactText(text: string): string {
  return normalizeForMatching(text).replace(/\s+/g, '');
}

function toOcrConfusionVariant(text: string): string {
  // شائع في OCR للأسماء الإنجليزية: O↔0, I/L↔1, S↔5, B↔8, Z↔2
  return normalizeForMatching(text)
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/5/g, 's')
    .replace(/8/g, 'b')
    .replace(/2/g, 'z');
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Levenshtein Distance بين سلسلتين
 */
export function levenshtein(a: string, b: string): number {
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * نسبة تشابه Levenshtein (0–1)
 */
export function levenshteinSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - dist / maxLen;
}

/**
 * نسبة تداخل الـ tokens بين نصين (Jaccard-like)
 */
export function tokenOverlapScore(textA: string, textB: string): number {
  const tokA = new Set(tokenize(normalizeForMatching(textA)));
  const tokB = new Set(tokenize(normalizeForMatching(textB)));
  if (tokA.size === 0 && tokB.size === 0) return 1;
  if (tokA.size === 0 || tokB.size === 0) return 0;

  let matches = 0;
  for (const t of tokA) {
    if (tokB.has(t)) {
      matches++;
    } else {
      // مطابقة تقريبية لكل token (Levenshtein ≥ 0.8)
      for (const bt of tokB) {
        if (levenshteinSimilarity(t, bt) >= 0.8) {
          matches += 0.7;
          break;
        }
      }
    }
  }

  const union = tokA.size + tokB.size - matches;
  return matches / union;
}

/**
 * Combined Similarity Score (0–1)
 * يجمع Token Overlap (70%) + Levenshtein (30%)
 */
export function combinedSimilarity(textA: string, textB: string): number {
  const normA = normalizeForMatching(textA);
  const normB = normalizeForMatching(textB);

  if (normA === normB) return 1;

  const tokenScore = tokenOverlapScore(normA, normB);
  const levScore = levenshteinSimilarity(normA, normB);
  const ocrLevScore = levenshteinSimilarity(toOcrConfusionVariant(normA), toOcrConfusionVariant(normB));
  const compactA = compactText(normA);
  const compactB = compactText(normB);
  const compactScore = compactA && compactB ? levenshteinSimilarity(compactA, compactB) : 0;

  return clamp01(tokenScore * 0.5 + levScore * 0.25 + ocrLevScore * 0.2 + compactScore * 0.05);
}

/**
 * Deep Combined Similarity — يحذف حروف الجر والتعريف
 */
export function deepSimilarity(textA: string, textB: string): number {
  const tokA = new Set(tokenizeDeep(normalizeForMatching(textA)));
  const tokB = new Set(tokenizeDeep(normalizeForMatching(textB)));
  if (tokA.size === 0 && tokB.size === 0) return 1;
  if (tokA.size === 0 || tokB.size === 0) return 0;

  let matches = 0;
  for (const t of tokA) {
    if (tokB.has(t)) {
      matches++;
    } else {
      for (const bt of tokB) {
        if (levenshteinSimilarity(t, bt) >= 0.8) {
          matches += 0.7;
          break;
        }
      }
    }
  }

  const union = tokA.size + tokB.size - matches;
  return matches / union;
}

export interface MatchResult<T> {
  item: T;
  score: number;
  method: 'exact' | 'alias' | 'token' | 'levenshtein';
}

/**
 * يبحث عن أفضل مطابقة من قائمة كيانات
 * @param query النص المستخرج من OCR
 * @param candidates قائمة الكيانات
 * @param getName دالة لاستخراج الاسم من الكيان
 * @param getAliases دالة لاستخراج الأسماء البديلة (اختياري)
 */
export function findBestMatch<T>(
  query: string,
  candidates: T[],
  getName: (item: T) => string,
  getAliases?: (item: T) => string[],
): MatchResult<T> | null {
  if (!query || candidates.length === 0) return null;

  const normQuery = normalizeForMatching(query);
  const compactQuery = compactText(query);
  const queryVariants = Array.from(
    new Set([
      query,
      normQuery,
      stripLegalEntityTokens(query),
      compactQuery,
      toOcrConfusionVariant(query),
    ].filter((x) => !!x && x.length > 1)),
  );

  let best: MatchResult<T> | null = null;
  let secondBestScore = 0;

  for (const candidate of candidates) {
    const name = getName(candidate);
    const normName = normalizeForMatching(name);
    const compactName = compactText(name);

    // مطابقة تامة
    if (normQuery === normName || (compactQuery && compactName && compactQuery === compactName)) {
      return { item: candidate, score: 1, method: 'exact' };
    }

    let candidateBestScore = 0;
    let candidateBestMethod: MatchResult<T>['method'] = 'levenshtein';

    // مطابقة aliases
    if (getAliases) {
      const aliases = getAliases(candidate);
      for (const alias of aliases) {
        const normAlias = normalizeForMatching(alias);
        if (normAlias === normQuery || compactText(alias) === compactQuery) {
          return { item: candidate, score: 0.98, method: 'alias' };
        }
        for (const qv of queryVariants) {
          const aliasScore = Math.max(combinedSimilarity(qv, alias), deepSimilarity(qv, alias));
          const adjusted = clamp01(aliasScore * 0.99);
          if (adjusted > candidateBestScore) {
            candidateBestScore = adjusted;
            candidateBestMethod = 'alias';
          }
        }
      }
    }

    for (const qv of queryVariants) {
      const coreScore = Math.max(
        combinedSimilarity(qv, name),
        deepSimilarity(qv, name),
      );
      const strippedScore = Math.max(
        combinedSimilarity(stripLegalEntityTokens(qv), stripLegalEntityTokens(name)),
        deepSimilarity(stripLegalEntityTokens(qv), stripLegalEntityTokens(name)),
      );
      const score = clamp01(Math.max(coreScore, strippedScore * 0.98));
      if (score > candidateBestScore) {
        candidateBestScore = score;
        candidateBestMethod = score >= 0.84 ? 'token' : 'levenshtein';
      }
    }

    const result: MatchResult<T> = {
      item: candidate,
      score: candidateBestScore,
      method: candidateBestMethod,
    };
    if (!best || result.score > best.score) {
      secondBestScore = best?.score ?? secondBestScore;
      best = result;
    } else if (result.score > secondBestScore) {
      secondBestScore = result.score;
    }
  }

  if (best && best.score >= 0.9 && secondBestScore > 0 && best.score - secondBestScore <= 0.015) {
    // حماية من التطابقات المتقاربة جداً (مرشحان شبه متساويان)
    best = { ...best, score: clamp01(best.score - 0.03) };
  }

  return best;
}

/**
 * تحديد حالة المطابقة بناءً على الـ score
 */
export function classifyConfidence(score: number): 'auto' | 'review' | 'new' {
  if (score >= 0.95) return 'auto';
  if (score >= 0.70) return 'review';
  return 'new';
}
