import { BadRequestException } from '@nestjs/common';
import { toYmd } from '../common/utils/to-ymd.util';

export function parseInvoiceDate(value: string | Date, fieldName = 'transactionDate') {
  const normalized = value instanceof Date ? value : new Date(toYmd(value));
  if (Number.isNaN(normalized.getTime())) {
    throw new BadRequestException(`Invalid ${fieldName}`);
  }
  return normalized;
}

export function parseInvoiceDayBoundary(value: string, boundary: 'start' | 'end') {
  const ymd = toYmd(value);
  const suffix = boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
  const date = new Date(`${ymd}${suffix}`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid ${boundary}Date`);
  }
  return date;
}
