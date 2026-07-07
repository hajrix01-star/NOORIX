/**
 * عرض اسم الموظف حسب لغة الواجهة.
 * القاعدة: الحقل `name` في النظام هو الاسم الأساسي (عادة عربي)، `nameEn` اختياري.
 */
export type EmployeeDisplayNameSource = object & {
  name?: unknown;
  nameAr?: unknown;
  nameEn?: unknown;
};

export type EmployeeDisplayLanguage = 'ar' | 'en' | string | null | undefined;

export function employeeDisplayName(
  entity: EmployeeDisplayNameSource | null | undefined,
  lang: EmployeeDisplayLanguage,
  fallback: string = '—',
) {
  if (entity == null) return fallback;
  const name = String(entity.name ?? '').trim();
  const nameAr = String(entity.nameAr ?? '').trim();
  const nameEn = String(entity.nameEn ?? '').trim();
  const primaryAr = nameAr || name;

  if (lang === 'en') {
    if (nameEn) return nameEn;
    return primaryAr || fallback;
  }
  return primaryAr || nameEn || fallback;
}
