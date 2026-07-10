import { Prisma } from '@prisma/client';
import type { SpecialDayPeriod } from './dashboard-special-days.util';

export type DashboardCalendarTargets = {
  overall: number | null;
  byDow: Record<string, number>;
};

export type DashboardCalendarDayNotes = Record<string, string>;

export type DashboardCalendarData = {
  targets: DashboardCalendarTargets;
  specialDays: SpecialDayPeriod[];
  dayNotes: DashboardCalendarDayNotes;
};

export const DEFAULT_DASHBOARD_CALENDAR_TARGETS: DashboardCalendarTargets = {
  overall: null,
  byDow: {},
};

export const DEFAULT_DASHBOARD_CALENDAR_DATA: DashboardCalendarData = {
  targets: DEFAULT_DASHBOARD_CALENDAR_TARGETS,
  specialDays: [],
  dayNotes: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeCalendarTargets(value: unknown): DashboardCalendarTargets {
  if (!isRecord(value)) return DEFAULT_DASHBOARD_CALENDAR_TARGETS;

  const overall = finiteNumber(value.overall);
  const byDow: Record<string, number> = {};
  if (isRecord(value.byDow)) {
    for (const [key, raw] of Object.entries(value.byDow)) {
      const dow = Number(key);
      const amount = finiteNumber(raw);
      if (Number.isInteger(dow) && dow >= 0 && dow <= 6 && amount !== null && amount >= 0) {
        byDow[String(dow)] = amount;
      }
    }
  }

  return {
    overall: overall !== null && overall >= 0 ? overall : null,
    byDow,
  };
}

export function hasCalendarTargetOverride(targets: DashboardCalendarTargets): boolean {
  return targets.overall !== null || Object.keys(targets.byDow).length > 0;
}

export function normalizeCalendarSpecialDays(value: unknown): SpecialDayPeriod[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const fromDate = typeof item.fromDate === 'string' ? item.fromDate.trim() : '';
    const toDate = typeof item.toDate === 'string' ? item.toDate.trim() : '';
    const color = typeof item.color === 'string' && item.color.trim() ? item.color.trim() : '#8b5cf6';
    if (!id || !fromDate || !toDate) return [];
    return [{ id, name, fromDate, toDate, color }];
  });
}

export function normalizeCalendarDayNotes(value: unknown): DashboardCalendarDayNotes {
  if (!isRecord(value)) return {};
  const notes: DashboardCalendarDayNotes = {};
  for (const [date, note] of Object.entries(value)) {
    if (typeof note === 'string' && note.trim()) notes[date] = note.trim();
  }
  return notes;
}

export function calendarTargetsJson(value: DashboardCalendarTargets): Prisma.InputJsonValue {
  return {
    overall: value.overall,
    byDow: value.byDow,
  };
}

export function specialDaysJson(value: SpecialDayPeriod[]): Prisma.InputJsonValue {
  return value.map((item) => ({
    id: item.id,
    name: item.name,
    fromDate: item.fromDate,
    toDate: item.toDate,
    color: item.color,
  }));
}

export function dayNotesJson(value: DashboardCalendarDayNotes): Prisma.InputJsonValue {
  return value;
}
