export const EMPTY_DISPLAY_VALUE = '\u2014';

export type LocalizedDisplaySource = {
  name?: unknown;
  nameAr?: unknown;
  nameEn?: unknown;
};

export type DisplayLanguage = 'ar' | 'en' | string | null | undefined;

export function cleanDisplayPart(value: unknown): string {
  return value != null ? String(value).trim() : '';
}

export function localizedDisplayName(
  source: LocalizedDisplaySource | null | undefined,
  lang: DisplayLanguage,
  fallback = EMPTY_DISPLAY_VALUE,
): string {
  if (!source) return fallback;

  const name = cleanDisplayPart(source.name);
  const ar = cleanDisplayPart(source.nameAr) || name;
  const en = cleanDisplayPart(source.nameEn) || name;

  return (lang === 'en' ? en || name || ar : ar || name || en) || fallback;
}

export function localizedSecondaryDisplayName(
  source: LocalizedDisplaySource | null | undefined,
  lang: DisplayLanguage,
  fallback = EMPTY_DISPLAY_VALUE,
): string {
  if (!source) return fallback;

  const name = cleanDisplayPart(source.name);
  const ar = cleanDisplayPart(source.nameAr);
  const en = cleanDisplayPart(source.nameEn);
  const secondary = lang === 'en' ? ar || name : en || name;

  return secondary || fallback;
}
