const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

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
