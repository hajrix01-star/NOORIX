/**
 * تخزين لوحة التحكم — أهداف، أيام خاصة، ملاحظات الأيام
 * مفتاح التخزين يتضمن companyId, year, month للعزل
 */
import { readJsonStorage, writeJsonStorage } from '../../../utils/jsonStorage';

const TARGET_KEY = 'noorix-dashboard-sales-target';
const SPECIAL_DAYS_KEY = 'noorix-dashboard-special-days';
const DAY_NOTES_KEY = 'noorix-dashboard-day-notes';

function key(prefix: any, companyId: any, year: any, month: any) {
  return `${prefix}-${companyId}-${year}-${month}`;
}

export function getStoredTargets(companyId: any, year: any, month: any) {
  const parsed = readJsonStorage(key(TARGET_KEY, companyId, year, month), null);
  if (!parsed || typeof parsed !== 'object') return { overall: null, byDow: {} };
  return {
    overall: parsed.overall != null ? parseFloat(parsed.overall) : null,
    byDow: parsed.byDow && typeof parsed.byDow === 'object' ? parsed.byDow : {},
  };
}

export function setStoredTargets(companyId: any, year: any, month: any, data: any) {
  return writeJsonStorage(key(TARGET_KEY, companyId, year, month), data);
}

export function getStoredSpecialDays(companyId: any, year: any, month: any) {
  const list = readJsonStorage(key(SPECIAL_DAYS_KEY, companyId, year, month), null);
  if (!Array.isArray(list)) return [];
  return list.map((item: any) => {
    if (item.fromDate && item.toDate) return item;
    if (item.dateStr) {
      return {
        id: item.id || `sp-${item.dateStr}`,
        name: item.type === 'holiday' ? 'إجازة' : item.type === 'ramadan' ? 'رمضان' : 'فترة خاصة',
        fromDate: item.dateStr,
        toDate: item.dateStr,
        color: item.color || '#8b5cf6',
      };
    }
    return item;
  });
}

export function setStoredSpecialDays(companyId: any, year: any, month: any, days: any) {
  return writeJsonStorage(key(SPECIAL_DAYS_KEY, companyId, year, month), days);
}

export function getStoredDayNotes(companyId: any, year: any, month: any) {
  const parsed = readJsonStorage(key(DAY_NOTES_KEY, companyId, year, month), null);
  return parsed && typeof parsed === 'object' ? parsed : {};
}

export function setStoredDayNotes(companyId: any, year: any, month: any, notes: any) {
  return writeJsonStorage(key(DAY_NOTES_KEY, companyId, year, month), notes);
}
