/**
 * عرض اسم الموظف حسب لغة الواجهة.
 * القاعدة: الحقل `name` في النظام هو الاسم الأساسي (عادة عربي)، `nameEn` اختياري.
 */
export function employeeDisplayName(entity: any, lang: any, fallback: any = '—') {
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
