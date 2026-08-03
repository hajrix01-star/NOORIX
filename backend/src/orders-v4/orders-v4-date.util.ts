import { BadRequestException } from '@nestjs/common';

/** Accepts the shared date filter ISO value or a plain YYYY-MM-DD value. */
export function ordersV4DateYmd(value: string, label: string): string {
  const input = String(value ?? '').trim();
  const text = input.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new BadRequestException(`${label} غير صالح`);
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new BadRequestException(`${label} غير صالح`);
  }
  return text;
}

/** Converts the validated shared date filter to the date-only database boundary. */
export function ordersV4DateOnly(value: string, label: string): Date {
  return new Date(`${ordersV4DateYmd(value, label)}T00:00:00.000Z`);
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

export function ordersV4SaudiToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function ordersV4RecentDateWindow(todayYmd = ordersV4SaudiToday(), inclusiveDays = 7): {
  startDate: string;
  endDate: string;
} {
  if (!Number.isInteger(inclusiveDays) || inclusiveDays < 1) {
    throw new BadRequestException('عدد أيام النطاق الحديث غير صالح');
  }
  const today = ordersV4DateOnly(todayYmd, 'تاريخ اليوم');
  today.setUTCDate(today.getUTCDate() - (inclusiveDays - 1));
  return { startDate: today.toISOString().slice(0, 10), endDate: todayYmd };
}
