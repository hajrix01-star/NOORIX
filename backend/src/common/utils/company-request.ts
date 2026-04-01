/**
 * استخراج companyId للـ GET (وما شابه) مع أولوية query على الهيدر.
 * يتوافق مع CompanyAccessGuard (query قبل x-company-id).
 * يمنع إرجاع بيانات شركة خاطئة عندما يتأخر تحديث x-company-id في الواجهة عن ?companyId.
 */
export function preferQueryCompanyId(query?: string, header?: string): string {
  const q = query?.trim();
  if (q) return q;
  return header?.trim() || '';
}
