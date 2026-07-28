const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

const DIRECTORY_IDENTITY_STOP_WORDS = new Set([
  'الوزاره',
  'وزاره',
  'الهييه',
  'هييه',
  'الشركه',
  'شركه',
  'الموسسه',
  'موسسه',
  'المديريه',
  'مديريه',
  'المركز',
  'مركز',
  'المنصه',
  'منصه',
  'الاعمال',
  'اعمال',
  'العامه',
  'عامه',
  'السعوديه',
  'الوطنيه',
  'وطنيه',
  'الاتصالات',
  'general',
  'ministry',
  'authority',
  'company',
  'platform',
  'business',
  'national',
  'saudi',
  'telecom',
  'telecommunication',
  'telecommunications',
]);

export function normalizeDirectoryText(value: unknown): string {
  return String(value ?? '')
    .toLocaleLowerCase('ar')
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function bigrams(value: string): Set<string> {
  const compact = value.replace(/\s+/g, '');
  if (compact.length < 2) return new Set(compact ? [compact] : []);
  const result = new Set<string>();
  for (let index = 0; index < compact.length - 1; index += 1) {
    result.add(compact.slice(index, index + 2));
  }
  return result;
}

export function directoryTextSimilarity(left: string, right: string): number {
  const a = bigrams(normalizeDirectoryText(left));
  const b = bigrams(normalizeDirectoryText(right));
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const pair of a) if (b.has(pair)) overlap += 1;
  return (2 * overlap) / (a.size + b.size);
}

function distinctiveIdentityTokens(value: string): string[] {
  return normalizeDirectoryText(value)
    .split(' ')
    .filter((token) => token.length > 1 && !DIRECTORY_IDENTITY_STOP_WORDS.has(token));
}

/**
 * Stricter than directory search: supplier identity matching must share a
 * distinctive word (or a very close spelling of one). This prevents generic
 * organization words such as "وزارة" from linking unrelated legal entities.
 */
export function directoryIdentitySimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeDirectoryText(left);
  const normalizedRight = normalizeDirectoryText(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const leftTokens = distinctiveIdentityTokens(normalizedLeft);
  const rightTokens = distinctiveIdentityTokens(normalizedRight);
  if (!leftTokens.length || !rightTokens.length) return 0;

  let hasExactDistinctiveToken = false;
  let hasSafeFuzzyDistinctiveToken = false;
  for (const leftToken of leftTokens) {
    for (const rightToken of rightTokens) {
      if (leftToken === rightToken) {
        hasExactDistinctiveToken = true;
        continue;
      }
      const tokenScore = directoryTextSimilarity(leftToken, rightToken);
      if (Math.min(leftToken.length, rightToken.length) >= 6 && tokenScore >= 0.86) {
        hasSafeFuzzyDistinctiveToken = true;
      }
    }
  }

  if (!hasExactDistinctiveToken && !hasSafeFuzzyDistinctiveToken) return 0;
  return directoryTextSimilarity(normalizedLeft, normalizedRight);
}

export function matchesDirectorySearch(
  query: string | undefined,
  values: Array<string | null | undefined>,
): boolean {
  const needle = normalizeDirectoryText(query);
  if (!needle) return true;

  const normalizedValues = values
    .map(normalizeDirectoryText)
    .filter(Boolean);
  const joined = normalizedValues.join(' ');
  if (joined.includes(needle)) return true;

  const tokens = needle.split(' ').filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => joined.includes(token))) return true;

  return normalizedValues.some((value) =>
    directoryTextSimilarity(needle, value) >= 0.48,
  );
}

export function isShamiTaxWorkspace(company: {
  nameAr?: string | null;
  nameEn?: string | null;
}): boolean {
  const names = [company.nameAr, company.nameEn]
    .map(normalizeDirectoryText)
    .map((value) => value.replace(/\s+/g, ''));
  return names.includes('shamitax');
}
