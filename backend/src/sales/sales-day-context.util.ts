import { Prisma } from '@prisma/client';
import { toYmd } from '../common/utils/to-ymd.util';
import { normalizeCalendarSpecialDays } from '../dashboard/dashboard-calendar-contracts';
import type { SpecialDayPeriod } from '../dashboard/dashboard-special-days.util';
import type { TxClient } from '../financial-core/financial-core-helpers.util';

export type SalesDayContextSource = 'saudi' | 'school' | 'manual';
export type SalesDayContextType = 'occasion' | 'school_holiday' | 'special_day';

export type SalesDayContextEvent = {
  id: string;
  name: string;
  type: SalesDayContextType;
  source: SalesDayContextSource;
  fromDate: string;
  toDate: string;
  color: string;
};

export type SalesDayContextSnapshot = {
  version: 1;
  date: string;
  isSpecialDay: true;
  primary: SalesDayContextEvent;
  events: SalesDayContextEvent[];
};

function monthFromYmd(date: string): { year: number; month: number } | null {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}

function isDateInPeriod(date: string, period: SpecialDayPeriod): boolean {
  return period.fromDate <= date && date <= period.toDate;
}

function sourceFromId(id: string): SalesDayContextSource {
  if (id.startsWith('saudi-')) return 'saudi';
  if (id.startsWith('school-')) return 'school';
  return 'manual';
}

function typeFromSource(source: SalesDayContextSource): SalesDayContextType {
  if (source === 'saudi') return 'occasion';
  if (source === 'school') return 'school_holiday';
  return 'special_day';
}

function toEvent(period: SpecialDayPeriod): SalesDayContextEvent {
  const source = sourceFromId(period.id);
  return {
    id: period.id,
    name: period.name,
    type: typeFromSource(source),
    source,
    fromDate: period.fromDate,
    toDate: period.toDate,
    color: period.color,
  };
}

function eventRank(event: SalesDayContextEvent): number {
  if (event.source === 'manual') return 1;
  if (event.source === 'school') return 2;
  return 3;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isContextSource(value: unknown): value is SalesDayContextSource {
  return value === 'saudi' || value === 'school' || value === 'manual';
}

function isContextType(value: unknown): value is SalesDayContextType {
  return value === 'occasion' || value === 'school_holiday' || value === 'special_day';
}

function normalizeContextEvent(value: unknown): SalesDayContextEvent | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id : '';
  const name = typeof value.name === 'string' ? value.name : '';
  const type = isContextType(value.type) ? value.type : null;
  const source = isContextSource(value.source) ? value.source : null;
  const fromDate = typeof value.fromDate === 'string' ? value.fromDate : '';
  const toDate = typeof value.toDate === 'string' ? value.toDate : '';
  const color = typeof value.color === 'string' ? value.color : '#8b5cf6';
  if (!id || !name || !type || !source || !fromDate || !toDate) return null;
  return { id, name, type, source, fromDate, toDate, color };
}

export function normalizeSalesDayContextSnapshotInput(value: unknown): SalesDayContextSnapshot | null {
  if (!isRecord(value) || value.version !== 1 || value.isSpecialDay !== true) return null;
  const date = typeof value.date === 'string' ? value.date : '';
  const primary = normalizeContextEvent(value.primary);
  const events = Array.isArray(value.events)
    ? value.events.flatMap((event) => {
        const normalized = normalizeContextEvent(event);
        return normalized ? [normalized] : [];
      })
    : [];
  if (!date || !primary || events.length === 0) return null;
  return { version: 1, date, isSpecialDay: true, primary, events };
}

export function buildSalesDayContextSnapshot(
  dateInput: unknown,
  specialDaysInput: unknown,
): SalesDayContextSnapshot | null {
  const date = toYmd(dateInput);
  const events = normalizeCalendarSpecialDays(specialDaysInput)
    .filter((period) => isDateInPeriod(date, period))
    .map(toEvent)
    .sort((a, b) => eventRank(a) - eventRank(b) || a.fromDate.localeCompare(b.fromDate) || a.name.localeCompare(b.name));

  const primary = events[0];
  if (!date || !primary) return null;

  return {
    version: 1,
    date,
    isSpecialDay: true,
    primary,
    events,
  };
}

export function salesDayContextJson(snapshot: SalesDayContextSnapshot | null): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return snapshot === null ? Prisma.JsonNull : snapshot;
}

export async function resolveSalesDayContextSnapshot(
  tx: TxClient,
  companyId: string,
  transactionDate: Date,
): Promise<SalesDayContextSnapshot | null> {
  const date = toYmd(transactionDate);
  const parts = monthFromYmd(date);
  if (!parts) return null;

  const calendar = await tx.dashboardCalendarData.findUnique({
    where: {
      companyId_year_month: {
        companyId,
        year: parts.year,
        month: parts.month,
      },
    },
    select: { specialDays: true },
  });

  return buildSalesDayContextSnapshot(date, calendar?.specialDays);
}
