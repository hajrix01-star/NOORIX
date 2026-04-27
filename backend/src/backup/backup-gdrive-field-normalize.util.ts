/** تطبيع قيم اختيارية من نماذج إعدادات النسخ (Google / مجلد). */
export function normOptionalTrimmedUrl(v: string | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  return t.length ? t : null;
}

export function normOptionalTrimmedFolderId(v: string | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  return t.length ? t : null;
}
