import { toYmd } from '../common/utils/to-ymd.util';

export function parseDateOnly(iso: string | undefined | null): Date | null {
  if (!iso || typeof iso !== 'string') return null;
  const s = toYmd(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addMonthsUtc(start: Date, months: number): Date {
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const day = start.getUTCDate();
  const lastDayOfTarget = new Date(Date.UTC(y, m + months + 1, 0)).getUTCDate();
  const newDay = Math.min(day, lastDayOfTarget);
  return new Date(Date.UTC(y, m + months, newDay));
}

export function utcToday(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

export function addDaysUtc(d: Date, days: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

export function daysBetweenUtc(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / 86400000);
}

export function computeWarrantyStorage(input: {
  purchaseDate: Date | null;
  warrantyMonths: number | null;
  warrantyStartDate: Date | null;
  warrantyEndDate: Date | null;
}): {
  warrantyStartDate: Date | null;
  warrantyEndDate: Date | null;
  warrantyMonths: number | null;
} {
  const monthsNum = input.warrantyMonths != null ? Number(input.warrantyMonths) : null;
  const start = input.warrantyStartDate ?? input.purchaseDate ?? null;
  let end = input.warrantyEndDate ?? null;
  if (!end && start && monthsNum != null && monthsNum > 0) {
    end = addMonthsUtc(start, monthsNum);
  }
  return {
    warrantyStartDate: start,
    warrantyEndDate: end,
    warrantyMonths: monthsNum,
  };
}
