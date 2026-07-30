import { BadRequestException } from '@nestjs/common';

export type CurrentAuthUser = { sub?: string; userId?: string; role?: string };

export function requireCurrentUserId(user: CurrentAuthUser): string {
  const userId = user.sub ?? user.userId;
  if (!userId) {
    throw new BadRequestException('Authenticated user id is required.');
  }
  return userId;
}

export function resolveCurrentUserRole(user: CurrentAuthUser): string | undefined {
  return user.role;
}

export function parseDaysQuery(days: string | undefined, fallback = 30): number {
  const parsed = Number.parseInt(String(days ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(365, Math.max(1, parsed));
}

export function parseRequiredYearMonth(
  year: string | undefined,
  month: string | undefined,
): { year: number; month: number } {
  if (!year || !month) {
    throw new BadRequestException('year and month are required.');
  }
  const y = Number.parseInt(year, 10);
  const m = Number.parseInt(month, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || y < 2000 || m < 1 || m > 12) {
    throw new BadRequestException('year or month is invalid.');
  }
  return { year: y, month: m };
}

export function parseOptionalYearMonth(
  year: string | undefined,
  month: string | undefined,
): { year?: number; month?: number } {
  const y = year ? Number.parseInt(year, 10) : undefined;
  const m = month ? Number.parseInt(month, 10) : undefined;
  if (year && (y === undefined || !Number.isFinite(y) || y < 2000)) {
    throw new BadRequestException('year or month is invalid.');
  }
  if (month && (m === undefined || !Number.isFinite(m) || m < 1 || m > 12)) {
    throw new BadRequestException('year or month is invalid.');
  }
  return { year: y, month: m };
}

export function parseRequiredDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
): { startDate: string; endDate: string } {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!startDate || !endDate || !datePattern.test(startDate) || !datePattern.test(endDate)) {
    throw new BadRequestException('startDate and endDate are required as YYYY-MM-DD.');
  }
  if (startDate > endDate) {
    throw new BadRequestException('startDate must be before or equal to endDate.');
  }
  return { startDate, endDate };
}
