/**
 * تطبيع بيانات شجرة التصنيف — نفس منطق BankCategoryTreePanel الأصلي.
 */
export function normParentKeywords(v: unknown): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v.map((x) => String(x).toLowerCase()) : [];
}

export function normClassifications(
  raw: unknown,
): Array<{ name: string; keywords: string[] }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((c: { name?: string; keywords?: unknown }) => ({
    name: String(c?.name || ''),
    keywords: Array.isArray(c?.keywords)
      ? c.keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean)
      : [],
  }));
}
