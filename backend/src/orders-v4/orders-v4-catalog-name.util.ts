import { BadRequestException } from '@nestjs/common';

export function ordersV4CatalogName(value: unknown, label: string): string {
  const name = String(value ?? '').trim().replace(/\s+/gu, ' ');
  if (!name) throw new BadRequestException(`${label} مطلوب`);
  return name;
}

export function ordersV4CatalogNameKey(value: unknown, label = 'اسم الصنف'): string {
  return ordersV4CatalogName(value, label).toLocaleLowerCase('ar');
}

export function ordersV4DuplicateItemMessage(nameAr: string, isActive: boolean): string {
  return isActive
    ? `يوجد صنف باسم "${nameAr}" بالفعل`
    : `يوجد صنف باسم "${nameAr}" بالفعل، وحالته معطل`;
}
