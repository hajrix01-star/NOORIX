import { BadRequestException } from '@nestjs/common';
import { toYmd } from '../common/utils/to-ymd.util';

export function parseSaleDateYmd(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? '').trim());
  if (!m) throw new BadRequestException('تاريخ المبيعات غير صالح');
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function staffOrderDayKey(o: { saleDate?: Date | null; createdAt: Date }): string {
  return toYmd(o.saleDate ?? o.createdAt);
}
