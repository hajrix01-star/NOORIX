/**
 * OCR Matching Utility — مطابقة الأسماء بالتطبيع والخوارزميات
 * يستخدم Token Overlap أولاً ثم Levenshtein Distance
 */
import { tokenize, tokenizeDeep, normalize } from './ocr-normalize.util';

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
  const tokA = new Set(tokenize(textA));
  const tokB = new Set(tokenize(textB));
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
  const normA = normalize(textA);
  const normB = normalize(textB);

  if (normA === normB) return 1;

  const tokenScore = tokenOverlapScore(textA, textB);
  const levScore = levenshteinSimilarity(normA, normB);

  return tokenScore * 0.7 + levScore * 0.3;
}

/**
 * Deep Combined Similarity — يحذف حروف الجر والتعريف
 */
export function deepSimilarity(textA: string, textB: string): number {
  const tokA = new Set(tokenizeDeep(textA));
  const tokB = new Set(tokenizeDeep(textB));
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

  const normQuery = normalize(query);
  let best: MatchResult<T> | null = null;

  for (const candidate of candidates) {
    const name = getName(candidate);
    const normName = normalize(name);

    // مطابقة تامة
    if (normQuery === normName) {
      return { item: candidate, score: 1, method: 'exact' };
    }

    // مطابقة aliases
    if (getAliases) {
      const aliases = getAliases(candidate);
      for (const alias of aliases) {
        if (normalize(alias) === normQuery) {
          return { item: candidate, score: 0.98, method: 'alias' };
        }
        const aliasScore = combinedSimilarity(query, alias);
        if (aliasScore >= 0.95) {
          const result = { item: candidate, score: aliasScore * 0.97, method: 'alias' as const };
          if (!best || result.score > best.score) best = result;
        }
      }
    }

    // Combined similarity
    const score = Math.max(
      combinedSimilarity(query, name),
      deepSimilarity(query, name),
    );

    const method = score >= 0.85 ? 'token' : 'levenshtein';
    const result: MatchResult<T> = { item: candidate, score, method };
    if (!best || result.score > best.score) best = result;
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
