const EMPTY_DISPLAY_VALUE = '\u2014';

export type LocalizedDisplaySource = {
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

export type VaultDisplaySource = LocalizedDisplaySource;

function cleanDisplayPart(value: string | null | undefined) {
  return value != null ? String(value).trim() : '';
}

export function localizedDisplayName(
  source: LocalizedDisplaySource | null | undefined,
  lang: string,
  fallback = EMPTY_DISPLAY_VALUE,
) {
  if (!source) return fallback;

  const name = cleanDisplayPart(source.name);
  const ar = cleanDisplayPart(source.nameAr) || name;
  const en = cleanDisplayPart(source.nameEn) || name;

  return (lang === 'en' ? en || ar : ar || en) || fallback;
}

export function vaultDisplayName(vault: VaultDisplaySource | null | undefined, lang: string) {
  return localizedDisplayName(vault, lang);
}
