/** اسم المرسل لعرضه بجانب صورة OCR */
export function ocrSubmitterLabel(
  submittedBy:
    | { nameAr?: string | null; nameEn?: string | null; email?: string | null }
    | null
    | undefined,
  isAr: boolean,
): string {
  if (!submittedBy) return '';
  const primary = isAr ? submittedBy.nameAr : submittedBy.nameEn;
  const fallback = isAr ? submittedBy.nameEn : submittedBy.nameAr;
  return String(primary || fallback || submittedBy.nameAr || submittedBy.nameEn || submittedBy.email || '').trim();
}
