import { BadRequestException } from '@nestjs/common';

/** Accepts the shared date filter ISO value or a plain YYYY-MM-DD document date. */
export function ordersV4DateOnly(value: string, label: string): Date {
  const input = String(value ?? '').trim();
  const text = input.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new BadRequestException(`${label} غير صالح`);
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new BadRequestException(`${label} غير صالح`);
  }
  return date;
}

export function ordersV4RangeBounds(startDate?: string, endDate?: string): { gte?: Date; lte?: Date } {
  const bounds: { gte?: Date; lte?: Date } = {};
  if (startDate) bounds.gte = ordersV4DateOnly(startDate, 'تاريخ البداية');
  if (endDate) bounds.lte = ordersV4DateOnly(endDate, 'تاريخ النهاية');
  if (bounds.gte && bounds.lte && bounds.gte > bounds.lte) {
    throw new BadRequestException('نطاق التاريخ معكوس');
  }
  return bounds;
}
